import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    isReloading?: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        isReloading: false,
    };

    public static getDerivedStateFromError(error: Error): State {
        const msg = error.message.toLowerCase();
        const isChunkError = msg.includes('dynamically imported module') || 
                             msg.includes('importing a module script failed') || 
                             msg.includes('chunk');
        
        // If it's a chunk error and we haven't reloaded yet, flag as reloading
        if (isChunkError && !sessionStorage.getItem('medix_chunk_reload')) {
            return { hasError: true, error, isReloading: true };
        }

        return { hasError: true, error, isReloading: false };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        
        // Auto-recover from chunk loading errors (e.g. new deploy invalidates old hashes)
        if (this.state.isReloading) {
            console.warn('[ErrorBoundary] Stale build chunk detected, auto-reloading...');
            sessionStorage.setItem('medix_chunk_reload', '1');
            window.location.reload();
            return;
        }

        // Simulate sending to Sentry/PostHog
        // logErrorToService(error, errorInfo); 
    }

    private handleFactoryReset = () => {
        if (confirm("This will clear all local data and log you out. Are you sure?")) {
            localStorage.clear();
            sessionStorage.clear();
            // Clear Service Workers
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(registrations => {
                    for (const registration of registrations) {
                        registration.unregister();
                    }
                });
            }
            window.location.href = '/';
        }
    };

    public render() {
        if (this.state.isReloading) {
            return (
                <div className="h-screen w-full flex items-center justify-center bg-gray-50 p-4">
                    <div className="flex flex-col items-center space-y-4 text-gray-500">
                        <RefreshCcw className="w-8 h-8 animate-spin text-primary" />
                        <p>Updating application to latest version...</p>
                    </div>
                </div>
            );
        }

        if (this.state.hasError) {
            return (
                <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50 p-4">
                    <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 text-center space-y-6">
                        <div className="flex justify-center">
                            <div className="p-4 bg-red-100 rounded-full text-red-600">
                                <AlertTriangle className="w-12 h-12" />
                            </div>
                        </div>

                        <h1 className="text-2xl font-bold text-gray-900">App Crashed</h1>
                        <p className="text-gray-600">
                            The application encountered a critical error. We apologize for the inconvenience.
                        </p>

                        <div className="bg-red-50 p-4 rounded text-left text-sm text-red-800 font-mono overflow-auto max-h-48 whitespace-pre-wrap">
                            <p className="font-bold mb-2 text-xs uppercase">Debug Info:</p>
                            {this.state.error instanceof Error ? this.state.error.message : String(this.state.error)}
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            <Button
                                size="lg"
                                onClick={() => window.location.reload()}
                                className="w-full bg-primary hover:bg-primary/90"
                            >
                                <RefreshCcw className="w-4 h-4 mr-2" />
                                Reload Application
                            </Button>

                            <div className="grid grid-cols-2 gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        navigator.clipboard.writeText(`${this.state.error?.message}\n${this.state.error?.stack}`);
                                        toast.success("Error details copied");
                                    }}
                                >
                                    Copy Error
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={this.handleFactoryReset}
                                >
                                    Factory Reset
                                </Button>
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-4">
                            "Factory Reset" clears local storage and caches. Use this if reloading doesn't fix the issue.
                        </p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
