
export interface LabTestResult {
    parameter: string;
    value: number;
    unit: string;
    normalRange: string;
    status: "Normal" | "Low" | "High";
    riskLevel: "None" | "Moderate" | "Critical";
    color: string;
}

export interface LabAnalysisReport {
    patientName?: string;
    reportDate?: string;
    results: LabTestResult[];
    summary: string;
    diseasePossibility: string[];
    recommendations: {
        prevention: string[];
        diet: string[];
        nextSteps: string[];
    };
}

const MOCK_SCENARIOS: Record<string, LabAnalysisReport> = {
    "anemia": {
        results: [
            { parameter: "Haemoglobin", value: 9.2, unit: "g/dL", normalRange: "13.0 - 17.0", status: "Low", riskLevel: "Moderate", color: "text-amber-500" },
            { parameter: "RBC Detection", value: 3.8, unit: "mill/mm3", normalRange: "4.5 - 5.5", status: "Low", riskLevel: "Moderate", color: "text-amber-500" },
            { parameter: "Iron", value: 45, unit: "mcg/dL", normalRange: "60 - 170", status: "Low", riskLevel: "Moderate", color: "text-amber-500" }
        ],
        summary: "Report indicates distinct Iron Deficiency Anemia. Haemoglobin and Iron levels are suppressed.",
        diseasePossibility: ["Iron Deficiency Anemia", "General Fatigue", "Poor Nutrition"],
        recommendations: {
            prevention: ["Avoid tea/coffee immediately after meals."],
            diet: ["Spinach", "Red Meat", "Beetroot", "Pomegranate"],
            nextSteps: ["Start Iron Supplements (Ferrous Ascorbate).", "Re-test in 30 days."]
        }
    },
    "thyroid": {
        results: [
            { parameter: "TSH", value: 8.5, unit: "mIU/L", normalRange: "0.4 - 4.0", status: "High", riskLevel: "Moderate", color: "text-red-500" },
            { parameter: "T4 (Thyroxine)", value: 4.2, unit: "ug/dL", normalRange: "4.6 - 12.0", status: "Low", riskLevel: "Moderate", color: "text-amber-500" }
        ],
        summary: "Elevated TSH and low T4 suggests Hypothyroidism (Underactive Thyroid).",
        diseasePossibility: ["Hypothyroidism", "Hashimoto's Thyroiditis"],
        recommendations: {
            prevention: ["Avoid soy products.", "Reduce stress."],
            diet: ["Iodized Salt", "Nuts", "Whole Grains"],
            nextSteps: ["Consult Endocrinologist.", "Start Thyroxine medication."]
        }
    }
};

class LabService {
    async analyzeReport(file: File): Promise<LabAnalysisReport> {
        // Simulate Processing Delay
        await new Promise(resolve => setTimeout(resolve, 3000));

        // For Demo: Randomly pick a scenario or determine based on filename if possible (cannot read real file content in mock)
        // defaulting to Anemia for visual impact
        const keys = Object.keys(MOCK_SCENARIOS);
        const randomKey = keys[Math.floor(Math.random() * keys.length)];
        return {
            ...MOCK_SCENARIOS[randomKey],
            patientName: "Guest Patient",
            reportDate: new Date().toLocaleDateString()
        };
    }
}

export const labService = new LabService();
