
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReturnItem {
    medicine_name: string;
    batch_number: string | null;
    quantity: number;
    expiry_date?: string;
    reason?: string;
}

interface ShopDetails {
    name: string;
    address?: string;
    phone?: string;
}

export const pdfService = {
    generateReturnNote(shop: ShopDetails, supplierName: string, items: ReturnItem[]): void {
        const doc = new jsPDF();

        // Header
        doc.setFontSize(18);
        doc.text(shop.name || "Pharmacy Name", 14, 20);

        doc.setFontSize(10);
        doc.text("Purchase Return Note", 14, 28);
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 34);

        doc.setFontSize(12);
        doc.text(`To Supplier: ${supplierName}`, 14, 45);

        // Computed Data
        const tableData = items.map(item => [
            item.medicine_name,
            item.batch_number || 'N/A',
            item.quantity,
            item.expiry_date || 'N/A',
            item.reason || 'Expired'
        ]);

        // Table
        autoTable(doc, {
            startY: 50,
            head: [['Medicine', 'Batch', 'Qty', 'Expiry', 'Reason']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185] },
        });

        // Footer
        const finalY = (doc as any).lastAutoTable.finalY + 10;
        doc.text("Authorized Signature", 14, finalY + 15);

        // Save
        const fileName = `Return_Note_${supplierName}_${Date.now()}.pdf`;
        doc.save(fileName);
    }
};
