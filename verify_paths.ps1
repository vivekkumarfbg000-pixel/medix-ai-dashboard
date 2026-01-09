$headers = @{ "Content-Type" = "application/json" }
$base = "https://vivek2073.app.n8n.cloud/webhook"

function Test-Path($endpoint, $body) {
    Write-Host "Testing: $endpoint" -NoNewline
    try {
        $uri = "$base/$endpoint"
        $res = Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body $body -ErrorAction Stop
        Write-Host " -> [SUCCESS]" -ForegroundColor Green
        return $true
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        Write-Host " -> [FAILED: $code]" -ForegroundColor Red
        return $false
    }
}

$chatBody = @{ query = "Hi"; userId = "test" } | ConvertTo-Json
$marketBody = @{ drugName = "Dolo 650" } | ConvertTo-Json
$forecastBody = @{ salesHistory = @(@{ date="2023-01-01"; sales=100 }); shopId="test" } | ConvertTo-Json
$complianceBody = @{ drugName = "Corex" } | ConvertTo-Json

Write-Host "--- DISCOVERY MODE ---"
Test-Path "medix-chat-v2" $chatBody
Test-Path "chat" $chatBody

Test-Path "medix-market-v5" $marketBody
Test-Path "market" $marketBody

Test-Path "medix-forecast-v5" $forecastBody
Test-Path "forecast" $forecastBody

Test-Path "medix-compliance-v5" $complianceBody
Test-Path "compliance" $complianceBody

Test-Path "medix-interactions-v5" (@{ drugs = @("Aspirin") } | ConvertTo-Json)
Test-Path "interactions" (@{ drugs = @("Aspirin") } | ConvertTo-Json)
