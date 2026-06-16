import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, type Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(rootDir, 'data');

function serveDataFile(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) {
  if (!req.url?.startsWith('/data/')) {
    next();
    return;
  }

  const relative = decodeURIComponent(req.url.slice('/data/'.length).split('?')[0]);
  if (!relative || relative.includes('..')) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  const filePath = path.resolve(dataDir, relative);
  if (!filePath.startsWith(dataDir + path.sep) && filePath !== dataDir) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }

    const contentType = path.extname(filePath).toLowerCase() === '.json'
      ? 'application/json'
      : 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    fs.createReadStream(filePath).pipe(res);
  });
}

function dataFolderPlugin(): Plugin {
  return {
    name: 'data-folder',
    configureServer(server) {
      server.middlewares.use(serveDataFile);
    },
    configurePreviewServer(server) {
      server.middlewares.use(serveDataFile);
    },
    closeBundle() {
      if (!fs.existsSync(dataDir)) return;
      const distData = path.resolve(rootDir, 'dist', 'data');
      fs.cpSync(dataDir, distData, { recursive: true });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), dataFolderPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, '.'),
    },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
  },
});