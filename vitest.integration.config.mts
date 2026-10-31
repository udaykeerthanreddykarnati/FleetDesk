import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { 'server-only': fileURLToPath(new URL('./tests/server-only-stub.ts', import.meta.url)) } },
  test: { environment: 'node', include: ['tests/**/*.integration.test.ts'], testTimeout: 180000, hookTimeout: 180000, sequence: { concurrent: false } }
});
