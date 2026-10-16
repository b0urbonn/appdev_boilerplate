package expo.modules.appmonitor

import android.accessibilityservice.AccessibilityService
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.Display
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.view.accessibility.AccessibilityWindowInfo
import android.view.animation.Animation
import android.view.animation.ScaleAnimation
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import java.io.File
import java.io.FileOutputStream
import java.lang.ref.WeakReference
import java.util.UUID
import org.json.JSONObject

/**
 * Watches the user-selected apps. While one is in the foreground it shows a
 * floating bubble, captures the screen when it changes and hands each frame
 * to the JS "MaalamScan" headless task for analysis.
 */
class MaalamMonitorService : AccessibilityService() {

  companion object {
    const val PREFS = "maalam_monitor"
    @Volatile var instance: WeakReference<MaalamMonitorService>? = null

    fun reportResult(frameId: String, result: Map<String, Any?>?) {
      instance?.get()?.let { service ->
        Handler(Looper.getMainLooper()).post { service.onScanResult(frameId, result) }
      }
    }
  }

  private val handler = Handler(Looper.getMainLooper())
  private lateinit var windowManager: WindowManager
  private lateinit var prefs: SharedPreferences

  private var enabled = false
  private var packages = emptySet<String>()
  private var labels = emptyMap<String, String>()
  private var minIntervalMs = 8000L

  private var foregroundPkg: String? = null
  private var scanInFlight = false
  private var pendingScan = false
  private var inFlightFrameId: String? = null
  private var lastScanAt = 0L
  private var lastHash = 0L
  private var lastText = ""
  private var alertResult: Map<String, Any?>? = null

  private var bubbleView: View? = null
  private var alertBar: View? = null
  private var popupView: View? = null
  private var captureInFlight = false
  private var captureRequest = 0
  private var delayedCaptureTask: Runnable? = null
  private var restoreCaptureTask: Runnable? = null

  private val debounceScan = Runnable { tryScan() }
  private val hideAlertBarTask = Runnable { hideAlertBar() }
  private val watchdog = Runnable {
    inFlightFrameId?.let { frameId ->
      scanInFlight = false
      inFlightFrameId = null
      setBubbleState(if (alertResult != null) BubbleState.ALERT else BubbleState.IDLE)
      if (pendingScan) { pendingScan = false; tryScan() }
    }
  }

  private val prefListener = SharedPreferences.OnSharedPreferenceChangeListener { _, _ ->
    loadConfig()
    refreshBubble()
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  override fun onServiceConnected() {
    windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
    prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    prefs.registerOnSharedPreferenceChangeListener(prefListener)
    instance = WeakReference(this)
    loadConfig()
    onForegroundCandidate(null)
  }

  override fun onUnbind(intent: Intent?): Boolean {
    prefs.unregisterOnSharedPreferenceChangeListener(prefListener)
    handler.removeCallbacksAndMessages(null)
    removeOverlays()
    instance = null
    return super.onUnbind(intent)
  }

  override fun onInterrupt() {}

  private fun loadConfig() {
    enabled = prefs.getBoolean("enabled", false)
    packages = prefs.getStringSet("packages", emptySet()) ?: emptySet()
    minIntervalMs = prefs.getLong("minIntervalMs", 8000L)
    labels = try {
      val json = JSONObject(prefs.getString("labels", "{}") ?: "{}")
      json.keys().asSequence().associateWith { json.getString(it) }
    } catch (_: Exception) { emptyMap() }
  }

  // ── Accessibility events ─────────────────────────────────────────────────

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (event == null) return
    if (event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED ||
        event.eventType == AccessibilityEvent.TYPE_WINDOWS_CHANGED) {
      onForegroundCandidate(event.packageName?.toString())
      return
    }
    val pkg = event.packageName?.toString() ?: return
    if (pkg != foregroundPkg || !packages.contains(pkg)) return
    if (event.eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED ||
        event.eventType == AccessibilityEvent.TYPE_VIEW_SCROLLED) {
      scheduleScan()
    }
  }

  /** Only application windows can switch the monitored app. Bubble, keyboard,
   *  toast and system-window events must not dismiss the monitor. */
  private fun foregroundApplicationWindow(): AccessibilityWindowInfo? = runCatching {
    val appWindows = windows.filter { it.type == AccessibilityWindowInfo.TYPE_APPLICATION }
    appWindows.firstOrNull { it.isFocused }
      ?: appWindows.firstOrNull { it.isActive }
      ?: appWindows.firstOrNull()
  }.getOrNull()

