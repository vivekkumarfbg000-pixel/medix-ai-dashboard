
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
    hinglishSummary?: string; // Patient-friendly explanation in Hinglish
    diseasePossibility: string[];
    potentialRisks?: Array<{
        risk: string;
        severity: 'Low' | 'Moderate' | 'High' | 'Critical';
        description: string;
    }>;
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
            // [HARDENING]: Check multiple common AI response patterns
            const testResults = Array.isArray(data) ? data : 
                               (data.test_results || data.results || data.biomarkers || rawAnalysis.test_results || rawAnalysis.results || []);
            
            const healthInsights = data.health_insights || rawAnalysis.health_insights || data || {};
            const recommendations = data.recommendations || rawAnalysis.recommendations || data || {};
            const diet = Array.isArray(recommendations.diet) ? recommendations.diet : 
                        (Array.isArray(recommendations.dietary) ? recommendations.dietary : (Array.isArray(data.diet) ? data.diet : []));
            const medical = Array.isArray(recommendations.medical) ? recommendations.medical : 
                           (Array.isArray(recommendations.nextSteps) ? recommendations.nextSteps : (Array.isArray(data.next_steps) ? data.next_steps : []));
            const prevention = Array.isArray(recommendations.prevention) ? recommendations.prevention : 
                              (Array.isArray(recommendations.lifestyle) ? recommendations.lifestyle : (Array.isArray(data.prevention) ? data.prevention : []));

            const finalReport: LabAnalysisReport = {
                patientName: data.patient_name || rawAnalysis.patient_name || null,
                reportDate: data.report_date || rawAnalysis.report_date || null,
                summary: data.summary || data.result || "Lab analysis completed successfully. See details below.",
                hinglishSummary: data.hinglish_summary || rawAnalysis.hinglish_summary || null,
                diseasePossibility: Array.isArray(data.disease_possibility) ? data.disease_possibility : 
                                  (Array.isArray(healthInsights.disease_risks) ? healthInsights.disease_risks : []),
                potentialRisks: Array.isArray(data.potential_risks) ? data.potential_risks : 
                               (Array.isArray(rawAnalysis.potential_risks) ? rawAnalysis.potential_risks : []),
                results: Array.isArray(testResults) ? testResults.map((test: any) => ({
                    parameter: test.test_name || test.parameter || test.test || "Unknown Marker",
                    value: test.value !== undefined ? String(test.value) : "N/A",
                    unit: test.unit || "",
                    normalRange: test.normal_range || test.normalRange || test.reference || "N/A",
                    status: (test.status && ["Normal", "Low", "High", "Abnormal"].includes(test.status)) ? test.status : "Normal"
                })) : [],
                recommendations: {
                    diet: diet,
                    nextSteps: medical,
                    prevention: prevention
                }
            };

            logger.log("[LabService] Normalized Report:", finalReport);
            return finalReport;

        } catch (error: any) {
            logger.error("Lab Analysis Failed:", error);
            throw error;
        }
    }

    // transformFile method removed as it is handled by aiService now
}

export const labService = new LabService();
