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
        target: 'https://ykrqpxbbyfipjqhpaszf.supabase.co',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/supabase-proxy/, ''),
        secure: true,
      },
      // Reverse proxy to bypass CORS for Groq API (Chatbot)
      '/groq-proxy': {
        target: 'https://api.groq.com',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/groq-proxy/, ''),
        secure: true,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            if (env.GROQ_API_KEY) {
              proxyReq.setHeader('Authorization', `Bearer ${env.GROQ_API_KEY}`);
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
            if (env.GEMINI_API_KEY) {
              proxyReq.setHeader('x-goog-api-key', env.GEMINI_API_KEY);
            }
          });
        }
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'placeholder.svg'],
      manifest: {
        name: 'MedixAI',
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
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
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
                maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              },
            }
          },
          {
            // API calls should generally be NetworkFirst or NetworkOnly
            // since we use React Query for caching state.
            urlPattern: ({ url }) => url.pathname.startsWith('/rest/v1/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 5 // 5 minutes
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
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_debugger: true,
      },
    },
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
