import { useEffect, useState } from "react";
import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export const SyncStatus = () => {
    const [status, setStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            setStatus('idle');
        };
        const handleOffline = () => {
            setIsOnline(false);
            setStatus('error');
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/50 border shadow-sm cursor-help transition-all hover:bg-background">
                    {status === 'syncing' && (
                        <>
                            <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
                            <span className="text-xs font-medium text-blue-600 hidden sm:inline">Syncing...</span>
                        </>
                    )}
                    {status === 'idle' && (
                        <>
                            <Cloud className="w-4 h-4 text-green-500" />
                            <span className="text-xs font-medium text-green-600 hidden sm:inline">Synced</span>
                        </>
                    )}
                    {status === 'error' && (
                        <>
                            <CloudOff className="w-4 h-4 text-destructive" />
                            <span className="text-xs font-medium text-destructive hidden sm:inline">Sync Error</span>
                        </>
                    )}
                </div>
            </TooltipTrigger>
            <TooltipContent>
                <p>Database Sync Status (Local ↔ Cloud)</p>
            </TooltipContent>
        </Tooltip>
    );
};
