import { useCallback, useEffect, useRef } from 'react';

const CLICK_DURATION_SECONDS = 0.025;
const CLICK_GAIN = 0.028;

type AudioContextConstructor = typeof AudioContext;
type AudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: AudioContextConstructor;
  };

function playWebAudioClick(context: AudioContext) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const startedAt = context.currentTime;
  const endsAt = startedAt + CLICK_DURATION_SECONDS;

  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(2_400, startedAt);
  oscillator.frequency.exponentialRampToValueAtTime(900, endsAt);

  gain.gain.setValueAtTime(0.0001, startedAt);
  gain.gain.exponentialRampToValueAtTime(CLICK_GAIN, startedAt + 0.001);
  gain.gain.exponentialRampToValueAtTime(0.0001, endsAt);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.addEventListener('ended', () => {
    oscillator.disconnect();
    gain.disconnect();
  });
  oscillator.start(startedAt);
  oscillator.stop(endsAt);
}

export function useKeyboardFeedback(): () => void {
  const contextRef = useRef<AudioContext | null>(null);

  useEffect(
    () => () => {
      const context = contextRef.current;
      contextRef.current = null;

      if (context && context.state !== 'closed') {
        void context.close().catch(() => undefined);
      }
    },
    []
  );

  return useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const audioWindow = window as AudioWindow;
    const Context = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;

    if (!Context) {
      return;
    }

    try {
      let context = contextRef.current;

      if (!context || context.state === 'closed') {
        context = new Context({ latencyHint: 'interactive' });
        contextRef.current = context;
      }

      if (context.state === 'suspended') {
        void context
          .resume()
          .then(() => playWebAudioClick(context))
          .catch(() => undefined);
        return;
      }

      playWebAudioClick(context);
    } catch {
      // Unsupported or blocked audio feedback should stay silent.
    }
  }, []);
}
