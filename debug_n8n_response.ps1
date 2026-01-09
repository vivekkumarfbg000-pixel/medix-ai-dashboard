$headers = @{ "Content-Type" = "application/json" }
$opsUrl = "https://vivek2073.app.n8n.cloud/webhook/operations"

# Valid 1x1 Pixel Red Dot JPEG
$validImage = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDAREAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUH/8QAFhABAQEAAAAAAAAAAAAAAAAAAQID/8QAFgABAQEAAAAAAAAAAAAAAAAAAQMC/8QAFhABAQEAAAAAAAAAAAAAAAAAAQMC/9oADAMBAAIRAxEAPwC/gA//"

# Valid Silent MP3 Frame (Base64)
$validAudio = "//NkxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//NkxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq"

function Test-Action($action, $dataKey, $dataVal) {
    Write-Host "`n--- TESTING ACTION: $action ---" -ForegroundColor Cyan
    
    $body = @{
        action = $action
        userId = "test-user"
        shopId = "test-shop"
        "$dataKey" = $dataVal
    } | ConvertTo-Json

    try {
        $res = Invoke-RestMethod -Uri $opsUrl -Method Post -Headers $headers -Body $body -ErrorAction Stop
        $json = $res | ConvertTo-Json -Depth 5
        Write-Host "RESPONSE KEY STRUCTURE:" -ForegroundColor Green
        Write-Host $json
    } catch {
        Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
             $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
             Write-Host "SERVER ERROR: $($reader.ReadToEnd())"
        }
    }
}

Test-Action "scan-parcha" "image_base64" $validImage
Test-Action "scan-report" "image_base64" $validImage
Test-Action "voice-bill" "data" $validAudio
