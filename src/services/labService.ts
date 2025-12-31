
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

import { aiService } from "./aiService";

export interface LabTestResult {
    parameter: string;
    value: string | number; // Gemini might return mixed types
    unit: string;
    normalRange: string;
    status: "Normal" | "Low" | "High" | "Abnormal";
    riskLevel?: "None" | "Moderate" | "Critical"; // Optional, derived from status
    color?: string; // Optional, formatted in UI
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

class LabService {
    async analyzeReport(file: File): Promise<LabAnalysisReport> {
        try {
            // Convert File to Base64
            const base64 = await this.fileToBase64(file);

            // Call N8N via aiService (which handles the endpoint mapping)
            // We use the generic 'triggerOp' or a specific method if we add one.
            // Since aiService.triggerOp handles JSON body, we construct the payload here.
            // The 'action' must match the workflow conditions: 'scan-report'

            const response = await aiService.triggerOp('scan-report', {
                image_base64: base64, // N8N expects this key for vision nodes
                filename: file.name
            });

            // The Workflow B returns: { result: string, warning: string, analysis: object }
            // We need to map the N8N response back to our Frontend Interface (LabAnalysisReport)
            // Assuming the Workflow returns a structure we can map, or we adjust the UI to match.
            // For now, let's assume the Gemini node in N8N returns the exact structure or we map it.

            // IF N8N returns mixed structure, we normalize it here.
            // This relies on the N8N Gemini system prompt being VERY specific.

            // Fallback mapper if direct structure doesn't match
            const data = response || {};

            return {
                summary: data.result || "Analysis Complete",
                diseasePossibility: data.disease_possibility || [],
                results: data.results || [],
                recommendations: {
                    diet: data.diet || [],
                    nextSteps: data.next_steps || [],
                    prevention: []
                }
            };

        } catch (error) {
            console.error("Lab Analysis Failed:", error);
            throw error;
        }
    }

    private fileToBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const result = reader.result as string;
                // Remove data:image/jpeg;base64, prefix if needed, but N8N usually handles it or we strip it.
                // Standard N8N binary handling often prefers just the base64 string.
                const base64Clean = result.split(',')[1];
                resolve(base64Clean);
            };
            reader.onerror = error => reject(error);
        });
    }
}

export const labService = new LabService();
