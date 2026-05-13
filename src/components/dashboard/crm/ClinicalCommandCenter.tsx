
import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { Activity, AlertCircle, Calendar, Clipboard, FileText, Heart, Microscope, Stethoscope, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";

interface ClinicalRecord {
    id: string;
    type: 'LAB' | 'PRESCRIPTION' | 'NOTE' | 'BILL';
    date: string;
    title: string;
    description: string;
    severity?: 'Normal' | 'Moderate' | 'High' | 'Critical';
    data?: any;
}

export const ClinicalCommandCenter = ({ customerId, customerName }: { customerId: string, customerName: string }) => {
    const [records, setRecords] = useState<ClinicalRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState({
        totalVisits: 0,
        lastConsulation: "N/A",
        activeConditions: [] as string[],
        alerts: [] as string[]
    });

    const fetchClinicalData = useCallback(async () => {
        setLoading(true);
        try {
            // 1. Fetch Lab Reports
            const { data: labs } = await supabase.from('lab_reports').select('*').eq('patient_id', customerId);
            
            // 2. Fetch Orders (Bills)
            const { data: bills } = await supabase.from('orders').select('*').eq('customer_name', customerName);

            // 3. Fetch Patient Core for Notes
            const { data: patient } = await supabase.from('customers').select('medical_history, allergies').eq('id', customerId).single();

            const combined: ClinicalRecord[] = [];

            // Process Labs
            labs?.forEach(l => {
                combined.push({
                    id: l.id,
                    type: 'LAB',
                    date: l.created_at,
                    title: "Pathology Analysis",
                    description: (l.summary_json as any)?.summary || "Complex Lab Analysis",
                    severity: (l.summary_json as any)?.diseasePossibility?.length > 0 ? 'Moderate' : 'Normal',
                    data: l
                });
            });

            // Process Bills
            bills?.forEach(b => {
                combined.push({
                    id: b.id,
                    type: 'BILL',
                    date: b.created_at,
                    title: `Medicine Purchase`,
                    description: `Total: ₹${b.total_amount}`,
                    data: b
                });
            });

            // Process Notes from History
            (patient?.medical_history as any[])?.forEach((h, idx) => {
                combined.push({
                    id: `note-${idx}`,
                    type: 'NOTE',
                    date: h.date || new Date().toISOString(),
                    title: "Clinical Note",
                    description: h.note,
                    severity: 'Normal'
                });
            });

            // Sort by date
            combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setRecords(combined);

            // Generate Clinical Summary
            const conditions = new Set<string>();
            labs?.forEach(l => (l.summary_json as any)?.diseasePossibility?.forEach((d: string) => conditions.add(d)));
            
            setSummary({
                totalVisits: bills?.length || 0,
                lastConsulation: combined[0]?.date ? format(new Date(combined[0].date), 'PP') : "N/A",
                activeConditions: Array.from(conditions),
                alerts: (patient?.allergies as string[]) || []
            });

        } catch (e) {
            console.error("Clinical Data Fetch Error", e);
        } finally {
            setLoading(false);
        }
    }, [customerId, customerName]);

    useEffect(() => {
        fetchClinicalData();
    }, [customerId, fetchClinicalData]);

    if (loading) return <div className="p-10 text-center animate-pulse text-blue-500 font-medium">Synthesizing Patient Clinical Pulse...</div>;

    return (
        <div className="space-y-6 h-full flex flex-col pt-2">
            {/* Clinical Dashboard Overview */}
            <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-200/50">
                    <div className="flex items-center gap-2 text-blue-700 mb-1">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Clinical Status</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-800">{summary.totalVisits} <span className="text-sm font-normal text-slate-500">Encounters</span></div>
                </div>
                <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-200/50">
                    <div className="flex items-center gap-2 text-purple-700 mb-1">
                        <Calendar className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Last Visit</span>
                    </div>
                    <div className="text-lg font-bold text-slate-800">{summary.lastConsulation}</div>
                </div>
            </div>

            {/* Alerts & Critical Info */}
            {(summary.alerts.length > 0 || summary.activeConditions.length > 0) && (
                <div className="p-4 rounded-2xl bg-red-50 border-2 border-red-100 flex items-start gap-3">
                    <AlertCircle className="w-6 h-6 text-red-500 shrink-0" />
                    <div>
                        <h4 className="font-bold text-red-900 text-sm">Clinical Attention Required</h4>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {summary.alerts.map(a => <Badge key={a} variant="destructive" className="bg-red-200 text-red-800 hover:bg-red-300 border-none">{a}</Badge>)}
                            {summary.activeConditions.map(c => <Badge key={c} variant="outline" className="border-red-300 text-red-700 font-bold">{c}</Badge>)}
                        </div>
                    </div>
                </div>
            )}

            {/* Timeline of Records */}
            <div className="flex-1 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <Clipboard className="w-4 h-4" /> Comprehensive Timeline
                    </h3>
                </div>
                <ScrollArea className="flex-1 pr-4">
                    <div className="space-y-4 relative border-l-2 border-slate-100 ml-4 pl-6 pb-10">
                        {records.map((rec, i) => (
                            <div key={rec.id} className="relative group">
                                {/* Dot on Timeline */}
                                <div className={`absolute -left-[33px] top-1 w-4 h-4 rounded-full border-4 border-white shadow-sm transition-transform group-hover:scale-125 ${
                                    rec.type === 'LAB' ? 'bg-blue-500' : 
                                    rec.type === 'NOTE' ? 'bg-purple-500' : 
                                    rec.type === 'BILL' ? 'bg-green-500' : 'bg-slate-300'
                                }`} />
                                
                                <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            {rec.type === 'LAB' ? <Microscope className="w-4 h-4 text-blue-500" /> : 
                                             rec.type === 'NOTE' ? <Stethoscope className="w-4 h-4 text-purple-500" /> : 
                                             <FileText className="w-4 h-4 text-green-500" />}
                                            <span className="font-bold text-sm text-slate-800">{rec.title}</span>
                                        </div>
                                        <span className="text-[10px] font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">{format(new Date(rec.date), 'dd MMM')}</span>
                                    </div>
                                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{rec.description}</p>
                                    
                                    {rec.severity && rec.severity !== 'Normal' && (
                                        <Badge className="mt-2 h-5 text-[9px] bg-red-100 text-red-600 border-none">{rec.severity} Risk</Badge>
                                    )}
                                </div>
                            </div>
                        ))}
                        {records.length === 0 && (
                            <div className="text-center py-20 text-slate-400">
                                <Heart className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                <p className="text-sm">No clinical records established yet.</p>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </div>
        </div>
    );
};
