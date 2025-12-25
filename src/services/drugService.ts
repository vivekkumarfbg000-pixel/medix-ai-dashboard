
export interface DrugInfo {
  name: string;
  genericName?: string;
  uses: string[];
  sideEffects: { effect: string; severity: string }[];
  warnings: string[];
}

export interface InteractionResult {
  drugs: string[];
  severity: "severe" | "moderate" | "mild";
  description: string;
  recommendation: string;
}

const OPENFDA_API_URL = "https://api.fda.gov/drug/label.json";

export const drugService = {
  /**
   * Search for drug information using OpenFDA API
   */
  async searchDrug(query: string): Promise<DrugInfo | null> {
    try {
      const response = await fetch(
        `${OPENFDA_API_URL}?search=openfda.brand_name:"${query}"+OR+openfda.generic_name:"${query}"&limit=1`
      );
      
      if (!response.ok) return null;
      
      const data = await response.json();
      if (!data.results || data.results.length === 0) return null;
      
      const result = data.results[0];
      
      // Extract relevant fields (OpenFDA data is unstructured text, so we map primarily to available fields)
      return {
        name: result.openfda?.brand_name?.[0] || query,
        genericName: result.openfda?.generic_name?.[0] || "Unknown",
        uses: (result.indications_and_usage || ["Information not available"]).slice(0, 5),
        sideEffects: (result.adverse_reactions || ["Information not available"])
          .slice(0, 1)
          .map((text: string) => ({ effect: text.substring(0, 100) + "...", severity: "moderate" })),
        warnings: (result.warnings || ["No specific warnings found"]).slice(0, 3)
      };
    } catch (error) {
      console.error("Error fetching drug info:", error);
      return null;
    }
  },

  /**
   * Check for interactions (Simulated for now as OpenFDA doesn't have a direct interaction API, 
   * but we can check warnings of each drug for mentions of the other)
   */
  async checkInteractions(drugs: string[]): Promise<InteractionResult[]> {
    if (drugs.length < 2) return [];
    
    const interactions: InteractionResult[] = [];
    
    // improvement: Real implementation would require a dedicated interaction database.
    // Here we do a basic cross-check of warnings
    
    for (let i = 0; i < drugs.length; i++) {
      for (let j = i + 1; j < drugs.length; j++) {
        const drug1 = drugs[i];
        const drug2 = drugs[j];
        
        // Simple known interaction fallback for demo purposes
        if (
          (drug1.toLowerCase().includes("aspirin") && drug2.toLowerCase().includes("warfarin")) ||
          (drug2.toLowerCase().includes("aspirin") && drug1.toLowerCase().includes("warfarin"))
        ) {
          interactions.push({
            drugs: [drug1, drug2],
            severity: "severe",
            description: "Increased risk of bleeding. Aspirin increases bleeding time.",
            recommendation: "Avoid concurrent use unless directed by a physician."
          });
        }
      }
    }
    
    return interactions;
  }
};
