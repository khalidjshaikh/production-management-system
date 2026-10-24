import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiTarget = process.env.VITE_API_TARGET ?? 'http://localhost:8090';

export default defineConfig({
  plugins: [react()],
  server: {
    // Bind IPv6 wildcard; on macOS/Linux this normally accepts IPv4-mapped
    // connections too, so the dev UI works on both [::1] and 127.0.0.1.
    host: '::',
    port: 5173,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/actuator': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
});
