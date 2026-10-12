import path from 'node:path';
import { defineConfig } from 'vitest/config';
export default defineConfig({resolve:{alias:{'server-only':path.resolve('tests/support/server-only.ts'),'@':path.resolve('apps/web'),'@reply':path.resolve('packages')}},test:{include:['tests/**/*.test.ts'],fileParallelism:false,testTimeout:20000}});
