#!/usr/bin/env bash
# Compiles and runs the host test for the Converge WAV decoder.
#
# WavDecoder has no Android or React Native dependency, so it can be verified
# with a plain JDK and no emulator. The React Native module classes in the same
# package need the RN Java sources on the classpath and are therefore excluded
# from this build.
set -euo pipefail

cd "$(dirname "$0")"

: "${JAVAC:=javac}"
: "${JAVA:=java}"

output_dir="$(mktemp -d)"
trap 'rm -rf "$output_dir"' EXIT

"$JAVAC" -d "$output_dir" \
  app/converge/audio/WavDecoder.java \
  test/app/converge/audio/WavDecoderTest.java

"$JAVA" -cp "$output_dir" app.converge.audio.WavDecoderTest
