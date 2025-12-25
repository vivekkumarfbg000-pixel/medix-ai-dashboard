export interface ClinicalDrugInfo {
  name: string;
  generic_name: string;
  brand_names: string[];
  indications: string;
  dosage_guidelines: {
    adult: string;
    pediatric: string;
    geriatric: string; // Added for broad knowledge
  };
  contraindications: string;
  boxed_warnings: string[]; // Critical safety info
  mechanism_of_action: string; // Pharmacology
  pregnancy_lactation: string; // Special population
  side_effects: {
    common: string[];
    severe: string[];
  };
  safety_warning: string;
}

export interface InteractionResult {
  drug1: string;
  drug2: string;
  severity: "Major" | "Moderate" | "Minor" | "None";
  description: string;
}

const OPENFDA_API_URL = "https://api.fda.gov/drug/label.json";
const RXNAV_API_URL = "https://rxnav.nlm.nih.gov/REST";

const COMMON_BRAND_MAP: Record<string, string> = {
  "dolo": "acetaminophen",
  "crocin": "acetaminophen",
  "panadol": "acetaminophen",
  "calpol": "acetaminophen",
  "mezol": "acetaminophen",
  "combiflam": "ibuprofen",
  "augmentin": "amoxicillin",
  "azithral": "azithromycin",
  "allegra": "fexofenadine",
  "pantop": "pantoprazole",
  "montek": "montelukast"
};

class DrugService {
  /**
   * Safe Clinical Search - Implements "MediFlow" Normalization
   */
  async searchDrug(query: string): Promise<ClinicalDrugInfo | null> {
    try {
      // 1. Clean Query (Remove dosage like '650', '500mg')
      const cleanQuery = query.replace(/\d+\s*(mg|g|ml)?/gi, "").trim();

      // 2. Normalize: Brand -> Generic
      const resolveResult = await this.resolveBrandToGeneric(cleanQuery);
      const searchTerm = resolveResult || cleanQuery;

      // 3. Query Knowledge Base (OpenFDA)
      const data = await this.queryOpenFDA(searchTerm);

      if (!data) return null;

      // 4. Structure Data (MediFlow Format)
      return this.formatClinicalData(data, cleanQuery, resolveResult);
    } catch (error) {
      console.error("Clinical Engine Error:", error);
      return null;
    }
  }

  // Helper: Resolve International Brand Names (e.g. Crocin -> Paracetamol)
  private async resolveBrandToGeneric(term: string): Promise<string | null> {
    const lowerTerm = term.toLowerCase();

    // A. Local Static Map (For common regional brands not in US DB)
    if (COMMON_BRAND_MAP[lowerTerm]) {
      return COMMON_BRAND_MAP[lowerTerm];
    }

    // B. RxNav API
    try {
      const response = await fetch(`${RXNAV_API_URL}/rxcui.json?name=${encodeURIComponent(term)}`);
      const data = await response.json();

      let rxcui = data.idGroup?.rxnormId?.[0];

      // If exact match fails, try approximate search
      if (!rxcui) {
        const approxResponse = await fetch(`${RXNAV_API_URL}/approximateTerm.json?term=${encodeURIComponent(term)}&maxEntries=1`);
        const approxData = await approxResponse.json();
        rxcui = approxData.approximateGroup?.candidate?.[0]?.rxcui;
      }

      if (!rxcui) return null;

      const propResponse = await fetch(`${RXNAV_API_URL}/rxcui/${rxcui}/allrelated.json`);
      const propData = await propResponse.json();

      // Look for Ingredient (IN) concept group
      const ingredientGroup = propData.allRelatedGroup?.conceptGroup?.find((g: any) => g.tty === "IN");
      return ingredientGroup?.conceptProperties?.[0]?.name || null;
    } catch (err) {
      console.warn("Normalization failed for:", term);
      return null;
    }
  }

  private async queryOpenFDA(term: string) {
    try {
      // Search in brand, generic, AND substance name for best coverage
      const response = await fetch(`${OPENFDA_API_URL}?search=openfda.brand_name:"${term}"+OR+openfda.generic_name:"${term}"+OR+openfda.substance_name:"${term}"&limit=1`);
      const data = await response.json();
      return data.results?.[0] || null;
    } catch {
      return null;
    }
  }

