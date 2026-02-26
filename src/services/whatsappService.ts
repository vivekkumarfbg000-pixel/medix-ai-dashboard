
export interface WhatsAppOrder {
    invoice_number?: string;
    customer_name: string;
    shop_name?: string;
    shop_address?: string;
    shop_phone?: string;
    shop_gstin?: string;
    created_at: string;
    total_amount: number | null;
    status: string;
    payment_mode?: string;
    doctor_name?: string;
    items: { name: string; qty?: number; price: number }[];
    gst?: { cgst: number; sgst: number };
    discount?: number;
}

export interface WhatsAppPrescription {
    doctor_name: string;
    customer_name: string;
    visit_date: string;
    medicines: { name: string; dosage: string }[];
}

export interface WhatsAppReport {
    summary: string;
    diseasePossibility: string[];
    diet: string[];
    nextSteps: string[];
}

export const whatsappService = {
    /**
     * Helper to format phone number to international format (91 prefix)
     */
    formatPhone(phone: string | null): string {
        if (!phone) return "";
        const clean = phone.replace(/\D/g, '');
        if (clean.length === 10) return `91${clean}`;
        return clean;
    },

    /**
     * Generate Professional GST Invoice Message
     */
    generateInvoiceLink(phone: string | null, order: WhatsAppOrder): string {
        const items = Array.isArray(order.items) ? order.items : [];
        const itemsList = items.map((item, idx) =>
            `${idx + 1}. ${item.name} x${item.qty || 1} = ₹${(item.price * (item.qty || 1)).toFixed(2)}`
        ).join('\n');

        const subtotal = items.reduce((sum, i) => sum + (i.price * (i.qty || 1)), 0);
        const discountAmt = order.discount || 0;
        const hasTax = order.gst && (order.gst.cgst > 0 || order.gst.sgst > 0);

        let message = `🧾 *TAX INVOICE*\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        message += `🏪 *${order.shop_name || 'Medix Pharmacy'}*\n`;
        if (order.shop_address) message += `📍 ${order.shop_address}\n`;
        if (order.shop_phone) message += `📞 ${order.shop_phone}\n`;
        if (order.shop_gstin) message += `🔖 GSTIN: ${order.shop_gstin}\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        message += `📋 Invoice: *#${order.invoice_number || 'NA'}*\n`;
        message += `📅 Date: ${new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} ${new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}\n`;
        message += `👤 Patient: ${order.customer_name}\n`;
        if (order.doctor_name) message += `👨‍⚕️ Dr: ${order.doctor_name}\n`;
        message += `💳 Payment: ${(order.payment_mode || order.status).toUpperCase()}\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        message += `*ITEMS:*\n`;
        message += itemsList;
        message += `\n━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        message += `Subtotal: ₹${subtotal.toFixed(2)}\n`;
        if (discountAmt > 0) message += `Discount: -₹${discountAmt.toFixed(2)}\n`;
        if (hasTax) {
            message += `CGST: ₹${order.gst!.cgst.toFixed(2)}\n`;
            message += `SGST: ₹${order.gst!.sgst.toFixed(2)}\n`;
        }
        message += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        message += `💰 *GRAND TOTAL: ₹${(order.total_amount || 0).toFixed(2)}*\n`;
        if (order.status === 'pending') {
            message += `⏳ *Payment Pending (Credit)*\n`;
        } else {
            message += `✅ *PAID*\n`;
        }
        message += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        message += `🙏 Thank you for your trust!\n`;
        message += `_Powered by PharmaAssist.AI_`;

        return `https://wa.me/${this.formatPhone(phone)}?text=${encodeURIComponent(message)}`;
    },

    /**
     * Generate Prescription Message
     */
    generatePrescriptionLink(phone: string | null, prescription: WhatsAppPrescription): string {
        const medsList = prescription.medicines.map((m, idx) =>
            `${idx + 1}. *${m.name}*\n   Dosage: ${m.dosage}`
        ).join('\n');

        const message = `👨‍⚕️ *DIGITAL PRESCRIPTION*\n` +
            `🏥 *Medix Pharmacy & Diagnostics*\n` +
            `Date: ${new Date(prescription.visit_date).toLocaleDateString()}\n\n` +
            `Patient: ${prescription.customer_name}\n` +
            `Doctor: ${prescription.doctor_name}\n` +
            `--------------------------------\n` +
            `💊 *MEDICINES:*\n` +
            medsList +
            `\n--------------------------------\n` +
            `\n_Get these medicines delivered via Medix App!_`;

        return `https://wa.me/${this.formatPhone(phone)}?text=${encodeURIComponent(message)}`;
    },

    /**
     * Generate Lab Report Summary Message
     */
    generateReportLink(phone: string | null, report: WhatsAppReport): string {
        const message = `*🏥 MedixAI Report Summary*\n\n` +
            `*Summary:* ${report.summary}\n\n` +
            `*🚨 Possibility:* ${report.diseasePossibility.join(", ")}\n\n` +
            `*🥗 Recommended Diet:* ${report.diet.join(", ")}\n\n` +
            `*👨‍⚕️ Next Steps:* ${report.nextSteps.join(", ")}\n\n` +
            `_Generated by MedixAI_`;

        return `https://wa.me/${this.formatPhone(phone)}?text=${encodeURIComponent(message)}`;
    },
    /**
     * Generate Return Note Message
     */
    generateReturnMessage(phone: string | null, details: { shop_name?: string, supplier_name: string, item_count: number }): string {
        const message = `👋 Hi ${details.supplier_name},\n\n` +
            `Please find attached the *Purchase Return Note* from ${details.shop_name || 'us'}.\n` +
            `Total Items: ${details.item_count}\n\n` +
            `Kindly process the credit note.\n` +
            `_Sent via PharmaAssist_`;

        return `https://wa.me/${this.formatPhone(phone) || ''}?text=${encodeURIComponent(message)}`;
    },

    /**
     * Generate Refill Reminder Message
     */
    generateRefillReminder(phone: string | null, details: { patient_name: string, medicine_name: string, shop_name?: string }): string {
        const message = `👋 Hi ${details.patient_name},\n\n` +
            `This is a gentle reminder from *${details.shop_name || 'Medix Pharmacy'}*.\n\n` +
            `Your medicine *${details.medicine_name}* is due for a refill.\n\n` +
            `Reply 'YES' to order now or click below to call us.\n` +
            `_Powered by MedixAI_`;

        return `https://wa.me/${this.formatPhone(phone)}?text=${encodeURIComponent(message)}`;
    }
};
