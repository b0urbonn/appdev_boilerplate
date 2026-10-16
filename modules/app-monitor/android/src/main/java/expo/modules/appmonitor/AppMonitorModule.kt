package expo.modules.appmonitor

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.Settings
import android.text.TextUtils
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream

class AppMonitorModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("AppMonitor")

    AsyncFunction("getInstalledApps") {
      val pm = context.packageManager
      val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
      val apps = pm.queryIntentActivities(intent, 0)
        .map { it.activityInfo }
        .filter { it.packageName != context.packageName }
        .distinctBy { it.packageName }
        .map { info ->
          mapOf(
            "packageName" to info.packageName,
            "label" to info.loadLabel(pm).toString(),
            "iconUri" to cacheIcon(pm, info.packageName,
              runCatching { info.loadIcon(pm) }.getOrNull())
          )
        }
        .sortedBy { (it["label"] as String).lowercase() }
      apps
    }

    AsyncFunction("launchApp") { packageName: String ->
      val launch = context.packageManager.getLaunchIntentForPackage(packageName)
      launch?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      if (launch != null) {
        runCatching { context.startActivity(launch) }
        true
      } else false
    }

    Function("isMonitorServiceEnabled") {
      if (Settings.Secure.getInt(context.contentResolver,
          Settings.Secure.ACCESSIBILITY_ENABLED, 0) != 1) return@Function false
      val enabled = Settings.Secure.getString(context.contentResolver,
        Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES) ?: return@Function false
      val expected = ComponentName(context, MaalamMonitorService::class.java)
        .flattenToString()
      val splitter = TextUtils.SimpleStringSplitter(':')
      splitter.setString(enabled)
      for (service in splitter) {
        if (service.equals(expected, ignoreCase = true)) return@Function true
      }
      false
    }

    Function("supportsScreenshots") { Build.VERSION.SDK_INT >= 30 }

    Function("openAccessibilitySettings") {
      context.startActivity(
        Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      )
    }

    Function("setConfig") { config: Map<String, Any?> ->
      val prefs = context.getSharedPreferences(
        MaalamMonitorService.PREFS, Context.MODE_PRIVATE)
      val labelMap = (config["labels"] as? Map<*, *>)
        ?.mapNotNull { (k, v) -> if (k is String && v is String) k to v else null }
        ?.toMap() ?: emptyMap()
      prefs.edit()
        .putBoolean("enabled", config["enabled"] as? Boolean ?: false)
        .putStringSet("packages",
          (config["packages"] as? List<*>)?.filterIsInstance<String>()?.toSet()
            ?: emptySet())
        .putString("labels", org.json.JSONObject(labelMap).toString())
        .putLong("minIntervalMs",
          (config["minIntervalMs"] as? Number)?.toLong() ?: 8000L)
        .apply()
    }

    Function("reportResult") { frameId: String, result: Map<String, Any?>? ->
      MaalamMonitorService.reportResult(frameId, result)
    }

    Function("hasUsageAccess") { hasUsageAccessSafely() }

    Function("openUsageAccessSettings") {
      // Some Android builds do not expose the dedicated Usage access page.
      val settingsIntents = listOf(
        Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS),
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}")),
        Intent(Settings.ACTION_SETTINGS)
      )
      var opened = false
      for (settingsIntent in settingsIntents) {
        val launched = runCatching {
          context.startActivity(settingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }.isSuccess
        if (launched) {
          opened = true
          break
        }
      }
      opened
    }

    // Foreground milliseconds spent in `packages` for each day. `dayStarts` are
    // ascending local-midnight timestamps from JS; the last day runs until now.
    AsyncFunction("getDailyUsage") { packages: List<String>, dayStarts: List<Double> ->
      val totals = DoubleArray(dayStarts.size)
      if (dayStarts.isEmpty() || packages.isEmpty() || !hasUsageAccessSafely()) return@AsyncFunction totals.toList()
      val starts = dayStarts.map { it.toLong() }
      val rangeStart = starts.first()
      val now = System.currentTimeMillis()
      val targets = packages.toSet()

      fun add(from: Long, to: Long) {
        for (i in starts.indices) {
          val dayEnd = if (i + 1 < starts.size) starts[i + 1] else now
          val overlap = minOf(to, dayEnd) - maxOf(from, starts[i])
          if (overlap > 0) totals[i] += overlap.toDouble()
        }
      }

      val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val events = try {
        usm.queryEvents(rangeStart, now)
      } catch (_: SecurityException) {
        return@AsyncFunction totals.toList()
      }
      val event = UsageEvents.Event()
      // Only one activity is in the foreground at a time; track it by package + class.
      var currentPkg: String? = null
      var currentClass: String? = null
      var since = 0L
      var sawAny = false
      fun close(at: Long) {
        if (currentPkg?.let { it in targets } == true) add(since, at)
        currentPkg = null
        currentClass = null
      }
      while (events.hasNextEvent()) {
        events.getNextEvent(event)
        val ts = event.timeStamp
        when (event.eventType) {
          EVENT_RESUMED -> {
            close(ts)
            currentPkg = event.packageName
            currentClass = event.className
            since = ts
          }
          EVENT_PAUSED, EVENT_STOPPED -> {
            if (currentPkg == event.packageName && currentClass == event.className) close(ts)
            // Already in the foreground before the range began.
            else if (!sawAny && currentPkg == null && event.packageName in targets) add(rangeStart, ts)
          }
          EVENT_SCREEN_OFF, EVENT_KEYGUARD_SHOWN, EVENT_SHUTDOWN -> close(ts)
        }
        sawAny = true
      }
      close(now)
      totals.toList()
    }
  }

  private fun hasUsageAccess(): Boolean {
    val ops = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    @Suppress("DEPRECATION")
    val mode = ops.checkOpNoThrow(
      AppOpsManager.OPSTR_GET_USAGE_STATS,
      Process.myUid(),
      context.packageName
    )
    // Usage access is a special app-op. The manifest permission alone does not
    // grant it, so the app-op's allowed state is the source of truth.
    return mode == AppOpsManager.MODE_ALLOWED
  }

  private fun hasUsageAccessSafely(): Boolean = runCatching { hasUsageAccess() }.getOrDefault(false)

  private companion object {
    // UsageEvents.Event types as literals; several constants are API 28/29+.
    const val EVENT_RESUMED = 1
    const val EVENT_PAUSED = 2
    const val EVENT_SCREEN_OFF = 16
    const val EVENT_KEYGUARD_SHOWN = 17
    const val EVENT_STOPPED = 23
    const val EVENT_SHUTDOWN = 26
  }

  private fun cacheIcon(pm: PackageManager, pkg: String, drawable: Drawable?): String {
    val dir = File(context.cacheDir, "app-icons").apply { mkdirs() }
    val file = File(dir, "$pkg.png")
    if (!file.exists() && drawable != null) {
      val bitmap = drawableToBitmap(drawable)
      FileOutputStream(file).use {
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)
      }
      bitmap.recycle()
    }
    return Uri.fromFile(file).toString()
  }

  private fun drawableToBitmap(drawable: Drawable): Bitmap {
    if (drawable is BitmapDrawable && drawable.bitmap != null) {
      return Bitmap.createScaledBitmap(drawable.bitmap, 96, 96, true)
    }
    val bitmap = Bitmap.createBitmap(96, 96, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    drawable.setBounds(0, 0, 96, 96)
    drawable.draw(canvas)
    return bitmap
  }
}
