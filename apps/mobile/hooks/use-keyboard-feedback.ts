import { useAudioPlayer, useAudioPlayerStatus, type AudioSource } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo } from 'react';
import { Platform } from 'react-native';

import {
  createKeyboardClickWav,
  KEYBOARD_CLICK_WAV_FILE_NAME,
} from '@/utils/keyboard-click-wav';

const CLICK_VOLUME = 0.12;

function prepareKeyboardClickSource(): AudioSource {
  try {
    const clickBytes = createKeyboardClickWav();
    const clickFile = new File(Paths.cache, KEYBOARD_CLICK_WAV_FILE_NAME);

    if (!clickFile.exists || clickFile.size !== clickBytes.byteLength) {
      clickFile.create({ overwrite: true });
      clickFile.write(clickBytes);
    }

    return { uri: clickFile.uri };
  } catch {
    return null;
  }
}

function triggerNativeHaptic() {
  if (Platform.OS === 'android') {
    void Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Keyboard_Press).catch(
      () => undefined
    );
    return;
  }

  if (Platform.OS === 'ios') {
    void Haptics.selectionAsync().catch(() => undefined);
  }
}

export function useKeyboardFeedback(): () => void {
  const source = useMemo(prepareKeyboardClickSource, []);
  const player = useAudioPlayer(source, {
    downloadFirst: true,
    keepAudioSessionActive: true,
  });
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    player.volume = CLICK_VOLUME;
  }, [player]);

  return useCallback(() => {
    triggerNativeHaptic();

    if (!status.isLoaded) {
      return;
    }

    try {
      void player.seekTo(0).catch(() => undefined);
      player.play();
    } catch {
      // Feedback must never interrupt a keyboard press.
    }
  }, [player, status.isLoaded]);
}
