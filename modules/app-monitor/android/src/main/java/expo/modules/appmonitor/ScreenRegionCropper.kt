package expo.modules.appmonitor

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import org.opencv.android.OpenCVLoader
import org.opencv.android.Utils
import org.opencv.core.Mat
import org.opencv.core.Rect
import org.opencv.core.Size
import org.opencv.imgproc.Imgproc
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import kotlin.math.ceil
import kotlin.math.floor

/** OpenCV crops model-localized evidence; it does not classify AI authorship. */
object ScreenRegionCropper {
  @Synchronized
  fun crop(context: Context, uri: String, regions: List<Map<String, Double>>): List<String?> {
    val parsed = Uri.parse(uri)
    require(parsed.scheme == "file") { "Only private captured files may be cropped." }
    val source = File(requireNotNull(parsed.path)).canonicalFile
    val cache = context.cacheDir.canonicalFile.path + File.separator
    val documents = context.filesDir.canonicalFile.path + File.separator
    require(source.path.startsWith(cache) || source.path.startsWith(documents)) { "Screenshot is outside app storage." }
    require(source.length() <= 14L * 1024 * 1024) { "Screenshot is too large." }
    check(OpenCVLoader.initLocal()) { "OpenCV could not initialize." }
    val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(source.path, options)
    require(options.outWidth > 0 && options.outHeight > 0) { "Invalid screenshot." }
    // Decode to at most roughly 2 megapixels before allocating an OpenCV Mat.
    options.inSampleSize = 1
    while ((options.outWidth / options.inSampleSize).toLong() * (options.outHeight / options.inSampleSize) > 2_000_000) options.inSampleSize *= 2
    options.inJustDecodeBounds = false
    val bitmap = requireNotNull(BitmapFactory.decodeFile(source.path, options)) { "Screenshot could not be decoded." }
    val image = Mat()
    val directory = File(context.filesDir, "detection-crops").apply { mkdirs() }
    try {
      Utils.bitmapToMat(bitmap, image)
      return regions.take(4).map { region ->
        val x = region["x"] ?: return@map null
        val y = region["y"] ?: return@map null
        val width = region["width"] ?: return@map null
        val height = region["height"] ?: return@map null
        if (listOf(x, y, width, height).any { !it.isFinite() } || x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1.001 || y + height > 1.001) return@map null
        val left = floor(x * image.cols()).toInt().coerceIn(0, image.cols() - 1)
        val top = floor(y * image.rows()).toInt().coerceIn(0, image.rows() - 1)
        val right = ceil((x + width) * image.cols()).toInt().coerceIn(left + 1, image.cols())
        val bottom = ceil((y + height) * image.rows()).toInt().coerceIn(top + 1, image.rows())
        val crop = image.submat(Rect(left, top, right - left, bottom - top))
        val output = Mat()
        var preview: Bitmap? = null
        val file = File(directory, "${UUID.randomUUID()}.jpg")
        try {
          val scale = minOf(1.0, 512.0 / maxOf(crop.cols(), crop.rows()))
          Imgproc.resize(crop, output, Size(maxOf(1.0, crop.cols() * scale), maxOf(1.0, crop.rows() * scale)))
          preview = Bitmap.createBitmap(output.cols(), output.rows(), Bitmap.Config.ARGB_8888)
          Utils.matToBitmap(output, preview)
          FileOutputStream(file).use { check(preview.compress(Bitmap.CompressFormat.JPEG, 82, it)) }
          Uri.fromFile(file).toString()
        } catch (_: Exception) { file.delete(); null }
        finally { preview?.recycle(); output.release(); crop.release() }
      }
    } finally { bitmap.recycle(); image.release() }
  }
}
