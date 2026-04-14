import { createRoot } from "react-dom/client";

// PWA Service Worker: Let VitePWA manage registration.
// Only clear stale caches from previous buggy builds (one-time cleanup).
if ('caches' in window && sessionStorage.getItem('medix_cache_v3_cleaned') !== '1') {
    caches.keys().then((keyList) => {
        // Purge almost everything to ensure a fresh build is pulled.
        // We only keep google-fonts to save bandwidth.
        const staleKeys = keyList.filter(k => 
            !k.startsWith('google-fonts') && 
            !k.startsWith('gstatic-fonts')
        );
        
        if (staleKeys.length > 0) {
            console.warn('[Bootstrap] Purging all caches (v3 reset):', staleKeys);
            Promise.all(staleKeys.map(k => caches.delete(k)));
        }
        sessionStorage.setItem('medix_cache_v3_cleaned', '1');
    });
}

// Helper: Detect stale Vite chunk errors (happens after new deploy when old cached chunks are gone)
function isChunkLoadError(msg: string): boolean {
    return /dynamically imported module|importing a module|load failed|chunk/i.test(msg);
}

// Helper: Detect network/fetch errors (common on mobile with spotty connection)
function isNetworkError(msg: string): boolean {
    return /fetch|network|timeout|abort|failed to fetch|load failed|ns_error/i.test(msg);
}

// Auto-reload once for stale chunk errors (prevents infinite loop via sessionStorage flag)
function handleChunkError(msg: string) {
    const reloadKey = 'medix_chunk_reload';
    if (!sessionStorage.getItem(reloadKey)) {
        console.warn('[ChunkError] Stale build detected, auto-reloading:', msg);
        sessionStorage.setItem(reloadKey, '1');
        window.location.reload();
    } else {
        // Already reloaded once — show error (avoid infinite loop)
        sessionStorage.removeItem(reloadKey);
        showCriticalError("App update failed to load. Please clear cache and reload.", msg);
    }
}

// Clear the chunk reload flag on successful load (set later after bootstrap succeeds)

// Global Sync Error Handler
window.onerror = function (msg, url, lineNo, columnNo, error) {
    const msgStr = (typeof msg === 'string' ? msg : '').toLowerCase();

    if (msgStr.indexOf('script error') > -1) {
        console.error('Script Error: See Browser Console for Detail');
        return false;
    }

    // Handle stale chunk errors with auto-reload
    if (isChunkLoadError(msgStr)) {
        handleChunkError(msgStr);
        return true; // Suppress default
    }

    // Suppress network errors on mobile
    if (isNetworkError(msgStr)) {
        console.warn('[Network] Sync error (suppressed overlay):', msgStr);
        return false;
    }

    const message = [
        'Message: ' + msg,
        'URL: ' + url,
        'Line: ' + lineNo,
        'Column: ' + columnNo,
        'Error object: ' + JSON.stringify(error)
    ].join(' - ');
    console.error("Global Error:", message);
    showCriticalError(msg as string, error?.stack);
    return false;
};

// Global Async Error Handler (Promise Rejections)
window.addEventListener('unhandledrejection', (event) => {
    const msg = event.reason?.message || String(event.reason) || "";

    // Handle stale chunk errors with auto-reload
    if (isChunkLoadError(msg)) {
        handleChunkError(msg);
        event.preventDefault();
        return;
    }

    // Suppress network errors on mobile
    if (isNetworkError(msg)) {
        console.warn('[Network] Unhandled rejection (suppressed overlay):', msg);
        return;
    }

    console.error('Unhandled Promise Rejection:', event.reason);
    showCriticalError(event.reason?.message || "Unknown Async Error", event.reason?.stack);
});

