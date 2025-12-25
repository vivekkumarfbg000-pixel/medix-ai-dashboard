import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldAlert, AlertTriangle, Pill, CheckCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

export const SafetyWidget = () => {
    const [drug1, setDrug1] = useState("");
    const [drug2, setDrug2] = useState("");
    const [checkResult, setCheckResult] = useState<null | string>(null);

    const handleCheck = () => {
        if (!drug1 || !drug2) return;
        // Mock simple check
        if (
            (drug1.toLowerCase().includes("aspirin") && drug2.toLowerCase().includes("warfarin")) ||
            (drug1.toLowerCase().includes("pain") && drug2.toLowerCase().includes("alcohol"))
        ) {
            setCheckResult("MAJOR_RISK");
        } else {
            setCheckResult("SAFE");
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
                <div className="bg-orange-50 dark:bg-orange-950/20 rounded-lg p-3 border border-orange-100 dark:border-orange-900/50">
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-orange-600" />
                        <span className="text-xs font-bold text-orange-800 dark:text-orange-300 uppercase tracking-wide">LASA Alert (Look-Alike)</span>
                    </div>
                    <div className="flex items-center justify-between text-sm p-2 bg-white dark:bg-background rounded border shadow-sm">
                        <span className="font-medium text-destructive">Humalog</span>
                        <span className="text-xs text-muted-foreground">vs</span>
                        <span className="font-medium text-destructive">Humulin</span>
                    </div>
                    <p className="text-[10px] text-orange-600 mt-1 text-center font-medium">Double check before dispensing!</p>
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
                    <Button size="sm" className="w-full h-8 text-xs bg-slate-800 hover:bg-slate-700 text-white" onClick={handleCheck}>
                        Check Safety
                    </Button>

                    {checkResult && (
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