  private fun onForegroundCandidate(eventPackage: String?) {
    val appWindow = foregroundApplicationWindow()
    val pkg = appWindow?.root?.packageName?.toString() ?: run {
      // A transient event can arrive before Android exposes the new window.
      // Keep the current app until an application window confirms the switch.
      val root = rootInActiveWindow ?: return
      if (root.window?.type != AccessibilityWindowInfo.TYPE_APPLICATION) return
      root.packageName?.toString() ?: eventPackage ?: return
    }
    if (pkg == "com.android.systemui" || pkg == imePackage()) return
    if (pkg == foregroundPkg) {
      refreshBubble()
      return
    }
    cancelCapture()
    handler.removeCallbacks(debounceScan)
    foregroundPkg = pkg
    lastHash = 0L
    lastText = ""
    refreshBubble()
    if (isMonitoredForeground()) scheduleScan()
  }

  private fun imePackage(): String? {
    val flat = Settings.Secure.getString(contentResolver, Settings.Secure.DEFAULT_INPUT_METHOD)
    return flat?.substringBefore('/')
  }

  private fun isMonitoredForeground() =
    enabled && foregroundPkg != null && packages.contains(foregroundPkg)

  private fun refreshBubble() {
    if (isMonitoredForeground()) showBubble() else removeOverlays()
  }

  // ── Scan scheduling ──────────────────────────────────────────────────────

  private fun scheduleScan() {
    handler.removeCallbacks(debounceScan)
    handler.postDelayed(debounceScan, 1500)
  }

  private fun tryScan() {
    if (!isMonitoredForeground() || popupView != null) return
    if (scanInFlight || captureInFlight) { pendingScan = true; return }
    val now = System.currentTimeMillis()
    val wait = minIntervalMs - (now - lastScanAt)
    if (wait > 0) {
      handler.postDelayed(debounceScan, wait)
      return
    }
    lastScanAt = now
    val text = collectText()
    if (Build.VERSION.SDK_INT >= 30) {
      captureScreenshot(text)
    } else {
      if (text.isBlank() || text == lastText) { finishScan(); return }
      lastText = text
      dispatchScan(UUID.randomUUID().toString(), null, text)
    }
  }

  @SuppressLint("NewApi")
  private fun captureScreenshot(text: String) {
    val pkg = foregroundPkg ?: return
    val window = foregroundApplicationWindow()
    val windowId = if (Build.VERSION.SDK_INT >= 34 &&
      window?.root?.packageName?.toString() == pkg) window.id else null
    val request = ++captureRequest
    captureInFlight = true
    // Always restore older Android's overlays, even if a screenshot callback
    // is delayed or never arrives. Window captures leave the bubble visible.
    restoreCaptureTask = Runnable {
      if (request == captureRequest) {
        cancelCapture()
        finishScan()
      }
    }.also { handler.postDelayed(it, 2000) }
    if (windowId != null) {
      doTakeScreenshot(text, pkg, request, windowId)
    } else {
      bubbleView?.visibility = View.INVISIBLE
      alertBar?.visibility = View.INVISIBLE
      delayedCaptureTask = Runnable {
        if (request == captureRequest) doTakeScreenshot(text, pkg, request, null)
      }.also { handler.postDelayed(it, 150) }
    }
  }

  private fun cancelCapture() {
    captureRequest++
    captureInFlight = false
    delayedCaptureTask?.let { handler.removeCallbacks(it) }
    restoreCaptureTask?.let { handler.removeCallbacks(it) }
    delayedCaptureTask = null
    restoreCaptureTask = null
    restoreOverlayVisibility()
  }

  private fun completeCapture(request: Int, pkg: String): Boolean {
    if (request != captureRequest) return false
    cancelCapture()
    return foregroundPkg == pkg && isMonitoredForeground()
  }

  private fun restoreOverlayVisibility() {
    bubbleView?.visibility = View.VISIBLE
    alertBar?.visibility = View.VISIBLE
  }

