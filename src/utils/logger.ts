/**
 * Production-safe logging utility
 * Prevents console.log pollution in production builds
 */

const isDev = import.meta.env.DEV;
const isProd = import.meta.env.PROD;

export const logger = {
    /**
     * Log general information (only in development)
     */
    log: (...args: any[]) => {
        if (isDev) {
            console.log(...args);
        }
    },

    /**
     * Log informational messages (only in development)
     */
    info: (...args: any[]) => {
        if (isDev) {
            console.info(...args);
        }
    },

    /**
     * Log warnings (always logged)
     */
    warn: (...args: any[]) => {
        console.warn(...args);
    },

    /**
     * Log errors (always logged)
     * In production, consider sending to error tracking service
     */
    error: (...args: any[]) => {
        console.error(...args);

        // TODO: Send to error tracking service in production
        if (isProd) {
            // Example: Sentry.captureException(args[0]);
        }
    },

    /**
     * Log debug information (only in development)
     */
    debug: (...args: any[]) => {
        if (isDev) {
            console.debug(...args);
        }
    },

    /**
     * Group logs together (only in development)
     */
    group: (label: string, callback: () => void) => {
        if (isDev) {
            console.group(label);
            callback();
            console.groupEnd();
        }
    },

    /**
     * Log performance timing
     */
    time: (label: string) => {
        if (isDev) {
            console.time(label);
        }
    },

    timeEnd: (label: string) => {
        if (isDev) {
            console.timeEnd(label);
        }
    },
};

export default logger;
