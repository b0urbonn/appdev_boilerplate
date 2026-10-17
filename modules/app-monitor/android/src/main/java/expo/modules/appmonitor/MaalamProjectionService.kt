package expo.modules.appmonitor

import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.Image
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.SystemClock
import android.util.Log
import android.view.WindowManager
import java.io.File
import java.io.FileOutputStream
import java.lang.ref.WeakReference
import java.util.UUID

/** Captures only the app/window/display explicitly selected in Android's share prompt. */
class MaalamProjectionService : Service() {
  companion object {
    private const val TAG = "MaalamProjection"
    private const val CHANNEL_ID = "screen-share"
    private const val NOTIFICATION_ID = 7302
    private const val ACTION_START = "expo.modules.appmonitor.START_SCREEN_SHARE"
    private const val ACTION_STOP = "expo.modules.appmonitor.STOP_SCREEN_SHARE"
    private const val EXTRA_RESULT_CODE = "resultCode"
    private const val EXTRA_RESULT_DATA = "resultData"
    private const val EXTRA_SINGLE_CAPTURE = "singleCapture"
    @Volatile private var singleCaptureCallback: ((Result<String>) -> Unit)? = null
    private const val MIN_FRAME_INTERVAL_MS = 15_000L
    const val SHARED_SCREEN_PACKAGE = "com.maalam.app.sharedscreen"
    const val SHARED_SCREEN_LABEL = "Shared screen"

    @Volatile private var active = false
    @Volatile private var instance: WeakReference<MaalamProjectionService>? = null

    @Synchronized
    fun startSingleCapture(context: Context, resultCode: Int, resultData: Intent, callback: (Result<String>) -> Unit) {
      if (active || instance?.get() != null || singleCaptureCallback != null) {
        callback(Result.failure(IllegalStateException("Stop the current screen share before taking a single screenshot.")))
        return
      }
      singleCaptureCallback = callback
      try { start(context, resultCode, resultData, singleCapture = true) }
      catch (error: Exception) { singleCaptureCallback = null; callback(Result.failure(error)) }
    }

    @Synchronized
    private fun completeSingleCapture(result: Result<String>) {
      val callback = singleCaptureCallback
      singleCaptureCallback = null
      callback?.invoke(result)
    }

    fun start(context: Context, resultCode: Int, resultData: Intent, singleCapture: Boolean = false) {
      val intent = Intent(context, MaalamProjectionService::class.java)
        .setAction(ACTION_START)
        .putExtra(EXTRA_RESULT_CODE, resultCode)
        .putExtra(EXTRA_RESULT_DATA, resultData)
        .putExtra(EXTRA_SINGLE_CAPTURE, singleCapture)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent)
      else context.startService(intent)
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, MaalamProjectionService::class.java))
    }

    fun isRunning(): Boolean = active

    fun reportResult(frameId: String, result: Map<String, Any?>?, error: String?) {
      instance?.get()?.let { service ->
        service.handler.post { service.onScanResult(frameId, result, error) }
      }
    }
  }

  private val handlerThread = HandlerThread("MaalamScreenShare").apply { start() }
  private val handler = Handler(handlerThread.looper)
  private var projection: MediaProjection? = null
  private var projectionCallback: MediaProjection.Callback? = null
  private var display: VirtualDisplay? = null
  private var imageReader: ImageReader? = null
  private var inFlightFrameId: String? = null
  private var lastFrameAt = 0L
  private var singleCapture = false
  private var captureNotBefore = 0L
  private var densityDpi = 0
  private var currentWidth = 0
  private var currentHeight = 0

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      stopSelf()
      return START_NOT_STICKY
    }
    if (projection != null) return START_NOT_STICKY

    singleCapture = intent?.getBooleanExtra(EXTRA_SINGLE_CAPTURE, false) == true
    captureNotBefore = if (singleCapture) SystemClock.elapsedRealtime() + 4000 else 0L
    if (singleCapture) handler.postDelayed({
      if (inFlightFrameId != null) return@postDelayed
      completeSingleCapture(Result.failure(IllegalStateException("Screen capture timed out. Please try again.")))
      stopSelf()
    }, 30000)
    createNotificationChannel()
    startAsForeground()
    instance = WeakReference(this)

    @Suppress("DEPRECATION")
    val resultData = if (Build.VERSION.SDK_INT >= 33) {
      intent?.getParcelableExtra(EXTRA_RESULT_DATA, Intent::class.java)
    } else {
      intent?.getParcelableExtra(EXTRA_RESULT_DATA)
    }
    val resultCode = intent?.getIntExtra(EXTRA_RESULT_CODE, Activity.RESULT_CANCELED)
      ?: Activity.RESULT_CANCELED
    if (resultCode != Activity.RESULT_OK || resultData == null) {
      stopSelf(startId)
      return START_NOT_STICKY
    }

    try {
      val manager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
      projection = manager.getMediaProjection(resultCode, resultData)
      densityDpi = resources.configuration.densityDpi
      val bounds = (getSystemService(Context.WINDOW_SERVICE) as WindowManager).defaultDisplay.let {
        android.graphics.Point().also(it::getRealSize)
      }
      currentWidth = bounds.x.coerceAtLeast(1)
      currentHeight = bounds.y.coerceAtLeast(1)

      val callback = object : MediaProjection.Callback() {
        override fun onStop() {
          handler.post {
            releaseCaptureResources(stopProjection = false)
            active = false
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
          }
        }

        override fun onCapturedContentResize(width: Int, height: Int) {
          if (width > 0 && height > 0) handler.post { configureCapture(width, height) }
        }
      }
      projectionCallback = callback
      projection?.registerCallback(callback, handler)
      configureCapture(currentWidth, currentHeight)
      active = true
      updateNotification(if (singleCapture) "Screenshot in 4 seconds. Open the content you want to check." else "Sharing is active. Switch to the app or screen you chose.")
    } catch (error: Exception) {
      Log.e(TAG, "Could not start screen sharing", error)
      stopSelf(startId)
    }
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    if (singleCapture) completeSingleCapture(Result.failure(IllegalStateException("Screen capture was stopped. Please try again.")))
    active = false
    releaseCaptureResources(stopProjection = true)
    if (instance?.get() === this) instance = null
    handler.removeCallbacksAndMessages(null)
    handlerThread.quitSafely()
    super.onDestroy()
  }

  private fun startAsForeground() {
    val notification = buildNotification(if (singleCapture) "Screenshot in 4 seconds. Open the content you want to check." else "Preparing screen share…")
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  private fun configureCapture(width: Int, height: Int) {
    val activeProjection = projection ?: return
    if (width == currentWidth && height == currentHeight && imageReader != null) return
    currentWidth = width
    currentHeight = height
    val nextReader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2)
    nextReader.setOnImageAvailableListener({ reader -> captureLatestFrame(reader) }, handler)
    val oldReader = imageReader
    imageReader = nextReader

    if (display == null) {
      display = activeProjection.createVirtualDisplay(
        "Maalam shared screen",
        width,
        height,
        densityDpi,
        DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
        nextReader.surface,
        null,
        handler
      )
    } else {
      display?.resize(width, height, densityDpi)
      display?.setSurface(nextReader.surface)
    }
    oldReader?.setOnImageAvailableListener(null, null)
    oldReader?.close()
  }

  private fun captureLatestFrame(reader: ImageReader) {
    val image = try { reader.acquireLatestImage() } catch (_: Exception) { null } ?: return
    try {
      val now = SystemClock.elapsedRealtime()
      if (now < captureNotBefore || inFlightFrameId != null || (!singleCapture && now - lastFrameAt < MIN_FRAME_INTERVAL_MS)) return
      lastFrameAt = now
      val source = imageToBitmap(image) ?: return
      val scaled = scaleLongEdge(source, 768)
      if (scaled !== source) source.recycle()
      val frameId = UUID.randomUUID().toString()
      val file = File(File(cacheDir, "monitor-frames").apply { mkdirs() }, "$frameId.jpg")
      FileOutputStream(file).use { scaled.compress(Bitmap.CompressFormat.JPEG, 80, it) }
      scaled.recycle()
      inFlightFrameId = frameId
      if (singleCapture) {
        completeSingleCapture(Result.success("file://${file.absolutePath}"))
        handler.post { stopSelf() }
        return
      }
      val extras = android.os.Bundle().apply {
        putString("mode", "screenShare")
        putString("frameId", frameId)
        putString("packageName", SHARED_SCREEN_PACKAGE)
        putString("appLabel", SHARED_SCREEN_LABEL)
        putString("imageUri", "file://${file.absolutePath}")
        putString("screenText", "")
        putDouble("capturedAt", System.currentTimeMillis().toDouble())
      }
      try {
        startService(Intent(this, MaalamScanTaskService::class.java).putExtras(extras))
      } catch (error: Exception) {
        inFlightFrameId = null
        file.delete()
        throw error
      }
      updateNotification("Checking the shared screen…")
    } catch (error: Exception) {
      if (singleCapture) {
        completeSingleCapture(Result.failure(error))
        handler.post { stopSelf() }
      }
      Log.e(TAG, "Could not capture shared screen", error)
    } finally {
      image.close()
    }
  }

  private fun imageToBitmap(image: Image): Bitmap? {
    return try {
      val plane = image.planes.firstOrNull() ?: return null
      val paddedWidth = plane.rowStride / plane.pixelStride
      val padded = Bitmap.createBitmap(paddedWidth.coerceAtLeast(image.width), image.height, Bitmap.Config.ARGB_8888)
      padded.copyPixelsFromBuffer(plane.buffer)
      val cropped = Bitmap.createBitmap(padded, 0, 0, image.width, image.height)
      if (cropped !== padded) padded.recycle()
      cropped
    } catch (error: Exception) {
      Log.w(TAG, "Could not read screen frame", error)
      null
    }
  }

  private fun scaleLongEdge(source: Bitmap, max: Int): Bitmap {
    val longEdge = maxOf(source.width, source.height)
    if (longEdge <= max) return source
    val scale = max.toFloat() / longEdge
    return Bitmap.createScaledBitmap(
      source,
      (source.width * scale).toInt().coerceAtLeast(1),
      (source.height * scale).toInt().coerceAtLeast(1),
      true
    )
  }

  private fun onScanResult(frameId: String, result: Map<String, Any?>?, error: String?) {
    if (frameId != inFlightFrameId) return
    inFlightFrameId = null
    val flagged = result != null
    val message = when {
      flagged -> "Potentially unsafe content detected. Open Maalam to review."
      error != null -> "Screen check needs attention. Open Maalam to review."
      else -> "Sharing is active. Switch to the app or screen you chose."
    }
    updateNotification(message)
  }

  private fun releaseCaptureResources(stopProjection: Boolean) {
    imageReader?.setOnImageAvailableListener(null, null)
    imageReader?.close()
    imageReader = null
    display?.release()
    display = null
    val currentProjection = projection
    projection = null
    projectionCallback?.let { callback -> runCatching { currentProjection?.unregisterCallback(callback) } }
    projectionCallback = null
    if (stopProjection) runCatching { currentProjection?.stop() }
    inFlightFrameId = null
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(NotificationManager::class.java)
    manager.createNotificationChannel(
      NotificationChannel(CHANNEL_ID, "Live screen scan", NotificationManager.IMPORTANCE_LOW)
    )
  }

  private fun buildNotification(message: String): Notification {
    val openIntent = packageManager.getLaunchIntentForPackage(packageName)
    val openPendingIntent = openIntent?.let {
      PendingIntent.getActivity(
        this,
        0,
        it,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
    }
    val stopIntent = PendingIntent.getService(
      this,
      1,
      Intent(this, MaalamProjectionService::class.java).setAction(ACTION_STOP),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }
    return builder
      .setSmallIcon(android.R.drawable.ic_menu_view)
      .setContentTitle("Maalam live scan")
      .setContentText(message)
      .setCategory(Notification.CATEGORY_SERVICE)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .addAction(android.R.drawable.ic_media_pause, "Stop sharing", stopIntent)
      .apply { if (openPendingIntent != null) setContentIntent(openPendingIntent) }
      .build()
  }

  private fun updateNotification(message: String) {
    val manager = getSystemService(NotificationManager::class.java)
    manager.notify(NOTIFICATION_ID, buildNotification(message))
  }
}
