package expo.modules.appmonitor

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/** Runs the JS "MaalamScan" headless task for one captured frame. */
class MaalamScanTaskService : HeadlessJsTaskService() {
  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
    val extras = intent?.extras ?: return null
    return HeadlessJsTaskConfig("MaalamScan", Arguments.fromBundle(extras), 120_000L, true)
  }
}
