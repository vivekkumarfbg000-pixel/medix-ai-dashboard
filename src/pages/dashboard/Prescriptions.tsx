
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Calendar, User, Search, Stethoscope, Pill } from "lucide-react";
import { format } from "date-fns";

interface Prescription {
    id: string;
    customer_name: string;
    doctor_name: string;
    visit_date: string;
    medicines: { name: string; dosage: string }[];
    created_at: string;
}

const Prescriptions = () => {
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    const fetchPrescriptions = async () => {
        setLoading(true);
        // @ts-ignore - Table exists in database
        const { data, error } = await supabase
            .from('prescriptions')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && data) {
            setPrescriptions(data as unknown as Prescription[]);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchPrescriptions();
    }, []);

    const filtered = prescriptions.filter(p =>
        p.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.doctor_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Digital Parchas</h1>
                    <p className="text-muted-foreground mt-1">History of scanned prescriptions.</p>
                </div>
            </div>

            <Card>
                <CardContent className="p-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by patient or doctor..."
                            className="pl-10"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-4">
                {loading ? (
                    <div className="text-center py-10">Loading parchas...</div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                        <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>No prescriptions found.</p>
                    </div>
                ) : (
                    filtered.map(p => (
                        <Card key={p.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-6">
                                <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <User className="w-4 h-4 text-muted-foreground" />
                                            <span className="font-semibold text-lg">{p.customer_name || 'Unknown Patient'}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Stethoscope className="w-4 h-4" />
                                            <span>{p.doctor_name || 'Unknown Doctor'}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm bg-muted/50 px-3 py-1 rounded-full h-fit w-fit">
                                        <Calendar className="w-4 h-4" />
                                        <span>{p.visit_date ? format(new Date(p.visit_date), 'PP') : 'No Date'}</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wider mb-2">Medicines</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {Array.isArray(p.medicines) && p.medicines.map((m, idx) => (
                                            <Badge key={idx} variant="outline" className="pl-2 gap-1 py-1">
                                                <Pill className="w-3 h-3 text-blue-500" />
                                                <span className="font-medium">{m.name}</span>
                                                {m.dosage && <span className="text-muted-foreground mx-1 text-[10px] border-l pl-1">{m.dosage}</span>}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
};

export default Prescriptions;
