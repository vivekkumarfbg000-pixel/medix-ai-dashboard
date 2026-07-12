import base64
import json
import io
from PIL import Image
import google.generativeai as genai
from typing import Dict, Any

# System instruction to force structured JSON output
PRESCRIPTION_PROMPT = """
You are an expert clinical AI. Analyze this image of a handwritten prescription or medical report and extract all medical information into a structured JSON object.

Your output must be a single JSON object (with no markdown block wrappers, no ```json formatting) matching this schema:
{
  "patient_name": "Name of patient or Null",
  "patient_age": "Age of patient or Null",
  "patient_gender": "Gender of patient or Null",
  "doctor_name": "Name of prescribing doctor or Null",
  "diagnosis": "Presumed diagnosis or symptoms mentioned or Null",
  "medicines": [
    {
      "medicine_name": "Standardized generic/brand name of the drug",
      "dosage": "e.g., 500mg, 1 tablet",
      "frequency": "e.g., Once daily, Twice daily, TDS, BD, OD",
      "duration": "e.g., 5 days, 1 month",
      "instructions": "e.g., After food, Before food, At bedtime"
    }
  ]
}

Be extremely careful to transcribe handwritten drug names accurately. If a medicine's details are partially illegible, provide your best clinical inference based on spelling fragments and state "Uncertain" in the instructions.
"""

def analyze_prescription_image(base64_image: str, api_key: str) -> Dict[str, Any]:
    """
    Analyze prescription image using Gemini 2.0 Flash and return structured JSON.
    """
    if not api_key:
        raise ValueError("Gemini API key is required")
        
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-2.0-flash')
    
    # Decode base64 image
    try:
        header, encoded = base64_image.split(",", 1) if "," in base64_image else ("", base64_image)
        image_data = base64.b64decode(encoded)
        image = Image.open(io.BytesIO(image_data))
    except Exception as e:
        raise ValueError(f"Invalid image format: {str(e)}")
        
    # Generate content
    response = model.generate_content([
        PRESCRIPTION_PROMPT,
        image
    ])
    
    text = response.text.strip()
    
    # Strip markdown block wrappers if present
    if text.startswith("```"):
        # Remove first line
        lines = text.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
        
    try:
        return json.loads(text)
    except Exception:
        # Fallback raw parse/wrapper if model returned slightly malformed json
        return {
            "error": "Failed to parse model output as JSON",
            "raw_output": text
        }
