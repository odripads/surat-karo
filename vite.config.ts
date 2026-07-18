import { defineConfig } from 'vite';

// base './' keeps every asset reference relative, so the build deploys as-is
// to GitHub Pages subpaths, Netlify, or file:// with zero configuration.
export default defineConfig({
  base: './',
});
