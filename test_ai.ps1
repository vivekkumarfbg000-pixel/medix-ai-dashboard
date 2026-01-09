$headers = @{ "Content-Type" = "application/json" }
$base = "https://vivek2073.app.n8n.cloud/webhook"

Write-Host "--- TEST 1: CHAT ---"
$body = @{ query = "What is paracetamol?"; userId = "test"; shopId = "test" } | ConvertTo-Json
try { 
    $res = Invoke-RestMethod -Uri "$base/medix-chat-v2" -Method Post -Headers $headers -Body $body
    $res | ConvertTo-Json -Depth 5
} catch { 
    Write-Host "ERROR: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "Response Body: $($reader.ReadToEnd())"
    }
}

Write-Host "`n--- TEST 2: INTERACTIONS ---"
$body = @{ drugs = @("Aspirin", "Warfarin") } | ConvertTo-Json
try { 
    $res = Invoke-RestMethod -Uri "$base/medix-interactions-v5" -Method Post -Headers $headers -Body $body 
    $res | ConvertTo-Json -Depth 5
} catch { Write-Host "ERROR: $($_.Exception.Message)" }

Write-Host "`n--- TEST 3: MARKET ---"
$body = @{ drugName = "Dolo 650" } | ConvertTo-Json
try { 
    $res = Invoke-RestMethod -Uri "$base/medix-market-v5" -Method Post -Headers $headers -Body $body 
    $res | ConvertTo-Json -Depth 5
} catch { Write-Host "ERROR: $($_.Exception.Message)" }

Write-Host "`n--- TEST 4: COMPLIANCE ---"
$body = @{ drugName = "Corex" } | ConvertTo-Json
try { 
    $res = Invoke-RestMethod -Uri "$base/medix-compliance-v5" -Method Post -Headers $headers -Body $body 
    $res | ConvertTo-Json -Depth 5
} catch { Write-Host "ERROR: $($_.Exception.Message)" }

Write-Host "`n--- TEST 5: FORECAST ---"
$body = @{ salesHistory = @(@{ date="2023-01-01"; sales=100 }); shopId="test" } | ConvertTo-Json
try { 
    $res = Invoke-RestMethod -Uri "$base/medix-forecast-v5" -Method Post -Headers $headers -Body $body 
    $res | ConvertTo-Json -Depth 5
} catch { Write-Host "ERROR: $($_.Exception.Message)" }
