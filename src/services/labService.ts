
import { logger } from "@/utils/logger";
import { aiService } from "@/services/aiService";

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
            logger.log("Starting Lab Analysis via aiService...");

            // Use the unified aiService which handles the correct endpoint (analyze-report)
            // and formatting expected by the backend.
            const data = await aiService.analyzeDocument(file, 'lab_report');

            logger.log("[LabService] Raw Response:", data);

            // Parse raw analysis if it's a string
            let rawAnalysis = data.raw_analysis || {};
            if (typeof rawAnalysis === 'string') {
                try { rawAnalysis = JSON.parse(rawAnalysis); } catch (e) { }
            }

            // Map response to Frontend Model
            // Handling variations in N8N response keys (result/summary, etc)
            return {
                summary: data.result || data.summary || "Analysis Complete",
                diseasePossibility: data.disease_possibility || [],
                results: rawAnalysis.results || data.results || [],
                recommendations: {
                    diet: data.diet || data.diet_recommendations || [],
                    nextSteps: data.next_steps || [],
                    prevention: []
                }
            };

        } catch (error: any) {
            logger.error("Lab Analysis Failed:", error);
            throw error;
        }
    }

    // transformFile method removed as it is handled by aiService now
}

export const labService = new LabService();
