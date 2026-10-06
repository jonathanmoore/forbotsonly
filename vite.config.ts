import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { SANDBOX_PAGES } from './src/sandbox';

// Vite's SPA fallback would serve the main index.html for /sandbox and /sandbox/complete.
// Rewrite them to their own entries (server.ts does the same for the production build).
function sandboxPages(): Plugin {
  return {
    name: 'sandbox-pages',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const [pathname, query] = (req.url ?? '').split('?');
        const page = SANDBOX_PAGES[pathname];
        if (page) {
          req.url = query ? `${page}?${query}` : page;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  root: 'public',
  plugins: [sandboxPages()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'public/index.html'),
        sandbox: resolve(import.meta.dirname, 'public/sandbox/index.html'),
        sandboxComplete: resolve(import.meta.dirname, 'public/sandbox/complete/index.html'),
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      // xfwd passes the browser's host through, so getPublicOrigin() builds
      // http://localhost:3000 return/success URLs instead of https://localhost:3001.
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        xfwd: true,
      },
      '/mcp': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        xfwd: true,
      },
      '/health': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/.well-known': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
