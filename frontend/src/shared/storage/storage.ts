import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Small JSON values kept on the device: AsyncStorage on phones, `localStorage` on the web.
 * Storage can be unavailable (a private browser window, a full disk), so reads fall back to
 * nothing and writes fail quietly: the app keeps working with the values in memory.
 */
export const storage = {
  async read<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(key);
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  },
  async write(key: string, value: unknown): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch {
      return;
    }
  },
  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      return;
    }
  },
};
