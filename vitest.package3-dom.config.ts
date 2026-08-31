import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/package3-dom/**/*.test.tsx'],
    setupFiles: ['tests/package2-dom/setup.ts'],
    restoreMocks: true,
  },
});
