import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
    // The family's own timezone, pinned so that local-day logic, SQLite's
    // 'localtime' conversions and date fixtures agree regardless of the host.
    // Without it, streak and leaderboard results depend on where the suite runs
    // and on the hour it runs at.
    env: { TZ: 'Europe/Oslo' },
    coverage: {
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'src/test/']
    }
  }
});
