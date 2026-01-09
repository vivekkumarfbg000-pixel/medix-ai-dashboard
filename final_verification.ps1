$headers = @{ "Content-Type" = "application/json" }
$base = "https://vivek2073.app.n8n.cloud/webhook"

function Get-Body($endpoint, $body) {
    Write-Host "--- $endpoint ---"
    try {
        $uri = "$base/$endpoint"
        $res = Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body $body -ErrorAction Stop
        $res | ConvertTo-Json -Depth 5
    } catch {
        Write-Host "HTTP STATUS: $($_.Exception.Response.StatusCode.value__)"
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            Write-Host "RESPONSE: $($reader.ReadToEnd())"
        }
    }
}

$marketBody = @{ drugName = "Dolo 650" } | ConvertTo-Json
$forecastBody = @{ salesHistory = @(@{ date="2023-01-01"; sales=100 }); shopId="test" } | ConvertTo-Json
$complianceBody = @{ drugName = "Corex" } | ConvertTo-Json

Get-Body "medix-market-v5" $marketBody
Get-Body "medix-forecast-v5" $forecastBody
Get-Body "medix-compliance-v5" $complianceBody
