import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    server: {
      host: '127.0.0.1',
      port: 4173,
      strictPort: true,
    },
    preview: {
      host: '127.0.0.1',
      port: 4173,
      strictPort: true,
    },
    define: {
      __RED_EGG_BUILD_ENV__: JSON.stringify(env.APP_ENV || mode),
    },
    test: {
      environment: 'node',
      globals: true,
      include: ['tests/simplified/**/*.test.js', 'tests/simplified-database-contract.test.js'],
    },
  };
});
