import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const B2BDebugger = () => {
    const [status, setStatus] = useState<any>({
        distributors: null,
        catalogs: null,
        error: null,
    });

    useEffect(() => {
        checkTables();
    }, []);

    const checkTables = async () => {
        const result: any = {};

        // Check Distributors
        const dist = await supabase.from('distributors').select('count', { count: 'exact' });
        result.distributors = dist;

        // Check Catalogs
        const cats = await supabase.from('catalogs').select('count', { count: 'exact' });
        result.catalogs = cats;

        // Check sample data
        const sample = await supabase.from('catalogs').select('*, distributor:distributors(name)').limit(1);
        result.sample = sample;

        setStatus(result);
    };

    return (
        <Card className="mb-6 border-destructive bg-destructive/10">
            <CardHeader>
                <CardTitle className="text-destructive">B2B Data Debugger</CardTitle>
            </CardHeader>
            <CardContent className="font-mono text-xs overflow-auto max-h-60">
                <p><strong>Distributors Count:</strong> {status.distributors?.count} (Error: {status.distributors?.error?.message})</p>
                <p><strong>Catalogs Count:</strong> {status.catalogs?.count} (Error: {status.catalogs?.error?.message})</p>
                <p><strong>Sample Query:</strong></p>
                <pre>{JSON.stringify(status.sample, null, 2)}</pre>
            </CardContent>
        </Card>
    );
};