  @SuppressLint("NewApi")
  private fun doTakeScreenshot(text: String, pkg: String, request: Int, windowId: Int?) {
    val callback = object : TakeScreenshotCallback {
        override fun onSuccess(screenshot: ScreenshotResult) {
          if (!completeCapture(request, pkg)) {
            screenshot.hardwareBuffer.close()
            return
          }
          try {
            val hardware = Bitmap.wrapHardwareBuffer(screenshot.hardwareBuffer, screenshot.colorSpace)
            screenshot.hardwareBuffer.close()
            val source = hardware?.copy(Bitmap.Config.ARGB_8888, false)
            hardware?.recycle()
            if (source == null) { finishScan(); return }
            val scaled = scaleLongEdge(source, 768)
            if (scaled !== source) source.recycle()
            val hash = dHash(scaled)
            if (hamming(hash, lastHash) <= 4 && text == lastText && lastHash != 0L) {
              scaled.recycle()
              finishScan()
              return
            }
            lastHash = hash
            lastText = text
            val frameId = UUID.randomUUID().toString()
            val file = File(File(cacheDir, "monitor-frames").apply { mkdirs() }, "$frameId.jpg")
            FileOutputStream(file).use { scaled.compress(Bitmap.CompressFormat.JPEG, 80, it) }
            scaled.recycle()
            dispatchScan(frameId, "file://${file.absolutePath}", text)
          } catch (_: Exception) {
            finishScan()
          }
        }

        override fun onFailure(errorCode: Int) {
          if (!completeCapture(request, pkg)) return
          val frameText = text
          if (frameText.isBlank() || frameText == lastText) { finishScan(); return }
          lastText = frameText
          dispatchScan(UUID.randomUUID().toString(), null, frameText)
        }
      }
    try {
      if (Build.VERSION.SDK_INT >= 34 && windowId != null) {
        takeScreenshotOfWindow(windowId, mainExecutor, callback)
      } else {
        takeScreenshot(Display.DEFAULT_DISPLAY, mainExecutor, callback)
      }
    } catch (_: Exception) {
      callback.onFailure(ERROR_TAKE_SCREENSHOT_INTERNAL_ERROR)
    }
  }

  private fun dispatchScan(frameId: String, imageUri: String?, text: String) {
    val pkg = foregroundPkg ?: return finishScan()
    scanInFlight = true
    inFlightFrameId = frameId
    setBubbleState(BubbleState.SCANNING)
    handler.postDelayed(watchdog, 120_000)
    val extras = Bundle().apply {
      putString("frameId", frameId)
      putString("packageName", pkg)
      putString("appLabel", labels[pkg] ?: pkg)
      imageUri?.let { putString("imageUri", it) }
      putString("screenText", text)
      putDouble("capturedAt", System.currentTimeMillis().toDouble())
    }
    try {
      startService(Intent(this, MaalamScanTaskService::class.java).putExtras(extras))
    } catch (_: Exception) {
      handler.removeCallbacks(watchdog)
      scanInFlight = false
      inFlightFrameId = null
      setBubbleState(BubbleState.IDLE)
    }
  }

  /** Called from JS via AppMonitorModule.reportResult(). */
  fun onScanResult(frameId: String, result: Map<String, Any?>?) {
    if (frameId == inFlightFrameId) {
      handler.removeCallbacks(watchdog)
      scanInFlight = false
      inFlightFrameId = null
    }
    if (result != null) {
      alertResult = result
      setBubbleState(BubbleState.ALERT)
      showAlertBar(result)
    } else {
      setBubbleState(if (alertResult != null) BubbleState.ALERT else BubbleState.IDLE)
    }
    if (pendingScan) {
      pendingScan = false
      scheduleScan()
    }
  }

  private fun finishScan() {
    if (pendingScan) { pendingScan = false; scheduleScan() }
  }

  // ── Frame helpers ────────────────────────────────────────────────────────

  private fun collectText(): String {
    val root = foregroundApplicationWindow()?.root ?: rootInActiveWindow ?: return ""
    if (root.packageName?.toString() != foregroundPkg) return ""
    val out = StringBuilder()
    fun walk(node: AccessibilityNodeInfo?) {
      if (node == null || out.length >= 3000) return
      node.text?.let { if (it.isNotBlank()) { out.append(it); out.append('\n') } }
      node.contentDescription?.let { if (it.isNotBlank()) { out.append(it); out.append('\n') } }
      for (i in 0 until node.childCount) walk(node.getChild(i))
    }
    walk(root)
    return out.toString().take(3000).trim()
  }

  private fun scaleLongEdge(source: Bitmap, max: Int): Bitmap {
    val w = source.width
    val h = source.height
    val longEdge = maxOf(w, h)
    if (longEdge <= max) return source
    val scale = max.toFloat() / longEdge
    return Bitmap.createScaledBitmap(source, (w * scale).toInt().coerceAtLeast(1),
      (h * scale).toInt().coerceAtLeast(1), true)
  }

