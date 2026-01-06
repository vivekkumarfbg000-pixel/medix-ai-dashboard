import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
    errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Error Boundary Caught:", error, errorInfo);

        this.setState({
            error,
            errorInfo,
        });

        // TODO: Send error to tracking service
        // Example: Sentry.captureException(error, { extra: errorInfo });
    }

    handleReload = () => {
        window.location.reload();
    };

    handleGoHome = () => {
        window.location.href = "/dashboard";
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen flex items-center justify-center p-4 bg-background">
                    <Card className="max-w-md w-full">
                        <CardHeader className="text-center">
                            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                                <AlertTriangle className="w-6 h-6 text-destructive" />
                            </div>
                            <CardTitle className="text-2xl">Something went wrong</CardTitle>
                            <CardDescription>
                                The application encountered an unexpected error.
                                {import.meta.env.DEV && this.state.error && (
                                    <details className="mt-4 text-left">
                                        <summary className="cursor-pointer font-semibold">
                                            Error Details (Dev Mode)
                                        </summary>
                                        <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-40">
                                            {this.state.error.toString()}
                                            {this.state.errorInfo?.componentStack}
                                        </pre>
                                    </details>
                                )}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Button
                                onClick={this.handleReload}
                                className="w-full"
                                variant="default"
                            >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Reload Application
                            </Button>
                            <Button
                                onClick={this.handleGoHome}
                                className="w-full"
                                variant="outline"
                            >
                                <Home className="w-4 h-4 mr-2" />
                                Go to Dashboard
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
