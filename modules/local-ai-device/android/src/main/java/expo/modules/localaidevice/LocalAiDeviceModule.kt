package expo.modules.localaidevice

import android.app.ActivityManager
import android.content.Context
import android.os.Build
import android.os.Process
import android.os.StatFs
import android.util.Log
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import org.json.JSONObject

class LocalAiDeviceModule : Module() {
  companion object {
    private val nativeAvailable = runCatching { System.loadLibrary("local_ai_device") }.isSuccess
  }

  private external fun readNeuralDevices(): Array<String>
  private external fun canLoadOpenCl(): Boolean

  private fun resources(): Map<String, Any> {
    val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
    val memory = ActivityManager.MemoryInfo()
    (context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager).getMemoryInfo(memory)
    return mapOf(
      "totalRamBytes" to memory.totalMem.toDouble(),
      "availableRamBytes" to memory.availMem.toDouble(),
      "lowMemory" to memory.lowMemory,
      "freeStorageBytes" to StatFs(context.filesDir.absolutePath).availableBytes.toDouble(),
      "updatedAt" to System.currentTimeMillis().toDouble()
    )
  }

  override fun definition() = ModuleDefinition {
    Name("LocalAiDevice")

    AsyncFunction("prepareAudio") { uri: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      LocalAudioDecoder.prepare(context, uri)
    }

    AsyncFunction("getResources") {
      val snapshot = resources()
      Log.d("LocalAiResources", JSONObject(snapshot).toString())
      snapshot
    }

    AsyncFunction("scan") {
      val soc = if (Build.VERSION.SDK_INT >= 31) Build.SOC_MODEL else Build.HARDWARE
      val neuralDevices = if (nativeAvailable) {
        runCatching { readNeuralDevices().toList() }.getOrDefault(emptyList())
      } else emptyList()
      // NNAPI type 3 is a dedicated accelerator, rather than a CPU or GPU.
      val accelerators = neuralDevices.filter { it.startsWith("3|") }.map { it.substringAfter('|') }
      val vendorNpuDriver = listOf(
        "/vendor/lib64/libQnnHtp.so",
        "/vendor/lib64/libhta_hexagon_runtime_snpe.so"
      ).any { File(it).exists() }
      // Verified chip fallback: some Android versions hide their NNAPI drivers.
      // This indicates physical Hexagon hardware, not LiteRT model support.
      val knownHexagonChip = Regex("^SM8550(?:[-_].*)?$", RegexOption.IGNORE_CASE).matches(soc)
      val npuSource = when {
        accelerators.isNotEmpty() -> "nnapi"
        vendorNpuDriver -> "vendor_driver"
        knownHexagonChip -> "chipset"
        else -> "unknown"
      }
      val snapshot = mapOf(
        "model" to Build.MODEL,
        "soc" to soc,
        "androidApi" to Build.VERSION.SDK_INT,
        "arm64" to (Build.SUPPORTED_ABIS.contains("arm64-v8a") && Process.is64Bit()),
        "npuDetected" to (npuSource != "unknown"),
        "npuSource" to npuSource,
        "neuralDevices" to accelerators,
        "gpuAvailable" to (nativeAvailable && runCatching { canLoadOpenCl() }.getOrDefault(false))
      ) + resources()
      Log.i("LocalAiDevice", JSONObject(snapshot).toString())
      snapshot
    }
  }
}
