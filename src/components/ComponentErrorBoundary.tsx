import React, { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    name?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ComponentErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error(`[ComponentErrorBoundary: ${this.props.name || 'Unknown'}] Error caught:`, error, errorInfo);
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="flex flex-col items-center justify-center p-4 m-2 bg-red-950/20 border border-red-900/50 rounded-lg text-slate-300">
                    <AlertTriangle className="w-8 h-8 text-red-500 mb-2" />
                    <h3 className="text-sm font-bold text-red-400 mb-1">
                        {this.props.name ? `${this.props.name} failed to load` : 'Component Error'}
                    </h3>
                    <p className="text-xs text-slate-400 text-center mb-4 truncate max-w-full">
                        {this.state.error?.message || "An unexpected error occurred."}
                    </p>
                    <button
                        onClick={this.handleReset}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-xs transition-colors"
                    >
                        <RefreshCw className="w-3 h-3" /> Retry
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
