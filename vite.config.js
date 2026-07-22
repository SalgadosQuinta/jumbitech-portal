import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Built output goes to docs/ which GitHub Pages serves at portal.jumbitech.com.
export default defineConfig({
  plugins: [react()],
  build: { outDir: 'docs', emptyOutDir: true },
});
