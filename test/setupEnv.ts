process.env.TZ = 'UTC';
(globalThis as { __DEV__?: boolean }).__DEV__ = false;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const originalConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  const first = typeof args[0] === 'string' ? args[0] : '';
  if (
    first.includes('react-test-renderer is deprecated') ||
    first.includes('The current testing environment is not configured to support act')
  ) {
    return;
  }
  originalConsoleError(...args);
};
