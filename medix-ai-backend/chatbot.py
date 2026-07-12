import google.generativeai as genai
from typing import List, Dict, Any

CLINICAL_SYSTEM_INSTRUCTION = """
You are a highly qualified Clinical Pharmacist AI Assistant at MedixAI. 
Your goal is to provide accurate, evidence-based clinical guidance regarding:
1. Drug-drug interactions.
2. Proper dosage adjustments, administration instructions, and safety profiles.
3. Patient-friendly explanations of side effects and warning signs.
4. Identification of high-risk drugs (e.g., sound-alike look-alike alerts).

Formatting Rules:
- Answer concisely using professional medical bullet points where possible.
- If a severe interaction or contraindication is identified, highlight it in a '**[CRITICAL DANGER]**' warning block at the top.
- Always include a standard medical disclaimer at the bottom of the response: "Disclaimer: This AI advice is for clinical reference only and does not replace a doctor's consultation."
"""

def chat_clinical_assistant(messages: List[Dict[str, str]], api_key: str) -> str:
    """
    Stateful clinical chatbot session utilizing Gemini 2.0 Flash.
    Converts message history format and returns assistant reply.
    """
    if not api_key:
        raise ValueError("Gemini API key is required")
        
    genai.configure(api_key=api_key)
    
    # Initialize model with system instruction
    model = genai.GenerativeModel(
        model_name='gemini-2.0-flash',
        system_instruction=CLINICAL_SYSTEM_INSTRUCTION
    )
    
    # Convert chat history format from OpenAI/standard to Gemini's native structure
    contents = []
    for msg in messages:
        role = "user" if msg["role"] == "user" else "model"
        contents.append({
            "role": role,
            "parts": [{"text": msg["content"]}]
        })
        
    response = model.generate_content(contents)
    return response.text.strip()
