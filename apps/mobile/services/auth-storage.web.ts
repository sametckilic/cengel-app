import type { AuthStorage } from '@/services/auth-storage';

const memoryStorage = new Map<string, string>();

export const authStorage: AuthStorage = {
  async getItem(key) {
    return typeof window === 'undefined'
      ? (memoryStorage.get(key) ?? null)
      : window.localStorage.getItem(key);
  },
  async removeItem(key) {
    if (typeof window === 'undefined') {
      memoryStorage.delete(key);
      return;
    }

    window.localStorage.removeItem(key);
  },
  async setItem(key, value) {
    if (typeof window === 'undefined') {
      memoryStorage.set(key, value);
      return;
    }

    window.localStorage.setItem(key, value);
  },
};
