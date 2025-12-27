
export interface TaxBreakdown {
    taxableAmount: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    totalTax: number;
    totalAmount: number;
}

/**
 * Calculates GST breakdown for a given amount and tax rates.
 * @param amount - The base amount (can be inclusive or exclusive based on isInclusive flag, but typically we treat MRP as inclusive for retail)
 * @param sgstRate - SGST percentage (e.g., 9 for 9%)
 * @param cgstRate - CGST percentage (e.g., 9 for 9%)
 * @param igstRate - IGST percentage (e.g., 18 for 18%)
 * @param isInclusive - Whether the input amount already includes tax. Default true for MRP.
 */
export const calculateTax = (
    amount: number,
    sgstRate: number,
    cgstRate: number,
    igstRate: number,
    isInclusive: boolean = true
): TaxBreakdown => {
    const totalTaxRate = sgstRate + cgstRate + igstRate;

    let taxableAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;
    let totalAmount = 0;

    if (isInclusive) {
        // Amount = Taxable + (Taxable * Rate / 100)
        // Amount = Taxable * (1 + Rate/100)
        // Taxable = Amount / (1 + Rate/100)
        taxableAmount = amount / (1 + totalTaxRate / 100);
        totalAmount = amount;

        // Now calc component amounts on the taxable base
        cgstAmount = taxableAmount * (cgstRate / 100);
        sgstAmount = taxableAmount * (sgstRate / 100);
        igstAmount = taxableAmount * (igstRate / 100);
    } else {
        taxableAmount = amount;
        cgstAmount = taxableAmount * (cgstRate / 100);
        sgstAmount = taxableAmount * (sgstRate / 100);
        igstAmount = taxableAmount * (igstRate / 100);

        totalAmount = taxableAmount + cgstAmount + sgstAmount + igstAmount;
    }

    return {
        taxableAmount: Number(taxableAmount.toFixed(2)),
        cgstAmount: Number(cgstAmount.toFixed(2)),
        sgstAmount: Number(sgstAmount.toFixed(2)),
        igstAmount: Number(igstAmount.toFixed(2)),
        totalTax: Number((cgstAmount + sgstAmount + igstAmount).toFixed(2)),
        totalAmount: Number(totalAmount.toFixed(2)),
    };
};

export const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
    }).format(amount);
};
