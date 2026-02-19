import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
    children: ReactNode;
    title?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class WidgetErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error(`Widget Error (${this.props.title || 'Unknown'}):`, error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="h-full w-full min-h-[200px] flex flex-col items-center justify-center bg-red-50/50 p-4 border border-red-100 rounded-lg">
                    <AlertTriangle className="w-8 h-8 text-red-500 mb-2" />
                    <h3 className="font-semibold text-red-900 mb-1">
                        {this.props.title || 'Widget'} Failed
                    </h3>
                    <p className="text-xs text-red-600/80 mb-3 text-center max-w-[200px] line-clamp-2">
                        {this.state.error?.message}
                    </p>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs bg-white hover:bg-red-50 border-red-200 text-red-700"
                        onClick={() => this.setState({ hasError: false, error: null })}
                    >
                        <RefreshCcw className="w-3 h-3 mr-1.5" />
                        Retry
                    </Button>
                </div>
            );
        }

        return this.props.children;
    }
}
