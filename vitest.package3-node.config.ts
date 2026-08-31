import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/package3-node/**/*.test.ts'],
    restoreMocks: true,
  },
});
