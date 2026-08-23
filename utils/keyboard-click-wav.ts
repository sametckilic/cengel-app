const SAMPLE_RATE = 44_100;
const DURATION_MS = 25;
const CHANNEL_COUNT = 1;
const BITS_PER_SAMPLE = 16;
const WAV_HEADER_BYTES = 44;

export const KEYBOARD_CLICK_WAV_FILE_NAME = 'cengel-keyboard-click-v1.wav';

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function clampSample(value: number) {
  return Math.max(-1, Math.min(1, value));
}

export function createKeyboardClickWav(): Uint8Array {
  const sampleCount = Math.round((SAMPLE_RATE * DURATION_MS) / 1000);
  const bytesPerSample = BITS_PER_SAMPLE / 8;
  const dataByteLength = sampleCount * CHANNEL_COUNT * bytesPerSample;
  const buffer = new ArrayBuffer(WAV_HEADER_BYTES + dataByteLength);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataByteLength, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, CHANNEL_COUNT, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * CHANNEL_COUNT * bytesPerSample, true);
  view.setUint16(32, CHANNEL_COUNT * bytesPerSample, true);
  view.setUint16(34, BITS_PER_SAMPLE, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataByteLength, true);

  let noiseState = 0x6d2b_79f5;
  let previousNoise = 0;

  for (let index = 0; index < sampleCount; index += 1) {
    noiseState = (Math.imul(noiseState, 1_664_525) + 1_013_904_223) >>> 0;

    const noise = ((noiseState >>> 8) / 0x00ff_ffff) * 2 - 1;
    const highPassedNoise = noise - previousNoise * 0.65;
    const progress = index / (sampleCount - 1);
    const attack = Math.min(1, index / (SAMPLE_RATE * 0.00075));
    const decay = (1 - progress) ** 4;
    const sample = clampSample(highPassedNoise * attack * decay * 0.42);

    previousNoise = noise;
    view.setInt16(WAV_HEADER_BYTES + index * bytesPerSample, Math.round(sample * 32_767), true);
  }

  return new Uint8Array(buffer);
}
