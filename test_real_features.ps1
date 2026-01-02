$shopId = "6b41d9b4-fe7d-4eec-a2c3-dd99093437e8"
$baseUrl = "https://vivek2073.app.n8n.cloud/webhook"
$ChatUrl = "https://vivek2073.app.n8n.cloud/webhook/medix-chat-v2"
$imagePath = "C:/Users/vivek/.gemini/antigravity/brain/faf30fa5-82fe-493f-b567-aa0a242fd3ea/uploaded_image_0_1767335285939.png"
$forecastPath = "forecast_payload.json"

function Test-Endpoint {
    param($name, $url, $body)
    Write-Host "Testing $name with REAL DATA..." -ForeColor Cyan
    try {
        $response = Invoke-RestMethod -Uri $url -Method Post -ContentType "application/json" -Body $body -ErrorAction Stop
        $json = $response | ConvertTo-Json -Depth 10
        Write-Host "SUCCESS! Response Content:" -ForeColor Green
        Write-Host $json -ForeColor Gray
    } catch {
        Write-Host "FAILED: $_" -ForeColor Red
        if ($_.Exception.Response) {
             $reader = New-Object System.IO.StreamReader $_.Exception.Response.GetResponseStream()
             Write-Host "Backend Error: $($reader.ReadToEnd())" -ForeColor Red
        }
    }
    Write-Host "--------------------------------"
}

# 1. Real Image Scan (Diary/Report)
if (Test-Path $imagePath) {
    $bytes = [System.IO.File]::ReadAllBytes($imagePath)
    $b64 = [System.Convert]::ToBase64String($bytes)
    
    Test-Endpoint "Lab Report Scan (Real Image)" "$baseUrl/operations" (@{ 
        action="scan-report"; 
        image_base64=$b64; 
        shopId=$shopId 
    } | ConvertTo-Json)
} else {
    Write-Host "Skipping Image Test: Image file not found." -ForeColor Yellow
}

# 2. Real Forecast Data
# 2. Real Forecast Data (Legacy Block Removed)
# if (Test-Path $forecastPath) { ... }

# 3. Real Sales Forecast (DB + AI) -> N8N "Universal Brain V5"
Test-Endpoint "Sales Forecast (Real History)" "$baseUrl/medix-forecast-v5" (@{ 
    salesHistory=@(); 
    shopId=$shopId 
} | ConvertTo-Json)

# 4. Real Market Check -> N8N "Universal Brain V5"
Test-Endpoint "Market Intel ('Dolo 650')" "$baseUrl/medix-market-v5" (@{ 
    drugName="Dolo 650"; 
    shopId=$shopId 
} | ConvertTo-Json)

# 5. Real Interaction Check (Safety Widget) -> N8N "Universal Brain V5"
Test-Endpoint "Interaction Check ('Warfarin + Aspirin')" "$baseUrl/medix-interactions-v5" (@{ 
    drugs=@("Warfarin", "Aspirin"); 
    shopId=$shopId 
} | ConvertTo-Json)
