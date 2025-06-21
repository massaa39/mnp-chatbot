module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests', '<rootDir>/backend/src'],
  testMatch: [
    '**/__tests__/**/*.test.(ts|js)',
    '**/tests/**/*.test.(ts|js)',
    '**/*.test.(ts|js)'
  ],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  collectCoverageFrom: [
    'backend/src/**/*.{ts,js}',
    '!backend/src/**/*.d.ts',
    '!backend/src/types/**',
    '!backend/src/**/*.test.{ts,js}',
    '!backend/src/server.ts',
  ],
  coverageDirectory: 'coverage',
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
    '^@backend/(.*)$': '<rootDir>/backend/src/$1',
    '^@/(.*)$': '<rootDir>/$1'
  },
  setupFilesAfterEnv: ['<rootDir>/tests/helpers/testSetup.ts'],
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
