import { aiService } from "./aiService";

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
  substitutes?: {
    name: string;
    generic_name: string;
    price: number;
    margin_percentage: number;
    savings: number;
  }[];
  is_h1_drug?: boolean; // For Compliance Shield
  banned_status?: { is_banned: boolean; reason: string }; // Anti-Malpractice
  education_tips?: { diet: string[]; lifestyle: string[]; warning: string }; // Dawa-Gyaan
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
  // Pain & Fever
  "dolo": "acetaminophen",
  "crocin": "acetaminophen",
  "calpol": "acetaminophen",
  "saridon": "acetaminophen", // + propyphenazone/caffeine -> usually maps to paracetamol base for safety check
  "combiflam": "ibuprofen", // + paracetamol
  "mezol": "acetaminophen",
  "flexon": "ibuprofen",
  "brufen": "ibuprofen",
  "voveran": "diclofenac",
  "dynapar": "diclofenac",
  "zerodol": "aceclofenac",
  "nise": "nimesulide",

  // Antibiotics
  "augmentin": "amoxicillin", // + clavulanate
  "clamox": "amoxicillin",
  "moxikind": "amoxicillin",
  "azithral": "azithromycin",
  "azibact": "azithromycin",
  "taxim": "cefixime",
  "zipod": "cefpodoxime",
  "ciplox": "ciprofloxacin",
  "oflox": "ofloxacin",
  "norflox": "norfloxacin",
  "metrogyl": "metronidazole",

  // Acidity & Gastric
  "digene": "aluminum hydroxide", // anatacid mix
  "gelusil": "aluminum hydroxide",
  "pan": "pantoprazole",
  "pantop": "pantoprazole",
  "pantocid": "pantoprazole",
  "pan d": "pantoprazole", // + domperidone
  "omiez": "omeprazole",
  "omez": "omeprazole",
  "rantac": "ranitidine",
  "aciloc": "ranitidine",
  "rabekind": "rabeprazole",
  "sucrafil": "sucralfate",
  "ganaton": "itopride",

  // Cold, Cough & Allergy
  "allegra": "fexofenadine",
  "cetriz": "cetirizine",
  "okacet": "cetirizine",
  "montair": "montelukast",
  "montek": "montelukast",
  "vicks action 500": "acetaminophen", // + decongestants
  "cheston cold": "cetirizine",
  "grilinctus": "dextromethorphan",
  "ascoril": "terbutaline", // expectorant mix
  "benadryl": "diphenhydramine",
  "corex": "chlorpheniramine", // old formulation codeine, keeping safe generic map

  // Vitamins & Supplements
  "becosules": "multivitamin",
  "shelcal": "calcium carbonate", // + vit d3
  "cipcal": "calcium carbonate",
  "neurobion": "vitamin b complex",
  "polybion": "vitamin b complex",
  "liv 52": "herbal liver supplement", // specialized handling might be needed, mapping to generic term
  "limcee": "ascorbic acid",
  "celin": "ascorbic acid",
  "evion": "tocopherol", // Vitamin E

  // Chronic (Diabetes, BP, Cardiac)
  "glycomet": "metformin",
  "glyciphage": "metformin",
  "istamet": "metformin",
  "janumet": "sitagliptin", // + metformin
  "amlong": "amlodipine",
  "stamlo": "amlodipine",
  "telma": "telmisartan",
  "telmikind": "telmisartan",
  "losar": "losartan",
  "atorva": "atorvastatin",
  "storvas": "atorvastatin",
  "rosuvas": "rosuvastatin",
  "ecosprin": "aspirin",

  "viagra": "sildenafil"
};

const PROFIT_SUBSTITUTES: Record<string, { name: string; generic_name: string; price: number; margin_percentage: number; savings: number }[]> = {
  "pantoprazole": [
    { name: "Pantop-40", generic_name: "Pantoprazole 40mg", price: 155, margin_percentage: 12, savings: 0 },
    { name: "Pan-40", generic_name: "Pantoprazole 40mg", price: 155, margin_percentage: 12, savings: 0 },
    { name: "Pantocid-40", generic_name: "Pantoprazole 40mg", price: 162, margin_percentage: 10, savings: -7 },
    // High Margin Generic / Branded Generic
    { name: "Panto-Safe", generic_name: "Pantoprazole 40mg", price: 85, margin_percentage: 45, savings: 70 }
  ],
  "amoxicillin": [
    { name: "Augmentin 625", generic_name: "Amoxi-Clav 625", price: 223, margin_percentage: 15, savings: 0 },
    { name: "Moxikind-CV 625", generic_name: "Amoxi-Clav 625", price: 180, margin_percentage: 25, savings: 43 }
  ],
  "acetaminophen": [
    { name: "Dolo 650", generic_name: "Paracetamol 650mg", price: 32, margin_percentage: 18, savings: 0 },
    { name: "Calpol 650", generic_name: "Paracetamol 650mg", price: 30, margin_percentage: 18, savings: 2 },
    { name: "Pacimol 650", generic_name: "Paracetamol 650mg", price: 22, margin_percentage: 35, savings: 10 }
  ]
};

