# Quick n8n Setup Checklist

## 🔧 For Each AI Workflow

### Step 1: HTTP Request Node
```
Method: POST
URL: https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent
Authentication: None
```

### Step 2: Query Parameters
```
Name: key
Value: YOUR_GOOGLE_AI_STUDIO_API_KEY
```

### Step 3: Headers
```
Content-Type: application/json
```

### Step 4: Request Body
Use the corresponding `gemini_*_request.json` file for each function:
- **Interactions**: `gemini_critical_interaction_request.json`
- **Compliance**: `gemini_compliance_request.json`
- **Forecast**: `gemini_forecast_request.json`
- **Voice**: `gemini_voice_request.json`
- **Lab Report**: `gemini_lab_report_request.json`

### Step 5: Parse Response Node (JavaScript)
```javascript
// Parse Gemini JSON Response
const response = $input.item.json;

// Gemini returns data in candidates[0].content.parts[0].text
const content = response.candidates[0].content.parts[0].text;

console.log("Raw Gemini Content:", content);

// Parse the JSON string
let parsedData;
try {
  parsedData = JSON.parse(content);
} catch (error) {
  // Try to extract JSON from text
  const match = content.match(/\{[\s\S]*\}/);
  if (match) {
    parsedData = JSON.parse(match[0]);
  } else {
    throw new Error("No valid JSON found");
  }
}

return { json: parsedData };
```

### Step 6: Respond to Frontend
```
Response body: {{ $json }}
```

---

## 📋 Workflows to Create/Update

### 1. Prescription Analysis (CRITICAL)
- **Endpoint**: `/webhook/analyze-prescription`
- **Prompt**: Use prescription analysis prompt from `n8n_system_prompts.md`
- **Input**: `image_base64`
- **Output**: Patient data + medications array

### 2. Drug Interactions (CRITICAL)
- **Endpoint**: `/webhook/medix-interactions-v5`
- **Prompt File**: `gemini_critical_interaction_prompt.txt`
- **Input**: `drugs: ["Drug1", "Drug2"]`
- **Output**: Critical interactions with Hinglish warnings

### 3. Compliance Check (CRITICAL)
- **Endpoint**: `/webhook/medix-compliance-v5`
- **Prompt File**: `gemini_compliance_system_prompt.txt`
- **Input**: `drugName: "Medicine"`
- **Output**: CDSCO compliance status with Hinglish warnings

### 4. Inventory Forecast (HIGH)
- **Endpoint**: `/webhook/medix-forecast-v5`
- **Prompt File**: `gemini_forecast_system_prompt.txt`
- **Input**: `salesHistory: []`
- **Output**: Forecast with Hinglish insights

### 5. Voice Billing (HIGH)
- **Endpoint**: `/webhook/voice-billing`
- **Prompt File**: `gemini_voice_system_prompt.txt`
- **Input**: `text: "do patta dolo"`
- **Output**: Parsed medicine items

### 6. Lab Report Analysis (HIGH)
- **Endpoint**: `/webhook/analyze-lab-report`
- **Prompt File**: `lab_report_system_prompt.txt`
- **Input**: `image_base64`
- **Output**: Test results + health insights

---

## ✅ Testing Checklist

For each workflow:
- [ ] Test with sample input
- [ ] Verify Gemini response
- [ ] Check parsing works
- [ ] Validate output structure matches frontend expectations
- [ ] Test error handling (malformed JSON, API errors)
- [ ] Check response time (< 5 seconds preferred)

---

## 🚨 Common Issues & Fixes

### Issue: "Model not found"
**Fix**: Change model name to `gemini-2.5-flash` (not 1.5)

### Issue: "Cannot read properties of undefined"
**Fix**: Use Gemini response format: `candidates[0].content.parts[0].text`

### Issue: JSON parsing error
**Fix**: Extract JSON from markdown with regex: `/\{[\s\S]*\}/`

### Issue: Empty response
**Fix**: Check `responseMimeType: "application/json"` in generationConfig

### Issue: Rate limiting
**Fix**: Add delay between requests or increase API quota
