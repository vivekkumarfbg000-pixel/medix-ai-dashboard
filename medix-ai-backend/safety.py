import jellyfish
import re
from typing import List, Dict, Tuple

def get_phonetic_code(name: str) -> str:
    """Generate metaphone phonetic code for drug names."""
    # Clean drug name (keep only alphanumeric characters)
    cleaned = re.sub(r'[^a-zA-Z0-9\s]', '', name).strip().upper()
    # Metaphone requires non-empty string of letters
    letters = "".join([c for c in cleaned if c.isalpha()])
    if not letters:
        return ""
    return jellyfish.metaphone(letters)

def check_lasa_pair(drug_a: str, drug_b: str) -> Tuple[bool, float, str]:
    """
    Check if a pair of drugs constitutes a Look-Alike Sound-Alike (LASA) risk.
    Returns: (is_risk, similarity_score, reason)
    """
    name_a = drug_a.lower().strip()
    name_b = drug_b.lower().strip()
    
    if name_a == name_b:
        return True, 1.0, "Exact match"
        
    # 1. Phonetic match
    code_a = get_phonetic_code(name_a)
    code_b = get_phonetic_code(name_b)
    
    phonetic_match = (code_a == code_b) and (len(code_a) > 0)
    
    # 2. String similarity (Jaro-Winkler)
    similarity = jellyfish.jaro_winkler_similarity(name_a, name_b)
    
    # Thresholds
    is_risk = False
    reason = "Safe"
    
    if phonetic_match and similarity > 0.75:
        is_risk = True
        reason = f"Phonetically identical ('{code_a}') and high similarity ({similarity:.2f})"
    elif similarity > 0.85:
        is_risk = True
        reason = f"High visual similarity similarity ({similarity:.2f})"
    elif phonetic_match:
        is_risk = True
        reason = f"Sounds extremely similar ('{code_a}')"
        
    return is_risk, similarity, reason

def scan_inventory_for_lasa(new_drug: str, existing_inventory: List[str]) -> List[Dict]:
    """Scan existing inventory for look-alike sound-alike conflicts against a new drug."""
    conflicts = []
    for item in existing_inventory:
        is_risk, score, reason = check_lasa_pair(new_drug, item)
        if is_risk:
            conflicts.append({
                "drug": item,
                "similarity": score,
                "reason": reason
            })
    return sorted(conflicts, key=lambda x: x["similarity"], reverse=True)