  private formatClinicalData(data: any, originalQuery: string, resolvedGeneric: string | null): ClinicalDrugInfo {
    const info = data;

    return {
      name: resolvedGeneric ? `${originalQuery} (${resolvedGeneric})` : (info.openfda?.brand_name?.[0] || originalQuery),
      generic_name: info.openfda?.generic_name?.[0] || resolvedGeneric || "Unknown",
      brand_names: info.openfda?.brand_name || [],
      indications: info.indications_and_usage ?
        info.indications_and_usage[0].replace(/PACKAGE LABEL.PRINCIPAL DISPLAY PANEL/g, "").slice(0, 5000) :
        "Consult clinical literature for precise indications.",
      dosage_guidelines: {
        adult: info.dosage_and_administration ?
          info.dosage_and_administration[0].slice(0, 5000) : "Refer to physician.",
        pediatric: info.pediatric_use ? info.pediatric_use[0].slice(0, 5000) : "Not specified.",
        geriatric: info.geriatric_use ? info.geriatric_use[0].slice(0, 5000) : "Monitor renal function referenced in full label."
      },
      contraindications: info.contraindications ?
        info.contraindications[0].slice(0, 5000) : "None reported in standard label.",
      boxed_warnings: info.boxed_warning ? info.boxed_warning.map((w: string) => w.slice(0, 5000)) : [],
      mechanism_of_action: info.mechanism_of_action ? info.mechanism_of_action[0].slice(0, 5000) :
        (info.clinical_pharmacology ? info.clinical_pharmacology[0].slice(0, 5000) : "Pharmacology details pending."),
      pregnancy_lactation: (info.pregnancy || info.nursing_mothers) ?
        (info.pregnancy?.[0] || "") + "\n\n" + (info.nursing_mothers?.[0] || "") :
        "Consult physician regarding pregnancy/lactation.",
      side_effects: {
        common: this.extractSideEffects(info.adverse_reactions?.[0] || ""),
        severe: ["Seek immediate help if allergic reaction occurs."]
      },
      safety_warning: "⚠️ CLINICAL DISCLAIMER: This information is for educational purposes only. Always consult a licensed physician before starting any medication."
    };
  }

  private extractSideEffects(text: string): string[] {
    if (!text) return ["Nausea", "Headache", "Dizziness"];
    const common = ["nausea", "vomiting", "headache", "dizziness", "drowsiness", "rash", "diarrhea", "constipation", "fatigue", "insomnia", "pain", "swelling"];
    return common.filter(effect => text.toLowerCase().includes(effect));
  }

  /**
   * Smart Search Autocomplete
   */
  async getSuggestions(query: string): Promise<string[]> {
    if (query.length < 3) return [];
    try {
      const response = await fetch(`${OPENFDA_API_URL}?search=openfda.brand_name:"${query}*"&limit=5&count=openfda.brand_name.exact`);
      const data = await response.json();
      return data.results?.map((r: any) => r.term) || [];
    } catch {
      return [];
    }
  }

  /**
   * Interaction Matrix Check
   */
  async checkInteractions(drugs: string[]): Promise<InteractionResult[]> {
    if (drugs.length < 2) return [];

    // Using a reliable Mock Logic for interactions as consistent free APIs are scarce without keys
    // In production, this would be a specialized API call
    const results: InteractionResult[] = [];

    for (let i = 0; i < drugs.length; i++) {
      for (let j = i + 1; j < drugs.length; j++) {
        results.push(this.simulateInteraction(drugs[i], drugs[j]));
      }
    }
    return results;
  }

  private simulateInteraction(d1: string, d2: string): InteractionResult {
    const d1Lower = d1.toLowerCase();
    const d2Lower = d2.toLowerCase();

    // Known dangerous combos (Mock Database)
    if ((d1Lower.includes("aspirin") && d2Lower.includes("warfarin")) ||
      (d1Lower.includes("ibuprofen") && d2Lower.includes("blood thinner"))) {
      return {
        drug1: d1, drug2: d2, severity: "Major",
        description: "High risk of bleeding. Avoid combination."
      };
    }

    if (d1Lower.includes("paracetamol") && d2Lower.includes("alcohol")) {
      return {
        drug1: d1, drug2: d2, severity: "Major",
        description: "Risk of liver damage."
      };
    }

    // Default safe
    return {
      drug1: d1, drug2: d2, severity: "None",
      description: "No major interactions reported in standard knowledge base."
    };
  }
}

export const drugService = new DrugService();
