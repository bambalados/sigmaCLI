import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'bin/sigma': 'bin/sigma.ts',
    index: 'src/index.ts',
  },
  format: ['esm'],
  target: 'node20',
  splitting: true,
  clean: true,
  sourcemap: true,
});
