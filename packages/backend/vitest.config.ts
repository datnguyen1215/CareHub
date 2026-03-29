import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    env: {
      JWT_SECRET: 'test-secret',
      DATABASE_URL: 'postgresql://postgres@localhost:5432/carehub_test',
    },
    // Disable file parallelism to prevent race conditions in database tests
    fileParallelism: false,
    // Isolate tests properly to prevent resource leaks
    isolate: true,
    // Use forks for better isolation between test files
    pool: 'forks',
    poolOptions: {
      forks: {
        // Each test file runs in isolation
        isolate: true,
      },
    },
    // Fail fast on unhandled errors
    dangerouslyIgnoreUnhandledErrors: false,
    // Timeout for hanging tests
    testTimeout: 10000,
    hookTimeout: 10000,
  },
})
