module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^expo-location$': '<rootDir>/test/mocks/expo-location.ts',
    '^react-native$': '<rootDir>/test/mocks/react-native.ts',
    '^@react-native-async-storage/async-storage$': '<rootDir>/test/mocks/async-storage.ts',
    '^react-native-url-polyfill/auto$': '<rootDir>/test/mocks/empty.ts',
  },
  setupFiles: ['<rootDir>/test/setupEnv.ts'],
  clearMocks: true,
};
