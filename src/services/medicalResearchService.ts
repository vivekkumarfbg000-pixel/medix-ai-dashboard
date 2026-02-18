import logger from "@/utils/logger";

const PUBMED_API = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const FDA_API = "https://api.fda.gov/drug/label.json";

interface PubMedArticle {
    title: string;
    pubdate: string;
    pmid: string;
    source: string;
}

interface FDAData {
    warnings: string[];
    indications: string;
    source: string;
}

interface SynthesizedAnswer {
    answer: string;
    citations: string[];
}

// Import callGroqAI dynamically to avoid circular dependency
const callGroqAI = async (messages: any[], model: string, jsonMode: boolean): Promise<string> => {
    const { aiService } = await import("./aiService");
    // Use aiService chatWithAgent as a proxy
    const result = await aiService.chatWithAgent(JSON.stringify({ messages, model, jsonMode }));
    return result.reply;
};

const safeJSONParse = (text: string, fallback: any = null): any => {
    try {
        // Remove markdown code blocks if present
        const cleaned = text.replace(/```json\s*|```\s*/g, "").trim();
        return JSON.parse(cleaned);
    } catch (e) {
        logger.warn("JSON parse failed", e);
        return fallback;
    }
};

export const medicalResearchService = {
    /**
     * Search PubMed for peer-reviewed medical research
     */
    async searchPubMed(query: string, maxResults = 3): Promise<PubMedArticle[]> {
        try {
            // Step 1: Search for article IDs
            const searchUrl = `${PUBMED_API}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmode=json&retmax=${maxResults}&sort=relevance&reldate=1825`; // Last 5 years
            const response = await fetch(searchUrl);
            const data = await response.json();
            const ids = data.esearchresult?.idlist || [];

            if (ids.length === 0) return [];

            // Step 2: Fetch article details
            const summaryUrl = `${PUBMED_API}/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json`;
            const summaryResponse = await fetch(summaryUrl);
            const summaryData = await summaryResponse.json();

            return ids.map((id: string) => ({
                title: summaryData.result?.[id]?.title || "No title",
                pubdate: summaryData.result?.[id]?.pubdate || "",
                pmid: id,
                source: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
            }));
        } catch (error) {
            logger.error("PubMed API error:", error);
            return [];
        }
    },

    /**
     * Check FDA OpenData for drug safety information
     */
    async checkFDA(drugName: string): Promise<FDAData | null> {
        try {
            const searchQuery = encodeURIComponent(`openfda.brand_name:"${drugName}" OR openfda.generic_name:"${drugName}"`);
            const response = await fetch(`${FDA_API}?search=${searchQuery}&limit=1`);
            const data = await response.json();
            const result = data.results?.[0];

            if (result) {
                return {
                    warnings: result.warnings || result.boxed_warning || [],
                    indications:
                        Array.isArray(result.indications_and_usage)
                            ? result.indications_and_usage[0]
                            : result.indications_and_usage || "",
                    source: "FDA OpenData",
                };
            }
            return null;
        } catch (error) {
            logger.error("FDA API error:", error);
            return null;
        }
    },

    /**
     * Synthesize answer from multiple research sources
     * Note: Uses simple formatting instead of Groq AI to avoid circular dependency
     */
    async synthesizeAnswer(query: string, sources: any): Promise<SynthesizedAnswer> {
        try {
            const { pubmed, fda } = sources;
            let answer = "";
            const citations: string[] = [];

            // Build answer from sources
            if (fda) {
                answer += `Based on FDA data:\n`;
                if (fda.indications) {
                    answer += `Indications: ${fda.indications.substring(0, 200)}...\n\n`;
                }
                if (fda.warnings && fda.warnings.length > 0) {
                    answer += `⚠️ Warnings: ${fda.warnings[0].substring(0, 200)}...\n\n`;
                }
                citations.push("FDA: OpenFDA Drug Database");
            }

            if (pubmed && pubmed.length > 0) {
                answer += `Recent research findings:\n`;
                pubmed.slice(0, 2).forEach((article: PubMedArticle) => {
                    answer += `• ${article.title.substring(0, 100)}...\n`;
                    citations.push(`PubMed: ${article.title.substring(0, 50)}... (${article.pubdate}) PMID: ${article.pmid}`);
                });
            }

            if (!answer) {
                return {
                    answer: "No authoritative medical information found. Please consult medical databases directly or seek professional medical advice.",
                    citations: [],
                };
            }

            answer += "\n⚠️ Important: This information is for reference only. Always consult a healthcare professional for medical advice.";

            return { answer, citations };
        } catch (error) {
            logger.error("Answer synthesis error:", error);
            return {
                answer: "Unable to generate answer. Please consult medical sources directly.",
                citations: [],
            };
        }
    },

    /**
     * Main entry point: Search medical research and provide answer
     */
    async searchMedicalResearch(query: string): Promise<SynthesizedAnswer> {
        logger.log("[Medical Research] Searching for:", query);

        // Extract drug name if present (simple regex)
        const drugMatch = query.match(
            /\b([A-Z][a-z]+(?:zole|pam|pril|sartan|statin|mycin|cillin|floxacin|tadine|morphine|codeine|phylline)?|metformin|aspirin|ibuprofen|paracetamol|acetaminophen|dolo|azithromycin|amoxicillin|ciprofloxacin)\b/i
        );
        const drugName = drugMatch ? drugMatch[1] : null;

        // Parallel search
        const [pubmedResults, fdaData] = await Promise.all([
            this.searchPubMed(query),
            drugName ? this.checkFDA(drugName) : Promise.resolve(null),
        ]);

        logger.log("[Medical Research] Results:", { pubmed: pubmedResults.length, fda: !!fdaData });

        // If no sources found, return early
        if (pubmedResults.length === 0 && !fdaData) {
            return {
                answer:
                    "No authoritative medical research found for this query. Please consult medical databases directly or seek professional medical advice.",
                citations: [],
            };
        }

        // Synthesize answer with citations
        return await this.synthesizeAnswer(query, {
            pubmed: pubmedResults,
            fda: fdaData,
        });
    },
};
