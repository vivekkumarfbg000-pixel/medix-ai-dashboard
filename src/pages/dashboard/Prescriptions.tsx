
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Calendar, User, Search, Stethoscope, ScanLine, Share2, Eye, Save, IndianRupee, AlertTriangle, Repeat, Sparkles, ShoppingCart } from "lucide-react";
import { aiService } from "@/services/aiService";
import { useNavigate } from "react-router-dom";
import { whatsappService } from "@/services/whatsappService";
import { format } from "date-fns";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

interface Medicine {
    name: string;
    dosage?: string;
    strength?: string;
    indication?: string;
    quantity?: number;
    unit_price?: number;
}

interface Prescription {
    id: string;
    customer_name: string;
    doctor_name: string;
    visit_date: string;
    medicines: Medicine[];
    created_at: string;
}

const Prescriptions = () => {
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const navigate = useNavigate();
    const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
    const [editingMedicines, setEditingMedicines] = useState<Medicine[]>([]);
    const [interactions, setInteractions] = useState<string[]>([]);
    const [checkingSafe, setCheckingSafe] = useState(false);

    // Mock Substitutes Cache
    const [substitutes, setSubstitutes] = useState<Record<string, string[]>>({});

    const fetchPrescriptions = async () => {
        setLoading(true);
        // @ts-ignore - Table exists in database
        const { data, error } = await supabase
            .from('prescriptions')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && data) {
            const parsed = data.map((p: any) => {
                let meds = p.medicines;
                if (typeof meds === 'string') {
                    try {
                        meds = JSON.parse(meds);
                    } catch (e) { meds = []; }
                }
                return { ...p, medicines: meds };
            });
            setPrescriptions(parsed as unknown as Prescription[]);
        }
        setLoading(false);
    };

    const handleShare = (p: Prescription) => {
        // @ts-ignore
        const link = whatsappService.generatePrescriptionLink("", {
            doctor_name: p.doctor_name,
            customer_name: p.customer_name,
            visit_date: p.visit_date,
            medicines: p.medicines
        });
        window.open(link, '_blank');
    };

    const handleViewDetails = (p: Prescription) => {
        setSelectedPrescription(p);
        setEditingMedicines(JSON.parse(JSON.stringify(p.medicines || [])));
    };

    const handlePriceChange = (index: number, price: string) => {
        const newMedicines = [...editingMedicines];
        newMedicines[index].unit_price = parseFloat(price) || 0;
        setEditingMedicines(newMedicines);
    };

    const calculateTotal = () => {
        return editingMedicines.reduce((sum, m) => sum + ((m.unit_price || 0) * (m.quantity || 1)), 0);
    };

    const handleSaveChanges = async () => {
        if (!selectedPrescription) return;

        const { error } = await supabase
            .from('prescriptions')
            .update({ medicines: editingMedicines as any })
            .eq('id', selectedPrescription.id);

        if (error) {
            toast.error("Failed to save changes");
        } else {
            toast.success("Prescription updated successfully");
            fetchPrescriptions(); // Refresh list
            setSelectedPrescription(null); // Close dialog (optional, or just update local state)
        }
    };

    const handleCheckInteractions = async () => {
        const meds = editingMedicines.map(m => m.name);
        if (meds.length < 2) {
            toast.info("Need at least 2 medicines to check interactions.");
            return;
        }
        setCheckingSafe(true);
        setInteractions([]);
        try {
            const warnings = await aiService.checkInteractions(meds);
            if (warnings.length > 0) {
                setInteractions(warnings);
                toast.warning(`Found ${warnings.length} potential interactions!`);
            } else {
                toast.success("✅ No severe interactions found. Safe to dispense.");
            }
        } catch (e) {
            toast.error("Safety Check Failed");
        }
        setCheckingSafe(false);
    };

    const handleFindSubstitute = async (index: number) => {
        const medName = editingMedicines[index].name;
        toast.loading(`Finding generics for ${medName}...`, { id: 'gen-load' });
        try {
            const subs = await aiService.getGenericSubstitutes(medName);
            setSubstitutes(prev => ({ ...prev, [medName]: subs }));
            toast.success("Generics found!", { id: 'gen-load' });
        } catch (e) {
            toast.error("Failed to find generics", { id: 'gen-load' });
        }
    };

    useEffect(() => {
        fetchPrescriptions();
    }, []);

    const filtered = prescriptions.filter(p =>
        p.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.doctor_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            {/* Premium Header */}
            <div className="relative rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 p-8 shadow-xl overflow-hidden text-white">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
                <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>

                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="space-y-2">
                        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight flex items-center gap-3">
                            <FileText className="w-8 h-8 md:w-10 md:h-10 text-teal-200" />
                            Digital Parchas
                        </h1>
                        <p className="text-teal-100 max-w-xl text-lg font-medium opacity-90">
                            Securely store, organize, and retrieve patient prescriptions and history.
                        </p>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
                    <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10">
                        <div className="text-teal-100 text-xs font-semibold uppercase tracking-wider">Total Parchas</div>
                        <div className="text-2xl font-bold">{prescriptions.length}</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10">
                        <div className="text-teal-100 text-xs font-semibold uppercase tracking-wider">This Month</div>
                        <div className="text-2xl font-bold">{prescriptions.filter(p => new Date(p.created_at) > new Date(new Date().setDate(1))).length}</div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative flex-1 w-full md:w-auto md:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by patient, doctor, or date..."
                        className="pl-10 h-10 w-full bg-white shadow-sm border-muted focus-visible:ring-teal-500"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <Button
                    size="lg"
                    className="shadow-lg bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 h-10 px-6 w-full md:w-auto"
                    onClick={() => navigate("/dashboard/diary-scan")}
                >
                    <div className="flex items-center gap-2">
                        <ScanLine className="w-4 h-4" />
                        <span>Scan New Parcha</span>
                    </div>
                </Button>
            </div>

            <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {loading ? (
                    [1, 2, 3, 4].map(i => <div key={i} className="h-64 bg-muted animate-pulse rounded-xl" />)
                ) : filtered.length === 0 ? (
                    <div className="col-span-full flex flex-col items-center justify-center py-20 text-center bg-white rounded-xl border border-dashed border-slate-200">
                        <div className="bg-slate-50 p-6 rounded-full mb-4">
                            <FileText className="w-12 h-12 text-slate-300" />
                        </div>
                        <h3 className="text-xl font-semibold text-slate-900">No prescriptions found</h3>
                        <p className="text-slate-500 max-w-sm mt-2">Upload a new prescription using the Scan button above.</p>
                    </div>
                ) : (
                    filtered.map(p => (
                        <Card key={p.id} className="group hover:shadow-xl transition-all duration-300 border-slate-200 hover:border-teal-200 flex flex-col">
                            <CardContent className="p-5 flex-1 flex flex-col">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center text-teal-600">
                                            <User className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-800 line-clamp-1" title={p.customer_name}>{p.customer_name || 'Unknown Patient'}</h3>
                                            <p className="text-xs text-slate-500 flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {p.visit_date ? format(new Date(p.visit_date), 'PP') : 'No Date'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3 flex-1">
                                    <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 p-2 rounded-lg">
                                        <Stethoscope className="w-4 h-4 text-slate-400" />
                                        <span className="font-medium truncate">{p.doctor_name || 'Unknown Doctor'}</span>
                                    </div>

                                    <div className="space-y-2 mt-2">
                                        <div className="flex items-center justify-between text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                                            <span>Medicines</span>
                                            <Badge variant="secondary" className="text-[10px] h-5">{p.medicines?.length || 0}</Badge>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 h-20 content-start overflow-hidden">
                                            {Array.isArray(p.medicines) && p.medicines.slice(0, 4).map((m, idx) => (
                                                <Badge key={idx} variant="outline" className="text-xs font-normal bg-white">
                                                    {m.name}
                                                </Badge>
                                            ))}
                                            {Array.isArray(p.medicines) && p.medicines.length > 4 && (
                                                <span className="text-xs text-muted-foreground pl-1">+{p.medicines.length - 4} more</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4 pt-4 border-t border-slate-100 flex gap-2">
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button size="sm" className="flex-1 bg-slate-900 text-white hover:bg-slate-800" onClick={() => handleViewDetails(p)}>
                                                <Eye className="w-3.5 h-3.5 mr-1.5" /> View
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                                            <DialogHeader>
                                                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                                    <FileText className="w-5 h-5 text-teal-600" />
                                                    Prescription Details
                                                </DialogTitle>
                                            </DialogHeader>

                                            <div className="grid grid-cols-2 gap-4 mb-6 bg-slate-50 p-4 rounded-lg">
                                                <div>
                                                    <p className="text-xs text-muted-foreground uppercase font-semibold">Patient</p>
                                                    <p className="font-medium">{selectedPrescription?.customer_name}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground uppercase font-semibold">Doctor</p>
                                                    <p className="font-medium">{selectedPrescription?.doctor_name}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground uppercase font-semibold">Date</p>
                                                    <p className="font-medium">{selectedPrescription?.visit_date}</p>
                                                </div>
                                            </div>

                                            {interactions.length > 0 && (
                                                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg animate-in fade-in slide-in-from-top-2">
                                                    <h4 className="flex items-center gap-2 text-red-800 font-bold mb-1">
                                                        <AlertTriangle className="w-4 h-4" /> Safety Warning
                                                    </h4>
                                                    <ul className="list-disc list-inside text-sm text-red-700">
                                                        {interactions.map((warn, i) => <li key={i}>{warn}</li>)}
                                                    </ul>
                                                </div>
                                            )}

                                            <div className="border rounded-lg overflow-hidden">
                                                <Table>
                                                    <TableHeader className="bg-slate-100">
                                                        <TableRow>
                                                            <TableHead className="w-[50px]">#</TableHead>
                                                            <TableHead>Medicine</TableHead>
                                                            <TableHead>Dosage / Strength</TableHead>
                                                            <TableHead>Indication</TableHead>
                                                            <TableHead className="w-[80px]">Qty</TableHead>
                                                            <TableHead className="w-[120px]">Price (₹)</TableHead>
                                                            <TableHead className="w-[50px]"></TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {editingMedicines.map((med, index) => (
                                                            <TableRow key={index}>
                                                                <TableCell className="font-medium text-slate-500">{index + 1}</TableCell>
                                                                <TableCell className="font-semibold text-slate-800">{med.name}</TableCell>
                                                                <TableCell>
                                                                    <div className="flex flex-col">
                                                                        <span className="text-sm font-medium">{med.strength || '-'}</span>
                                                                        <span className="text-xs text-slate-500">{med.dosage || '-'}</span>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-sm text-slate-600">{med.indication || '-'}</TableCell>
                                                                <TableCell>{med.quantity || 1}</TableCell>
                                                                <TableCell>
                                                                    <Input
                                                                        type="number"
                                                                        className="h-8 w-24"
                                                                        placeholder="0.00"
                                                                        value={med.unit_price || ''}
                                                                        onChange={(e) => handlePriceChange(index, e.target.value)}
                                                                    />
                                                                    {substitutes[med.name] && (
                                                                        <div className="text-[10px] text-green-600 mt-1">
                                                                            Generic: {substitutes[med.name][0]}
                                                                        </div>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-teal-600" title="Find Generic" onClick={() => handleFindSubstitute(index)}>
                                                                        <Repeat className="w-4 h-4" />
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>

                                            <div className="mt-6 bg-teal-50 rounded-lg border border-teal-100 overflow-hidden">
                                                <div className="p-4 flex justify-between items-center">
                                                    <div className="text-teal-800">
                                                        <p className="text-sm font-medium">Total Estimated Amount</p>
                                                        <p className="text-2xl font-bold flex items-center">
                                                            <IndianRupee className="w-5 h-5 mr-1" />
                                                            {calculateTotal().toFixed(2)}
                                                        </p>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button variant="outline" onClick={() => setSelectedPrescription(null)}>Cancel</Button>
                                                        <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={handleSaveChanges}>
                                                            <Save className="w-4 h-4 mr-2" /> Save Changes
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="border-t border-teal-200 p-2 bg-teal-100/30">
                                                    <Button
                                                        variant="ghost"
                                                        className="text-orange-700 hover:bg-orange-100 hover:text-orange-800 w-full h-9 flex items-center justify-center gap-2"
                                                        onClick={handleCheckInteractions}
                                                        disabled={checkingSafe}
                                                    >
                                                        {checkingSafe ? <Sparkles className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                                                        {checkingSafe ? "Analyzing Interactions..." : "Check Drug Interactions"}
                                                    </Button>
                                                </div>

                                                <div className="p-2 pt-0">
                                                    <Button
                                                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg"
                                                        size="lg"
                                                        onClick={() => {
                                                            toast.success("Sending to Billing Counter...");
                                                            navigate("/dashboard/sales/pos", {
                                                                state: {
                                                                    importItems: editingMedicines,
                                                                    customerName: selectedPrescription?.customer_name
                                                                }
                                                            });
                                                        }}
                                                    >
                                                        <ShoppingCart className="w-5 h-5 mr-2" />
                                                        Convert to Bill
                                                    </Button>
                                                </div>
                                            </div>
                                        </DialogContent>
                                    </Dialog>

                                    <Button size="sm" variant="outline" className="flex-1 text-teal-700 border-teal-100 hover:bg-teal-50" onClick={() => handleShare(p)}>
                                        <Share2 className="w-3.5 h-3.5 mr-1.5" /> Share
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div >
    );
};

export default Prescriptions;
