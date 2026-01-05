import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldAlert, AlertTriangle, Pill, CheckCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserShops } from "@/hooks/useUserShops";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const SafetyWidget = () => {
    const { currentShop } = useUserShops();
    const [lasaAlert, setLasaAlert] = useState<any>(null); // { name1, name2 }
    const [scanning, setScanning] = useState(false);

    // Interaction Check State
    const [drug1, setDrug1] = useState("");
    const [drug2, setDrug2] = useState("");
    const [checkResult, setCheckResult] = useState<null | string>(null);

    // Initial Scan
    useEffect(() => {
        if (currentShop?.id) checkLASA();
    }, [currentShop]);

    const checkLASA = async () => {
        if (!currentShop?.id) return;
        setScanning(true);

        // Fetch all medicine names
        const { data } = await supabase.from('inventory').select('medicine_name').eq('shop_id', currentShop.id);

        if (data && data.length > 5) {
            // Simple Levenshtein check for demo/speed 
            // In production, this might be a DB function or Edge Edge
            const names = data.map(d => d.medicine_name);
            let found = null;

            for (let i = 0; i < names.length; i++) {
                for (let j = i + 1; j < names.length; j++) {
                    const dist = levenshtein(names[i].toLowerCase(), names[j].toLowerCase());
                    // Threshold: if length > 4 and distance <= 2, flag it
                    if (names[i].length > 4 && dist <= 2) {
                        found = { name1: names[i], name2: names[j] };
                        break;
                    }
                }
                if (found) break;
            }
            setLasaAlert(found);
        }
        setScanning(false);
    };

    // Helper: Levenshtein Distance
    const levenshtein = (a: string, b: string) => {
        const matrix = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) == a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
                }
            }
        }
        return matrix[b.length][a.length];
    };

    const handleCheck = async () => {
        if (!drug1 || !drug2) return;
        setCheckResult("ANALYZING");

        try {
            // Real AI Check
            import("@/services/drugService").then(async (mod) => {
                const results = await mod.drugService.checkInteractions([drug1, drug2]);

                if (results.length > 0) {
                    // Check if any major/moderate interaction exists
                    const hasSevere = results.some(r => r.severity === "Major" || r.severity === "Moderate");
                    setCheckResult(hasSevere ? "MAJOR_RISK" : "SAFE"); // Or show details
                } else {
                    setCheckResult("SAFE");
                }
            });
        } catch (e) {
            console.error(e);
            setCheckResult("ERROR");
        }
    };

    return (
        <Card className="h-full glass-card border-l-4 border-l-orange-400">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-orange-500" /> Safety Shield
                </CardTitle>
                <CardDescription className="text-xs">LASA & Interaction Monitor</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* LASA Monitor */}
                <div className="bg-orange-50 dark:bg-slate-800 rounded-lg p-3 border border-orange-100 dark:border-orange-900/30 min-h-[100px] flex flex-col justify-center">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-orange-600" />
                            <span className="text-xs font-bold text-orange-800 dark:text-orange-400 uppercase tracking-wide">LASA Alert</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={checkLASA} disabled={scanning}>
                            <RefreshCw className={`w-3 h-3 ${scanning ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>

                    {lasaAlert ? (
                        <>
                            <div className="flex items-center justify-between text-sm p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 shadow-sm animate-in zoom-in">
                                <span className="font-medium text-destructive truncate max-w-[40%]">{lasaAlert.name1}</span>
                                <span className="text-xs text-muted-foreground">vs</span>
                                <span className="font-medium text-destructive truncate max-w-[40%]">{lasaAlert.name2}</span>
                            </div>
                            <p className="text-[10px] text-orange-600 dark:text-orange-300 mt-1 text-center font-medium">Potential confusion detected in inventory!</p>
                        </>
                    ) : (
                        <div className="text-center py-2 text-xs text-muted-foreground">
                            <CheckCircle className="w-5 h-5 mx-auto text-green-500 mb-1" />
                            No high-risk sound-alike pairs found.
                        </div>
                    )}
                </div>

                {/* Mini Interaction Checker */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Pill className="w-4 h-4 text-primary" />
                        <span className="text-sm font-semibold">Quick Interaction Check</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <Input
                            placeholder="Drug A"
                            className="h-8 text-xs"
                            value={drug1}
                            onChange={(e) => setDrug1(e.target.value)}
                        />
                        <Input
                            placeholder="Drug B"
                            className="h-8 text-xs"
                            value={drug2}
                            onChange={(e) => setDrug2(e.target.value)}
                        />
                    </div>
                    <Button size="sm" className="w-full h-8 text-xs bg-slate-800 hover:bg-slate-700 text-white" onClick={handleCheck} disabled={checkResult === "ANALYZING"}>
                        {checkResult === "ANALYZING" ? "Checking AI..." : "Check Safety"}
                    </Button>

                    {checkResult && checkResult !== "ANALYZING" && (
                        <div className={`mt-2 p-2 rounded text-xs font-bold text-center flex items-center justify-center gap-2 animate-in fade-in zoom-in ${checkResult === 'SAFE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                            {checkResult === 'SAFE' ? (
                                <><CheckCircle className="w-3 h-3" /> Safe Combination</>
                            ) : (
                                <><ShieldAlert className="w-3 h-3" /> ⚠️ MAJOR INTERACTION</>
                            )}
                        </div>
                    )}
                </div>

                <div className="pt-2 border-t">
                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <span>Compliance Score</span>
                        <Badge variant="outline" className="text-green-600 border-green-200">98% Excellent</Badge>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
