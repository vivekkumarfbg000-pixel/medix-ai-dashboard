
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
const NLM_RXNAV_API_URL = "https://rxnav.nlm.nih.gov/REST";

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

      return {
        name: result.openfda?.brand_name?.[0] || query,
        genericName: result.openfda?.generic_name?.[0] || "Unknown",
        uses: (result.indications_and_usage || ["Information not available"]).slice(0, 5),
        sideEffects: (result.adverse_reactions || ["Information not available"])
          .slice(0, 1)
          .map((text: string) => ({ effect: text.substring(0, 150) + "...", severity: "moderate" })),
        warnings: (result.warnings || ["No specific warnings found"]).slice(0, 3)
      };
    } catch (error) {
      console.error("Error fetching drug info:", error);
      return null;
    }
  },

  /**
   * Helper to get RxCUI from NLM RxNav API
   */
  async getRxCUI(drugName: string): Promise<string | null> {
    try {
      const response = await fetch(`${NLM_RXNAV_API_URL}/rxcui.json?name=${encodeURIComponent(drugName)}`);
      const data = await response.json();
      const idGroup = data.idGroup;
      if (idGroup.rxnormId && idGroup.rxnormId.length > 0) {
        return idGroup.rxnormId[0];
      }
      return null;
    } catch (error) {
      console.error(`Error getting RxCUI for ${drugName}:`, error);
      return null;
    }
  },

  /**
   * Check for interactions using NLM Interaction API
   */
  async checkInteractions(drugs: string[]): Promise<InteractionResult[]> {
    if (drugs.length < 2) return [];

    const interactions: InteractionResult[] = [];

    try {
      // 1. Get RxCUIs for all drugs
      const drugIds: Record<string, string> = {}; // map rxcui to name
      const rxcuis: string[] = [];

      for (const drug of drugs) {
        const id = await this.getRxCUI(drug);
        if (id) {
          rxcuis.push(id);
          drugIds[id] = drug;
        }
      }

      if (rxcuis.length < 2) return [];

      // 2. Call Interaction API
      const response = await fetch(
        `${NLM_RXNAV_API_URL}/interaction/list.json?rxcuis=${rxcuis.join("+")}`
      );
      const data = await response.json();

      if (!data.fullInteractionTypeGroup) return [];

      // 3. Parse Interactions
      for (const group of data.fullInteractionTypeGroup) {
        for (const type of group.fullInteractionType) {
          for (const interaction of type.interactionPair) {
            const drug1Name = interaction.interactionConcept[0].minConceptItem.name;
            const drug2Name = interaction.interactionConcept[1].minConceptItem.name;
            const description = interaction.description;

            interactions.push({
              drugs: [drug1Name, drug2Name],
              severity: "severe", // NLM API doesn't always perform severity in this endpoint, defaulting to high attention
              description: description,
              recommendation: "Consult a healthcare professional immediately regarding this combination."
            });
          }
        }
      }

    } catch (error) {
      console.error("Error checking interactions:", error);
    }

    return interactions;
  }
};
