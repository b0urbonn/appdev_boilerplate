package expo.modules.appmonitor

import android.accessibilityservice.AccessibilityService
import android.annotation.SuppressLint
import android.app.KeyguardManager
import android.content.res.ColorStateList
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
import android.view.animation.AlphaAnimation
import android.view.animation.Animation
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
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

  private var bubbleIcon: ImageView? = null
  private var bubbleStatus: TextView? = null
  private var badgeDot: View? = null
  private var bubbleParams: WindowManager.LayoutParams? = null
  private var bubbleDockLeft = false
  private var bubbleState = BubbleState.IDLE
  private var scanError: String? = null
  private var inFlightPackage: String? = null
  private var scanScheduled = false
  private var quickRequestId: String? = null
  private var quickReplyView: TextView? = null
  private var quickSend: View? = null
  private var quickInput: EditText? = null
  private val quickChips = mutableListOf<View>()
  private var detectedLinks = emptyList<String>()
  private var detectedLinkIndex = -1
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
  // Live mode scans the monitored screen automatically as it changes;
  // manual mode only scans when the user taps Capture screen.
  private var liveMonitoring = true
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

  // Overlay palette + the big tools popup's live/manual segmented control.
  private var darkTheme = false
  private var utilityBarView: View? = null
  private var modeTrack: FrameLayout? = null
  private var modeKnob: View? = null
  private var modeToggleBg: GradientDrawable? = null
  private var modeLiveLabel: TextView? = null
  private var modeManualLabel: TextView? = null
  private var liveSection: View? = null
  private var manualSection: View? = null
  private var motionText: TextView? = null
  private var motionIcon: ImageView? = null
  private var verdictCard: View? = null
  private var chatThreadView: LinearLayout? = null
  private var chatScrollView: ScrollView? = null
  private var renderChat: (() -> Unit)? = null

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
    // Theme/config flips repaint an open tools popup in place.
    if (utilityBarView != null) { dismissPopup(false, resume = false); showUtilityBar() }
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
    darkTheme = prefs.getBoolean("darkTheme", false)
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
      if (reopenComposerPackage == foregroundPkg) { reopenComposerPackage = null; showUtilityBar() }
    } else removeOverlays()
  }

  // ── Scan scheduling ──────────────────────────────────────────────────────

  private fun scheduleScan() {
    if (!liveMonitoring) return
    // Keep the first deadline: continuous feed events must not starve scans.
    if (scanScheduled) return
    scanScheduled = true
    handler.postDelayed(debounceScan, 1000)
  }

  private fun tryScan() {
    if (!liveMonitoring || !isMonitoredForeground() || popupView != null || quickRequestId != null) return
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
              showUtilityBar()
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
      if (result != null) showPopup(result) else showUtilityBar()
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
      if (isMonitoredForeground()) showUtilityBar()
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

  private fun stateColor(state: BubbleState) = when (state) {
    BubbleState.ALERT -> "#FF6B63"
    BubbleState.ERROR -> "#FFB74D"
    BubbleState.CAPTURING, BubbleState.SCANNING -> "#B39DFF"
    else -> "#34C759"
  }

  private fun stateLabel(state: BubbleState) = when (state) {
    BubbleState.IDLE -> "Running"
    BubbleState.CAPTURING -> "Capturing"
    BubbleState.SCANNING -> "Scanning"
    BubbleState.ALERT -> "Flagged"
    BubbleState.ERROR -> "Attention"
  }

  // ── Overlay palette: mirrors the app's light/dark setting ──────────────

  private fun inkColor() = Color.parseColor(if (darkTheme) "#E8EEF5" else "#111111")
  private fun subColor() = Color.parseColor(if (darkTheme) "#9FB3C8" else "#6B6B70")
  private fun dimColor() = Color.parseColor(if (darkTheme) "#7E8FA3" else "#8E8E96")
  private fun accentColor() = Color.parseColor(if (darkTheme) "#208AEF" else "#0066CC")
  private fun manualOrange() = Color.parseColor("#D9822B")
  private fun cardColor() = if (darkTheme) 0xF4101C2E.toInt() else 0xF7FFFFFF.toInt()
  private fun cardStroke() = if (darkTheme) 0x29FFFFFF else 0x1F000000
  private fun chipBg() = if (darkTheme) 0xFF223146.toInt() else 0xFFE6E8EE.toInt()
  private fun chipInk() = if (darkTheme) Color.parseColor("#C9D6E4") else Color.parseColor("#3C3C44")
  private fun fieldBg() = if (darkTheme) 0xFF1B293E.toInt() else 0xFFF2F2F7.toInt()
  private fun fieldStroke() = if (darkTheme) 0x22FFFFFF else 0xFFD8D8DE.toInt()
  private fun replyBg() = if (darkTheme) 0xFF1B2740.toInt() else 0xFFEFF2F7.toInt()
  private fun logoBoxBg() = if (darkTheme) 0xFF18283C.toInt() else 0xFFE6E8EE.toInt()
  private fun logoBoxStroke() = if (darkTheme) 0x334FA3FF else 0xFFD8D8DE.toInt()
  private fun stagedChipBg() = if (darkTheme) 0xFF1B2C42.toInt() else 0xFFE8F1FC.toInt()
  private fun stagedChipStroke() = if (darkTheme) 0x444FA3FF else 0x660066CC
  private fun flagBg() = if (darkTheme) 0xFF4D1D22.toInt() else 0xFFFDEBEC.toInt()
  private fun flagStroke() = if (darkTheme) 0x66FF8A80 else 0x66B42323
  private fun flagInk() = Color.parseColor(if (darkTheme) "#FF8A80" else "#B42323")
  private fun scrimColor() = if (darkTheme) 0xB8050A12.toInt() else 0x8A000000.toInt()
  private fun bannerBg(live: Int) = (0x1F shl 24) or (live and 0x00FFFFFF)
  private fun bannerStroke(live: Int) = (0x4D shl 24) or (live and 0x00FFFFFF)

  private fun overlayCard(cornerDp: Int = 20) = GradientDrawable().apply {
    cornerRadius = dp(cornerDp).toFloat()
    setColor(cardColor())
    setStroke(dp(1), cardStroke())
  }

  private fun tintedIcon(resId: Int, color: Int) =
    getDrawable(resId)?.mutate()?.apply { setTint(color) }

  private fun applyRipple(view: View) {
    runCatching {
      val a = obtainStyledAttributes(intArrayOf(android.R.attr.selectableItemBackgroundBorderless))
      view.foreground = a.getDrawable(0)
      a.recycle()
    }
  }

  /** Compact circular FAB: a 44dp circle with a state-colored ring, the
   *  shield icon centred, and a small red badge dot for alerts. Draggable
   *  along the screen edge; taps open the tools. */
  @SuppressLint("ClickableViewAccessibility")
  private fun showBubble() {
    if (bubbleView != null) return
    val shield = ImageView(this).apply {
      setImageDrawable(tintedIcon(R.drawable.ic_shield, Color.parseColor(stateColor(BubbleState.IDLE))))
      scaleType = ImageView.ScaleType.FIT_CENTER
    }
    val status = TextView(this).apply {
      textSize = 11.5f
      maxLines = 1
      setTextColor(Color.parseColor(stateColor(BubbleState.IDLE)))
    }
    // Badge dot: 8dp red circle positioned at the top-right of the FAB.
    val badge = View(this).apply {
      background = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(Color.parseColor("#FF6B63"))
      }
      visibility = View.GONE
    }
    val fab = FrameLayout(this).apply {
      isFocusable = true
      background = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(cardColor())
        setStroke(dp(3), Color.parseColor(stateColor(BubbleState.IDLE)))
      }
      elevation = dp(6).toFloat()
      addView(shield, FrameLayout.LayoutParams(dp(16), dp(16), Gravity.CENTER))
      addView(badge, FrameLayout.LayoutParams(dp(8), dp(8)).apply {
        gravity = Gravity.TOP or Gravity.END
        topMargin = dp(2)
        marginEnd = dp(2)
      })
      setOnClickListener { onBubbleTap() }
    }
    val params = overlayParams(dp(44), dp(44)).apply { y = dp(140) }
    val screenW = resources.displayMetrics.widthPixels
    val screenH = resources.displayMetrics.heightPixels
    var downX = 0f; var downY = 0f; var startX = 0; var startY = 0; var moved = false
    fab.setOnTouchListener { v, e ->
      val w = v.width
      val h = v.height
      when (e.action) {
        MotionEvent.ACTION_DOWN -> {
          downX = e.rawX; downY = e.rawY; startX = params.x; startY = params.y; moved = false
        }
        MotionEvent.ACTION_MOVE -> {
          val dx = (e.rawX - downX).toInt(); val dy = (e.rawY - downY).toInt()
          if (!moved && dx * dx + dy * dy > 100) moved = true
          if (moved) {
            params.x = (startX + dx).coerceIn(0, (screenW - w).coerceAtLeast(0))
            params.y = (startY + dy).coerceIn(0, (screenH - h).coerceAtLeast(0))
            runCatching { windowManager.updateViewLayout(v, params) }
          }
        }
        MotionEvent.ACTION_UP -> {
          if (!moved) v.performClick() else dockBubble(v)
        }
      }
      true
    }
    runCatching {
      windowManager.addView(fab, params)
      bubbleView = fab
      bubbleIcon = shield
      bubbleStatus = status
      badgeDot = badge
      bubbleParams = params
      fab.post { dockBubble(fab) }
      updateBubbleState()
    }
  }

  /** Snap the circular FAB flush against whichever screen edge it is nearest to. */
  private fun dockBubble(view: View) {
    val params = bubbleParams ?: return
    val screenW = resources.displayMetrics.widthPixels
    val fabW = dp(44)
    bubbleDockLeft = params.x + fabW / 2 < screenW / 2
    params.x = if (bubbleDockLeft) dp(4) else (screenW - fabW - dp(4)).coerceAtLeast(0)
    runCatching { windowManager.updateViewLayout(view, params) }
  }

  private fun liveStatusLabel() =
    if (bubbleState == BubbleState.IDLE && !liveMonitoring) "Manual" else stateLabel(bubbleState)

  private fun liveStatusColor() =
    Color.parseColor(if (bubbleState == BubbleState.IDLE && !liveMonitoring) "#FFB74D" else stateColor(bubbleState))

  private fun setBubbleState(state: BubbleState) {
    if (state == bubbleState && bubbleStatus?.text?.isNotEmpty() == true) return
    bubbleState = state
    val shield = bubbleIcon ?: return
    val status = bubbleStatus ?: return
    val color = liveStatusColor()
    shield.setColorFilter(color)
    status.text = "· ${liveStatusLabel()}"
    status.setTextColor(color)
    (bubbleView?.background as? GradientDrawable)?.apply {
      setColor(cardColor())
      setStroke(dp(3), color)
    }
    badgeDot?.visibility = if (state == BubbleState.ALERT) View.VISIBLE else View.GONE
    bubbleView?.contentDescription =
      "Maalam monitor: ${stateLabel(state)}. Tap to open Maalam tools."
    shield.clearAnimation()
    if ((state == BubbleState.SCANNING || state == BubbleState.CAPTURING) &&
        android.animation.ValueAnimator.areAnimatorsEnabled()) {
      shield.startAnimation(AlphaAnimation(1f, 0.25f).apply {
        duration = 450
        repeatMode = Animation.REVERSE
        repeatCount = Animation.INFINITE
      })
    }
  }

  private fun onBubbleTap() {
    if (popupView != null) dismissPopup(false) else showUtilityBar()
  }

  /** Live = real-time auto scans; Manual = scans only run from Capture
   *  screen. An open tools popup animates the big mode switch in place. */
  private fun setLiveMonitoring(live: Boolean) {
    if (liveMonitoring == live) return
    liveMonitoring = live
    if (!live) {
      handler.removeCallbacks(debounceScan)
      scanScheduled = false
      pendingScan = false
    }
    // Force a pill repaint even when the bubble state itself did not change.
    bubbleStatus?.text = ""
    updateBubbleState()
    if (utilityBarView != null) applyModeUi(animate = true)
    else if (live && isMonitoredForeground()) scheduleScan()
  }

  /** Slides the knob, recolors the toggle, crossfades the active-mode label
   *  and swaps the manual tools section for the live status hint. */
  private fun applyModeUi(animate: Boolean) {
    positionModeKnob(animate)
    val from = if (liveMonitoring) manualOrange() else accentColor()
    val to = if (liveMonitoring) accentColor() else manualOrange()
    modeToggleBg?.let { bg ->
      if (animate && android.animation.ValueAnimator.areAnimatorsEnabled()) {
        android.animation.ValueAnimator.ofArgb(from, to).apply {
          duration = 260
          addUpdateListener { bg.setColor(it.animatedValue as Int) }
          start()
        }
      } else bg.setColor(to)
    }
    modeLiveLabel?.animate()?.alpha(if (liveMonitoring) 1f else 0f)?.setDuration(200)?.start()
    modeManualLabel?.animate()?.alpha(if (liveMonitoring) 0f else 1f)?.setDuration(200)?.start()
    // Standalone verdict card only shows in live mode; manual shows it in-thread.
    verdictCard?.visibility = if (liveMonitoring) View.VISIBLE else View.GONE
    val live = liveStatusColor()
    motionText?.text = when {
      scanInFlight || captureInFlight -> "Analyzing stream in real-time…"
      liveMonitoring -> "Active Guard · Live protection active"
      else -> "Manual Mode · Ready to inspect on demand"
    }
    motionText?.setTextColor(live)
    motionIcon?.setColorFilter(live)
    swapSection(liveSection, liveMonitoring, animate)
    swapSection(manualSection, !liveMonitoring, animate)
    if (!liveMonitoring) autofillVisibleLink()
  }

  private fun positionModeKnob(animate: Boolean) {
    val track = modeTrack ?: return
    val knob = modeKnob ?: return
    val inset = dp(5)
    val w = track.width
    val knobW = dp(36)
    if (w <= knobW + inset * 2) { track.post { positionModeKnob(animate) }; return }
    // Live = on → knob at right edge; Manual = off → knob at left edge.
    val target = if (liveMonitoring) (w - knobW - inset * 2).toFloat() else 0f
    if (animate && android.animation.ValueAnimator.areAnimatorsEnabled()) {
      knob.animate().translationX(target).setDuration(260).start()
    } else knob.translationX = target
  }

  private fun swapSection(section: View?, show: Boolean, animate: Boolean) {
    section ?: return
    if (!animate || !android.animation.ValueAnimator.areAnimatorsEnabled()) {
      section.visibility = if (show) View.VISIBLE else View.GONE
      return
    }
    if (show) {
      section.visibility = View.VISIBLE
      section.alpha = 0f
      section.translationY = dp(8).toFloat()
      section.animate().alpha(1f).translationY(0f).setDuration(220).start()
    } else {
      section.animate().alpha(0f).translationY(dp(8).toFloat()).setDuration(160)
        .withEndAction {
          section.visibility = View.GONE
          section.alpha = 1f
          section.translationY = 0f
        }.start()
    }
  }

  /** Mini verdict card: verdict + confidence + summary with "View result"
   *  (full report) and "Open app ›" (deep link into Maalam) actions. Used
   *  standalone in live mode and inside the chat thread in manual mode. */
  private fun verdictBubbleView(result: Map<String, Any?>): View {
    val ink = inkColor()
    val accent = accentColor()
    fun tv(str: String, size: Float, color: Int, bold: Boolean = false) =
      TextView(this).apply {
        text = str
        textSize = size
        setTextColor(color)
        if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
      }
    val flag = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(12), dp(10), dp(12), dp(10))
      background = GradientDrawable().apply {
        cornerRadius = dp(14).toFloat()
        setColor(flagBg())
        setStroke(dp(1), flagStroke())
      }
    }
    val flagTop = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
    }
    flagTop.addView(ImageView(this).apply {
      setImageDrawable(tintedIcon(R.drawable.ic_warning, flagInk()))
      scaleType = ImageView.ScaleType.FIT_CENTER
    }, LinearLayout.LayoutParams(dp(16), dp(16)))
    val verdictName = (result["verdict"] as? String)?.replace('_', ' ')?.uppercase() ?: "FLAGGED"
    val verdictConf = (result["confidence"] as? Number)?.toInt() ?: 0
    flagTop.addView(tv("$verdictName · $verdictConf%", 12.5f, flagInk(), true).apply {
      setPadding(dp(7), 0, 0, 0)
      maxLines = 1
      ellipsize = android.text.TextUtils.TruncateAt.END
    }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
    flag.addView(flagTop)
    flag.addView(tv((result["summary"] as? String) ?: "Potential issue flagged on this screen.",
      13f, ink).apply {
      maxLines = 2
      ellipsize = android.text.TextUtils.TruncateAt.END
      setPadding(0, dp(4), 0, 0)
    })
    val flagActions = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.END
    }
    flagActions.addView(tv("View result", 14f, accent, true).apply {
      setPadding(dp(8), dp(8), dp(8), dp(4))
      setOnClickListener { dismissPopup(false); showPopup(result) }
      applyRipple(this)
    })
    (result["detectionId"] as? String)?.takeIf { it.isNotBlank() }?.let { id ->
      flagActions.addView(tv("Open app ›", 14f, accent, true).apply {
        setPadding(dp(8), dp(8), dp(8), dp(4))
        setOnClickListener { openInApp(id) }
        applyRipple(this)
      })
    }
    flag.addView(flagActions, LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT,
      LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply { topMargin = dp(4) })
    return flag
  }

  private fun scrollChatToEnd() {
    chatScrollView?.post { chatScrollView?.fullScroll(View.FOCUS_DOWN) }
  }

  private val screenUrlPattern = Regex(
    "(?:https?://|www\\.)[^\\s<>\"'|{}\\[\\]`]+",
    RegexOption.IGNORE_CASE
  )

  /** URLs in the monitored app's node tree, mapped to the top edge of the
   *  node that showed them. With visibleOnly, off-screen and scrolled-away
   *  nodes are skipped so the result tracks what is actually on screen. */
  private fun collectScreenLinks(visibleOnly: Boolean): Map<String, Int> {
    val found = mutableMapOf<String, Int>()
    val root = foregroundApplicationWindow()?.root ?: rootInActiveWindow ?: return found
    if (root.packageName?.toString() != foregroundPkg) return found
    runCatching { root.refresh() }
    val screenW = resources.displayMetrics.widthPixels
    val screenH = resources.displayMetrics.heightPixels
    val rect = android.graphics.Rect()
    fun harvest(text: CharSequence, top: Int) {
      screenUrlPattern.findAll(text).forEach { match ->
        val url = match.value.trimEnd('.', ',', ';', ':', '!', '?', ')', ']', '}', '"', '\'', '»')
        if (url.length > 8 && (found[url]?.let { top < it } != false)) found[url] = top
      }
    }
    fun walk(node: AccessibilityNodeInfo?) {
      if (node == null) return
      node.getBoundsInScreen(rect)
      val onScreen = node.isVisibleToUser && rect.intersects(0, 0, screenW, screenH)
      if (!visibleOnly || onScreen) {
        node.text?.let { harvest(it, rect.top) }
        node.contentDescription?.let { harvest(it, rect.top) }
      }
      for (i in 0 until node.childCount) walk(node.getChild(i))
    }
    walk(root)
    return found
  }

  /** Re-reads the live screen each call: visible links ordered top-first so
   *  the post the user is looking at wins, then any link in the tree, then
   *  the clipboard. The boolean marks whether a link was seen on screen. */
  private fun findLinks(): Pair<List<String>, Boolean> {
    val ranked = collectScreenLinks(visibleOnly = true)
      .ifEmpty { collectScreenLinks(visibleOnly = false) }
    val links = ranked.entries.sortedBy { it.value }.map { it.key }.take(8)
    if (links.isNotEmpty()) return links to true
    val clip = runCatching {
      val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
      clipboard.primaryClip?.takeIf { it.itemCount > 0 }
        ?.getItemAt(0)?.coerceToText(this)?.toString()
    }.getOrNull()
    val clipLinks = mutableListOf<String>()
    if (!clip.isNullOrBlank()) {
      screenUrlPattern.findAll(clip).forEach { match ->
        val url = match.value.trimEnd('.', ',', ';', ':', '!', '?', ')', ']', '}', '"', '\'', '»')
        if (url.length > 8 && !clipLinks.contains(url)) clipLinks.add(url)
      }
    }
    return clipLinks.take(8) to false
  }

  /** Fills the composer with a link visible on the monitored screen right
   *  now. The screen is re-read on every tap, so it follows the user as they
   *  scroll; repeated taps cycle through every link found. */
  private fun detectScreenUrl() {
    if (quickRequestId != null) return
    val (urls, onScreen) = findLinks()
    if (urls.isEmpty()) {
      detectedLinks = emptyList()
      detectedLinkIndex = -1
      quickReplyView?.text = "No link visible on this screen — tap Capture screen to check what you are watching, or copy the post link and press Paste."
      return
    }
    if (urls != detectedLinks) { detectedLinks = urls; detectedLinkIndex = -1 }
    detectedLinkIndex = (detectedLinkIndex + 1) % urls.size
    val raw = urls[detectedLinkIndex]
    val url = if (raw.startsWith("www.", ignoreCase = true)) "https://$raw" else raw
    quickInput?.setText(url)
    quickInput?.setSelection(url.length)
    quickReplyView?.text = if (onScreen)
      "Link ${detectedLinkIndex + 1} of ${urls.size} visible on this screen — tap Detect link for the next one, or press ↑ to check it."
    else
      "No link visible on this screen — using a link from your clipboard. Press ↑ to check it."
  }

  private fun pasteIntoQuickInput() {
    val input = quickInput ?: return
    input.requestFocus()
    val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    val clip = clipboard.primaryClip
    val pasted = if (clip != null && clip.itemCount > 0) clip.getItemAt(0).coerceToText(this)?.toString() else null
    if (!pasted.isNullOrBlank()) {
      input.setText(pasted.take(5000)); input.setSelection(input.text.length)
    } else quickReplyView?.text = "Copy the post link first, then tap Paste. You can also touch and hold the message field to paste."
  }

  /** Manual mode opens with the top visible link already read off the
   *  monitored screen — the same auto-detect the Detect link chip cycles. */
  private fun autofillVisibleLink() {
    val input = quickInput ?: return
    if (input.text.isNotBlank() || quickRequestId != null || stagedAttachmentUri != null) return
    val (links, onScreen) = findLinks()
    if (links.isEmpty() || !onScreen) return
    detectedLinks = links
    detectedLinkIndex = 0
    val raw = links[0]
    val url = if (raw.startsWith("www.", ignoreCase = true)) "https://$raw" else raw
    input.setText(url)
    input.setSelection(url.length)
  }

  /** Big floating tools popup opened from the FAB:
   *  - Monitored app logo + shield badge at top
   *  - Animated motion status banner
   *  - Big segmented Live Mode | Manual Mode switch (animated thumb)
   *  - Live: status hint only — Manual: action chips + input
   *  - Action chips: Detect link, Paste link, Take screenshot
   *  - Staged screenshot chip
   *  - Input pill & Send button to run detection verdict or ask questions
   */
  private fun showUtilityBar() {
    if (popupView != null) return
    hideAlertBar()
    detectedLinks = emptyList()
    detectedLinkIndex = -1
    quickChips.clear()
    val ink = inkColor()
    val sub = subColor()
    val dim = dimColor()
    val accent = accentColor()
    val live = liveStatusColor()
    fun text(value: String, size: Float, color: Int, bold: Boolean = false) =
      TextView(this).apply {
        this.text = value
        textSize = size
        setTextColor(color)
        if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
      }
    val card = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(18), dp(16), dp(18), dp(16))
      background = overlayCard(24)
      elevation = dp(12).toFloat()
    }

    fun icon(resId: Int, color: Int) = ImageView(this).apply {
      setImageDrawable(tintedIcon(resId, color))
      scaleType = ImageView.ScaleType.FIT_CENTER
    }

    val pkg = foregroundPkg
    val appIconDrawable = runCatching {
      pkg?.let { packageManager.getApplicationIcon(it) }
    }.getOrNull()

    // 1. Header: monitored app icon — link — Maalam icon, centered + close (no text).
    val header = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
    }

    fun logoBox() = FrameLayout(this).apply {
      background = GradientDrawable().apply {
        cornerRadius = dp(15).toFloat()
        setColor(logoBoxBg())
        setStroke(dp(1), logoBoxStroke())
      }
    }

    // Direct open-app shortcut on the left; the logo chain stays centered.
    header.addView(icon(R.drawable.ic_open, sub).apply {
      setPadding(dp(6), dp(5), dp(5), dp(5))
      contentDescription = "Open Maalam app"
      applyRipple(this)
      setOnClickListener { openMaalamApp() }
    }, LinearLayout.LayoutParams(dp(32), dp(32)))

    header.addView(View(this), LinearLayout.LayoutParams(0, 1, 1f))

    // Monitored app icon
    val appBox = logoBox()
    val appImg = ImageView(this).apply {
      if (appIconDrawable != null) setImageDrawable(appIconDrawable)
      else setImageDrawable(tintedIcon(R.drawable.ic_shield, live))
      scaleType = ImageView.ScaleType.FIT_CENTER
    }
    appBox.addView(appImg, FrameLayout.LayoutParams(dp(32), dp(32), Gravity.CENTER))
    header.addView(appBox, LinearLayout.LayoutParams(dp(52), dp(52)))

    // Link connector: the monitored app is linked to Maalam — a dot
    // travels app → Maalam while the link glyph gently pulses.
    val linkWrap = FrameLayout(this)
    val linkIcon = icon(R.drawable.ic_link, sub)
    linkWrap.addView(linkIcon, FrameLayout.LayoutParams(dp(15), dp(15), Gravity.CENTER))
    val linkDot = View(this).apply {
      background = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(accent)
      }
      alpha = 0f
    }
    linkWrap.addView(linkDot, FrameLayout.LayoutParams(dp(4), dp(4)).apply {
      gravity = Gravity.CENTER_VERTICAL or Gravity.START
      marginStart = dp(2)
    })
    linkWrap.post {
      if (android.animation.ValueAnimator.areAnimatorsEnabled()) {
        val travel = (linkWrap.width - dp(8)).coerceAtLeast(dp(8))
        android.animation.ObjectAnimator.ofFloat(linkDot, "translationX", 0f, travel.toFloat()).apply {
          duration = 1100
          repeatCount = android.animation.ValueAnimator.INFINITE
          start()
        }
        android.animation.ObjectAnimator.ofFloat(linkDot, "alpha", 0f, 1f, 1f, 0f).apply {
          duration = 1100
          repeatCount = android.animation.ValueAnimator.INFINITE
          start()
        }
        linkIcon.startAnimation(AlphaAnimation(0.35f, 1f).apply {
          duration = 1100
          repeatMode = Animation.REVERSE
          repeatCount = Animation.INFINITE
        })
      }
    }
    header.addView(linkWrap, LinearLayout.LayoutParams(dp(24), dp(24)).apply {
      marginStart = dp(5); marginEnd = dp(5)
    })

    // Maalam app icon with the live-state dot
    val maalamBox = logoBox()
    val maalamIcon = ImageView(this).apply {
      val own = runCatching { packageManager.getApplicationIcon(packageName) }.getOrNull()
      if (own != null) setImageDrawable(own)
      else setImageDrawable(tintedIcon(R.drawable.ic_shield, accent))
      scaleType = ImageView.ScaleType.FIT_CENTER
    }
    maalamBox.addView(maalamIcon, FrameLayout.LayoutParams(dp(32), dp(32), Gravity.CENTER))
    val stateDot = View(this).apply {
      background = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(live)
        setStroke(dp(2), cardColor())
      }
    }
    maalamBox.addView(stateDot, FrameLayout.LayoutParams(dp(12), dp(12)).apply {
      gravity = Gravity.BOTTOM or Gravity.END
    })
    header.addView(maalamBox, LinearLayout.LayoutParams(dp(52), dp(52)))

    header.addView(View(this), LinearLayout.LayoutParams(0, 1, 1f))

    header.addView(icon(R.drawable.ic_close, sub).apply {
      setPadding(dp(7), dp(5), dp(5), dp(5))
      contentDescription = "Close Maalam tools"
      applyRipple(this)
      setOnClickListener { dismissPopup(false) }
    }, LinearLayout.LayoutParams(dp(32), dp(32)))
    card.addView(header)

    // 2. Animated Motion Status Banner
    val motionBanner = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      setPadding(dp(12), dp(9), dp(12), dp(9))
      background = GradientDrawable().apply {
        cornerRadius = dp(12).toFloat()
        setColor(bannerBg(live))
        setStroke(dp(1), bannerStroke(live))
      }
    }
    val mIcon = icon(R.drawable.ic_shield, live)
    motionBanner.addView(mIcon,
      LinearLayout.LayoutParams(dp(16), dp(16)).apply { marginEnd = dp(8) })
    motionIcon = mIcon
    val bannerMsg = when {
      scanInFlight || captureInFlight -> "Analyzing stream in real-time…"
      liveMonitoring -> "Active Guard · Live protection active"
      else -> "Manual Mode · Ready to inspect on demand"
    }
    val mText = text(bannerMsg, 13.5f, live, true).apply { maxLines = 1 }
    motionText = mText
    motionBanner.addView(mText)
    if (android.animation.ValueAnimator.areAnimatorsEnabled()) {
      motionBanner.startAnimation(AlphaAnimation(1f, 0.45f).apply {
        duration = 800
        repeatMode = Animation.REVERSE
        repeatCount = Animation.INFINITE
      })
    }
    card.addView(motionBanner, LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT,
      LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply { topMargin = dp(10) })

    // 3. Centered oblong toggle: only the active mode's label shows, knob slides.
    val toggleBg = GradientDrawable().apply {
      cornerRadius = dp(23).toFloat()
      setColor(if (liveMonitoring) accent else manualOrange())
    }
    val track = FrameLayout(this).apply {
      background = toggleBg
      contentDescription = if (liveMonitoring)
        "Live Mode on. Switch to Manual Mode"
      else "Manual Mode on. Switch to Live Mode"
      setOnClickListener { setLiveMonitoring(!liveMonitoring) }
      applyRipple(this)
    }
    // White knob — right edge = Live (on), left edge = Manual (off).
    val knob = View(this).apply {
      background = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(Color.WHITE)
      }
      elevation = dp(4).toFloat()
    }
    track.addView(knob, FrameLayout.LayoutParams(dp(36), dp(36)).apply {
      marginStart = dp(5)
      gravity = Gravity.CENTER_VERTICAL or Gravity.START
    })
    // Active-mode label crossfades in the center.
    fun modeLabel(label: String, active: Boolean) = text(label, 15.5f, Color.WHITE, true).apply {
      alpha = if (active) 1f else 0f
    }
    val liveTv = modeLabel("Live Mode", liveMonitoring)
    val manualTv = modeLabel("Manual Mode", !liveMonitoring)
    modeLiveLabel = liveTv
    modeManualLabel = manualTv
    track.addView(liveTv, FrameLayout.LayoutParams(
      FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT,
      Gravity.CENTER))
    track.addView(manualTv, FrameLayout.LayoutParams(
      FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT,
      Gravity.CENTER))
    modeTrack = track
    modeKnob = knob
    modeToggleBg = toggleBg
    card.addView(track, LinearLayout.LayoutParams(dp(208), dp(46)).apply {
      topMargin = dp(10)
      gravity = Gravity.CENTER_HORIZONTAL
    })
    track.post { positionModeKnob(false) }

    // Verdict summary card — live mode shows it standalone; manual mode
    // renders the same bubble inside the chat thread instead.
    alertResult?.let { result ->
      val flag = verdictBubbleView(result)
      flag.visibility = if (liveMonitoring) View.VISIBLE else View.GONE
      verdictCard = flag
      card.addView(flag, LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      ).apply { topMargin = dp(10) })
    }

    // 4. Live Mode: just the big switch above — auto-scan needs no tools.
    val liveHint = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      setPadding(dp(12), dp(11), dp(12), dp(11))
      background = GradientDrawable().apply {
        cornerRadius = dp(12).toFloat()
        setColor(fieldBg())
        setStroke(dp(1), fieldStroke())
      }
    }
    liveHint.addView(icon(R.drawable.ic_scan, live),
      LinearLayout.LayoutParams(dp(17), dp(17)).apply { marginEnd = dp(9) })
    liveHint.addView(text(
      "Live Mode is auto-scanning this screen. Switch to Manual Mode to inspect on demand.",
      12.5f, sub), LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
    liveSection = liveHint
    card.addView(liveHint, LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT,
      LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply { topMargin = dp(8) })

    // 5. Manual Mode: staged chip, reply bubble, action chips, input pill.
    val manual = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
    manualSection = manual

    // Staged Screenshot Chip
    stagedAttachmentUri?.let {
      val chipRow = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        setPadding(dp(10), dp(7), dp(10), dp(7))
        background = GradientDrawable().apply {
          cornerRadius = dp(10).toFloat()
          setColor(stagedChipBg())
          setStroke(dp(1), stagedChipStroke())
        }
      }
      chipRow.addView(icon(R.drawable.ic_attach, accent),
        LinearLayout.LayoutParams(dp(16), dp(16)).apply { marginEnd = dp(7) })
      chipRow.addView(text("Screenshot attached · ready to verify", 12.5f, ink),
        LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
      chipRow.addView(text("Remove", 12.5f, flagInk(), true).apply {
        setPadding(dp(6), 0, 0, 0)
        setOnClickListener {
          clearStagedAttachment(); dismissPopup(false, resume = false); showUtilityBar()
        }
        applyRipple(this)
      })
      manual.addView(chipRow, LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      ).apply { topMargin = dp(8) })
    }

    // Chat thread: user bubbles (with attached images), assistant replies,
    // the scan verdict, and a transient status bubble — scrollable.
    fun rebuildThread() {
      val t = chatThreadView ?: return
      t.removeAllViews()
      fun msgBubble(content: JSONObject, isUser: Boolean): LinearLayout {
        val bubble = LinearLayout(this).apply {
          orientation = LinearLayout.VERTICAL
          setPadding(dp(11), dp(8), dp(11), dp(8))
          background = GradientDrawable().apply {
            cornerRadius = dp(14).toFloat()
            setColor(if (isUser) accent else replyBg())
          }
        }
        content.optString("image").takeIf { it.isNotBlank() }?.let { path ->
          runCatching {
            val img = BitmapFactory.decodeFile(path)
            if (img != null) {
              bubble.addView(ImageView(this).apply {
                setImageBitmap(img)
                scaleType = ImageView.ScaleType.CENTER_CROP
              }, LinearLayout.LayoutParams(dp(180), dp(110)).apply {
                bottomMargin = dp(6)
              })
            }
          }
        }
        val display = content.optString("display").takeIf { it.isNotBlank() }
          ?: content.optString("content")
        bubble.addView(text(display, 13.5f, if (isUser) Color.WHITE else ink).apply {
          maxWidth = dp(250)
        })
        return bubble
      }
      for (i in 0 until quickHistory.length()) {
        val m = quickHistory.optJSONObject(i) ?: continue
        val isUser = m.optString("role") == "user"
        val row = LinearLayout(this).apply {
          orientation = LinearLayout.HORIZONTAL
          gravity = if (isUser) Gravity.END else Gravity.START
        }
        row.addView(msgBubble(m, isUser))
        t.addView(row, LinearLayout.LayoutParams(
          LinearLayout.LayoutParams.MATCH_PARENT,
          LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { if (t.childCount > 0) topMargin = dp(6) })
      }
      // Scan verdict as a chat bubble.
      alertResult?.let { result ->
        val row = LinearLayout(this).apply {
          orientation = LinearLayout.HORIZONTAL
          gravity = Gravity.START
        }
        row.addView(verdictBubbleView(result), LinearLayout.LayoutParams(
          LinearLayout.LayoutParams.MATCH_PARENT,
          LinearLayout.LayoutParams.WRAP_CONTENT))
        t.addView(row, LinearLayout.LayoutParams(
          LinearLayout.LayoutParams.MATCH_PARENT,
          LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { if (t.childCount > 0) topMargin = dp(6) })
      }
      // Trailing status bubble: hidden when empty, appears on any status
      // write (chip feedback, "Checking content…", errors).
      val statusBubble = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(11), dp(8), dp(11), dp(8))
        background = GradientDrawable().apply {
          cornerRadius = dp(14).toFloat()
          setColor(replyBg())
        }
      }
      val statusText = text(
        if (quickRequestId != null) "Checking content…" else "", 13.5f, ink
      ).apply {
        maxWidth = dp(250)
        addTextChangedListener(object : android.text.TextWatcher {
          override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
          override fun onTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
          override fun afterTextChanged(s: android.text.Editable?) {
            statusBubble.visibility =
              if (s.isNullOrBlank()) View.GONE else View.VISIBLE
          }
        })
      }
      statusBubble.visibility =
        if (statusText.text.isBlank()) View.GONE else View.VISIBLE
      statusBubble.addView(statusText)
      quickReplyView = statusText
      val statusRow = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.START
      }
      statusRow.addView(statusBubble)
      t.addView(statusRow, LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      ).apply { if (t.childCount > 0) topMargin = dp(6) })
      // Empty convo → seed the status bubble with the hint.
      if (quickHistory.length() == 0 && alertResult == null && quickRequestId == null) {
        statusText.text = "Ask a question, detect a link on this screen, or attach a screenshot to verify."
      }
      // Keep the thread bounded: wrap when tiny, fixed 220dp once the convo
      // grows so the popup can't outgrow the screen.
      chatScrollView?.let { sv ->
        val lp = sv.layoutParams as? LinearLayout.LayoutParams ?: return@let
        val target = if (quickHistory.length() > 1 || alertResult != null)
          dp(220) else LinearLayout.LayoutParams.WRAP_CONTENT
        if (lp.height != target) { lp.height = target; sv.layoutParams = lp }
      }
      scrollChatToEnd()
    }
    renderChat = { rebuildThread() }
    val chatScroll = ScrollView(this).apply {
      isVerticalScrollBarEnabled = false
      overScrollMode = View.OVER_SCROLL_NEVER
    }
    val thread = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
    chatScroll.addView(thread, FrameLayout.LayoutParams(
      FrameLayout.LayoutParams.MATCH_PARENT,
      FrameLayout.LayoutParams.WRAP_CONTENT))
    chatThreadView = thread
    chatScrollView = chatScroll
    manual.addView(chatScroll, LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT,
      LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply { topMargin = dp(8) })
    rebuildThread()

    // Action Chips: Detect link, Paste link, Take screenshot
    fun chip(row: LinearLayout, resId: Int, label: String, description: String, accentBg: Boolean, action: () -> Unit) {
      val tint = if (accentBg) Color.WHITE else chipInk()
      val chip = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER
        setPadding(dp(8), dp(9), dp(8), dp(9))
        background = GradientDrawable().apply {
          cornerRadius = dp(12).toFloat()
          setColor(if (accentBg) accent else chipBg())
        }
        contentDescription = description
        applyRipple(this)
        setOnClickListener { action() }
        addView(icon(resId, tint), LinearLayout.LayoutParams(dp(16), dp(16)))
        addView(text(label, 12.5f, tint, true).apply { setPadding(dp(5), 0, 0, 0); maxLines = 1 })
      }
      quickChips.add(chip)
      row.addView(chip, LinearLayout.LayoutParams(
        0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f
      ).apply { if (row.childCount > 0) leftMargin = dp(7) })
    }

    val tools = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      setPadding(0, dp(2), 0, 0)
      visibility = View.GONE
    }
    chip(tools, R.drawable.ic_attach, "Attach", "Attach a screenshot or image to verify", true) { pickOverlayAttachment("image") }
    chip(tools, R.drawable.ic_link, "Detect link", "Detect link visible on screen", false) { detectScreenUrl() }
    chip(tools, R.drawable.ic_paste, "Paste link", "Paste link from clipboard", false) { pasteIntoQuickInput() }
    manual.addView(tools, LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT,
      LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply { topMargin = dp(8) })

    // Slim composer pill: + tools toggle, inline input, send circle.
    val inputPill = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      setPadding(dp(6), dp(4), dp(6), dp(4))
      background = GradientDrawable().apply {
        cornerRadius = dp(24).toFloat()
        setColor(fieldBg())
        setStroke(dp(1), fieldStroke())
      }
    }
    val plusIcon = icon(R.drawable.ic_add, chipInk())
    val plus = FrameLayout(this).apply {
      background = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(chipBg())
      }
      contentDescription = "Show tools: detect link, paste link, attach"
      applyRipple(this)
      addView(plusIcon, FrameLayout.LayoutParams(dp(17), dp(17), Gravity.CENTER))
      setOnClickListener {
        val show = tools.visibility != View.VISIBLE
        if (show) {
          tools.alpha = 0f
          tools.visibility = View.VISIBLE
          tools.animate().alpha(1f).setDuration(180).start()
        } else {
          tools.animate().alpha(0f).setDuration(150)
            .withEndAction { tools.visibility = View.GONE }.start()
        }
        plusIcon.animate().rotation(if (show) 45f else 0f).setDuration(180).start()
      }
    }
    inputPill.addView(plus, LinearLayout.LayoutParams(dp(36), dp(36)).apply { rightMargin = dp(8) })
    val input = EditText(this).apply {
      hint = "Ask, paste text or link to verify…"
      contentDescription = "Message or public URL"
      setTextColor(ink)
      setHintTextColor(dim)
      textSize = 14f
      maxLines = 4
      gravity = Gravity.CENTER_VERTICAL
      inputType = android.text.InputType.TYPE_CLASS_TEXT or
        android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE
      filters = arrayOf(android.text.InputFilter.LengthFilter(5000))
      setBackgroundColor(Color.TRANSPARENT)
      setPadding(0, 0, dp(8), 0)
    }
    input.setText(quickDraft)
    input.setSelection(input.text.length)
    quickInput = input
    inputPill.addView(input, LinearLayout.LayoutParams(
      0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f
    ))
    val send = FrameLayout(this).apply {
      background = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(accent)
      }
      contentDescription = "Send to Maalam"
      applyRipple(this)
      setOnClickListener { submitQuickChat(input.text.toString()) }
      addView(icon(R.drawable.ic_send, Color.WHITE),
        FrameLayout.LayoutParams(dp(17), dp(17), Gravity.CENTER))
    }
    inputPill.addView(send, LinearLayout.LayoutParams(dp(36), dp(36)))
    manual.addView(inputPill, LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT,
      LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply { topMargin = dp(8) })
    quickSend = send

    if (!liveMonitoring) autofillVisibleLink()

    if (quickRequestId != null) {
      send.isEnabled = false
      input.isEnabled = false
      quickChips.forEach { it.isEnabled = false }
      quickReplyView?.text = "Checking content…"
    }

    card.addView(manual, LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT,
      LinearLayout.LayoutParams.WRAP_CONTENT
    ))

    val screenW = resources.displayMetrics.widthPixels
    val barW = (screenW - dp(12)).coerceAtMost(dp(400))
    val params = overlayParams(
      barW,
      WindowManager.LayoutParams.WRAP_CONTENT
    ).apply {
      gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
      y = dp(10)
      flags = WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
      softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
    }
    runCatching {
      windowManager.addView(card, params)
      popupView = card
      utilityBarView = card
      liveHint.visibility = if (liveMonitoring) View.VISIBLE else View.GONE
      manual.visibility = if (liveMonitoring) View.GONE else View.VISIBLE
      if (android.animation.ValueAnimator.areAnimatorsEnabled()) {
        card.alpha = 0f; card.translationY = dp(24).toFloat()
        card.animate().alpha(1f).translationY(0f).setDuration(200).start()
      }
    }
  }

  private fun submitQuickChat(prompt: String) {
    if (manualCapturePending) {
      quickReplyView?.text = "Your screenshot is queued or being scanned. You can paste your next message now and send it when the screen check finishes."
      return
    }
    if ((prompt.isBlank() && stagedAttachmentUri == null) || quickRequestId != null) return
    val trimmed = prompt.trim()
    val submitted = when {
      trimmed.isBlank() -> "Inspect this attached content for AI manipulation, deepfakes, and harmful content."
      screenUrlPattern.matchEntire(trimmed) != null ->
        "Check this link for AI-generated or manipulated media, deepfakes, scams and harmful content, then give a clear verdict: $trimmed"
      else -> trimmed
    }
    val id = UUID.randomUUID().toString()
    quickRequestId = id
    quickPrompt = submitted
    quickSend?.isEnabled = false
    quickInput?.isEnabled = false
    quickChips.forEach { it.isEnabled = false }
    // Chat thread shows the user's message right away; the AI context keeps
    // the older history so the current prompt is not sent twice.
    val historyJson = quickHistory.toString()
    val userDisplay = trimmed.ifBlank {
      if (stagedAttachmentUri != null) "Attached a screenshot" else submitted
    }
    quickHistory.put(JSONObject().apply {
      put("role", "user")
      put("content", submitted)
      put("display", userDisplay)
      stagedAttachmentUri?.let { put("image", it) }
    })
    while (quickHistory.length() > 12) quickHistory.remove(0)
    renderChat?.invoke()
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
            putExtra("prompt", submitted); putExtra("history", historyJson)
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
    quickChips.forEach { it.isEnabled = true }
    if (reply != null && error == null) {
      quickHistory.put(JSONObject().put("role", "assistant").put("content", reply))
      while (quickHistory.length() > 12) quickHistory.remove(0)
      quickDraft = ""
      quickInput?.setText("")
      consumeStagedAttachment()
    }
    // Rebuild the thread (adds the reply bubble / shows the user bubble),
    // then route the transient status text through the fresh status bubble.
    renderChat?.invoke()
    quickReplyView?.text = error ?: if (reply == null) "No answer returned. Try again." else ""
    if (popupView == null) scheduleScan()
  }

  /** Drops the staged-attachment fields without deleting the file — a chat
   *  bubble may still be displaying it. */
  private fun consumeStagedAttachment() {
    stagedAttachmentUri = null
    stagedAttachmentKind = null
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
      showUtilityBar()
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
    val bar = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      setPadding(dp(14), dp(8), dp(14), dp(8))
      background = GradientDrawable().apply {
        cornerRadius = dp(20).toFloat()
        setColor(Color.parseColor("#C62828"))
        setStroke(dp(1), 0x40FFFFFF)
      }
      elevation = dp(8).toFloat()
      contentDescription = "Potential $verdict detected. Tap to view the report."
      setOnClickListener { showPopup(result) }
      addView(ImageView(this@MaalamMonitorService).apply {
        setImageDrawable(tintedIcon(R.drawable.ic_warning, Color.WHITE))
        scaleType = ImageView.ScaleType.FIT_CENTER
      }, LinearLayout.LayoutParams(dp(16), dp(16)).apply { rightMargin = dp(8) })
      addView(TextView(this@MaalamMonitorService).apply {
        text = "Potential $verdict detected · Tap to view"
        textSize = 12.5f
        setTextColor(Color.WHITE)
        setTypeface(typeface, android.graphics.Typeface.BOLD)
        maxLines = 1
      })
    }
    val screenW = resources.displayMetrics.widthPixels
    val barW = (screenW - dp(32)).coerceAtMost(dp(320))
    runCatching {
      windowManager.addView(bar, overlayParams(
        barW,
        WindowManager.LayoutParams.WRAP_CONTENT
      ).apply {
        gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
        y = dp(12)
      })
      alertBar = bar
      if (android.animation.ValueAnimator.areAnimatorsEnabled()) {
        bar.alpha = 0f
        bar.translationY = -dp(20).toFloat()
        bar.animate().alpha(1f).translationY(0f).setDuration(220).start()
      }
    }
    handler.postDelayed(hideAlertBarTask, 5000)
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
      setBackgroundColor(scrimColor())
      setOnClickListener { dismissPopup() }
    }
    val card = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(18), dp(18), dp(18), dp(14))
      background = overlayCard(20)
      isClickable = true
    }
    val ink = inkColor()
    val sub = subColor()
    val dim = dimColor()
    fun text(str: String, size: Float, bold: Boolean = false, color: Int = ink): TextView =
      TextView(this).apply {
        text = str
        textSize = size
        setTextColor(color)
        if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
      }

    fun num(v: Any?) = (v as? Number)?.toInt() ?: 0
    // Header row: warning glyph + verdict badge + confidence.
    val badgeRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
    }
    badgeRow.addView(ImageView(this).apply {
      setImageDrawable(tintedIcon(R.drawable.ic_warning, flagInk()))
      scaleType = ImageView.ScaleType.FIT_CENTER
    }, LinearLayout.LayoutParams(dp(18), dp(18)).apply { rightMargin = dp(8) })
    badgeRow.addView(text(
      (result["verdict"] as? String)?.replace('_', ' ')?.uppercase() ?: "FLAGGED",
      11f, true, Color.WHITE).apply {
      setPadding(dp(8), dp(3), dp(8), dp(3))
      background = GradientDrawable().apply {
        cornerRadius = dp(7).toFloat()
        setColor(Color.parseColor("#C62828"))
      }
    })
    badgeRow.addView(text("${num(result["confidence"])}% confidence", 12f,
      color = sub).apply { setPadding(dp(8), 0, 0, 0) })
    card.addView(badgeRow)
    card.addView(text("Deepfake, AI-generated or harmful content detected", 15.5f, true,
      ink).apply { setPadding(0, dp(8), 0, 0) })
    card.addView(text("in ${labels[pkg] ?: pkg ?: "this app"}", 12f,
      color = sub).apply { setPadding(0, dp(2), 0, 0) })
    @Suppress("UNCHECKED_CAST")
    val findings = result["findings"] as? List<Map<String, Any?>> ?: emptyList()
    for (f in findings) {
      val label = "${f["label"] ?: "Finding"} · ${(f["category"] as? String)?.replace('_', ' ') ?: ""} · ${num(f["confidence"])}%"
      card.addView(text(label, 13.5f, true).apply { setPadding(0, dp(8), 0, 0) })
      card.addView(text((f["description"] as? String) ?: "", 12.5f, color = sub))
      (f["cropUri"] as? String)?.let { uri ->
        runCatching {
          val crop = File(android.net.Uri.parse(uri).path ?: "").canonicalFile
          if (crop.parentFile == File(filesDir, "detection-crops").canonicalFile) {
            val bitmap = BitmapFactory.decodeFile(crop.path)
            if (bitmap != null) {
              card.addView(text("Suspected region · OpenCV crop", 11.5f, color = dim).apply {
                setPadding(0, dp(4), 0, dp(2))
              })
              card.addView(ImageView(this).apply {
                setImageBitmap(bitmap); scaleType = ImageView.ScaleType.FIT_CENTER
                contentDescription = "Suspected region: ${f["label"] ?: "finding"}"
              }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(150)))
            }
          }
        }
      }
    }
    (result["summary"] as? String)?.takeIf { it.isNotBlank() }?.let {
      card.addView(text(it, 12.5f, color = sub).apply { setPadding(0, dp(8), 0, 0) })
    }
    val buttons = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.END
    }
    buttons.addView(text("Dismiss", 14f, true, sub).apply {
      setPadding(dp(12), dp(8), dp(12), dp(8))
      setOnClickListener { dismissPopup() }
    })
    buttons.addView(text("View in Maalam", 14f, true, accentColor()).apply {
      setPadding(dp(12), dp(8), dp(12), dp(8))
      setOnClickListener { openInApp((result["detectionId"] as? String) ?: "") }
    })
    card.addView(buttons)

    val scroll = ScrollView(this).apply { addView(card) }
    val cardParams = FrameLayout.LayoutParams(
      FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT
    ).apply {
      gravity = Gravity.CENTER
      marginStart = dp(20); marginEnd = dp(20)
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
    utilityBarView = null
    modeTrack = null
    modeKnob = null
    modeToggleBg = null
    modeLiveLabel = null
    modeManualLabel = null
    liveSection = null
    manualSection = null
    motionText = null
    motionIcon = null
    verdictCard = null
    chatThreadView = null
    chatScrollView = null
    renderChat = null
    quickReplyView = null
    quickSend = null
    quickInput = null
    quickChips.clear()
    detectedLinks = emptyList()
    detectedLinkIndex = -1
    if (clearAlert) alertResult = null
    updateBubbleState()
    if (resume && isMonitoredForeground()) scheduleScan()
  }

  private fun openMaalamApp() {
    dismissPopup()
    try {
      val intent = packageManager.getLaunchIntentForPackage(packageName)
        ?: Intent(Intent.ACTION_VIEW, android.net.Uri.parse("maalam://")).setPackage(packageName)
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      startActivity(intent)
    } catch (_: Exception) {}
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
    bubbleIcon = null
    bubbleStatus = null
    badgeDot = null
    bubbleParams = null
    bubbleDockLeft = false
    if (attachmentTargetPackage == null && reopenComposerPackage == null) {
      while (quickHistory.length() > 0) quickHistory.remove(0)
      quickDraft = ""
      if (quickRequestId == null) clearStagedAttachment()
    }
    alertResult = null
  }
}
