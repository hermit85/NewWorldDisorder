export const Accuracy = {
  BestForNavigation: 6,
};

export async function requestForegroundPermissionsAsync() {
  return { status: 'granted' as const };
}

export async function getForegroundPermissionsAsync() {
  return { status: 'granted' as const };
}

export async function getCurrentPositionAsync() {
  return {
    coords: {
      latitude: 52.21722,
      longitude: 21.0013,
      altitude: 147,
      accuracy: 5,
      speed: 0,
    },
    timestamp: 0,
  };
}

export async function watchPositionAsync() {
  return {
    remove() {},
  };
}
