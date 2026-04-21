export const Platform = { OS: 'ios', select: <T,>(options: { ios?: T; default?: T }) => options.ios ?? options.default };

export const AppState = {
  addEventListener: () => ({
    remove() {},
  }),
};
