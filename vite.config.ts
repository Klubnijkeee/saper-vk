import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // Относительные пути — чтобы сборка работала и в подкаталоге (GitHub Pages).
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        /*
         * Имена файлов без хеша — осознанное решение.
         *
         * С хешем каждая публикация удаляла файлы прошлой сборки, а закешированный
         * `index.html` (кеш браузера, веб-вью ВК, CDN Pages) продолжал ссылаться на
         * уже удалённый файл: приложение открывалось белым экраном. Со стабильными
         * именами старый HTML всегда находит свои файлы, а свежесть даёт сам кеш
         * `index.html` (GitHub Pages держит его 10 минут).
         */
        entryFileNames: 'assets/app.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