  /** 64-bit difference hash on a 9x8 grayscale grid. */
  private fun dHash(bitmap: Bitmap): Long {
    val small = Bitmap.createScaledBitmap(bitmap, 9, 8, true)
    val px = IntArray(72)
    small.getPixels(px, 0, 9, 0, 0, 9, 8)
    if (small !== bitmap) small.recycle()
    var hash = 0L
    for (y in 0 until 8) {
      for (x in 0 until 8) {
        val a = gray(px[y * 9 + x])
        val b = gray(px[y * 9 + x + 1])
        if (a < b) hash = hash or (1L shl (y * 8 + x))
      }
    }
    return hash
  }

  private fun gray(p: Int) =
    (Color.red(p) * 299 + Color.green(p) * 587 + Color.blue(p) * 114) / 1000

  private fun hamming(a: Long, b: Long) = java.lang.Long.bitCount(a xor b)

  // ── Overlay views ────────────────────────────────────────────────────────

  private enum class BubbleState { IDLE, SCANNING, ALERT }

  private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

  private fun overlayParams(w: Int, h: Int): WindowManager.LayoutParams =
    WindowManager.LayoutParams(
      w, h,
      WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
      PixelFormat.TRANSLUCENT
    ).apply { gravity = Gravity.TOP or Gravity.START }

