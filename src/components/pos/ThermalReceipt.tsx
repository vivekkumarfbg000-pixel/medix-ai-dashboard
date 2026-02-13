import React from 'react';

interface ThermalReceiptProps {
    shopDetails: {
        name: string;
        address?: string;
        phone?: string;
        gstin?: string;
    };
    order: {
        invoice_number: string;
        date: Date;
        payment_mode: string;
    };
    customer?: {
        name: string;
        phone?: string;
        doctor_name?: string;
    };
    items: {
        name: string;
        qty: number;
        price: number;
        amount: number;
    }[];
    totals: {
        subtotal: number;
        discount: number;
        total: number;
        gst?: { cgst: number; sgst: number };
    };
}

export const ThermalReceipt = React.forwardRef<HTMLDivElement, ThermalReceiptProps>(({ shopDetails, order, customer, items, totals }, ref) => {
    return (
        <div ref={ref} className="hidden print:block font-mono text-black p-2 bg-white w-[80mm] max-w-[80mm] mx-auto text-[12px] leading-tight">
            {/* Header */}
            <div className="text-center border-b border-black pb-2 mb-2">
                <h1 className="font-bold text-lg uppercase">{shopDetails.name}</h1>
                <p className="text-[10px]" style={{ whiteSpace: 'pre-line' }}>{shopDetails.address}</p>
                {shopDetails.phone && <p>Ph: {shopDetails.phone}</p>}
                {shopDetails.gstin && <p>GSTIN: {shopDetails.gstin}</p>}
            </div>

            {/* Info */}
            <div className="flex justify-between mb-1 text-[11px]">
                <span>Inv: {order.invoice_number}</span>
                <span>{order.date.toLocaleDateString()} {order.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="mb-2 border-b border-dashed border-black pb-2 text-[11px]">
                <p>To: {customer?.name || "Cash Sale"}</p>
                {customer?.doctor_name && <p>Dr: {customer.doctor_name}</p>}
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-12 gap-1 font-bold border-b border-black mb-1 text-[11px]">
                <span className="col-span-6">Item</span>
                <span className="col-span-2 text-right">Qty</span>
                <span className="col-span-2 text-right">Rate</span>
                <span className="col-span-2 text-right">Amt</span>
            </div>

            {/* Items */}
            <div className="space-y-1 mb-2 border-b border-dashed border-black pb-2">
                {items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-1 text-[11px]">
                        <span className="col-span-6 truncate">{item.name}</span>
                        <span className="col-span-2 text-right">{item.qty}</span>
                        <span className="col-span-2 text-right">{item.price}</span>
                        <span className="col-span-2 text-right">{item.amount.toFixed(2)}</span>
                    </div>
                ))}
            </div>

            {/* Totals */}
            <div className="flex justify-end mb-2 border-b border-black pb-2">
                <div className="w-full text-right space-y-1">
                    <div className="flex justify-between"><span>Subtotal:</span> <span>{totals.subtotal.toFixed(2)}</span></div>
                    {totals.discount > 0 && <div className="flex justify-between"><span>Disc:</span> <span>-{totals.discount.toFixed(2)}</span></div>}

                    {totals.gst && (totals.gst.cgst > 0 || totals.gst.sgst > 0) && (
                        <div className="border-t border-dotted border-black pt-1 mt-1 text-[10px]">
                            <div className="flex justify-between">
                                <span>Taxable Value:</span>
                                <span>{(totals.total - (totals.gst.cgst + totals.gst.sgst)).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>CGST:</span>
                                <span>{totals.gst.cgst.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>SGST:</span>
                                <span>{totals.gst.sgst.toFixed(2)}</span>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-between font-bold text-sm border-t border-black pt-2 mt-1">
                        <span>NET TOTAL:</span>
                        <span>₹{totals.total.toFixed(2)}</span>
                    </div>
                    <div className="text-[10px] mt-1 text-right italic capitalize">
                        Payment: {order.payment_mode}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="text-center text-[10px] mt-4 border-t border-black pt-2">
                <p className="font-bold">Thank You! Get Well Soon.</p>
                <p className="mt-1 text-[8px]">Powered by PharmaAssist.AI</p>
            </div>
        </div>
    );
});

ThermalReceipt.displayName = "ThermalReceipt";
