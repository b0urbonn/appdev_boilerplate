package expo.modules.appmonitor

import android.accessibilityservice.AccessibilityService
import android.annotation.SuppressLint
import android.app.KeyguardManager
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
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
import android.widget.EditText
import android.widget.ImageView
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Button
import org.json.JSONArray
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

    fun reportResult(frameId: String, result: Map<String, Any?>?, error: String?) {
      instance?.get()?.let { service ->
        Handler(Looper.getMainLooper()).post { service.onScanResult(frameId, result, error) }
      }
    }
  }

  private var bubbleGlyph: TextView? = null
  private var bubbleLabel: TextView? = null
  private var bubbleState = BubbleState.IDLE
  private var scanError: String? = null
  private var inFlightPackage: String? = null
  private var scanScheduled = false
  private var quickRequestId: String? = null
  private var quickReplyView: TextView? = null
  private var quickSend: Button? = null
  private var quickInput: EditText? = null
  private val quickHistory = JSONArray()
  private var quickPrompt = ""
  private var queuedQuickTask: Runnable? = null
  private val quickWatchdog = Runnable {
    if (quickRequestId != null) onQuickReply(quickRequestId!!, null, "The check timed out. Please try again.")
  }
  private val heartbeat = object : Runnable {
    override fun run() {
      if (!enabled) return
      onForegroundCandidate(null)
      if (isMonitoredForeground()) scheduleScan()
      handler.postDelayed(this, minIntervalMs)
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
  private var attachmentTargetPackage: String? = null
  private var reopenComposerPackage: String? = null
  private var stagedAttachmentUri: String? = null
  private var stagedAttachmentKind: String? = null
  private var quickDraft = ""
  private data class ManualFrame(val id: String, val uri: String, val text: String, val pkg: String, val at: Long)
  private var queuedManualFrame: ManualFrame? = null
  private var inFlightManualScan = false
  private var manualCapturePending = false
  private var scanNotice: String? = null
  private var captureInFlight = false
  private var captureRequest = 0
  private var delayedCaptureTask: Runnable? = null
  private var restoreCaptureTask: Runnable? = null

  private val debounceScan = Runnable { scanScheduled = false; tryScan() }
  private val hideAlertBarTask = Runnable { hideAlertBar() }
  private val watchdog = Runnable {
    if (inFlightFrameId != null) {
      scanInFlight = false
      inFlightFrameId = null
      inFlightPackage = null
      lastHash = 0L
      lastText = ""
      scanError = "Screen check timed out. Check Detector settings."
      finishScan()
    }
  }

  private val prefListener = SharedPreferences.OnSharedPreferenceChangeListener { _, _ ->
    loadConfig()
    refreshBubble()
    restartHeartbeat()
  }

  private fun restartHeartbeat() {
    handler.removeCallbacks(heartbeat)
    if (enabled) handler.postDelayed(heartbeat, minIntervalMs)
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  override fun onServiceConnected() {
    windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
    prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    prefs.registerOnSharedPreferenceChangeListener(prefListener)
    instance = WeakReference(this)
    loadConfig()
    onForegroundCandidate(null)
    restartHeartbeat()
  }

  override fun onUnbind(intent: Intent?): Boolean {
    prefs.unregisterOnSharedPreferenceChangeListener(prefListener)
    removeOverlays()
    handler.removeCallbacksAndMessages(null)
    instance = null
    return super.onUnbind(intent)
  }

  override fun onDestroy() {
    if (::prefs.isInitialized) prefs.unregisterOnSharedPreferenceChangeListener(prefListener)
    if (::windowManager.isInitialized) removeOverlays()
    handler.removeCallbacksAndMessages(null)
    instance = null
    super.onDestroy()
  }

  override fun onInterrupt() {}

  private fun loadConfig() {
    enabled = prefs.getBoolean("enabled", false)
    packages = prefs.getStringSet("packages", emptySet()) ?: emptySet()
    minIntervalMs = prefs.getLong("minIntervalMs", 8000L).coerceAtLeast(3000L)
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
    removeOverlays()
    handler.removeCallbacks(debounceScan)
    scanScheduled = false
    foregroundPkg = pkg
    scanError = null
    lastHash = 0L
    lastText = ""
    refreshBubble()
    if (isMonitoredForeground()) scheduleScan()
  }

  private fun imePackage(): String? {
    val flat = Settings.Secure.getString(contentResolver, Settings.Secure.DEFAULT_INPUT_METHOD)
    return flat?.substringBefore('/')
  }

  private fun isMonitoredForeground(): Boolean {
    val power = getSystemService(Context.POWER_SERVICE) as PowerManager
    val keyguard = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
    return enabled && power.isInteractive && !keyguard.isKeyguardLocked &&
      foregroundPkg != null && packages.contains(foregroundPkg)
  }

  private fun refreshBubble() {
    if (isMonitoredForeground()) {
      showBubble(); updateBubbleState()
      if (reopenComposerPackage == foregroundPkg) { reopenComposerPackage = null; showQuickChat() }
    } else removeOverlays()
  }

  // ── Scan scheduling ──────────────────────────────────────────────────────

  private fun scheduleScan() {
    // Keep the first deadline: continuous feed events must not starve scans.
    if (scanScheduled) return
    scanScheduled = true
    handler.postDelayed(debounceScan, 1000)
  }

  private fun tryScan() {
    if (!isMonitoredForeground() || popupView != null || quickRequestId != null) return
    if (scanInFlight || captureInFlight) { pendingScan = true; return }
    val now = SystemClock.elapsedRealtime()
    val wait = minIntervalMs - (now - lastScanAt)
    if (wait > 0) {
      if (!scanScheduled) { scanScheduled = true; handler.postDelayed(debounceScan, wait) }
      return
    }
    lastScanAt = now
    val text = collectText()
    if (Build.VERSION.SDK_INT >= 30) {
      captureScreenshot(text)
    } else {
      if (text.isBlank()) { scanError = "No readable text on this screen. Image scanning needs Android 11 or later."; finishScan(); return }
      if (text == lastText) { finishScan(); return }
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
    setBubbleState(BubbleState.CAPTURING)
    // Always restore older Android's overlays, even if a screenshot callback
    // is delayed or never arrives. Window captures leave the bubble visible.
    restoreCaptureTask = Runnable {
      if (request == captureRequest) {
        cancelCapture()
        scanError = "Screen capture timed out. Try again."
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
            if (source == null) { scanError = "This screen could not be captured."; finishScan(); return }
            val scaled = scaleLongEdge(source, 768)
            if (scaled !== source) source.recycle()
            val hash = dHash(scaled)
            if (!manualCapturePending && hamming(hash, lastHash) <= 4 && text == lastText && lastHash != 0L) {
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
            val uri = "file://${file.absolutePath}"
            if (manualCapturePending && scanInFlight) {
              queuedManualFrame = ManualFrame(frameId, uri, text, pkg, System.currentTimeMillis())
              scanNotice = "Screenshot captured. It will be checked as soon as the current scan finishes."
              showQuickChat()
              updateBubbleState()
            } else dispatchScan(frameId, uri, text, manual = manualCapturePending)
          } catch (_: Exception) {
            scanError = "This screen could not be captured."
            finishScan()
          }
        }

        override fun onFailure(errorCode: Int) {
          // Some social apps expose a window whose image cannot be captured.
          // Retry the display once, hiding our overlay; never bypass secure windows.
          if (windowId != null && request == captureRequest && foregroundPkg == pkg &&
              errorCode != ERROR_TAKE_SCREENSHOT_SECURE_WINDOW) {
            bubbleView?.visibility = View.INVISIBLE
            alertBar?.visibility = View.INVISIBLE
            delayedCaptureTask = Runnable {
              if (request == captureRequest) doTakeScreenshot(text, pkg, request, null)
            }.also { handler.postDelayed(it, 150) }
            return
          }
          if (!completeCapture(request, pkg)) return
          if (manualCapturePending) {
            scanError = "This app could not be captured. Attach a screenshot or media file instead."
            finishScan(); return
          }
          val frameText = text
          if (frameText.isBlank()) {
            scanError = "This app blocks screen capture and has no readable text. Attach content to check it."
            finishScan(); return
          }
          if (frameText == lastText) { finishScan(); return }
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

  private fun dispatchScan(frameId: String, imageUri: String?, text: String, manual: Boolean = false, capturedAt: Long = System.currentTimeMillis()) {
    val pkg = foregroundPkg ?: return finishScan()
    scanInFlight = true
    inFlightManualScan = manual
    inFlightFrameId = frameId
    inFlightPackage = pkg
    setBubbleState(BubbleState.SCANNING)
    handler.postDelayed(watchdog, 120_000)
    val extras = Bundle().apply {
      putString("frameId", frameId)
      putString("packageName", pkg)
      putString("appLabel", labels[pkg] ?: pkg)
      imageUri?.let { putString("imageUri", it) }
      putString("screenText", text)
      putDouble("capturedAt", capturedAt.toDouble())
    }
    try {
      startService(Intent(this, MaalamScanTaskService::class.java).putExtras(extras))
    } catch (_: Exception) {
      handler.removeCallbacks(watchdog)
      scanInFlight = false
      inFlightFrameId = null
      inFlightPackage = null
      scanError = "Could not start the screen check. Open Maalam and try again."
      lastHash = 0L
      lastText = ""
      finishScan()
    }
  }

  /** Called from JS via AppMonitorModule.reportResult(). */
  fun onScanResult(frameId: String, result: Map<String, Any?>?, error: String?) {
    // Ignore expired tasks and findings captured in an app we have since left.
    if (frameId != inFlightFrameId) return
    val sameApp = inFlightPackage == foregroundPkg && isMonitoredForeground()
    val manual = inFlightManualScan
    inFlightManualScan = false
    handler.removeCallbacks(watchdog)
    scanInFlight = false
    inFlightFrameId = null
    inFlightPackage = null
    if (sameApp) {
      scanError = error
      if (error != null) { lastHash = 0L; lastText = "" }
      if (result != null) {
        alertResult = result
        if (popupView == null) showAlertBar(result)
      }
    }
    if (manual) manualCapturePending = false
    if (manual && sameApp) {
      if (error == null && result == null) alertResult = null
      scanNotice = if (error == null && result == null) "Screen checked. No high-confidence alert was raised. This does not prove the content is authentic." else null
      if (result != null) showPopup(result) else showQuickChat()
    }
    finishScan()
  }

  private fun dispatchQueuedManualFrame(): Boolean {
    if (scanInFlight || captureInFlight || quickRequestId != null) return false
    val frame = queuedManualFrame ?: return false
    queuedManualFrame = null
    if (foregroundPkg != frame.pkg || !isMonitoredForeground()) {
      File(android.net.Uri.parse(frame.uri).path ?: "").delete()
      manualCapturePending = false
      return false
    }
    dismissPopup(false, resume = false)
    scanError = null
    scanNotice = null
    alertResult = null
    dispatchScan(frame.id, frame.uri, frame.text, manual = true, capturedAt = frame.at)
    return true
  }

  private fun updateBubbleState() {
    setBubbleState(when {
      captureInFlight -> BubbleState.CAPTURING
      scanInFlight -> BubbleState.SCANNING
      scanError != null -> BubbleState.ERROR
      alertResult != null -> BubbleState.ALERT
      else -> BubbleState.IDLE
    })
  }

  private fun finishScan() {
    if (dispatchQueuedManualFrame()) return
    if (manualCapturePending && !captureInFlight && queuedManualFrame == null && (!scanInFlight || !inFlightManualScan)) {
      manualCapturePending = false
      if (isMonitoredForeground()) showQuickChat()
    }
    updateBubbleState()
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

  private enum class BubbleState { IDLE, CAPTURING, SCANNING, ALERT, ERROR }

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
    val size = dp(84)
    val glyph = TextView(this).apply {
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
    val label = TextView(this).apply {
      textSize = 10f
      gravity = Gravity.CENTER
      setTextColor(Color.WHITE)
      setPadding(dp(4), dp(2), dp(4), dp(2))
      background = GradientDrawable().apply { cornerRadius = dp(8).toFloat(); setColor(0xDD16324F.toInt()) }
    }
    val bubble = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      isFocusable = true
      addView(glyph, LinearLayout.LayoutParams(dp(56), dp(56)))
      addView(label, LinearLayout.LayoutParams(size, dp(22)))
      setOnClickListener { onBubbleTap() }
    }
    val params = overlayParams(size, dp(80)).apply { y = dp(140) }
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
            params.x = (startX + dx).coerceIn(0, (screenW - size).coerceAtLeast(0)); params.y = (startY + dy).coerceIn(0, (resources.displayMetrics.heightPixels - dp(80)).coerceAtLeast(0))
            runCatching { windowManager.updateViewLayout(v, params) }
          }
        }
        MotionEvent.ACTION_UP -> {
          if (!moved) {
            v.performClick()
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
      bubbleGlyph = glyph
      bubbleLabel = label
      updateBubbleState()
    }
  }

  private fun setBubbleState(state: BubbleState) {
    if (state == bubbleState && bubbleLabel?.text?.isNotEmpty() == true) return
    bubbleState = state
    val glyph = bubbleGlyph ?: return
    val color = when (state) {
      BubbleState.ALERT -> "#E5484D"
      BubbleState.ERROR -> "#B7791F"
      BubbleState.CAPTURING, BubbleState.SCANNING -> "#7C3AED"
      else -> "#208AEF"
    }
    val label = when (state) {
      BubbleState.IDLE -> "Running"
      BubbleState.CAPTURING -> "Capturing"
      BubbleState.SCANNING -> "Scanning"
      BubbleState.ALERT -> "Content flagged"
      BubbleState.ERROR -> "Needs attention"
    }
    (glyph.background as? GradientDrawable)?.setColor(Color.parseColor(color))
    glyph.text = when (state) {
      BubbleState.CAPTURING, BubbleState.SCANNING -> "⟳"
      BubbleState.ALERT, BubbleState.ERROR -> "!"
      else -> "🛡"
    }
    bubbleLabel?.text = label
    bubbleView?.contentDescription = "Maalam: $label. Tap to chat, attach content or check a public URL."
    glyph.clearAnimation()
    if ((state == BubbleState.SCANNING || state == BubbleState.CAPTURING) && android.animation.ValueAnimator.areAnimatorsEnabled()) {
      glyph.startAnimation(ScaleAnimation(1f, 0.88f, 1f, 0.88f,
        Animation.RELATIVE_TO_SELF, 0.5f, Animation.RELATIVE_TO_SELF, 0.5f).apply {
        duration = 700
        repeatMode = Animation.REVERSE
        repeatCount = Animation.INFINITE
      })
    }
  }

  private fun onBubbleTap() {
    if (popupView != null) dismissPopup(false) else showQuickChat()
  }

  private fun captureScreenNow() {
    if (captureInFlight || manualCapturePending || quickRequestId != null) {
      quickReplyView?.text = "Your capture or message is already being checked. The current screenshot is kept until its scan finishes."
      return
    }
    if (Build.VERSION.SDK_INT < 30) {
      scanError = "Screen capture needs Android 11 or newer. Attach a screenshot instead."
      quickReplyView?.text = scanError
      return
    }
    dismissPopup(false, resume = false)
    handler.removeCallbacks(debounceScan)
    scanScheduled = false
    manualCapturePending = true
    scanNotice = null
    scanError = null
    pendingScan = false
    val targetPackage = foregroundPkg
    // Hide the composer/keyboard before collecting the target app's pixels.
    handler.postDelayed({
      if (manualCapturePending && foregroundPkg == targetPackage && isMonitoredForeground()) captureScreenshot(collectText())
      else { manualCapturePending = false; refreshBubble() }
    }, 350)
  }

  private fun showQuickChat() {
    if (popupView != null) return
    hideAlertBar()
    val card = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(18), dp(16), dp(18), dp(16))
      background = GradientDrawable().apply { cornerRadius = dp(22).toFloat(); setColor(Color.WHITE) }
      elevation = dp(12).toFloat()
    }
    fun line(value: String, size: Float = 14f) = TextView(this).apply {
      text = value; textSize = size; setTextColor(Color.parseColor("#16324F"))
      setPadding(0, dp(5), 0, dp(5))
    }
    card.addView(line("Ask Maalam", 20f))
    card.addView(line(scanError ?: scanNotice ?: when {
      scanInFlight -> "Scanning this screen…"
      alertResult != null -> "Content was flagged. View the finding below."
      else -> "Protection running · ${labels[foregroundPkg] ?: "this app"}"
    }))
    alertResult?.let { result ->
      card.addView(Button(this).apply {
        text = "View flagged content"
        setOnClickListener { dismissPopup(false); showPopup(result) }
      })
    }
    val reply = line(if (quickHistory.length() > 0) quickHistory.optJSONObject(quickHistory.length() - 1)?.optString("content") ?: "" else "Chat, paste a post or add a public URL to check for AI and harmful content.")
    val scroll = ScrollView(this).apply { addView(reply) }
    card.addView(scroll, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(140)))
    quickReplyView = reply
    val input = EditText(this).apply {
      hint = "Message or https://…"
      contentDescription = "Message or public URL"
      setTextColor(Color.parseColor("#16324F"))
      setHintTextColor(Color.DKGRAY)
      minLines = 2; maxLines = 4
      inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE
      filters = arrayOf(android.text.InputFilter.LengthFilter(5000))
    }
    input.setText(quickDraft)
    input.setSelection(input.text.length)
    quickInput = input
    card.addView(input)
    if (stagedAttachmentUri != null) {
      card.addView(line("Attached: ${stagedAttachmentKind ?: "file"} · press Send to scan"))
      card.addView(Button(this).apply { text = "Remove attachment"; setOnClickListener {
        clearStagedAttachment(); dismissPopup(false, resume = false); showQuickChat()
      } })
    }
    val buttons = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
    fun action(title: String, callback: () -> Unit) {
      buttons.addView(Button(this).apply { text = title; textSize = 12f; setOnClickListener { callback() } },
        LinearLayout.LayoutParams(0, dp(48), 1f))
    }
    action("Image") { pickOverlayAttachment("image") }
    action("Paste link") {
      input.requestFocus()
      val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
      val clip = clipboard.primaryClip
      val pasted = if (clip != null && clip.itemCount > 0) clip.getItemAt(0).coerceToText(this)?.toString() else null
      if (!pasted.isNullOrBlank()) {
        input.setText(pasted.take(5000)); input.setSelection(input.text.length)
      } else reply.text = "Copy the post link first, then tap Paste link. You can also touch and hold this message field to paste."
    }
    action("Send") { submitQuickChat(input.text.toString()) }
    quickSend = buttons.getChildAt(2) as Button
    if (quickRequestId != null) {
      quickSend?.isEnabled = false
      input.isEnabled = false
      reply.text = "Checking content…"
    }
    card.addView(buttons)
    val captureActions = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
    listOf("Capture screen" to { captureScreenNow() }, "Video" to { pickOverlayAttachment("video") }, "Audio" to { pickOverlayAttachment("audio") }).forEach { (title, callback) ->
      captureActions.addView(Button(this).apply {
        text = title; textSize = 12f
        isEnabled = quickRequestId == null
        setOnClickListener { callback() }
      }, LinearLayout.LayoutParams(0, dp(52), 1f))
    }
    card.addView(captureActions)
    card.addView(line("Paste a post or public link, attach a file, or capture this screen to scan it. Private links need a screenshot; a preview image is not the full video.", 12f))
    card.addView(Button(this).apply { text = "Close"; setOnClickListener { dismissPopup(false) } })
    val params = overlayParams((resources.displayMetrics.widthPixels - dp(24)).coerceAtLeast(dp(240)), WindowManager.LayoutParams.WRAP_CONTENT).apply {
      gravity = Gravity.CENTER
      flags = WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
      softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
    }
    val composer = ScrollView(this).apply {
      isFillViewport = true
      addView(card)
    }
    params.height = (resources.displayMetrics.heightPixels * 0.70f).toInt()
    runCatching {
      windowManager.addView(composer, params)
      popupView = composer
      if (android.animation.ValueAnimator.areAnimatorsEnabled()) {
        card.alpha = 0f; card.translationY = dp(24).toFloat()
        card.animate().alpha(1f).translationY(0f).setDuration(220).start()
      }
    }
  }

  private fun submitQuickChat(prompt: String) {
    if (manualCapturePending) {
      quickReplyView?.text = "Your screenshot is queued or being scanned. You can paste your next message now and send it when the screen check finishes."
      return
    }
    if ((prompt.isBlank() && stagedAttachmentUri == null) || quickRequestId != null) return
    val submitted = prompt.ifBlank { "Inspect this attached content for AI manipulation, deepfakes, and harmful content." }
    val id = UUID.randomUUID().toString()
    quickRequestId = id
    quickPrompt = submitted
    quickSend?.isEnabled = false
    quickInput?.isEnabled = false
    val task = object : Runnable {
      override fun run() {
        if (quickRequestId != id) return
        if (scanInFlight || captureInFlight) {
          quickReplyView?.text = "Finishing the screen scan before checking your message…"
          handler.postDelayed(this, 300)
          return
        }
        queuedQuickTask = null
        quickReplyView?.text = "Checking content…"
        handler.postDelayed(quickWatchdog, 120_000)
        try {
          startService(Intent(this@MaalamMonitorService, MaalamScanTaskService::class.java).apply {
            putExtra("frameId", id); putExtra("mode", "quickChat")
            putExtra("prompt", submitted); putExtra("history", quickHistory.toString())
            putExtra("attachmentUri", stagedAttachmentUri)
            putExtra("attachmentKind", stagedAttachmentKind)
          })
        } catch (_: Exception) {
          onQuickReply(id, null, "Could not start chat. Open Maalam and try again.")
        }
      }
    }
    queuedQuickTask = task
    handler.post(task)
  }

  fun onQuickReply(id: String, reply: String?, error: String?) {
    if (id != quickRequestId) return
    handler.removeCallbacks(quickWatchdog)
    quickRequestId = null
    queuedQuickTask?.let { handler.removeCallbacks(it) }
    queuedQuickTask = null
    quickSend?.isEnabled = true
    quickInput?.isEnabled = true
    quickReplyView?.text = error ?: reply ?: "No answer returned. Try again."
    if (reply != null && error == null) {
      quickHistory.put(JSONObject().put("role", "user").put("content", quickPrompt))
      quickHistory.put(JSONObject().put("role", "assistant").put("content", reply))
      while (quickHistory.length() > 6) quickHistory.remove(0)
      quickDraft = ""
      quickInput?.setText("")
      clearStagedAttachment()
    }
    if (popupView == null) scheduleScan()
  }

  private fun clearStagedAttachment() {
    stagedAttachmentUri?.let { uri ->
      runCatching {
        val file = File(android.net.Uri.parse(uri).path ?: "").canonicalFile
        if (file.parentFile == File(cacheDir, "monitor-attachments").canonicalFile) file.delete()
      }
    }
    stagedAttachmentUri = null
    stagedAttachmentKind = null
  }

  private fun pickOverlayAttachment(kind: String) {
    if (manualCapturePending || captureInFlight) { quickReplyView?.text = "Wait for your captured screenshot to finish checking before attaching another file."; return }
    if (quickRequestId != null) { quickReplyView?.text = "Wait for the current message check to finish."; return }
    attachmentTargetPackage = foregroundPkg
    dismissPopup(false, resume = false)
    try {
      startActivity(Intent(this, OverlayAttachmentActivity::class.java)
        .putExtra("kind", kind).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    } catch (_: Exception) {
      attachmentTargetPackage = null
      scanError = "Could not open the attachment picker."
      showQuickChat()
    }
  }

  fun onAttachmentPicked(uri: String?, kind: String, error: String?) {
    val target = attachmentTargetPackage
    attachmentTargetPackage = null
    if (uri != null) {
      clearStagedAttachment()
      stagedAttachmentUri = uri
      stagedAttachmentKind = kind
    }
    scanError = error
    reopenComposerPackage = target
    // The picker activity finishes back to the user's monitored app.
    handler.postDelayed({ refreshBubble() }, 500)
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
      (f["cropUri"] as? String)?.let { uri ->
        runCatching {
          val crop = File(android.net.Uri.parse(uri).path ?: "").canonicalFile
          if (crop.parentFile == File(filesDir, "detection-crops").canonicalFile) {
            val bitmap = BitmapFactory.decodeFile(crop.path)
            if (bitmap != null) {
              card.addView(text("Suspected region · OpenCV crop", 12f, color = Color.DKGRAY))
              card.addView(ImageView(this).apply {
                setImageBitmap(bitmap); scaleType = ImageView.ScaleType.FIT_CENTER
                contentDescription = "Suspected region: ${f["label"] ?: "finding"}"
              }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(160)))
            }
          }
        }
      }
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

  private fun dismissPopup(clearAlert: Boolean = true, resume: Boolean = true) {
    quickInput?.text?.toString()?.let { quickDraft = it }
    queuedQuickTask?.let {
      handler.removeCallbacks(it)
      queuedQuickTask = null
      quickRequestId = null
    }
    popupView?.let { runCatching { windowManager.removeView(it) } }
    popupView = null
    quickReplyView = null
    quickSend = null
    quickInput = null
    if (clearAlert) alertResult = null
    updateBubbleState()
    if (resume && isMonitoredForeground()) scheduleScan()
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
    queuedManualFrame?.let { File(android.net.Uri.parse(it.uri).path ?: "").delete() }
    queuedManualFrame = null
    manualCapturePending = false
    scanNotice = null
    cancelCapture()
    hideAlertBar()
    dismissPopup(resume = false)
    handler.removeCallbacks(debounceScan)
    scanScheduled = false
    bubbleView?.let { runCatching { windowManager.removeView(it) } }
    bubbleView = null
    bubbleGlyph = null
    bubbleLabel = null
    if (attachmentTargetPackage == null && reopenComposerPackage == null) {
      while (quickHistory.length() > 0) quickHistory.remove(0)
      quickDraft = ""
      if (quickRequestId == null) clearStagedAttachment()
    }
    alertResult = null
  }
}
