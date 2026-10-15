import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/ws': { target: 'ws://localhost:8000', ws: true },
      '/devices': 'http://localhost:8000',
      '/simulation': 'http://localhost:8000',
      '/metrics': 'http://localhost:8000',
      '/reset': 'http://localhost:8000',
      '/logs': 'http://localhost:8000',
    },
  },
});
