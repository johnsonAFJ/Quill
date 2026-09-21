import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// The published site lives at https://johnsonafj.github.io/Quill/, so built
// files need the /Quill/ prefix. The test copy on the Mac runs at the root of
// http://localhost:5173/. Both addresses are registered with Dropbox.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/Quill/' : '/',
  server: { port: 5173, strictPort: true },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-180.png', 'icons/favicon-32.png'],
      manifest: {
        name: 'Quill',
        short_name: 'Quill',
        description: 'A quiet place to write, backed by Markdown files in Dropbox.',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#f7f5f0',
        theme_color: '#f7f5f0',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  test: { environment: 'node' },
}));
