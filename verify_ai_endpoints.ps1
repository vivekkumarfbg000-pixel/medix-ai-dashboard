$shopId = "6b41d9b4-fe7d-4eec-a2c3-dd99093437e8"
$baseUrl = "https://vivek2073.app.n8n.cloud/webhook"

# Dummy Base64 (1x1 pixel Transparent GIF) for testing file uploads
$dummyBase64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"

function Test-Endpoint {
    param($name, $url, $body)
    Write-Host "Testing $name..." -ForeColor Cyan
    try {
        $response = Invoke-RestMethod -Uri $url -Method Post -ContentType "application/json" -Body $body -ErrorAction Stop
        Write-Host "SUCCESS: $($response | ConvertTo-Json -Depth 2)" -ForeColor Green
    } catch {
        Write-Host "FAILED: $_" -ForeColor Red
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader $_.Exception.Response.GetResponseStream()
            Write-Host "Response Body: $($reader.ReadToEnd())" -ForeColor Red
        }
    }
    Write-Host "--------------------------------"
}

# 1. Voice Billing
Test-Endpoint "Voice Billing (Ops)" "$baseUrl/operations" (@{ 
    action="voice-bill"; 
    data=$dummyBase64; 
    shopId=$shopId 
} | ConvertTo-Json)

# 2. Interactions
Test-Endpoint "Drug Interactions" "$baseUrl/interactions" (@{ 
    drugs=@("Aspirin", "Warfarin"); 
    shopId=$shopId 
} | ConvertTo-Json)

# 3. Compliance
Test-Endpoint "Compliance Check" "$baseUrl/compliance-check" (@{ 
    drugName="Corex"; 
    shopId=$shopId 
} | ConvertTo-Json)

# 4. Forecast (Restock Predictions)
Test-Endpoint "Sales Forecast" "$baseUrl/forecast" (@{ 
    shopId=$shopId 
} | ConvertTo-Json)

# 5. Market Intel
Test-Endpoint "Market Intel" "$baseUrl/market" (@{ 
    shopId=$shopId 
} | ConvertTo-Json)

# 6. Lab Report Scan
Test-Endpoint "Lab Report Scan (Ops)" "$baseUrl/operations" (@{ 
    action="scan-report"; 
    image_base64=$dummyBase64; 
    shopId=$shopId 
} | ConvertTo-Json)

# 7. Prescription Scan
Test-Endpoint "Prescription Scan (Ops)" "$baseUrl/operations" (@{ 
    action="scan-parcha"; 
    image_base64=$dummyBase64; 
    shopId=$shopId 
} | ConvertTo-Json)
