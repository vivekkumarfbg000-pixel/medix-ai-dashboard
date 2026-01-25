import { format as dateFnsFormat, parseISO, isValid } from 'date-fns';

/**
 * Safe date formatting that never throws errors
 * Returns fallback string if date is invalid
 */
export const safeFormat = (
    date: Date | string | null | undefined,
    formatStr: string,
    fallback: string = 'N/A'
): string => {
    try {
        if (!date) return fallback;

        const dateObj = typeof date === 'string' ? parseISO(date) : date;

        if (!isValid(dateObj)) return fallback;

        return dateFnsFormat(dateObj, formatStr);
    } catch (error) {
        console.warn('Date formatting error:', error);
        return fallback;
    }
};

/**
 * Safe date parsing that never throws
 */
export const safeParseDate = (
    dateString: string | null | undefined
): Date | null => {
    try {
        if (!dateString) return null;
        const date = parseISO(dateString);
        return isValid(date) ? date : null;
    } catch {
        return null;
    }
};

/**
 * Safe new Date() constructor
 */
export const safeNewDate = (value?: any): Date | null => {
    try {
        const date = value ? new Date(value) : new Date();
        return isValid(date) ? date : null;
    } catch {
        return null;
    }
};
