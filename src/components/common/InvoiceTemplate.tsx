import React from 'react';
import { format } from "date-fns";

interface InvoiceProps {
    order: any;
    shopDetails?: {
        name: string;
        address: string;
        phone: string;
        gstin: string;
        dl_number: string;
    };
}

export const InvoiceTemplate = React.forwardRef<HTMLDivElement, InvoiceProps>(({ order, shopDetails }, ref) => {
    const items = Array.isArray(order.order_items) ? order.order_items : [];

    const calculateSubtotal = () => {
        return items.reduce((acc: number, item: any) => {
            const price = item.price || 0;
            const qty = item.qty || 0;
            const breakdown = item.tax_breakdown || { taxableAmount: price * qty }; // Fallback
            return acc + breakdown.taxableAmount;
        }, 0);
    };

    const calculateTotalTax = () => {
        return items.reduce((acc: number, item: any) => {
            const breakdown = item.tax_breakdown || { totalTax: 0 };
            return acc + breakdown.totalTax;
        }, 0);
    };

    return (
        <div ref={ref} className="p-8 bg-white text-black font-sans max-w-[800px] mx-auto print:p-0 print:max-w-none">
            {/* Header */}
            <div className="flex justify-between items-start border-b pb-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold uppercase tracking-wide text-gray-900">{shopDetails?.name || "Medical Store"}</h1>
                    <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{shopDetails?.address || "Address Line 1"}</p>
                    <div className="text-sm mt-2 space-y-1">
                        <p>Phone: {shopDetails?.phone || "-"}</p>
                        <p>GSTIN: <span className="font-semibold">{shopDetails?.gstin || "N/A"}</span></p>
                        <p>DL No: <span className="font-semibold">{shopDetails?.dl_number || "N/A"}</span></p>
                    </div>
                </div>
                <div className="text-right">
                    <h2 className="text-4xl font-light text-gray-400">INVOICE</h2>
                    <p className="font-medium mt-2">#{order.invoice_number || order.id?.slice(0, 8).toUpperCase()}</p>
                    <p className="text-sm text-gray-500">{format(new Date(order.created_at || new Date()), "dd MMM yyyy")}</p>
                </div>
            </div>

            {/* Customer Info */}
            <div className="mb-8">
                <h3 className="text-xs font-bold uppercase text-gray-400 mb-2">Bill To</h3>
                <p className="font-semibold text-lg">{order.customer_name || "Cash Customer"}</p>
                {order.customer_phone && <p className="text-sm text-gray-600">{order.customer_phone}</p>}
            </div>

            {/* Items Table */}
            <table className="w-full text-sm mb-6">
                <thead>
                    <tr className="border-b-2 border-gray-100">
                        <th className="text-left py-2 w-[40%]">Item Name</th>
                        <th className="text-center py-2">HSN</th>
                        <th className="text-center py-2">Qty</th>
                        <th className="text-right py-2">MRP</th>
                        <th className="text-right py-2">Taxable</th>
                        <th className="text-right py-2">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item: any, idx: number) => {
                        const breakdown = item.tax_breakdown || { taxableAmount: (item.price * item.qty), totalTax: 0 };
                        return (
                            <tr key={idx} className="border-b border-gray-50">
                                <td className="py-2">{item.name}</td>
                                <td className="text-center text-gray-500 text-xs">{item.hsn || "-"}</td>
                                <td className="text-center">{item.qty}</td>
                                <td className="text-right">₹{item.price}</td>
                                <td className="text-right">₹{breakdown.taxableAmount.toFixed(2)}</td>
                                <td className="text-right font-medium">₹{(item.price * item.qty).toFixed(2)}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end mb-12">
                <div className="w-[40%] space-y-2">
                    <div className="flex justify-between text-sm text-gray-600">
                        <span>Taxable Amount</span>
                        <span>₹{calculateSubtotal().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                        <span>Total GST</span>
                        <span>₹{calculateTotalTax().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xl font-bold border-t pt-2 mt-2">
                        <span>Grand Total</span>
                        <span>₹{(order.total_amount || 0).toFixed(2)}</span>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-gray-400 mt-12 pt-8 border-t">
                <p>Thank you for your business!</p>
                <p className="mt-1">Computer Generated Invoice. No Signature Required.</p>
                <p className="mt-4 font-mono">Powered by PharmaAssist.AI</p>
            </div>
        </div>
    );
});

InvoiceTemplate.displayName = "InvoiceTemplate";
