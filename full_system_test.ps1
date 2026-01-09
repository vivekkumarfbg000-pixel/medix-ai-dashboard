$headers = @{ "Content-Type" = "application/json" }
$base = "https://vivek2073.app.n8n.cloud/webhook"

# Dummy base64 for images/audio
$dummyBase64 = "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=" 

function Test-Endpoint($name, $path, $body) {
    Write-Host "TESTING: $name ($path)" -NoNewline
    try {
        $uri = "$base/$path"
        $res = Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body $body -ErrorAction Stop
        Write-Host " -> [SUCCESS]" -ForegroundColor Green
        # $res | ConvertTo-Json -Depth 3
    } catch {
        Write-Host " -> [FAILED]" -ForegroundColor Red
        if ($_.Exception.Response) {
             $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
             Write-Host "ERROR: $($reader.ReadToEnd())"
        }
    }
}

Write-Host "--- STANDARD AI FEATURES ---"
Test-Endpoint "Chat" "medix-chat-v2" (@{ query = "Hi"; userId = "test" } | ConvertTo-Json)
Test-Endpoint "Interactions" "medix-interactions-v5" (@{ drugs = @("Aspirin") } | ConvertTo-Json)
Test-Endpoint "Compliance" "medix-compliance-v5" (@{ drugName = "Corex" } | ConvertTo-Json)
Test-Endpoint "Market" "medix-market-v5" (@{ drugName = "Dolo" } | ConvertTo-Json)
Test-Endpoint "Forecast" "medix-forecast-v5" (@{ salesHistory = @(); shopId="test" } | ConvertTo-Json)

Write-Host "`n--- OPS FEATURES (SCANS) ---"
Test-Endpoint "Voice Bill" "operations" (@{ action="voice-bill"; data=$dummyBase64; userId="test"; shopId="test" } | ConvertTo-Json)
Test-Endpoint "Prescription (Parcha)" "operations" (@{ action="scan-parcha"; image_base64=$dummyBase64; userId="test"; shopId="test" } | ConvertTo-Json)
Test-Endpoint "Invoice Scan" "operations" (@{ action="scan-medicine"; image_base64=$dummyBase64; userId="test"; shopId="test" } | ConvertTo-Json)
Test-Endpoint "Lab Report (Check)" "operations" (@{ action="scan-report"; image_base64=$dummyBase64; userId="test"; shopId="test" } | ConvertTo-Json)
