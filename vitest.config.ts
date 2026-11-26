import { defineConfig } from 'vitest/config';

// Tests cover the pure logic only (no DOM, no audio).
export default defineConfig({
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
