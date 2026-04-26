// Test mock for @react-native-community/netinfo.
// Mirrors the public addEventListener/fetch surface and exposes
// __setState / __reset helpers (cast to access from tests) so suites
// can drive offline/online transitions deterministically.

type Listener = (state: { isConnected: boolean | null; isInternetReachable?: boolean | null }) => void;

const listeners = new Set<Listener>();
let currentState: { isConnected: boolean | null; isInternetReachable?: boolean | null } = {
  isConnected: true,
  isInternetReachable: true,
};

const NetInfo = {
  addEventListener(listener: Listener) {
    listeners.add(listener);
    listener(currentState);
    return () => {
      listeners.delete(listener);
    };
  },
  fetch() {
    return Promise.resolve(currentState);
  },
  // Test-only — real NetInfo does not expose these.
  __setState(state: { isConnected: boolean | null; isInternetReachable?: boolean | null }) {
    currentState = { ...currentState, ...state };
    listeners.forEach((l) => l(currentState));
  },
  __reset() {
    listeners.clear();
    currentState = { isConnected: true, isInternetReachable: true };
  },
};

export default NetInfo;
