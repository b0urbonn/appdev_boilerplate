package expo.modules.appmonitor

import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Bundle
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

/** A temporary picker task returns directly to the app the user was browsing. */
class OverlayAttachmentActivity : Activity() {
  private val kind: String get() = intent.getStringExtra("kind") ?: "image"

  override fun onCreate(state: Bundle?) {
    super.onCreate(state)
    if (state != null) return
    try {
      @Suppress("DEPRECATION")
      startActivityForResult(Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
        addCategory(Intent.CATEGORY_OPENABLE)
        type = when (kind) { "video" -> "video/*"; "audio" -> "audio/*"; else -> "image/*" }
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }, 91)
    } catch (_: Exception) { deliver(null, "Could not open the file picker.") }
  }

  @Deprecated("Activity result API retained for this isolated non-React picker")
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    if (requestCode != 91) return
    val uri = data?.data
    if (resultCode != RESULT_OK || uri == null) { deliver(null, null); return }
    Thread({
      try { val file = copySelectedFile(uri); runOnUiThread { deliver(Uri.fromFile(file).toString(), null) } }
      catch (error: Exception) { runOnUiThread { deliver(null, error.message ?: "Could not attach this file.") } }
    }, "MaalamAttachment").start()
  }

  private fun deliver(uri: String?, error: String?) {
    val monitor = MaalamMonitorService.instance?.get()
    if (monitor != null) monitor.onAttachmentPicked(uri, kind, error)
    else if (uri != null) File(Uri.parse(uri).path ?: "").delete()
    finish()
  }

  private fun copySelectedFile(uri: Uri): File {
    val mime = contentResolver.getType(uri)?.lowercase() ?: ""
    val ext = mapOf("image/jpeg" to "jpg", "image/png" to "png", "image/webp" to "webp", "image/gif" to "gif",
      "video/mp4" to "mp4", "video/webm" to "webm", "video/quicktime" to "mov",
      "audio/mpeg" to "mp3", "audio/mp4" to "m4a", "audio/aac" to "aac", "audio/wav" to "wav", "audio/x-wav" to "wav", "audio/ogg" to "ogg", "audio/webm" to "webm")[mime]
      ?: throw IllegalArgumentException("Unsupported file format. Use a screenshot, MP4, or supported audio file.")
    require(mime.startsWith("$kind/")) { "Choose a $kind file." }
    val dir = File(cacheDir, "monitor-attachments").apply { mkdirs() }
    val file = File(dir, "${UUID.randomUUID()}.$ext")
    try {
      contentResolver.openInputStream(uri).use { input ->
        requireNotNull(input) { "This file could not be opened." }
        FileOutputStream(file).use { output ->
          val buffer = ByteArray(64 * 1024)
          var total = 0L
          while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            total += read
            require(total <= 12L * 1024 * 1024) { "This file is too large. Choose one under 12 MB or attach a screenshot." }
            output.write(buffer, 0, read)
          }
        }
      }
      if (kind != "image") return file
      val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
      BitmapFactory.decodeFile(file.path, options)
      require(options.outWidth > 0 && options.outHeight > 0) { "The image could not be read." }
      options.inSampleSize = 1
      while ((options.outWidth / options.inSampleSize).toLong() * (options.outHeight / options.inSampleSize) > 2_000_000) options.inSampleSize *= 2
      options.inJustDecodeBounds = false
      val bitmap = requireNotNull(BitmapFactory.decodeFile(file.path, options)) { "The image could not be read." }
      val scale = minOf(1.0, 1024.0 / maxOf(bitmap.width, bitmap.height))
      val scaled = Bitmap.createScaledBitmap(bitmap, maxOf(1, (bitmap.width * scale).toInt()), maxOf(1, (bitmap.height * scale).toInt()), true)
      val imageFile = File(dir, "${UUID.randomUUID()}.jpg")
      try {
        FileOutputStream(imageFile).use { check(scaled.compress(Bitmap.CompressFormat.JPEG, 82, it)) }
        file.delete()
        return imageFile
      } catch (error: Exception) { imageFile.delete(); throw error }
      finally { if (scaled !== bitmap) scaled.recycle(); bitmap.recycle() }
    } catch (error: Exception) { file.delete(); throw error }
  }
}
