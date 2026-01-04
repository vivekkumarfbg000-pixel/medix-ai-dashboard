import { ThemeProvider } from "next-themes";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Force unregister service worker to clear old cache
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (registrations) {
        for (let registration of registrations) {
            registration.unregister();
            console.log('Service Worker unregistered');
        }
    });
}

createRoot(document.getElementById("root")!).render(
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <App />
    </ThemeProvider>
);
