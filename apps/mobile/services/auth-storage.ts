import * as SecureStore from 'expo-secure-store';

const CHUNK_SIZE = 1800;

export type AuthStorage = {
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
  setItem(key: string, value: string): Promise<void>;
};

function countKey(key: string): string {
  return `${key}.chunk-count`;
}

function chunkKey(key: string, index: number): string {
  return `${key}.chunk-${index}`;
}

async function readChunkCount(key: string): Promise<number> {
  const value = await SecureStore.getItemAsync(countKey(key));
  const count = Number(value);
  return Number.isInteger(count) && count > 0 ? count : 0;
}

export const authStorage: AuthStorage = {
  async getItem(key) {
    const count = await readChunkCount(key);

    if (count === 0) {
      return SecureStore.getItemAsync(key);
    }

    const chunks = await Promise.all(
      Array.from({ length: count }, (_, index) =>
        SecureStore.getItemAsync(chunkKey(key, index)),
      ),
    );

    return chunks.every((chunk): chunk is string => chunk !== null)
      ? chunks.join('')
      : null;
  },
  async removeItem(key) {
    const count = await readChunkCount(key);
    await Promise.all([
      SecureStore.deleteItemAsync(key),
      SecureStore.deleteItemAsync(countKey(key)),
      ...Array.from({ length: count }, (_, index) =>
        SecureStore.deleteItemAsync(chunkKey(key, index)),
      ),
    ]);
  },
  async setItem(key, value) {
    const previousCount = await readChunkCount(key);
    const chunks = Array.from(
      { length: Math.ceil(value.length / CHUNK_SIZE) },
      (_, index) => value.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE),
    );

    await Promise.all(
      chunks.map((chunk, index) =>
        SecureStore.setItemAsync(chunkKey(key, index), chunk),
      ),
    );
    await SecureStore.setItemAsync(countKey(key), String(chunks.length));
    await SecureStore.deleteItemAsync(key);
    await Promise.all(
      Array.from(
        { length: Math.max(0, previousCount - chunks.length) },
        (_, offset) =>
          SecureStore.deleteItemAsync(chunkKey(key, chunks.length + offset)),
      ),
    );
  },
};
