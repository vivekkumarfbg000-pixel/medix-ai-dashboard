import { aiService, safeJSONParse } from "./aiService";
import { supabase } from "@/integrations/supabase/client";
import logger from "@/utils/logger";

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
  "paracetamol": "acetaminophen",
  "paracitamol": "acetaminophen", // Typo handling
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
   * Safe Clinical Search - Implements "MedixAI" Normalization
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

      // --- GEMINI AI FALLBACK (REAL INTELLIGENCE) ---
      if (!data) {
        console.warn("OpenFDA Offline or Drug Not Found. Asking Gemini AI...");
        try {
          const aiPrompt = `Act as a clinical pharmacist database. Provide detailed clinical information for the drug "${cleanQuery}". 
            Return strictly valid JSON matching this interface:
            {
               openfda: { generic_name: string[], brand_name: string[] },
               indications_and_usage: string[],
               dosage_and_administration: string[],
               contraindications: string[],
               adverse_reactions: string[],
               boxed_warning: string[],
               pregnancy: string,
               nursing_mothers: string
            }
            Do not include Markdown. Just JSON.`;

          const aiResponse = await aiService.chatWithAgent(aiPrompt);
          // aiService now normalizes 'reply' or 'output'.
          // Expected response is stringified JSON in 'reply'.
          const rawJson = aiResponse.reply;

          // Clean JSON using robust parser
          data = safeJSONParse(rawJson, null);
          logger.log("Gemini Clinical Data:", data);

        } catch (aiErr) {
          logger.error("Gemini Fallback Failed:", aiErr);
          // Final safety net: Empty but valid structure to prevent crash
          return null;
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

      // 5. Structure Data (MedixAI Format)
      return this.formatClinicalData(data, cleanQuery, resolveResult, marketData);
    } catch (error) {
      logger.error("Clinical Engine Error:", error);
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

    const interactions: InteractionResult[] = [];

    // 1. Local Duplicate Therapy Check
    try {
      const normalizedNames = await Promise.all(drugs.map(async d => {
        // Try resolving to generic, or fallback to cleaned name
        const generic = await this.resolveBrandToGeneric(d);
        // Handle explicit "Paracetamol" / "Acetaminophen" equivalence manually if not in map
        const name = (generic || d).toLowerCase();
        if (name.includes("paracetamol") || name.includes("paracitamol")) return "acetaminophen"; // Typo handling
        return name;
      }));

      // Check for duplicates
      for (let i = 0; i < normalizedNames.length; i++) {
        for (let j = i + 1; j < normalizedNames.length; j++) {
          const d1 = normalizedNames[i];
          const d2 = normalizedNames[j];

          // Direct Match or Substring Match (e.g. "Amoxicillin" vs "Amoxicillin 500")
          if (d1 === d2 || d1.includes(d2) || d2.includes(d1)) {
            interactions.push({
              drug1: drugs[i],
              drug2: drugs[j],
              severity: "Major",
              description: `DUPLICATE THERAPY DETECTED: Both items contain ${d1}. Risk of overdose.`
            });
          }
        }
      }
    } catch (e) {
      console.warn("Local Duplicate Check Failed", e);
    }

    if (interactions.length > 0) return interactions;

    try {
      // 2. Direct call to AI Service
      const { warnings } = await aiService.checkInteractions(drugs);
      const mappedResults: InteractionResult[] = (warnings || []).map(r => {
        // Try to parse "⚠️ Severity: DrugA + DrugB: Description"
        const match = r.match(/⚠️\s*(.*?):\s*(.*?)\s*\+\s*(.*?):\s*(.*)/);
        if (match) {
          return {
            drug1: match[2].trim(),
            drug2: match[3].trim(),
            severity: match[1].trim() as any,
            description: match[4].trim()
          };
        }
        return {
          drug1: drugs[0],
          drug2: drugs[1] || "Drug",
          severity: "Moderate" as any,
          description: r
        };
      });
      return mappedResults;
    } catch (err) {
      logger.error("Failed to check interactions via AI", err);
      return interactions;
    }
  }

  async validateCompliance(drugName: string): Promise<string> {
    const res = await aiService.checkCompliance(drugName);
    return res.is_banned ? `BANNED: ${res.reason}` : "Compliant";
  }

  /**
   * Find Higher Margin Substitutes (Client-Side Logic)
   * @param currentItem The item currently in cart
   * @param inventoryList List of *potential* candidates (fetched by POS)
   * @returns List of items with better margin
   */
  findBetterMarginSubstitutes(currentItem: any, inventoryList: any[]): any[] {
    if (!currentItem.purchase_price || !currentItem.unit_price) return [];

    const currentMargin = currentItem.unit_price - currentItem.purchase_price;
    const currentMarginPercent = (currentMargin / currentItem.unit_price) * 100;

    // Filter Logic:
    // 1. Same Composition (ideal) OR Same Generic Name
    // 2. Higher Profit Margin (absolute ₹ or %)
    // 3. Must be in stock (quantity > 0) - assumed pre-filtered by caller

    return inventoryList.filter(candidate => {
      if (candidate.id === currentItem.id) return false; // Skip self

      // Match Strength
      const sameComp = currentItem.composition && candidate.composition &&
        candidate.composition.toLowerCase() === currentItem.composition.toLowerCase();

      // Fallback: If no strict composition, check generic name
      const sameGeneric = currentItem.generic_name && candidate.generic_name &&
        candidate.generic_name.toLowerCase() === currentItem.generic_name.toLowerCase();

      if (!sameComp && !sameGeneric) return false;

      // Margin Check
      const candCost = candidate.purchase_price || (candidate.unit_price * 0.7); // Fallback cost estimate
      const candMargin = candidate.unit_price - candCost;

      // Threshold: At least ₹5 more profit OR 5% better margin
      const significantGain = (candMargin > currentMargin + 5) ||
        ((candMargin / candidate.unit_price * 100) > currentMarginPercent + 5);

      return significantGain;
    }).sort((a, b) => {
      // Sort by highest profit first
      const profitA = a.unit_price - (a.purchase_price || 0);
      const profitB = b.unit_price - (b.purchase_price || 0);
      return profitB - profitA;
    });
  }
}

export const drugService = new DrugService();