// Helper to show error UI
function showCriticalError(message: string, stack?: string) {
    const display = document.getElementById('global-error-display');
    if (display) {
        const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : 'unknown';
        const platform = typeof navigator !== 'undefined' ? navigator.platform : 'unknown';
        const userAgent = typeof navigator !== 'undefined' ? (navigator.userAgent || 'unknown') : 'unknown';
        const locationHref = typeof window !== 'undefined' ? (window.location?.href || 'unknown') : 'unknown';
        const time = new Date().toISOString();
        
        // Construct diagnostic blob for copy-pasting
        const diagnosticInfo = JSON.stringify({
            time,
            isOnline,
            platform,
            userAgent,
            location: locationHref,
            message,
            stack: stack?.substring(0, 500) // Truncate stack for UI safety
        }, null, 2);

        display.innerHTML = `
            <div style="font-family: system-ui, -apple-system, sans-serif; padding: 2rem; background: white; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); max-width: 550px; width: 95%; text-align: center; color: #1f2937; animation: slideUp 0.3s ease-out;">
                <div style="width: 60px; height: 60px; background: #fee2e2; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem;">
                    <svg style="width: 32px; height: 32px; color: #dc2626;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                </div>
                
                <h2 style="margin-bottom: 0.5rem; font-size: 1.75rem; font-weight: 800; letter-spacing: -0.025em;">Critical Error</h2>
                <p style="color: #6b7280; margin-bottom: 1.5rem; line-height: 1.5;">The application encountered an unexpected issue during startup. This is often caused by network restrictions or a stale cache.</p>
                
                <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 1.25rem; border-radius: 12px; text-align: left; font-family: 'ui-monospace', 'Cascadia Code', monospace; font-size: 0.85rem; margin-bottom: 2rem; overflow: auto; max-height: 250px; color: #374151; position: relative;">
                    <button onclick="navigator.clipboard.writeText(this.nextElementSibling.innerText)" style="position: absolute; right: 8px; top: 8px; font-size: 0.7rem; background: #fff; border: 1px solid #ddd; padding: 2px 6px; border-radius: 4px; cursor: pointer;">Copy</button>
                    <pre style="margin: 0; white-space: pre-wrap; word-break: break-all;"><strong>Error: ${message}</strong>\n\nDiagnostic Info:\n${diagnosticInfo}</pre>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <button onclick="window.location.reload()" style="background: #2563eb; color: white; padding: 0.875rem; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; transition: all 0.2s; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);">
                        Reload App
                    </button>
                    <button onclick="medixFactoryReset()" style="background: #dc2626; color: white; padding: 0.875rem; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; transition: all 0.2s; box-shadow: 0 4px 6px -1px rgba(220, 38, 38, 0.2);">
                        Factory Reset
                    </button>
                </div>
                <p style="margin-top: 1.25rem; font-size: 0.8rem; color: #9ca3af; line-height: 1.4;">
                    <strong>Factory Reset</strong> clears all local storage and unregisters service workers. Use this if multiple reloads fail.
                </p>
                
                <style>
                    @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                </style>
            </div>
        `;
        
        // Define the reset function globally so the button can call it
        (window as any).medixFactoryReset = async () => {
            console.warn('[Maintenance] Executing Full Factory Reset...');
            
            // 1. Clear Storages
            localStorage.clear();
            sessionStorage.clear();
            
            // 2. Unregister all Service Workers
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                    await registration.unregister();
                }
            }
            
            // 3. Delete all caches
            if ('caches' in window) {
                const keys = await caches.keys();
                for (const key of keys) {
                    await caches.delete(key);
                }
            }
            
            // 4. Force Reload
            window.location.reload();
        };

        // Ensure container is visible and styled for overlay
        display.style.position = 'fixed';
        display.style.top = '0';
        display.style.left = '0';
        display.style.width = '100vw';
        display.style.height = '100vh';
        display.style.zIndex = '99999';
        display.style.background = 'rgba(17, 24, 39, 0.9)'; // Darker, theme-aware background
        display.style.backdropFilter = 'blur(8px)';
        display.style.display = 'flex';
        display.style.alignItems = 'center';
        display.style.justifyContent = 'center';
    }
}

const updateLoadingStatus = (status: string) => {
    const el = document.getElementById('root');
    if (el) {
        // Only update if it's the loading text
        if (el.innerText.includes('Loading')) {
            el.innerHTML = `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; color: #666;">
                <div>Loading Medix AI Dashboard...</div>
                <div style="font-size: 0.8em; margin-top: 10px; color: #999;">${status}</div>
            </div>`;
        }
    }
    console.log(`[Bootstrap] ${status}`);
};

const bootstrap = async () => {
    try {
        console.log("📦 Starting Application Bootstrap...");
        updateLoadingStatus("Initializing Bootstrap...");

        // Safety Timeout: If app doesn't load in 10s, throw error
        const activeLoad = (async () => {
            // Dynamically import dependencies to isolate crashes
            updateLoadingStatus("Importing Themes...");
            const { ThemeProvider } = await import("next-themes");

            updateLoadingStatus("Importing App Component...");
            const { default: App } = await import("./App.tsx");

            updateLoadingStatus("Importing Error Boundary...");
            const { default: ErrorBoundary } = await import("./components/ErrorBoundary.tsx");

            updateLoadingStatus("Importing Styles...");
            await import("./index.css");

            console.log("✅ Modules Loaded. Mounting React Root...");
            updateLoadingStatus("Mounting React Application...");

            const rootElement = document.getElementById("root");
            if (!rootElement) throw new Error("Root element not found");

            createRoot(rootElement).render(
                <ErrorBoundary>
                    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
                        <App />
                    </ThemeProvider>
                </ErrorBoundary>
            );
            console.log("🚀 React Root Mounted Successfully");
            // Clear chunk reload flag on successful load
            sessionStorage.removeItem('medix_chunk_reload');
        })();

        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Slow network detected. Still trying to load... If this fails, tap Reload App.")), 45000)
        );

        await Promise.race([activeLoad, timeout]);

    } catch (error: any) {
        console.error("🔥 BOOTSTRAP FAILURE:", error);
        // Handle stale chunk errors with auto-reload
        if (isChunkLoadError(error.message || '')) {
            handleChunkError(error.message);
            return;
        }
        showCriticalError(error.message, error.stack);
    }
};

bootstrap();
