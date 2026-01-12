import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingUp, Wallet, CheckCircle2, AlertTriangle } from "lucide-react";

interface DrugOption {
    name: string;
    manufacturer: string;
    priceToPatient: number;
    costToPharmacy: number;
    isGeneric: boolean;
}

interface ComparisonCardProps {
    prescribed: DrugOption;
    suggested: DrugOption;
    onAcceptSuggestion: () => void;
    onKeepPrescribed: () => void;
}

export function ComparisonCard({ prescribed, suggested, onAcceptSuggestion, onKeepPrescribed }: ComparisonCardProps) {
    const prescribedProfit = prescribed.priceToPatient - prescribed.costToPharmacy;
    const suggestedProfit = suggested.priceToPatient - suggested.costToPharmacy;

    const profitIncrease = suggestedProfit - prescribedProfit;
    const patientSavings = prescribed.priceToPatient - suggested.priceToPatient;

    return (
        <Card className="border-2 border-primary/20 bg-gradient-to-br from-white to-blue-50/50 shadow-lg overflow-hidden">
            <CardHeader className="bg-primary/5 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg text-primary">
                    <TrendingUp className="w-5 h-5" /> Smart Profit Optimizer
                </CardTitle>
                <CardDescription>An equivalent generic is available with higher margins.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                <div className="grid grid-cols-2 divide-x divide-gray-100">
                    {/* Prescribed (Left) */}
                    <div className="p-4 space-y-3 opacity-70">
                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Prescribed</div>
                        <div>
                            <h3 className="font-bold text-gray-800">{prescribed.name}</h3>
                            <p className="text-xs text-gray-500">{prescribed.manufacturer}</p>
                        </div>
                        <div className="pt-2">
                            <div className="flex justify-between text-sm">
                                <span>Patient Pays:</span>
                                <span className="font-medium">₹{prescribed.priceToPatient}</span>
                            </div>
                            <div className="flex justify-between text-sm text-green-600">
                                <span>Your Profit:</span>
                                <span className="font-medium">₹{prescribedProfit.toFixed(2)}</span>
                            </div>
                        </div>
                        <Button variant="ghost" className="w-full text-xs" onClick={onKeepPrescribed}>
                            Keep Original
                        </Button>
                    </div>

                    {/* Suggested (Right) */}
                    <div className="p-4 space-y-3 bg-green-50/50">
                        <div className="flex justify-between items-center">
                            <div className="text-xs font-bold text-green-700 uppercase tracking-wider">Smart Alternative</div>
                            <span className="text-[10px] bg-green-200 text-green-800 px-2 py-0.5 rounded-full font-bold">Recommended</span>
                        </div>
                        <div>
                            <h3 className="font-bold text-green-900">{suggested.name}</h3>
                            <p className="text-xs text-green-600">{suggested.manufacturer}</p>
                        </div>
                        <div className="pt-2 space-y-1">
                            <div className="flex justify-between text-sm">
                                <span>Patient Pays:</span>
                                <span className="font-bold text-green-700">₹{suggested.priceToPatient}</span>
                            </div>
                            <div className="flex justify-between text-sm bg-white p-1 rounded border border-green-100 shadow-sm">
                                <span className="flex items-center gap-1"><Wallet className="w-3 h-3" /> Profit:</span>
                                <span className="font-bold text-green-700">+₹{suggestedProfit.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="pt-2 text-[10px] text-green-600 flex gap-2">
                            <span>✅ +₹{profitIncrease.toFixed(0)} Extra Profit</span>
                            <span>✅ Patient Saves ₹{patientSavings.toFixed(0)}</span>
                        </div>

                        <Button size="sm" className="w-full bg-green-600 hover:bg-green-700 text-white shadow-md shadow-green-200" onClick={onAcceptSuggestion}>
                            Switch & Bill <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
