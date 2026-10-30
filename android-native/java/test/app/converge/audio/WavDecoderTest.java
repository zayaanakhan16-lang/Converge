package app.converge.audio;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;

/**
 * Host test for {@link WavDecoder}.
 *
 * The decoder has no Android dependency, so it can be verified with a plain JDK
 * and no emulator. WAV files are synthesised in the test itself rather than
 * committed as fixtures, so the expected sample values are visible next to the
 * assertions. Run with:
 *
 *   cd android-native/java && ./run_tests.sh
 */
public final class WavDecoderTest {

    private static int failures = 0;

    private WavDecoderTest() {
    }


    public static void main(String[] args) throws Exception {
        testDecodesMono16Bit();
        testTakesFirstChannelFromStereo();
        testRejectsNonWav();
        testRejectsEightBit();
        testRejectsEmptyFile();
        testHandlesChunkBeforeFormat();
        testRejectsTruncatedDataChunk();

        if (failures == 0) {
            System.out.println("\nWAV DECODER TESTS PASSED");
            return;
        }
        System.out.printf("%n%d wav decoder test(s) failed%n", failures);
        System.exit(1);
    }

    private static void testDecodesMono16Bit() throws IOException {
        short[] samples = {0, 16384, -16384, 32767, -32768};
        File file = writeWav(samples, 1, 16, false);
        float[] decoded = WavDecoder.decodeMono16(file);
        expect(decoded.length == samples.length, "every mono sample is decoded");
        expect(close(decoded[0], 0f), "silence decodes to zero");
        expect(close(decoded[1], 0.5f), "half scale decodes to 0.5");
        expect(close(decoded[2], -0.5f), "negative half scale decodes to -0.5");
        expect(close(decoded[3], 32767f / 32768f), "full positive scale decodes correctly");
        expect(close(decoded[4], -1f), "the most negative sample decodes to -1");
    }

    private static void testTakesFirstChannelFromStereo() throws IOException {
        // Interleaved left/right where the right channel is always silent.
        short[] interleaved = {1000, 0, 2000, 0, 3000, 0};
        File file = writeWav(interleaved, 2, 16, false);
        float[] decoded = WavDecoder.decodeMono16(file);
        expect(decoded.length == 3, "a stereo file yields one sample per frame");
        expect(close(decoded[0], 1000f / 32768f), "the left channel is read, not mixed");
        expect(close(decoded[2], 3000f / 32768f), "later frames keep their channel order");
    }

    private static void testRejectsNonWav() throws IOException {
        File file = File.createTempFile("converge-not-wav", ".bin");
        try (OutputStream out = new FileOutputStream(file)) {
            out.write("this is definitely not a wav file".getBytes());
        }
        expectRejects(file, "a file that is not RIFF/WAVE is rejected");
    }

    private static void testRejectsEightBit() throws IOException {
        File file = writeWav(new short[] {1, 2, 3, 4}, 1, 8, false);
        expectRejects(file, "an 8-bit file is rejected rather than guessed at");
    }

    private static void testRejectsEmptyFile() throws IOException {
        File file = File.createTempFile("converge-empty", ".wav");
        expectRejects(file, "an empty file is rejected");
    }

    private static void testHandlesChunkBeforeFormat() throws IOException {
        // A LIST chunk ahead of fmt/: the decoder must skip it and keep reading.
        short[] samples = {8192, -8192};
        File file = writeWav(samples, 1, 16, true);
        float[] decoded = WavDecoder.decodeMono16(file);
        expect(decoded.length == 2, "chunks before fmt are skipped, not misread");
        expect(close(decoded[0], 0.25f), "the data after a skipped chunk decodes correctly");
    }

    private static void testRejectsTruncatedDataChunk() throws IOException {
        // A header that claims more audio than the file contains must still
        // return the frames that are actually present, not throw or pad.
        File full = writeWav(new short[] {1000, 2000, 3000, 4000}, 1, 16, false);
        byte[] bytes = java.nio.file.Files.readAllBytes(full.toPath());
        byte[] truncated = new byte[bytes.length - 4];
        System.arraycopy(bytes, 0, truncated, 0, truncated.length);
        File file = File.createTempFile("converge-truncated", ".wav");
        java.nio.file.Files.write(file.toPath(), truncated);

        float[] decoded = WavDecoder.decodeMono16(file);
        expect(decoded.length == 2, "a truncated data chunk returns the frames present");
        expect(close(decoded[0], 1000f / 32768f), "the first surviving frame is correct");
    }

    // ---- helpers ---------------------------------------------------------

    private static void expectRejects(File file, String description) {
        try {
            WavDecoder.decodeMono16(file);
            fail(description + " (it was accepted)");
        } catch (WavDecoder.WavDecodeException expected) {
            pass(description);
        }
    }

    private static boolean close(float actual, float expected) {
        return Math.abs(actual - expected) < 1e-6f;
    }

    private static void expect(boolean condition, String description) {
        if (condition) {
            pass(description);
        } else {
            fail(description);
        }
    }

    private static void pass(String description) {
        System.out.println("ok   " + description);
    }

    private static void fail(String description) {
        System.out.println("FAIL " + description);
        failures++;
    }

    /** Writes a minimal WAV file, optionally preceded by a skippable chunk. */
    private static File writeWav(short[] samples, int channels, int bitsPerSample,
                                 boolean includeLeadingChunk) throws IOException {
        int frameBytes = channels * (bitsPerSample / 8);
        int dataBytes = samples.length * (bitsPerSample / 8);
        int leadingBytes = includeLeadingChunk ? 8 + 5 + 1 : 0; // payload plus pad byte

        File file = File.createTempFile("converge-wav", ".wav");
        try (OutputStream out = new FileOutputStream(file)) {
            writeAscii(out, "RIFF");
            writeInt(out, 36 + dataBytes + leadingBytes - 8);
            writeAscii(out, "WAVE");

            if (includeLeadingChunk) {
                // An odd-sized chunk is followed by a pad byte that is not part of
                // the declared length. Five bytes of payload exercises that path.
                writeAscii(out, "LIST");
                writeInt(out, 5);
                out.write("INFOX".getBytes());
                out.write(0);
            }

            writeAscii(out, "fmt ");
            writeInt(out, 16);
            writeShort(out, 1); // PCM
            writeShort(out, channels);
            writeInt(out, 16000); // sample rate
            writeInt(out, 16000 * frameBytes); // byte rate
            writeShort(out, frameBytes); // block align
            writeShort(out, bitsPerSample);

            writeAscii(out, "data");
            writeInt(out, dataBytes);
            for (short sample : samples) {
                if (bitsPerSample == 16) {
                    writeShort(out, sample);
                } else {
                    out.write(sample & 0xFF);
                }
            }
        }
        return file;
    }

    private static void writeAscii(OutputStream out, String value) throws IOException {
        out.write(value.getBytes("US-ASCII"));
    }

    private static void writeInt(OutputStream out, int value) throws IOException {
        out.write(value & 0xFF);
        out.write((value >> 8) & 0xFF);
        out.write((value >> 16) & 0xFF);
        out.write((value >> 24) & 0xFF);
    }

    private static void writeShort(OutputStream out, int value) throws IOException {
        out.write(value & 0xFF);
        out.write((value >> 8) & 0xFF);
    }
}
