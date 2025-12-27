import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { useNavigate, useLocation } from 'react-router-dom';

export const useMobileBackHandler = () => {
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        let lastBackPressTime = 0;

        const handleBackButton = async (event: any) => {
            // Prevent default behavior
            if (document.URL.indexOf('http') !== 0) {
                // Optimization for file schema if needed
            }

            const now = Date.now();

            // If on root auth or dashboard overview, or if no history, maybe exit?
            // For now, let's keep it simple: can go back? go back. Else exit.

            if (location.pathname === '/auth' || location.pathname === '/dashboard') {
                // Double tap to exit could be implemented here
                if (now - lastBackPressTime < 2000) {
                    App.exitApp();
                } else {
                    // Maybe show a toast "Press back again to exit" if you had a toast service here
                    // For now just update the time
                    lastBackPressTime = now;
                }
            } else {
                // Go back in history
                navigate(-1);
            }
        };

        const setupListener = async () => {
            try {
                await App.addListener('backButton', handleBackButton);
            } catch (e) {
                console.warn('Back button listener setup failed (not in capacitor?)', e);
            }
        };

        setupListener();

        return () => {
            App.removeAllListeners();
        };
    }, [navigate, location]);
};
