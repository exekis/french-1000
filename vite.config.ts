import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
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

      // sub-directories so direct URL visits work without server-side rewrites. the
      // app rewrites the title once it boots, but a crawler and the loading tab only
      // ever see what is in the file, so each route ships its own head
      const shell = readFileSync(indexPath, 'utf8');
      const routes = [
        {
          slug: 'french-1000',
          title: 'French 1000',
          description:
            'A beginner-friendly list of 1,000 French words with English and Persian meanings, examples, and pronunciation.',
        },
        {
          slug: 'spanish-1000',
          title: 'Spanish 1000',
          description:
            'A beginner-friendly list of 1,000 Spanish words with English and Persian meanings, examples, and pronunciation.',
        },
      ];
      for (const route of routes) {
        const routeDir = resolve(distDir, route.slug);
        mkdirSync(routeDir, { recursive: true });
        const html = shell
          .replace(/<title>[^<]*<\/title>/, `<title>${route.title}</title>`)
          .replace(
            /(<meta\s+name="description"\s+content=")[^"]*(")/,
            `$1${route.description}$2`,
          );
        writeFileSync(resolve(routeDir, 'index.html'), html);
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
