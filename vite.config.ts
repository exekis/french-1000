import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function spaRoutesPlugin(): Plugin {
  return {
    name: 'spa-routes-plugin',
    closeBundle() {
      const distDir = resolve(process.cwd(), 'dist');
      const indexPath = resolve(distDir, 'index.html');
      if (!existsSync(indexPath)) return;

      // 404 fallback for GitHub Pages single page routing
      copyFileSync(indexPath, resolve(distDir, '404.html'));

      // sub-directories so direct URL visits work without server-side rewrites
      const routes = ['spanish-1000', 'french-1000'];
      for (const route of routes) {
        const routeDir = resolve(distDir, route);
        mkdirSync(routeDir, { recursive: true });
        copyFileSync(indexPath, resolve(routeDir, 'index.html'));
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    base: env.VITE_BASE_PATH || '/french-1000/',
    plugins: [react(), spaRoutesPlugin()],
    build: { chunkSizeWarningLimit: 2000 },
  };
});
