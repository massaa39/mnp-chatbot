module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/../tests'],
  testMatch: [
    '**/__tests__/**/*.test.(ts|js)',
    '**/tests/**/*.test.(ts|js)',
    '**/*.test.(ts|js)'
  ],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
    '!src/types/**',
    '!src/**/*.test.{ts,js}',
    '!src/server.ts',
  ],
  coverageDirectory: '../coverage',
  coverageReporters: ['text', 'lcov', 'html', 'clover'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  moduleNameMapping: {
    '^@backend/(.*)$': '<rootDir>/src/$1',
    '^@/(.*)$': '<rootDir>/../$1'
  },
  setupFilesAfterEnv: ['<rootDir>/../tests/helpers/testSetup.ts'],
  testTimeout: 10000,
  verbose: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  maxWorkers: '50%',
  globals: {
    'ts-jest': {
      tsconfig: {
        compilerOptions: {
          module: 'commonjs'
        }
      }
    }
  }
};