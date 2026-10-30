import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useCallback, useEffect, useState } from 'react';

import { ATTACHMENT_RULES } from '../utils/validation';

/**
 * Voice note recording.
 *
 * Records real audio to a local file via expo-audio. The recorded file is handed
 * to the caller along with its true duration; nothing is synthesised. Recording
 * stops automatically at the attachment limit so a long recording cannot exceed
 * the storage policy.
 */
export interface RecordedVoiceNote {
  uri: string;
  mimeType: string;
  durationSeconds: number;
  byteSize: number;
}

export interface VoiceNoteRecorder {
  recording: boolean;
  /** Elapsed seconds, updated from the recorder's own status. */
  seconds: number;
  error: string | null;
  /** True when microphone permission has been granted. */
  permitted: boolean | null;
  start: () => Promise<void>;
  stop: () => Promise<RecordedVoiceNote | null>;
  cancel: () => Promise<void>;
}

export function useVoiceNoteRecorder(): VoiceNoteRecorder {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const status = useAudioRecorderState(recorder, 250);
  const [permitted, setPermitted] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const seconds = Math.floor((status.durationMillis ?? 0) / 1000);

  // Stop at the policy limit rather than letting the file grow unbounded.
  useEffect(() => {
    if (!status.isRecording) return;
    if (seconds >= ATTACHMENT_RULES.maxVoiceNoteSeconds) {
      void recorder.stop();
    }
  }, [recorder, seconds, status.isRecording]);

  const start = useCallback(async () => {
    setError(null);
    const permission = await requestRecordingPermissionsAsync();
    setPermitted(permission.granted);
    if (!permission.granted) {
      setError('Microphone access was declined. Enable it in Android settings to record voice notes.');
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setStartedAt(Date.now());
  }, [recorder]);

  const stop = useCallback(async (): Promise<RecordedVoiceNote | null> => {
    try {
      await recorder.stop();
    } catch {
      setError('Could not finish that recording.');
      return null;
    }
    await setAudioModeAsync({ allowsRecording: false });
    const uri = recorder.uri;
    if (!uri) {
      setError('The recording produced no audio file.');
      return null;
    }
    const elapsed = startedAt ? Math.round((Date.now() - startedAt) / 1000) : seconds;
    setStartedAt(null);
    // A sub-second tap produces an unusable file, so it is rejected explicitly.
    if (elapsed < 1) {
      setError('That recording was too short. Hold the button for at least a second.');
      return null;
    }
    return {
      uri,
      mimeType: 'audio/m4a',
      durationSeconds: Math.min(elapsed, ATTACHMENT_RULES.maxVoiceNoteSeconds),
      byteSize: 0,
    };
  }, [recorder, seconds, startedAt]);

  const cancel = useCallback(async () => {
    try {
      await recorder.stop();
    } catch {
      // Already stopped; nothing to do.
    }
    await setAudioModeAsync({ allowsRecording: false });
    setStartedAt(null);
    setError(null);
  }, [recorder]);

  return {
    recording: status.isRecording,
    seconds,
    error,
    permitted,
    start,
    stop,
    cancel,
  };
}
