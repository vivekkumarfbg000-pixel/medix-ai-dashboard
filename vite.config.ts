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
      port: 5173,
      proxy: {
      // Reverse proxy to bypass ISP blocks on *.supabase.co (Jio/Airtel India)
      // Browser hits localhost:5173/supabase-proxy/* → Vite forwards server-side to supabase.co
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
    react(),
    VitePWA({
      registerType: 'prompt', // Changed from autoUpdate to prompt to force user awareness if a cache is stubborn
      includeAssets: ['favicon.ico', 'robots.txt', 'placeholder.svg'],
      manifest: {
        name: 'MedixAI (v1.2)', // Versioned manifest name
        short_name: 'MedixAI',
        description: 'AI-Powered Manager for Medical Shops',
        theme_color: '#0ea5e9',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'medix-logo.jpg',
            sizes: '64x64 32x32 24x24 16x16',
            type: 'image/jpeg'
        },
          {
            src: 'medix-logo.jpg',
            sizes: '192x192',
            type: 'image/jpeg'
        },
          {
            src: 'medix-logo.jpg',
            sizes: '512x512',
            type: 'image/jpeg',
            purpose: 'any maskable'
          }
        ]
    },
      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        // CRITICAL: Prevent the Service Worker from intercepting OAuth redirects via proxy
        navigateFallbackDenylist: [/^\/supabase-proxy/],
        globPatterns: ['**/*.{js,css,ico,png,svg,woff2}'], // REMOVED .html to prevent it from being cached as a shell
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname === '/' || url.pathname.endsWith('index.html'),
            handler: 'NetworkFirst', // FORCE NetworkFirst for index.html
            options: {
              cacheName: 'html-cache',
            }
        },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
            },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
        },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
            },
              cacheableResponse: {
                statuses: [0, 200]
            },
            }
        },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/rest/v1/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 5 
            },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    }),
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
  }
  };
});
