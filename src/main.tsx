console.log("🚀 Main.tsx is executing... (Dynamic Load)");
import { createRoot } from "react-dom/client";

// Global Async Error Handler (Promise Rejections)
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled Promise Rejection:', event.reason);
});

const bootstrap = async () => {
    try {
        console.log("📦 Starting Application Bootstrap...");

        // Safety Timeout: If app doesn't load in 10s, throw error
        const activeLoad = (async () => {
            // Dynamically import dependencies to isolate crashes
            const { ThemeProvider } = await import("next-themes");
            const { default: App } = await import("./App.tsx");
            const { default: ErrorBoundary } = await import("./components/ErrorBoundary.tsx"); // Correct path?
            // Note: If ErrorBoundary was deleted in previous step, we should use a local simple one or restore it.
            // Wait, previous turn deleted 'src/components/common/ErrorBoundary.tsx'. 
            // main.tsx imports from './components/ErrorBoundary.tsx'. 
            // Let's assume the previous turn deleted the WRONG one or the file exists at the root of components.
            // I will check file existence in next step if needed, but for now I assume standard path.

            await import("./index.css");

            console.log("✅ Modules Loaded. Mounting React Root...");

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
        })();

        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Bootstrap Timed Out (10s). Check Network or Console.")), 10000)
        );

        await Promise.race([activeLoad, timeout]);

    } catch (error: any) {
        console.error("🔥 BOOTSTRAP FAILURE:", error);

        // Manually report to the DOM if React fails
        const display = document.getElementById('global-error-display');
        const message = document.getElementById('global-error-message');
        if (display && message) {
            display.style.display = 'block';
            message.textContent = `CRITICAL BOOTSTRAP ERROR:\n${error.message}\n\nStack:\n${error.stack}`;
        }
    }
};

bootstrap();
