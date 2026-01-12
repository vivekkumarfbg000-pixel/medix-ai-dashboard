import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50 p-4">
                    <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 text-center space-y-6">
                        <div className="flex justify-center">
                            <div className="p-4 bg-red-100 rounded-full text-red-600">
                                <AlertTriangle className="w-12 h-12" />
                            </div>
                        </div>

                        <h1 className="text-2xl font-bold text-gray-900">Something went wrong</h1>

                        <div className="bg-red-50 p-4 rounded text-left text-sm text-red-800 font-mono overflow-auto max-h-32">
                            {this.state.error?.message || "Unknown Application Error"}
                        </div>

                        <p className="text-gray-600">
                            We've logged this issue. Please try refreshing the page.
                        </p>

                        <Button
                            className="w-full"
                            size="lg"
                            onClick={() => window.location.reload()}
                        >
                            <RefreshCcw className="w-4 h-4 mr-2" />
                            Reload Application
                        </Button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
