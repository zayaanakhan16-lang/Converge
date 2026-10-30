package app.converge.audio;

import java.io.File;
import java.io.IOException;
import java.io.RandomAccessFile;

/**
 * Decodes a 16-bit PCM WAV file into normalised samples.
 *
 * <p>This lives on the Java side rather than in TypeScript for two reasons. First,
 * parsing a container format means reading a byte stream with endianness and
 * chunk-boundary handling, which is genuinely faster in JVM byte code than
 * crossing the React Native bridge per sample. Second, it keeps the container
 * format in one place so the native DSP layer receives a plain float array and
 * never has to know about WAV headers.
 *
 * <p>Only uncompressed 16-bit PCM is accepted. Anything else is rejected with a
 * {@link WavDecodeException} rather than being guessed at, because a wrong
 * interpretation would show a misleading waveform.
 */
final class WavDecoder {

    /** Raised when the file is not a WAV file this decoder can read. */
    static final class WavDecodeException extends IOException {
        WavDecodeException(String message) {
            super(message);
        }
    }

    private static final int RIFF_HEADER_SIZE = 12;
    private static final int CHUNK_HEADER_SIZE = 8;
    private static final int FORMAT_PCM = 1;
    private static final int FORMAT_EXTENSIBLE = 0xFFFE;

    /** Guard against a malformed header claiming a huge sample count. */
    private static final int MAX_SAMPLES = 60 * 16000 * 4;

    private WavDecoder() {
    }

    /**
     * Reads every sample from the first audio channel.
     *
     * @param file the WAV file to decode
     * @return samples in the range -1..1
     * @throws WavDecodeException if the file is missing, empty or not 16-bit PCM
     */
    static float[] decodeMono16(File file) throws WavDecodeException {
        if (!file.exists()) {
            throw new WavDecodeException("The recording file no longer exists.");
        }
        if (file.length() == 0) {
            throw new WavDecodeException("The recording is empty.");
        }

        try (RandomAccessFile input = new RandomAccessFile(file, "r")) {
            byte[] riff = new byte[RIFF_HEADER_SIZE];
            input.readFully(riff);
            if (!matches(riff, 0, "RIFF") || !matches(riff, 8, "WAVE")) {
                throw new WavDecodeException("The recording is not a WAV file.");
            }

            int channels = 0;
            int bitsPerSample = 0;
            int audioFormat = 0;
            long dataOffset = -1;
            int dataLength = 0;

            long position = RIFF_HEADER_SIZE;
            while (position + CHUNK_HEADER_SIZE <= input.length()) {
                input.seek(position);
                byte[] header = new byte[CHUNK_HEADER_SIZE];
                input.readFully(header);
                String chunkId = new String(header, 0, 4, "US-ASCII");
                int chunkSize = littleEndianInt(header, 4);

                if ("fmt ".equals(chunkId)) {
                    int readSize = Math.min(chunkSize, 16);
                    if (readSize < 16) {
                        throw new WavDecodeException("The audio format header is incomplete.");
                    }
                    byte[] format = new byte[readSize];
                    input.readFully(format);
                    audioFormat = unsignedShort(format, 0);
                    channels = unsignedShort(format, 2);
                    bitsPerSample = unsignedShort(format, 14);
                } else if ("data".equals(chunkId)) {
                    dataOffset = position + CHUNK_HEADER_SIZE;
                    dataLength = chunkSize;
                    break;
                }

                // Chunks are word aligned: an odd size is followed by a pad byte.
                position += CHUNK_HEADER_SIZE + chunkSize + (chunkSize % 2);
            }

            boolean pcm = audioFormat == FORMAT_PCM || audioFormat == FORMAT_EXTENSIBLE;
            if (!pcm || bitsPerSample != 16 || channels < 1) {
                throw new WavDecodeException(
                        "Only uncompressed 16-bit audio can be read. This recording is "
                                + bitsPerSample + "-bit format " + audioFormat + ".");
            }
            if (dataOffset < 0 || dataLength <= 0) {
                throw new WavDecodeException("The recording contains no audio data.");
            }

            long available = input.length() - dataOffset;
            int usableBytes = (int) Math.min(dataLength, available);
            int frameBytes = channels * 2;
            int frames = usableBytes / frameBytes;
            if (frames > MAX_SAMPLES) {
                throw new WavDecodeException("The recording is longer than this decoder accepts.");
            }
            if (frames == 0) {
                throw new WavDecodeException("The recording contains no complete audio frames.");
            }

            float[] samples = new float[frames];
            byte[] buffer = new byte[Math.min(usableBytes, 64 * 1024)];
            int frameIndex = 0;
            long remaining = (long) frames * frameBytes;

            input.seek(dataOffset);
            while (remaining > 0) {
                int toRead = (int) Math.min(buffer.length, remaining);
                input.readFully(buffer, 0, toRead);
                for (int offset = 0; offset + frameBytes <= toRead; offset += frameBytes) {
                    // Channel 0 only: a voice note is mono in practice, and mixing
                    // would average away the peak the waveform is meant to show.
                    samples[frameIndex++] = littleEndianShort(buffer, offset) / 32768f;
                }
                remaining -= toRead;
            }
            return samples;
        } catch (IOException cause) {
            if (cause instanceof WavDecodeException) {
                throw (WavDecodeException) cause;
            }
            throw new WavDecodeException("The recording could not be read: " + cause.getMessage());
        }
    }

    /** Read an unsigned 16-bit little-endian value, as the header fields are. */
    private static int unsignedShort(byte[] bytes, int offset) {
        return littleEndianShort(bytes, offset) & 0xFFFF;
    }

    private static boolean matches(byte[] bytes, int offset, String expected) {
        if (offset + expected.length() > bytes.length) {
            return false;
        }
        for (int index = 0; index < expected.length(); index++) {
            if (bytes[offset + index] != expected.charAt(index)) {
                return false;
            }
        }
        return true;
    }

    /** Read a signed 16-bit little-endian value. */
    private static short littleEndianShort(byte[] bytes, int offset) {
        return (short) ((bytes[offset] & 0xFF) | ((bytes[offset + 1] & 0xFF) << 8));
    }

    private static int littleEndianInt(byte[] bytes, int offset) {
        return (bytes[offset] & 0xFF)
                | ((bytes[offset + 1] & 0xFF) << 8)
                | ((bytes[offset + 2] & 0xFF) << 16)
                | ((bytes[offset + 3] & 0xFF) << 24);
    }
}
