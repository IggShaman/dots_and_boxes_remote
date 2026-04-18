import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/dots_and_boxes_remote/',
  server: { port: 3000 },
});
