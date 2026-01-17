console.log("🚀 Main.tsx is executing... (Dynamic Load)");
import { createRoot } from "react-dom/client";

// Global Async Error Handler (Promise Rejections)
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled Promise Rejection:', event.reason);
});

const bootstrap = async () => {
    try {
        console.log("📦 Starting Application Bootstrap...");

        // Dynamically import dependencies to isolate crashes
        const { ThemeProvider } = await import("next-themes");
        const { default: App } = await import("./App.tsx");
        const { default: ErrorBoundary } = await import("./components/ErrorBoundary.tsx");
        // import("./index.css"); // CSS usually doesn't crash JS, but good to know
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
