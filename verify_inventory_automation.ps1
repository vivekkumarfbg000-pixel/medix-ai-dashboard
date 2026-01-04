$ErrorActionPreference = "Stop"

# Configuration
$SupabaseUrl = "https://fzykfngzgwkwdnhjcsxl.supabase.co"
$SupabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6eWtmbmd6Z3drd2RuaGpjc3hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1MDc0MjcsImV4cCI6MjA4MjA4MzQyN30.UlV_Y0hW_NfhFBA3atxtrBvnf7IDQE04s9qcPuRnCCw"
$ShopId = "6b41d9b4-fe7d-4eec-a2c3-dd99093437e8"
$ChatWebhook = "https://vivek2073.app.n8n.cloud/webhook/medix-chat-v2"

$Headers = @{
    "apikey" = $SupabaseKey
    "Authorization" = "Bearer $SupabaseKey"
    "Content-Type" = "application/json"
    "Prefer" = "return=representation"
}

function Get-Inventory {
    param($id)
    $url = "$SupabaseUrl/rest/v1/inventory?id=eq.$id&select=id,medicine_name,quantity"
    try {
        $res = Invoke-RestMethod -Uri $url -Method Get -Headers $Headers
        if ($res.Count -gt 0) { return $res[0] }
        return $null
    } catch {
        Write-Output "Error getting inventory: $_" -ForeColor Red
        return $null
    }
}

Write-Output "--- STARTING INVENTORY AUTOMATION TEST ---" -ForeColor Cyan

# 1. Setup Test Item (Using Existing)
Write-Output "Fetching an existing item for testing..."
try {
    # REMOVED shop_id filter to find ANY item
    $ExistingItems = Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/inventory?select=*&limit=1" -Method Get -Headers $Headers
    if ($ExistingItems.Count -eq 0) {
        Write-Output "No items found in inventory (Global Check). Cannot verify." -ForeColor Red
        exit
    }
    $Item = $ExistingItems[0]
    $ItemId = $Item.id
    $TestItemName = $Item.medicine_name
    $InitialQty = $Item.quantity
    
    # Auto-detect Shop ID from the item we found
    $ShopId = $Item.shop_id 
    
    Write-Output "Using Item: $TestItemName (ID: $ItemId, Start Qty: $InitialQty, Shop: $ShopId)" -ForeColor Yellow
} catch {
    Write-Output "Failed to fetch inventory. $_" -ForeColor Red
    exit
}

# 2. Test POS Auto-Deduction (Sale of 1)
Write-Output "`n--- TEST 1: POS Auto-Deduction (Sale of 1) ---" -ForeColor Cyan
$OrderPayload = @{
    shop_id = $ShopId
    customer_name = "Test Bot"
    total_amount = 50
    status = "approved"
    invoice_number = "TEST-POS-$(Get-Random)"
    order_items = @(
        @{
            inventory_id = $ItemId
            medicine_name = $TestItemName
            qty = 1
            price = 10
        }
    )
} | ConvertTo-Json -Depth 10

try {
    Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/orders" -Method Post -Headers $Headers -Body $OrderPayload
    Write-Output "Sale Recorded. Checking logic..."
    Start-Sleep -Seconds 2 
    
    $UpdatedItem = Get-Inventory $ItemId # Using ID now
    $ExpectedQty = $InitialQty - 1
    
    if ($UpdatedItem.quantity -eq $ExpectedQty) {
        Write-Output "SUCCESS: Stock dropped from $InitialQty -> $ExpectedQty" -ForeColor Green
    } else {
        Write-Output "FAILED: Stock is $($UpdatedItem.quantity) (Expected $ExpectedQty)" -ForeColor Red
    }
} catch {
    Write-Output "Sale Failed: $_" -ForeColor Red
}

# 3. Test AI Restock (N8N Tool)
Write-Output "`n--- TEST 2: AI Agent Restock (Add 50) ---" -ForeColor Cyan
$ChatPayload = @{
    query = "Add 50 strips of $TestItemName to inventory"
    userId = "test-verification"
    shopId = $ShopId
} | ConvertTo-Json

try {
    Write-Output "Asking AI Agent..."
    $ChatRes = Invoke-RestMethod -Uri $ChatWebhook -Method Post -ContentType "application/json" -Body $ChatPayload
    Write-Output "AI Replied: $($ChatRes.reply)" -ForeColor Gray
    
    Start-Sleep -Seconds 5 # Wait for N8N processing
    
    $FinalItem = Get-Inventory $ItemId # Using ID now
    
    # Expected: (Previous Qty) + 50
    # Current UpdatedItem Qty + 50
    $ExpectedFinal = $UpdatedItem.quantity + 50
    
    if ($FinalItem.quantity -eq $ExpectedFinal) {
        Write-Output "SUCCESS: Stock rose from $($UpdatedItem.quantity) -> $ExpectedFinal" -ForeColor Green
    } else {
        Write-Output "FATAL/FAIL: Stock is $($FinalItem.quantity) (Expected $ExpectedFinal)" -ForeColor Red
    }
} catch {
    Write-Host "AI Request Failed: $_" -ForeColor Red
}

# Cleanup
Write-Host "`n--- CLEANUP ---"
# Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/inventory?id=eq.$ItemId" -Method Delete -Headers $Headers
Write-Host "Test Completed."
