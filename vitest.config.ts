import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    // The Worker backend in apps/api has its own test setup.
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
