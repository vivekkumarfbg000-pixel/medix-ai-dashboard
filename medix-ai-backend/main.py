import os
from fastapi import FastAPI, HTTPException, Header, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

# Import local modules
from safety import check_lasa_pair, scan_inventory_for_lasa
from ocr import analyze_prescription_image
from chatbot import chat_clinical_assistant
from analytics import forecast_demand

app = FastAPI(
    title="MedixAI Python Backend",
    description="Production-grade AI microservice for prescription vision, look-alike drug safety, and stock analytics.",
    version="1.0.0"
)

# Enable CORS for local development and production domains
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Whitelisted for premium SaaS deployment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── PYDANTIC MODELS ─────────────────────────────────────────────────────────

class LasaCheckRequest(BaseModel):
    drug_a: str
    drug_b: str

class LasaScanRequest(BaseModel):
    new_drug: str
    existing_inventory: List[str]

class PrescriptionOcrRequest(BaseModel):
    image_base64: str # Base64 encoded image string (includes metadata header)

class ChatMessage(BaseModel):
    role: str # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]

class ForecastRequest(BaseModel):
    sales_history: List[Dict[str, Any]]
    forecast_days: Optional[int] = 15

# ─── API KEY RESOLVER ────────────────────────────────────────────────────────

def get_api_key(x_gemini_api_key: Optional[str] = Header(None)) -> str:
    """Resolve Gemini API Key from header or environment variables."""
    api_key = x_gemini_api_key or os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=401,
            detail="API Key missing. Provide 'X-Gemini-API-Key' header or set 'GEMINI_API_KEY' environment variable."
        )
    return api_key

# ─── ROUTING ENDPOINTS ───────────────────────────────────────────────────────

@app.get("/")
def read_root():
    return {
        "status": "healthy",
        "service": "MedixAI Python Backend",
        "docs_url": "/docs"
    }

@app.post("/api/v1/safety/check")
def api_check_lasa(payload: LasaCheckRequest):
    """Check look-alike sound-alike (LASA) risk for a pair of drug names."""
    is_risk, score, reason = check_lasa_pair(payload.drug_a, payload.drug_b)
    return {
        "is_risk": is_risk,
        "similarity_score": score,
        "reason": reason
    }

@app.post("/api/v1/safety/scan")
def api_scan_lasa(payload: LasaScanRequest):
    """Scan existing catalog for look-alike sound-alike confusion against a new drug."""
    conflicts = scan_inventory_for_lasa(payload.new_drug, payload.existing_inventory)
    return {
        "new_drug": payload.new_drug,
        "conflicts": conflicts
    }

@app.post("/api/v1/prescription/analyze")
def api_analyze_prescription(payload: PrescriptionOcrRequest, api_key: str = Header(None)):
    """Analyze handwritten prescription image and extract structured JSON medical details."""
    resolved_key = api_key or os.getenv("GEMINI_API_KEY")
    if not resolved_key:
        raise HTTPException(status_code=401, detail="X-Gemini-API-Key header is required")
    try:
        data = analyze_prescription_image(payload.image_base64, resolved_key)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/chat/pharmacist")
def api_chat_pharmacist(payload: ChatRequest, api_key: str = Header(None)):
    """Conversational AI clinical pharmacist assistant endpoint."""
    resolved_key = api_key or os.getenv("GEMINI_API_KEY")
    if not resolved_key:
        raise HTTPException(status_code=401, detail="X-Gemini-API-Key header is required")
    try:
        msg_list = [{"role": msg.role, "content": msg.content} for msg in payload.messages]
        reply = chat_clinical_assistant(msg_list, resolved_key)
        return {"reply": reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/analytics/forecast")
def api_forecast_demand(payload: ForecastRequest):
    """Forecasting endpoint for monthly inventory demands."""
    try:
        result = forecast_demand(payload.sales_history, payload.forecast_days)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class OpenAiMessage(BaseModel):
    role: str
    content: Any # Can be string or list of dicts

class OpenAiRequest(BaseModel):
    model: str
    messages: List[OpenAiMessage]
    response_format: Optional[Dict[str, Any]] = None

@app.post("/chat/completions")
@app.post("/v1/chat/completions")
def open_ai_chat_completions(payload: OpenAiRequest, x_gemini_api_key: Optional[str] = Header(None)):
    """OpenAI-compatible chat completion route to allow seamless drop-in integration with frontend."""
    resolved_key = x_gemini_api_key or os.getenv("GEMINI_API_KEY")
    if not resolved_key:
        raise HTTPException(status_code=401, detail="X-Gemini-API-Key or GEMINI_API_KEY env variable required")
        
    user_msgs = [m for m in payload.messages if m.role == "user"]
    if not user_msgs:
        raise HTTPException(status_code=400, detail="No user messages provided")
        
    last_msg = user_msgs[-1]
    
    is_vision = False
    base64_img = ""
    mime_type = "image/jpeg"
    text_prompt = ""
    
    if isinstance(last_msg.content, list):
        for part in last_msg.content:
            if isinstance(part, dict):
                if part.get("type") == "text":
                    text_prompt = part.get("text", "")
                elif part.get("type") == "image_url":
                    img_url = part.get("image_url", {}).get("url", "")
                    if img_url.startswith("data:"):
                        try:
                            header, base64_img = img_url.split(",", 1)
                            is_vision = True
                            if "image/" in header:
                                mime_type = header.split("image/")[1].split(";")[0]
                        except Exception:
                            pass
    else:
        text_prompt = str(last_msg.content)
        
    try:
        if is_vision:
            reply = analyze_prescription_image(base64_img, resolved_key)
            import json
            reply_text = json.dumps(reply)
        else:
            system_msg = next((m for m in payload.messages if m.role == "system"), None)
            conversation = [m for m in payload.messages if m.role != "system"]
            
            msg_list = []
            for m in conversation:
                content_str = ""
                if isinstance(m.content, list):
                    content_str = " ".join([p.get("text", "") for p in m.content if isinstance(p, dict) and p.get("type") == "text"])
                else:
                    content_str = str(m.content)
                msg_list.append({"role": m.role, "content": content_str})
                
            reply_text = chat_clinical_assistant(msg_list, resolved_key)
            
        return {
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": reply_text
                    }
                }
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
