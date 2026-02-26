console.log("🚀 Main.tsx is executing... (Versions 2.4 Debug)");
import { createRoot } from "react-dom/client";

// [DEV-BYPASS] Aggressively clear Service Workers and Caches to remove Auth guard
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (registrations) {
        for (let registration of registrations) {
            registration.unregister();
            console.log('Unregistered service worker', registration);
        }
    });
}
if ('caches' in window) {
    caches.keys().then((keyList) => {
        return Promise.all(keyList.map((key) => {
            console.log('Deleting cache', key);
            return caches.delete(key);
        }));
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
    const msgEl = document.getElementById('global-error-message');
    if (display && msgEl) {
        display.style.display = 'flex'; // Changed to flex for centering if CSS supports it, or valid

        // Inject robust HTML directly
        display.innerHTML = `
            <div style="font-family: system-ui, sans-serif; padding: 2rem; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); max-width: 500px; width: 90%; text-align: center;">
                <h2 style="color: #dc2626; margin-bottom: 1rem; font-size: 1.5rem; font-weight: bold;">Critical Error</h2>
                <p style="color: #4b5563; margin-bottom: 1.5rem;">The application trapped a critical error and cannot load.</p>
                
                <div style="background: #f3f4f6; padding: 1rem; border-radius: 8px; text-align: left; font-family: monospace; font-size: 0.8em; margin-bottom: 1.5rem; overflow: auto; max-height: 200px; color: #374151;">
                    <strong>${message}</strong>
                    <div style="margin-top: 0.5rem; opacity: 0.7;">${stack || ''}</div>
                </div>

                <div style="display: flex; gap: 1rem; justify-content: center;">
                    <button onclick="window.location.reload()" style="background: #2563eb; color: white; padding: 0.75rem 1.5rem; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">
                        Reload App
                    </button>
                    <button onclick="localStorage.clear(); sessionStorage.clear(); window.location.reload()" style="background: #dc2626; color: white; padding: 0.75rem 1.5rem; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">
                        Factory Reset (Fix)
                    </button>
                </div>
                <p style="margin-top: 1rem; font-size: 0.75rem; color: #9ca3af;">Factory Reset clears local data which usually fixes startup crashes.</p>
            </div>
        `;
        // Ensure container is visible and styled for overlay
        display.style.position = 'fixed';
        display.style.top = '0';
        display.style.left = '0';
        display.style.width = '100vw';
        display.style.height = '100vh';
        display.style.zIndex = '9999';
        display.style.background = 'rgba(0,0,0,0.8)';
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
            setTimeout(() => reject(new Error("Bootstrap Timed Out (15s). Check Network or Console.")), 15000)
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
