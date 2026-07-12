/// <reference types="vitest" />
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    server: {
      host: "0.0.0.0",
      port: 3000,
      proxy: {
      // Reverse proxy to bypass ISP blocks on *.supabase.co (Jio/Airtel India)
      // Browser hits localhost:3000/supabase-proxy/* → Vite forwards server-side to supabase.co
      '/supabase-proxy': {
        target: 'https://medixai.shop',
        changeOrigin: true,
        rewrite: (path: string) => path, // Preserve /supabase-proxy/ prefix for the remote proxy
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.error('[Supabase Proxy Error]:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log(`[Supabase Proxy Request]: ${req.method} ${req.url}`);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log(`[Supabase Proxy Response]: ${proxyRes.statusCode} for ${req.url}`);
          });
      },
    },
      // Reverse proxy to bypass CORS for Groq API (Chatbot)
      '/groq-proxy': {
        target: 'https://api.groq.com',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/groq-proxy/, ''),
        secure: true,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            const apiKey = env.VITE_GROQ_API_KEY || env.GROQ_API_KEY;
            if (apiKey) {
              proxyReq.setHeader('Authorization', `Bearer ${apiKey}`);
            }
          });
        }
    },
      // Reverse proxy for Gemini API (Vision processing securely)
      '/gemini-proxy': {
        target: 'https://generativelanguage.googleapis.com',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/gemini-proxy/, ''),
        secure: true,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            const apiKey = env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY;
            if (apiKey) {
              proxyReq.setHeader('x-goog-api-key', apiKey);
            }
          });
        }
    },
  },
  },
  plugins: [
    react()
  ],
  esbuild: {
    pure: ['console.log', 'console.info', 'console.debug'],
    drop: ['debugger']
  },
  build: {
    minify: 'esbuild', sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-slot',
            '@radix-ui/react-toast',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            'lucide-react',
            'class-variance-authority',
            'clsx',
            'tailwind-merge'
          ],
          'chart-vendor': ['recharts'],
          'supabase-vendor': ['@supabase/supabase-js'],
          'query-vendor': ['@tanstack/react-query'],
          'form-vendor': ['react-hook-form', 'zod', '@hookform/resolvers'],
          'utils-vendor': ['date-fns', 'papaparse', 'jspdf', 'jspdf-autotable']
        }
      }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/__tests__/setup.ts',
  }
  };
});