  @SuppressLint("ClickableViewAccessibility")
  private fun showBubble() {
    if (bubbleView != null) return
    val size = dp(56)
    val bubble = TextView(this).apply {
      text = "🛡"
      textSize = 26f
      gravity = Gravity.CENTER
      background = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(Color.parseColor("#208AEF"))
        setStroke(dp(2), Color.WHITE)
      }
      elevation = dp(4).toFloat()
    }
    val params = overlayParams(size, size).apply { y = dp(140) }
    var downX = 0f; var downY = 0f; var startX = 0; var startY = 0; var moved = false
    val screenW = resources.displayMetrics.widthPixels
    bubble.setOnTouchListener { v, e ->
      when (e.action) {
        MotionEvent.ACTION_DOWN -> {
          downX = e.rawX; downY = e.rawY; startX = params.x; startY = params.y; moved = false
        }
        MotionEvent.ACTION_MOVE -> {
          val dx = (e.rawX - downX).toInt(); val dy = (e.rawY - downY).toInt()
          if (!moved && dx * dx + dy * dy > 100) moved = true
          if (moved) {
            params.x = startX + dx; params.y = startY + dy
            runCatching { windowManager.updateViewLayout(v, params) }
          }
        }
        MotionEvent.ACTION_UP -> {
          if (!moved) {
            onBubbleTap()
          } else {
            params.x = if (params.x + size / 2 < screenW / 2) 0 else screenW - size
            runCatching { windowManager.updateViewLayout(v, params) }
          }
        }
      }
      true
    }
    runCatching {
      windowManager.addView(bubble, params)
      bubbleView = bubble
      setBubbleState(if (alertResult != null) BubbleState.ALERT else BubbleState.IDLE)
    }
  }

  private fun setBubbleState(state: BubbleState) {
    val bubble = bubbleView as? TextView ?: return
    val color = if (state == BubbleState.ALERT) "#E5484D" else "#208AEF"
    (bubble.background as? GradientDrawable)?.setColor(Color.parseColor(color))
    bubble.clearAnimation()
    bubble.alpha = 1f
    bubble.contentDescription = when (state) {
      BubbleState.IDLE -> "Maalam protection active"
      BubbleState.SCANNING -> "Maalam is scanning this app"
      BubbleState.ALERT -> "Maalam detected potentially harmful content"
    }
    if (state == BubbleState.SCANNING) {
      bubble.startAnimation(ScaleAnimation(1f, 0.92f, 1f, 0.92f,
        Animation.RELATIVE_TO_SELF, 0.5f, Animation.RELATIVE_TO_SELF, 0.5f).apply {
        duration = 700
        repeatMode = Animation.REVERSE
        repeatCount = Animation.INFINITE
      })
    }
  }

  private fun onBubbleTap() {
    val result = alertResult
    if (result != null) showPopup(result)
    else Toast.makeText(this, "Maalam is protecting ${labels[foregroundPkg] ?: foregroundPkg ?: "this app"}", Toast.LENGTH_SHORT).show()
  }

  private fun showAlertBar(result: Map<String, Any?>) {
    alertBar?.let { runCatching { windowManager.removeView(it) } }
    alertBar = null
    handler.removeCallbacks(hideAlertBarTask)
    val verdict = (result["verdict"] as? String)?.replace('_', ' ') ?: "harmful content"
    val bar = TextView(this).apply {
      text = "⚠ Potential $verdict detected · Tap to view"
      setTextColor(Color.WHITE)
      textSize = 14f
      setPadding(dp(16), dp(12), dp(16), dp(12))
      setBackgroundColor(Color.parseColor("#E5484D"))
      setOnClickListener { showPopup(result) }
    }
    runCatching {
      windowManager.addView(bar, overlayParams(WindowManager.LayoutParams.MATCH_PARENT,
        WindowManager.LayoutParams.WRAP_CONTENT))
      alertBar = bar
    }
    handler.postDelayed(hideAlertBarTask, 8000)
  }

  private fun hideAlertBar() {
    alertBar?.let { runCatching { windowManager.removeView(it) } }
    alertBar = null
  }

  private fun showPopup(result: Map<String, Any?>) {
    if (popupView != null) return
    hideAlertBar()
    val pkg = foregroundPkg
    val root = FrameLayout(this).apply {
      setBackgroundColor(0x99000000.toInt())
      setOnClickListener { dismissPopup() }
    }
    val card = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(20), dp(20), dp(20), dp(20))
      background = GradientDrawable().apply {
        cornerRadius = dp(16).toFloat()
        setColor(Color.WHITE)
      }
      isClickable = true
    }
    fun text(str: String, size: Float, bold: Boolean = false, color: Int = Color.BLACK): TextView =
      TextView(this).apply {
        text = str
        textSize = size
        setTextColor(color)
        if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
      }

    card.addView(text("Deepfake, AI-generated or harmful content detected", 17f, true,
      Color.parseColor("#B42323")))
    fun num(v: Any?) = (v as? Number)?.toInt() ?: 0
    card.addView(text("${labels[pkg] ?: pkg ?: "App"} · ${num(result["confidence"])}% confidence",
      14f, color = Color.DKGRAY))
    @Suppress("UNCHECKED_CAST")
    val findings = result["findings"] as? List<Map<String, Any?>> ?: emptyList()
    for (f in findings) {
      val label = "${f["label"] ?: "Finding"} · ${(f["category"] as? String)?.replace('_', ' ') ?: ""} · ${num(f["confidence"])}%"
      card.addView(text(label, 14f, true))
      card.addView(text((f["description"] as? String) ?: "", 13f, color = Color.DKGRAY))
    }
    (result["summary"] as? String)?.takeIf { it.isNotBlank() }?.let {
      card.addView(text(it, 13f, color = Color.DKGRAY))
    }
    val buttons = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
    buttons.addView(text("Dismiss", 15f, true, Color.parseColor("#208AEF")).apply {
      setPadding(dp(16), dp(12), dp(16), dp(12))
      setOnClickListener { dismissPopup() }
    })
    buttons.addView(text("View in Maalam", 15f, true, Color.parseColor("#208AEF")).apply {
      setPadding(dp(16), dp(12), dp(16), dp(12))
      setOnClickListener { openInApp((result["detectionId"] as? String) ?: "") }
    })
    buttons.gravity = Gravity.END
    card.addView(buttons)

    val scroll = ScrollView(this).apply { addView(card) }
    val cardParams = FrameLayout.LayoutParams(
      FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT
    ).apply {
      gravity = Gravity.CENTER
      marginStart = dp(24); marginEnd = dp(24)
    }
    root.addView(scroll, cardParams)
    runCatching {
      val params = overlayParams(WindowManager.LayoutParams.MATCH_PARENT,
        WindowManager.LayoutParams.MATCH_PARENT)
      windowManager.addView(root, params)
      popupView = root
    }
  }

  private fun dismissPopup() {
    popupView?.let { runCatching { windowManager.removeView(it) } }
    popupView = null
    alertResult = null
    setBubbleState(BubbleState.IDLE)
  }

  private fun openInApp(detectionId: String) {
    dismissPopup()
    try {
      val intent = Intent(Intent.ACTION_VIEW, android.net.Uri.parse("maalam://detections/$detectionId"))
        .setPackage(packageName)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      startActivity(intent)
    } catch (_: Exception) {}
  }

  private fun removeOverlays() {
    cancelCapture()
    hideAlertBar()
    dismissPopup()
    bubbleView?.let { runCatching { windowManager.removeView(it) } }
    bubbleView = null
    alertResult = null
  }
}
