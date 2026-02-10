
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
                try { rawAnalysis = JSON.parse(rawAnalysis); } catch (e) { logger.warn("Pre-parsed rawAnalysis check failed", e); }
            }

            // Map response to Frontend Model
            // Gemini Lab Report API returns: test_results, health_insights, recommendations
            const testResults = data.test_results || rawAnalysis.test_results || data.results || rawAnalysis.results || [];
            const healthInsights = data.health_insights || rawAnalysis.health_insights || {};
            const recommendations = data.recommendations || rawAnalysis.recommendations || {};

            return {
                patientName: data.patient_name || rawAnalysis.patient_name,
                reportDate: data.report_date || rawAnalysis.report_date,
                summary: data.summary || data.result || "Analysis Complete",
                diseasePossibility: healthInsights.disease_risks || data.disease_possibility || [],
                results: testResults.map((test: any) => ({
                    parameter: test.test_name || test.parameter || "Unknown",
                    value: test.value || "",
                    unit: test.unit || "",
                    normalRange: test.normal_range || test.normalRange || "",
                    status: test.status || "Normal"
                })),
                recommendations: {
                    diet: recommendations.dietary || recommendations.diet || data.diet || [],
                    nextSteps: recommendations.medical || recommendations.nextSteps || data.next_steps || [],
                    prevention: recommendations.lifestyle || []
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
