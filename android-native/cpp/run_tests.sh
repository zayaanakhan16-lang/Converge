#!/usr/bin/env bash
# Builds and runs the host test for the Converge waveform DSP.
#
# The DSP has no Android or JNI dependency, so it can be verified on a build
# machine without an emulator or the NDK.
set -euo pipefail

cd "$(dirname "$0")"

: "${CXX:=g++}"

"$CXX" -std=c++20 -Wall -Wextra -Werror -O2 \
  -o waveform_test_bin \
  waveform_test.cpp waveform.cpp

./waveform_test_bin
