import { ThemeProvider } from "next-themes";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import ErrorBoundary from "./components/ErrorBoundary.tsx";
import logger from "./utils/logger.ts";
import "./index.css";

// Force unregister service worker to clear old cache
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (registrations) {
        for (let registration of registrations) {
            registration.unregister();
            logger.log('Service Worker unregistered');
        }
    });
}

createRoot(document.getElementById("root")!).render(
    <ErrorBoundary>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <App />
        </ThemeProvider>
    </ErrorBoundary>
);
