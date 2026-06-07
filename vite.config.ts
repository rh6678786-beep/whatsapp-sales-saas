import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  
  // CDN base URL for production builds
  // Set VITE_CDN_URL=https://d12345.cloudfront.net for CloudFront
  // In production: /assets/* → https://d12345.cloudfront.net/assets/*
  // In dev: keep as relative path
  const cdnUrl = env.VITE_CDN_URL || '';
  const base = cdnUrl ? cdnUrl.replace(/\/+$/, '') + '/' : '/';
  
  return {
    base,
    plugins: [react(), tailwindcss()],
    define: {},
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        'node-fetch': path.resolve(__dirname, 'src/empty-shim.ts'),
        'undici': path.resolve(__dirname, 'src/empty-shim.ts'),
      },
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'lucide-react',
        'motion',
        'recharts',
        'd3',
        'axios'
      ],
      exclude: [
        'express',
        '@google/genai',
        'google-auth-library',
        'google-gax',
        'undici',
        'dotenv',
        'node-fetch',
        'path',
        'url',
        'fs',
        'fsevents',
        'child_process',
        'http',
        'https',
        'crypto',
        'stream',
        'os',
        'zlib'
      ],
      entries: ['src/main.tsx', 'index.html'],
    },
    build: {
      rollupOptions: {
        external: [
          'express',
          '@google/genai',
          'dotenv',
          'path',
          'url',
          'fs',
          'node-fetch',
          'undici'
        ],
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-charts': ['recharts', 'd3'],
            'vendor-ui': ['lucide-react', 'motion', 'react-hot-toast'],
            'vendor-socket': ['socket.io-client'],
          },
        },
      },
      chunkSizeWarningLimit: 600,
    },
    server: {
      allowedHosts: true,
      hmr: false,
      watch: {
        ignored: [
          '**/.wwebjs_auth/**',
          '.wwebjs_auth',
          '.wwebjs_auth/**',
          '**/.wwebjs_cache/**',
          '.wwebjs_cache',
          '.wwebjs_cache/**',
          '**/*.json',
          '**/settings.json',
          '**/mock_products.json',
          '**/dist/**',
          '**/node_modules/**'
        ]
      },
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true
        }
      }
    },
  };
});
