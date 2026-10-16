// No-op AsyncStorage for running the app's api/client.js under Node (persistence is not needed;
// the backtest has its own on-disk response cache in scripts/.cache/).
const AsyncStorage = {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
    getAllKeys: async () => [],
    multiRemove: async () => {},
};
export default AsyncStorage;
