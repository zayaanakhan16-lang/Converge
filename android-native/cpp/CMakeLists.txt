# Builds the Converge native audio library for Android.
#
# Wired into the Expo-generated Android project by the `convergeAudio` entry in
# mobile/package.json, which `expo prebuild` reads. See android-native/README.md.

cmake_minimum_required(VERSION 3.22.1)

project(converge-audio)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(converge-audio SHARED
  waveform.cpp
  waveform_jni.cpp
)

target_include_directories(converge-audio PRIVATE
  ${CMAKE_CURRENT_SOURCE_DIR}
)

# The DSP has no dependency on the Android runtime, so it is compiled with the
# standard library only and is portable to a host test harness.
target_compile_options(converge-audio PRIVATE
  -Wall
  -Wextra
  -Werror
  -fvisibility=hidden
)

find_library(log-lib log)
target_link_libraries(converge-audio ${log-lib})
