import * as SecureStore from 'expo-secure-store';

export const storage = {
  async setItem(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error('Error guardando en SecureStore:', error);
    }
  },

  async getItem(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error('Error leyendo de SecureStore:', error);
      return null;
    }
  },

  async removeItem(key: string) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('Error eliminando de SecureStore:', error);
    }
  },

  async multiRemove(keys: string[]) {
    try {
      for (const key of keys) {
        await SecureStore.deleteItemAsync(key);
      }
    } catch (error) {
      console.error('Error eliminando múltiples keys:', error);
    }
  }
};