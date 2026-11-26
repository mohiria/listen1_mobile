// In-memory stand-in for @react-native-community/async-storage.
// Starts empty on every run, so providers always fetch fresh tokens.
const store = new Map();

export default {
  getItem: async (key) => (store.has(key) ? store.get(key) : null),
  setItem: async (key, value) => {
    store.set(key, String(value));
  },
  removeItem: async (key) => {
    store.delete(key);
  },
};
