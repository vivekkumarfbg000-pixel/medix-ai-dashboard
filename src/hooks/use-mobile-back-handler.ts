import { useEffect, useRef, useCallback } from 'react';
import { App } from '@capacitor/app';
import { useNavigate, useLocation } from 'react-router-dom';

export const useMobileBackHandler = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const lastBackPressRef = useRef(0);
    const locationRef = useRef(location);

    // Keep location ref in sync without triggering effect re-run
    useEffect(() => {
        locationRef.current = location;
    }, [location]);

    useEffect(() => {
        let listenerHandle: any = null;

        const handleBackButton = async () => {
            const now = Date.now();
            const currentPath = locationRef.current.pathname;

            if (currentPath === '/auth' || currentPath === '/dashboard') {
                // Double tap to exit
                if (now - lastBackPressRef.current < 2000) {
                    App.exitApp();
                } else {
                    lastBackPressRef.current = now;
                }
            } else {
                navigate(-1);
            }
        };

        const setupListener = async () => {
            try {
                listenerHandle = await App.addListener('backButton', handleBackButton);
            } catch (e) {
                console.warn('Back button listener setup failed (not in capacitor?)', e);
            }
        };

        setupListener();

        return () => {
            // Only remove the back button listener, not ALL listeners
            if (listenerHandle && typeof listenerHandle.remove === 'function') {
                listenerHandle.remove();
            }
        };
    }, [navigate]); // Only depends on navigate (stable ref), NOT location
};
