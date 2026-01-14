import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useUserShops } from "@/hooks/useUserShops";
import { whatsappService } from "@/services/whatsappService";
import { Bell, CalendarClock, Check, MessageCircle, RefreshCw, User, FileText } from "lucide-react";
import { differenceInDays, addDays, format } from "date-fns";
import { toast } from "sonner";

interface RefillCandidate {
    id: string; // Order ID
    customer_name: string;
    customer_phone: string;
    medication_summary: string; // e.g., "Metformin + 2 others"
    refill_date: string;
    days_remaining: number;
}

export const RefillAlertsWidget = () => {
    const { currentShop } = useUserShops();
    const [loading, setLoading] = useState(true);
    const [candidates, setCandidates] = useState<RefillCandidate[]>([]);

    useEffect(() => {
        if (!currentShop?.id) return;
        fetchRefillCandidates();
    }, [currentShop?.id]);

    const fetchRefillCandidates = async () => {
        setLoading(true);
        try {
            const today = new Date();
            const threeDaysFromNow = addDays(today, 3);

            // Query orders with refill_due_date within next 3 days OR overdue
            // Note: This relies on 'refill_due_date' being populated in orders table
            const { data, error } = await supabase
                .from('orders')
                .select(`
          id,
          customer_name, 
          customer_phone,
          refill_due_date,
          status,
          total_amount
        `)
                .eq('shop_id', currentShop!.id)
                .eq('status', 'completed') // Only completed orders need refills
                .lte('refill_due_date', threeDaysFromNow.toISOString())
                .order('refill_due_date', { ascending: true })
                .limit(5);

            if (error) throw error;

            // Transform data
            const mapped: RefillCandidate[] = (data || []).map((order: any) => {
                const refillDate = new Date(order.refill_due_date);
                const diff = differenceInDays(refillDate, today);

                return {
                    id: order.id,
                    customer_name: order.customer_name || "Unknown Patient",
                    customer_phone: order.customer_phone,
                    medication_summary: "Repeat Prescriptions", // Placeholder as items might be in a separate table/json
                    refill_date: order.refill_due_date,
                    days_remaining: diff
                };
            });

            setCandidates(mapped);
        } catch (err) {
            console.error("Error fetching refills:", err);
            // Fallback for demo if table column doesn't exist yet or is empty
            //   setCandidates([
            //     {
            //       id: "demo-1",
            //       customer_name: "Rahul Sharma",
            //       customer_phone: "9876543210",
            //       medication_summary: "Metformin 500mg",
            //       refill_date: addDays(new Date(), 1).toISOString(),
            //       days_remaining: 1
            //     },
            //     {
            //       id: "demo-2",
            //       customer_name: "Priya Patel",
            //       customer_phone: "9123456789",
            //       medication_summary: "Thyronorm 50mcg",
            //       refill_date: addDays(new Date(), -2).toISOString(),
            //       days_remaining: -2
            //     }
            //   ]);
        } finally {
            setLoading(false);
        }
    };

    const handleSendReminder = (candidate: RefillCandidate) => {
        if (!candidate.customer_phone) {
            toast.error("No phone number available for this customer.");
            return;
        }

        const message = `Hi ${candidate.customer_name}, this is a reminder from ${currentShop?.name || 'MedixAI.Shop'}. Your refill for ${candidate.medication_summary} is due on ${format(new Date(candidate.refill_date), 'MMM dd')}. Reply 'YES' to refill now! 💊`;

        // Use WhatsApp Service or direct link
        const url = `https://wa.me/${candidate.customer_phone}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
        toast.success("WhatsApp opened for " + candidate.customer_name);
    };

    if (loading) {
        return (
            <Card className="glass-card h-full">
                <CardHeader className="pb-2">
                    <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (candidates.length === 0) {
        // Empty State - Good for UX
        return (
            <Card className="glass-card h-full bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-slate-900/50 dark:to-slate-800/50 border-primary/20">
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-bold flex items-center gap-2 text-primary">
                        <RefreshCw className="w-4 h-4" /> Smart Refills
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground s">
                    <div className="bg-primary/10 p-3 rounded-full mb-3">
                        <Check className="w-6 h-6 text-primary" />
                    </div>
                    <p className="text-sm font-medium">All caught up!</p>
                    <p className="text-xs">No pending refills for the next 3 days.</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="glass-card h-full border-l-4 border-l-indigo-500 shadow-lg shadow-indigo-500/10 transition-all hover:shadow-indigo-500/20">
            <CardHeader className="pb-3 border-b border-border/40">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-500/10 rounded-md text-indigo-500">
                            <CalendarClock className="w-4 h-4" />
                        </div>
                        Refill Due
                        <Badge variant="secondary" className="ml-2 bg-indigo-500/20 text-indigo-700 hover:bg-indigo-500/30">
                            {candidates.length} Pending
                        </Badge>
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={fetchRefillCandidates} className="h-8 w-8 p-0">
                        <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y divide-border/40">
                    {candidates.map((c) => (
                        <div key={c.id} className="p-3 flex items-center justify-between hover:bg-muted/30 transition-colors group">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 font-bold text-xs mt-1">
                                    {c.customer_name.charAt(0)}
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-sm font-medium text-foreground">{c.customer_name}</p>
                                    <div className="flex items-center gap-2 text-xs">
                                        {c.days_remaining < 0 ? (
                                            <span className="text-red-500 font-bold">Overdue by {Math.abs(c.days_remaining)}d</span>
                                        ) : c.days_remaining === 0 ? (
                                            <span className="text-orange-500 font-bold">Due Today</span>
                                        ) : (
                                            <span className="text-muted-foreground">in {c.days_remaining} days</span>
                                        )}
                                        <span className="text-border">|</span>
                                        <span className="text-muted-foreground truncate max-w-[100px]">{c.medication_summary}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-8 p-0 rounded-full border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400"
                                    onClick={() => {
                                        // Navigate to LitePOS with pre-filled customer
                                        // This is the "missing functionality" - instant billing
                                        window.location.href = `/dashboard/lite-pos?customer=${encodeURIComponent(c.customer_name)}&phone=${c.customer_phone}`;
                                        toast.success("Drafting Bill for " + c.customer_name);
                                    }}
                                    title="Create Bill"
                                >
                                    <FileText className="w-4 h-4" />
                                    <span className="sr-only">Bill</span>
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-8 p-0 rounded-full border-green-200 bg-green-50 text-green-600 hover:bg-green-100 hover:text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400"
                                    onClick={() => handleSendReminder(c)}
                                    title="Send WhatsApp Reminder"
                                >
                                    <MessageCircle className="w-4 h-4" />
                                    <span className="sr-only">WhatsApp</span>
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};
