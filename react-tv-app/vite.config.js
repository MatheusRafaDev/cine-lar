import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react()
  ],
  base: './', // Essencial para rodar como arquivo local ou empacotado no Tizen (.wgt)
  server: {
    port: 3000,
    host: true
  },
  build: {
    target: ['chrome69', 'safari12'],
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'icons';
          }
          if (id.includes('node_modules/framer-motion')) {
            return 'motion';
          }
          if (id.includes('@fontsource')) {
            return 'fonts';
          }
        }
      }
    }
  }
});