const H1_DRUGS_LIST = [
  "alprazolam", "diazepam", "clonazepam", "zolpidem", "tramadol", // Sedatives/Sleep
  "amoxicillin", "azithromycin", "ciprofloxacin", "cefixime", "ofloxacin", "levofloxacin", // Antibiotics
  "tuberculosis", "rifampicin", "isoniazid",
  "buprenorphine", "tapentadol"
];

// CDSCO Banned Fixed Dose Combinations (Anti-Malpractice Database)
const BANNED_COMBINATIONS: Record<string, string> = {
  "nimesulide paracetamol": "Banned in children < 12 years. Hepatotoxicity risk.",
  "cisapride": "Banned due to cardiac risks.",
  "phenylpropanolamine": "Banned. Risk of stroke.",
  "codeine chlorpheniramine alcohol": "Banned. Risk of abuse and respiratory depression.",
  "pioglitazone metformin": "Suspended warnings. Bladder cancer risk check required."
};

// "Dawa-Gyaan" Patient Education Database
const PATIENT_EDUCATION: Record<string, { diet: string[], lifestyle: string[], warning: string }> = {
  "antibiotic": {
    diet: ["Eat Probiotics (Curd/Yogurt) to protect stomach.", "Avoid spicy food."],
    lifestyle: ["Complete the full course even if you feel better.", "Drink 3L water daily."],
    warning: "Alcohol may cause severe reaction."
  },
  "painkiller": {
    diet: ["Take with food/milk to avoid acidity.", "Avoid alcohol."],
    lifestyle: ["Do not take on empty stomach."],
    warning: "Long term use affects kidneys."
  },
  "antidiabetic": {
    diet: ["Avoid sugar & refined carbs.", "Eat fiber-rich food."],
    lifestyle: ["Walk 30 mins daily.", "Check feet for injuries."],
    warning: "Monitor for sudden sugar drop (Hypoglycemia)."
  },
  "antihypertensive": {
    diet: ["Reduce salt intake.", "Eat bananas/potassium rich food."],
    lifestyle: ["Monitor BP weekly.", "Manage stress."],
    warning: "Do not stop suddenly. Rebound BP risk."
  }
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
      let data = await this.queryOpenFDA(searchTerm);

      // --- SIMULATION MODE FALLBACK ---
      if (!data) {
        console.warn("OpenFDA Offline. Using Simulation Data.");
        if (cleanQuery.toLowerCase().includes("dolo") || cleanQuery.toLowerCase().includes("paracetamol")) {
          data = {
            openfda: {
              generic_name: ["Paracetamol"],
              brand_name: ["Dolo 650", "Calpol"]
            },
            indications_and_usage: ["Indicated for temporary relief of fever, minor aches, and pains."],
            dosage_and_administration: ["Adults: 500-1000mg every 4-6 hours. Max 4000mg/day."],
            contraindications: ["Hypersensitivity to paracetamol. Severe hepatic impairment."],
            adverse_reactions: ["Rarely: Hypersensitivity, Rash, Hepatotoxicity (overdose)."]
          };
        } else if (cleanQuery.toLowerCase().includes("metformin")) {
          data = {
            openfda: { generic_name: ["Metformin Hydrochloride"], brand_name: ["Glycomet"] },
            indications_and_usage: ["Management of Type 2 Diabetes Mellitus."],
            dosage_and_administration: ["Start 500mg daily. Titrate to 2000mg daily in divided doses."],
            contraindications: ["Renal failure, Metabolic acidosis."],
            adverse_reactions: ["Nausea, Diarrhea, Metallic taste."]
          };
        } else if (cleanQuery.toLowerCase().includes("amoxicillin") || cleanQuery.toLowerCase().includes("augmentin")) {
          data = {
            openfda: { generic_name: ["Amoxicillin and Clavulanate"], brand_name: ["Augmentin"] },
            indications_and_usage: ["Treatment of infections (Respiratory tract, Urinary tract, Skin)."],
            dosage_and_administration: ["Adults: 625mg every 12 hours."],
            contraindications: ["Penicillin allergy."],
            adverse_reactions: ["Diarrhea, Nausea, Skin rash."]
          };
        } else {
          // Generic Mock
          data = {
            openfda: { generic_name: [cleanQuery], brand_name: [cleanQuery.toUpperCase()] },
            indications_and_usage: ["General clinical indications for " + cleanQuery + "."],
            dosage_and_administration: ["Consult physician for standard dosage."],
            contraindications: ["Standard contraindications apply. Check patient history."],
            adverse_reactions: ["Nausea, Dizziness, Headache (Common)."]
          };
        }
      }

      if (!data) return null;

      // 4. Real-time Market Intel (n8n "Moat")
      let marketData = null;
      try {
        marketData = await aiService.getMarketData(cleanQuery);
      } catch (e) {
        console.warn("Market Intel unavailable");
      }

      // 5. Structure Data (MediFlow Format)
      return this.formatClinicalData(data, cleanQuery, resolveResult, marketData);
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

  // --- TEXT SIMPLIFIER ENGINE ---
  private cleanMedicalText(text: string | string[], type: 'indication' | 'dosage'): string {
    if (!text) return "Consult physician.";

    let raw = Array.isArray(text) ? text[0] : text;

    // 1. Remove Headers and References like "1 INDICATIONS..." or "( 2.1 )"
    raw = raw.replace(/\d+\s+[A-Z\s]+\s+/g, "") // Remove "1 INDICATIONS..."
      .replace(/\(\s*\d+(\.\d+)?\s*\)/g, "") // Remove "( 2.1 )"
      .replace(/See full prescribing information.*/i, "");

    // 2. Truncate for Concision
    // Keep first 2-3 sentences max
    const sentences = raw.split('. ').filter(s => s.length > 10);
    const concise = sentences.slice(0, 3).join('. ') + '.';

    // 3. Format as Bullet Points if it's long
    if (concise.length > 200) {
      return concise
        .replace(/ and /g, "\n• ")
        .replace(/, /g, "\n• ")
        + "\n(See label for full details)";
    }

    return concise;
  }

  // ... helper methods ...

  private formatClinicalData(data: any, originalQuery: string, resolvedGeneric: string | null, marketData: any): ClinicalDrugInfo {
    const info = data;
    const genericName = (info.openfda?.generic_name?.[0] || resolvedGeneric || "Unknown").toLowerCase();

    // ... (Existing substitute logic) ...
    let foundSubstitutes = [];
    if (marketData && marketData.substitutes) {
      foundSubstitutes = marketData.substitutes;
    } else {
      for (const key in PROFIT_SUBSTITUTES) {
        if (genericName.includes(key)) {
          foundSubstitutes = PROFIT_SUBSTITUTES[key];
          break;
        }
      }
    }

    // ... (Existing Compliance Logic) ...
    const isH1 = H1_DRUGS_LIST.some(drug => genericName.includes(drug));
    let bannedStatus = { is_banned: false, reason: "" };
    for (const banned in BANNED_COMBINATIONS) {
      if (genericName.includes(banned) || originalQuery.toLowerCase().includes(banned)) {
        bannedStatus = { is_banned: true, reason: BANNED_COMBINATIONS[banned] };
        break;
      }
    }

    // ... (Existing Education Logic) ...
    let education = PATIENT_EDUCATION["painkiller"];
    if (genericName.includes("biotic") || genericName.includes("illin") || genericName.includes("mycin") || genericName.includes("cef")) education = PATIENT_EDUCATION["antibiotic"];
    else if (genericName.includes("metformin") || genericName.includes("glipizide") || genericName.includes("insulin")) education = PATIENT_EDUCATION["antidiabetic"];
    else if (genericName.includes("sartan") || genericName.includes("pril") || genericName.includes("pine")) education = PATIENT_EDUCATION["antihypertensive"];


    return {
      name: resolvedGeneric ? `${originalQuery} (${resolvedGeneric})` : (info.openfda?.brand_name?.[0] || originalQuery),
      generic_name: info.openfda?.generic_name?.[0] || resolvedGeneric || "Unknown",
      brand_names: info.openfda?.brand_name || [],

      // APPROVED: Simplified Text
      indications: this.cleanMedicalText(info.indications_and_usage, 'indication'),

      dosage_guidelines: {
        adult: this.cleanMedicalText(info.dosage_and_administration, 'dosage'),
        pediatric: info.pediatric_use ? "Consult Pediatrician." : "Not specified.",
        geriatric: "Adjust based on renal function."
      },

      contraindications: info.contraindications ?
        this.cleanMedicalText(info.contraindications, 'indication') : "Hypersensitivity.",

      boxed_warnings: info.boxed_warning ? info.boxed_warning.map((w: string) => w.slice(0, 150) + "...") : [],

      mechanism_of_action: "Pharmacology details available in full label.",

      pregnancy_lactation: (info.pregnancy || info.nursing_mothers) ? "Consult Physician (Category C/D mostly)." : "Consult Physician.",

      side_effects: {
        common: this.extractSideEffects(info.adverse_reactions?.[0] || ""),
        severe: ["Seek help for allergic reactions."]
      },
      substitutes: foundSubstitutes,
      is_h1_drug: isH1,
      banned_status: bannedStatus,
      education_tips: education,
      safety_warning: "⚠️ CLINICAL SUMMARY: Simplified for quick reference. Verify with full Prescribing Information."
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

    // AI-Powered Interaction Check (Real-time via n8n)
    try {
      if (typeof aiService.checkInteractions === 'function') {
        const results = await aiService.checkInteractions(drugs);
        return results;
      } else {
        // Fallback for demo if n8n service isn't ready
        return [];
      }
    } catch (err) {
      console.error("Failed to check interactions via AI", err);
      // Fallback
      return [];
    }
  }

  // private simulateInteraction(d1: string, d2: string): InteractionResult { // Removed in favor of n8n
  //   ... 
  // }
  async validateCompliance(drugName: string): Promise<string> {
    return await aiService.checkCompliance(drugName);
  }
}

export const drugService = new DrugService();
