package expo.modules.localaidevice

import android.content.Context
import android.media.AudioFormat
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.UUID
import kotlin.math.roundToInt

/** Convert compressed Android recordings into mono 16 kHz PCM WAV for LiteRT. */
object LocalAudioDecoder {
  fun prepare(context: Context, uri: String): String {
    val input = File(if (uri.startsWith("file:")) Uri.parse(uri).path ?: error("Invalid audio file") else uri).canonicalFile
    val privateRoots = listOf(context.filesDir.canonicalPath, context.cacheDir.canonicalPath)
    require(privateRoots.any { input.path.startsWith("$it/") }) { "Audio must be in app storage" }
    require(input.isFile) { "Audio file is missing" }
    val extractor = MediaExtractor()
    var decoder: MediaCodec? = null
    var started = false
    val pcm = ByteArrayOutputStream()
    var rate = 16000
    var channels = 1
    var encoding = AudioFormat.ENCODING_PCM_16BIT
    try {
      extractor.setDataSource(input.path)
      val track = (0 until extractor.trackCount).firstOrNull {
        extractor.getTrackFormat(it).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true
      } ?: error("No audio track found")
      extractor.selectTrack(track)
      val format = extractor.getTrackFormat(track)
      rate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
      channels = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
      format.setInteger(MediaFormat.KEY_PCM_ENCODING, AudioFormat.ENCODING_PCM_16BIT)
      decoder = MediaCodec.createDecoderByType(format.getString(MediaFormat.KEY_MIME)!!)
      decoder.configure(format, null, null, 0)
      decoder.start()
      started = true
      var inputEnded = false
      var outputEnded = false
      val info = MediaCodec.BufferInfo()
      val deadline = android.os.SystemClock.elapsedRealtime() + 60_000
      while (!outputEnded) {
        check(android.os.SystemClock.elapsedRealtime() < deadline) { "Audio decoding timed out" }
        if (!inputEnded) {
          val index = decoder.dequeueInputBuffer(10_000)
          if (index >= 0) {
            val buffer = decoder.getInputBuffer(index) ?: error("Audio input unavailable")
            buffer.clear()
            val bytes = extractor.readSampleData(buffer, 0)
            if (bytes < 0) {
              decoder.queueInputBuffer(index, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
              inputEnded = true
            } else {
              decoder.queueInputBuffer(index, 0, bytes, extractor.sampleTime.coerceAtLeast(0), 0)
              extractor.advance()
            }
          }
        }
        val index = decoder.dequeueOutputBuffer(info, 10_000)
        if (index == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
          val output = decoder.outputFormat
          rate = output.getInteger(MediaFormat.KEY_SAMPLE_RATE)
          channels = output.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
          encoding = if (output.containsKey(MediaFormat.KEY_PCM_ENCODING)) output.getInteger(MediaFormat.KEY_PCM_ENCODING) else AudioFormat.ENCODING_PCM_16BIT
        } else if (index >= 0) {
          try {
            if (info.size > 0) {
              val buffer = decoder.getOutputBuffer(index) ?: error("Audio output unavailable")
              buffer.position(info.offset)
              buffer.limit(info.offset + info.size)
              val bytes = ByteArray(info.size)
              buffer.get(bytes)
              check(pcm.size() + bytes.size <= 64 * 1024 * 1024) { "Audio message is too long" }
              pcm.write(bytes)
            }
            outputEnded = info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0
          } finally { decoder.releaseOutputBuffer(index, false) }
        }
      }
    } finally {
      if (started) runCatching { decoder?.stop() }
      runCatching { decoder?.release() }
      extractor.release()
    }
    require(rate > 0 && channels in 1..8) { "Unsupported audio format" }
    require(encoding == AudioFormat.ENCODING_PCM_16BIT || encoding == AudioFormat.ENCODING_PCM_FLOAT) { "Unsupported audio encoding" }
    val bytesPerSample = if (encoding == AudioFormat.ENCODING_PCM_FLOAT) 4 else 2
    val source = ByteBuffer.wrap(pcm.toByteArray()).order(ByteOrder.LITTLE_ENDIAN)
    val frames = source.limit() / (bytesPerSample * channels)
    require(frames > 0) { "Audio recording is empty" }
    val targetFrames = (frames.toLong() * 16000 / rate).coerceAtMost(16000 * 120L).toInt()
    val output = ByteBuffer.allocate(targetFrames * 2).order(ByteOrder.LITTLE_ENDIAN)
    fun mono(frame: Int): Float {
      val offset = frame.coerceIn(0, frames - 1) * channels * bytesPerSample
      var value = 0f
      for (channel in 0 until channels) value += if (bytesPerSample == 4) source.getFloat(offset + channel * 4) else source.getShort(offset + channel * 2) / 32768f
      return value / channels
    }
    for (frame in 0 until targetFrames) {
      val position = frame.toDouble() * rate / 16000
      val left = position.toInt()
      val fraction = (position - left).toFloat()
      val sample = mono(left) * (1f - fraction) + mono(left + 1) * fraction
      output.putShort((sample.coerceIn(-1f, 1f) * 32767).roundToInt().toShort())
    }
    val payload = output.array()
    val header = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN)
    header.put("RIFF".toByteArray()).putInt(36 + payload.size).put("WAVEfmt ".toByteArray())
      .putInt(16).putShort(1.toShort()).putShort(1.toShort()).putInt(16000).putInt(32000)
      .putShort(2.toShort()).putShort(16.toShort()).put("data".toByteArray()).putInt(payload.size)
    val result = File(context.cacheDir, "local-audio-${UUID.randomUUID()}.wav")
    try {
      result.outputStream().use { it.write(header.array()); it.write(payload) }
      return result.path
    } catch (error: Throwable) { result.delete(); throw error }
  }
}
