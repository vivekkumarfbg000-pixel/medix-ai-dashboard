import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const B2BDebugger = () => {
    return (
        <Card className="mb-6 border-destructive bg-destructive/10">
            <CardHeader>
                <CardTitle className="text-destructive">B2B Data Debugger</CardTitle>
            </CardHeader>
            <CardContent className="font-mono text-xs overflow-auto max-h-60">
                <p className="text-muted-foreground">B2B tables (distributors, catalogs) not yet configured.</p>
                <p className="text-muted-foreground">Run migrations to enable B2B marketplace features.</p>
            </CardContent>
        </Card>
    );
};
