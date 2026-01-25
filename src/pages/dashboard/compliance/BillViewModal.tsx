import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FileText, Printer, CheckCircle } from "lucide-react";
import { format } from "date-fns";

interface BillViewModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    invoice: any | null;
}

export function BillViewModal({ open, onOpenChange, invoice }: BillViewModalProps) {
    if (!invoice) return null;

    const total = invoice.total_amount || 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md bg-white">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        Invoice #{invoice.invoice}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="flex justify-between items-start text-sm">
                        <div>
                            <p className="font-bold">{invoice.patient}</p>
                            <p className="text-muted-foreground">{format(new Date(invoice.date), 'PPP p')}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-muted-foreground">Doctor</p>
                            <p className="font-medium">{invoice.doctor}</p>
                        </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">H1 Prescribed Items</p>
                        {/* 
                   In a real scenario, we'd fetch the full order items. 
                   Since ScheduleH1 passes a flattened record, we might only show the single H1 item 
                   OR we need to fetch the full order by ID.
                   For this demo, we will show the single item passed in the record context or fetch if we had the ID.
                   Let's assume the passed 'invoice' object is the flattened record from ScheduleH1.
                */}
                        <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <div>
                                <p className="font-medium">{invoice.medicine}</p>
                                <p className="text-xs text-muted-foreground">Batch: {invoice.batch}</p>
                            </div>
                            <div className="text-right">
                                <p className="font-bold">x{invoice.qty}</p>
                            </div>
                        </div>

                        <p className="text-[10px] text-muted-foreground italic text-center mt-2">
                            * Showing specific Schedule H1 entry matching this register record directly.
                        </p>
                    </div>

                    <Separator />

                    <div className="flex justify-between items-center">
                        <Button variant="outline" size="sm" onClick={() => window.print()}>
                            <Printer className="w-4 h-4 mr-2" /> Print Record
                        </Button>
                        <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1 rounded-full text-xs font-medium">
                            <CheckCircle className="w-3 h-3" /> Verified
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
