import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The client runs on http://localhost:5173 (the server's CORS allows exactly this).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
});
