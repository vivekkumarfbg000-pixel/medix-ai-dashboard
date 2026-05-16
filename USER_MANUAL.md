# PharmaAssist.AI Dashboard - User Manual

> **Version**: 5.0  
> **Last Updated**: February 2026  
> **System**: Medix AI Integrated Dashboard

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Getting Started](#getting-started)
3. [Core Features](#core-features)
4. [n8n Workflow Setup](#n8n-workflow-setup)
5. [Troubleshooting](#troubleshooting)
6. [API Configuration](#api-configuration)

---

## System Overview

PharmaAssist.AI is an intelligent pharmacy management system powered by AI. It provides:

- 🏪 **Billing Hub (Lite POS)**: Quick sales and invoice generation
- 📦 **Inventory Management**: Stock tracking with AI-powered restock predictions
- 📋 **Digital Prescriptions**: OCR scanning and AI prescription analysis
- 💳 **Customer Ledger**: Credit management (Khata system)
- 📊 **Business Analytics**: Sales reports and insights
- 🤖 **AI Assistant**: Voice/text chatbot for shop operations
- 📱 **WhatsApp Integration**: Send invoices directly to customers

---

## Getting Started

### Prerequisites

1. **Supabase Account**: Your database and authentication
2. **n8n Instance**: For AI workflows (cloud or self-hosted)
3. **Google Gemini API Key**: For AI features
4. **Browser**: Chrome, Firefox, Edge, or Safari (latest version)

### Initial Setup

#### Step 1: Configure Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_N8N_WEBHOOK_URL=https://your-n8n-instance.app.n8n.cloud/webhook/medix-chat-v2
```

#### Step 2: Run Database Migrations

```bash
# Navigate to project directory
cd medix-ai-dashboard-main

# Apply all migrations
supabase db push
```

**Critical Migrations**:
- `20260117_fix_inventory_rls_robust.sql` - Inventory permissions
- `20260121_fix_inventory_rpc.sql` - Add inventory RPC function
- `20251230_add_customers_ledger.sql` - Ledger system

#### Step 3: Create Your First Shop

1. Sign up at `/signup`
2. After login, create a shop:
   - Name: Your pharmacy name
   - Location: City/area
   - Phone: Contact number
3. Note your **Shop ID** (shown in URL or Settings)

#### Step 4: Import n8n Workflow

1. Download workflow: `_N8N_WORKFLOW_/Medix AI Integrated Agent V5 (Standard Nodes).json`
2. Open your n8n instance
3. Click **Import from File**
4. Update credentials:
   - Supabase API (apikey + URL)
   - Google Gemini API key
5. Update **Agent Configuration** node:
   - `shopId`: Your shop ID from Step 3
   - `supabaseUrl`: Your Supabase project URL
   - `supabaseKey`: Your anon key

---

## Core Features

### 1. Billing Hub (Lite POS)

**Purpose**: Quick medicine sales with invoice generation

#### How to Use:

1. **Navigate**: Dashboard → Billing Hub
2. **Add Items**:
   - Type medicine name in search
   - Click medicine from suggestions
   - Adjust quantity if needed
3. **Customer Info**:
   - Enter customer name
   - Add phone number (for WhatsApp invoice)
4. **Payment**:
   - Click **Cash** or **Credit** or **UPI**
   - For credit: Amount is added to customer ledger
5. **Complete Sale**:
   - Click **Complete Sale**
   - Invoice is generated automatically
6. **Send Invoice**:
   - Click **Send via WhatsApp**
   - WhatsApp opens with pre-filled invoice

**Keyboard Shortcuts**:
- `Ctrl + K`: Focus search
- `Enter`: Add selected medicine
- `Ctrl + S`: Complete sale

---

### 2. Orders Section

**Purpose**: View all sales/orders across time

#### Features:

- **Real-time updates**: New orders appear automatically (no refresh needed)
- **Filter by status**: Pending, Completed, Cancelled
- **Search**: By invoice number or customer name
- **WhatsApp share**: Send invoice to customer

#### How to Use:

1. **View Orders**: Dashboard → Orders
2. **Filter**: Click status tabs (All, Pending, Completed)
3. **Search**: Type invoice number or name
4. **Send Invoice**:
   - Click **WhatsApp** icon
   - If no phone: Dialog opens to add number
   - After adding: WhatsApp opens automatically

**Popup Blocker Fix**: If WhatsApp doesn't open:
- Toast appears with "Open WhatsApp" button
- Click button to open manually

---

### 3. Inventory Management

**Purpose**: Track stock levels, expiry, and restock needs

#### Features:

- **Stock tracking**: Quantity, batch, expiry date
- **Low stock alerts**: Automatic warnings
- **Restock predictions**: AI forecasts when to reorder
- **Multi-source**: Manual, CSV upload, n8n AI

#### Adding Inventory:

**Method 1: Manual**
1. Dashboard → Inventory
2. Click **Add Stock**
3. Fill details:
   - Medicine name
   - Quantity
   - Unit price (selling price)
   - Purchase price (cost)
   - Batch number
   - Expiry date
4. Click **Save**

**Method 2: CSV Upload**
1. Download template (CSV format)
2. Fill medicine data
3. Click **Upload CSV**
4. Select file → Review → Confirm

**Method 3: AI Assistant (n8n)**
- Chat: "Add 50 strips of Azithral, batch AB123, expires March 2026"
- AI extracts data and adds to inventory

**Method 4: Invoice Scan**
1. Dashboard → Diary Scan
2. Upload invoice image
3. AI extracts medicines
4. Click **Add All to Inventory**

---

### 4. Digital Prescriptions (Digital Parcha)

**Purpose**: Scan and digitize paper prescriptions

#### How to Use:

1. **Navigate**: Dashboard → Digital Parcha / Diary Scan
2. **Upload Image**:
   - Click camera icon **OR**
   - Drag & drop prescription image
3. **AI Processing**:
   - Gemini Vision extracts text
   - Identifies medicines, dosage, doctor name
4. **Review**:
   - Check extracted data
   - Edit if needed
5. **Actions**:
   - **Check Stock**: See if medicines available
   - **Create Invoice**: Bill customer directly
   - **Save**: Store for future reference

**Supported Formats**: JPG, PNG, HEIC, WebP

---

### 5. Customer Ledger (Khata)

**Purpose**: Track customer credit/payments

#### Features:

- **Credit sales**: Record udhaari (customer debt)
- **Payments**: Record when customer pays
- **Balance tracking**: See who owes what
- **History**: View all transactions

#### How to Use:

**Recording Credit Sale**:
1. Billing Hub → Add items
2. Click **Credit** payment
3. Sale amount added to customer's ledger

**Recording Payment**:
1. Dashboard → Customers
2. Find customer
3. Click **Add Payment**
4. Enter amount received
5. Balance updates automatically

**View Ledger**:
1. Dashboard → Customers
2. Click customer name
3. See all transactions (sales + payments)

---

### 6. AI Assistant

**Purpose**: Voice/text commands for shop operations

#### Capabilities:

- Check inventory: "Do we have Dolo 650?"
- Add stock: "Add 10 boxes of Crocin"
- Sales info: "How much sale today?"
- Medical advice: "What is paracetamol used for?"
- Prescription analysis: Upload image → Get medicine list

#### How to Use:

**Text Chat**:
1. Dashboard → Click chat icon (bottom right)
2. Type query
3. AI responds in Hinglish

**Voice Input**:
1. Click microphone icon
2. Speak your query
3. AI converts to text and responds

**Example Queries**:
- "Bhaiya, sar dard ki dawa hai?"
- "Add 50 strips of Azithral to inventory"
- "Ramesh took 500rs udhaari"
- "Show me today's sales report"

---

## n8n Workflow Setup

### Overview

The n8n workflow connects your dashboard to AI services (Gemini) for:
- Prescription OCR
- Inventory management
- Chat assistance
- Drug interaction checks

### Workflow File

**Location**: `_N8N_WORKFLOW_/Medix AI Integrated Agent V5 (Standard Nodes).json`

### Configuration Steps

#### 1. Import Workflow

1. Open n8n dashboard
2. Click **Workflows** → **Import from File**
3. Select `Medix AI Integrated Agent V5 (Standard Nodes).json`
4. Click **Import**

#### 2. Configure Credentials

**Supabase Credential**:
1. Click any Supabase node (e.g., "Get Patient History")
2. Credentials dropdown → **Create New**
3. Enter:
   - **URL**: `https://YOUR_PROJECT.supabase.co`
   - **API Key**: Your `anon` key from Supabase dashboard
4. Click **Save**

**Google Gemini Credential**:
1. Click "Google Gemini Chat Model" node
2. Credentials → **Create New**
3. Enter:
   - **API Key**: Your Gemini API key (`AIza...`)
4. Click **Save**

**Header Auth Credential** (for Add inventory):
1. Click "Add inventory" node
2. Credentials → **Create New**
3. Enter:
   - **Name**: `apikey`
   - **Value**: Your Supabase `anon` key
4. Add second header:
   - **Name**: `Authorization`
   - **Value**: `Bearer YOUR_ANON_KEY`
5. Click **Save**

#### 3. Update Agent Configuration

Find the **"Agent Configuration"** node:

```json
{
  "shopId": "YOUR_SHOP_ID_HERE",
  "supabaseUrl": "https://YOUR_PROJECT.supabase.co",
  "supabaseKey": "YOUR_ANON_KEY_HERE",
  "googleGeminiApiKey": "AIza..."
}
```

**Get Your Shop ID**:
1. Open dashboard
2. Go to Settings → Shops
3. Copy Shop ID (UUID format)

#### 4. Activate Workflow

1. Click **Active** toggle (top right)
2. Workflow should turn green
3. Note the webhook URL: `https://YOUR_INSTANCE.app.n8n.cloud/webhook/medix-chat-v2`

#### 5. Update Dashboard Environment

Update your dashboard `.env`:

```env
VITE_N8N_WEBHOOK_URL=https://YOUR_INSTANCE.app.n8n.cloud/webhook/medix-chat-v2
```

Restart your dev server:
```bash
npm run dev
```

---

## Troubleshooting

### Common Issues

#### 1. "Authorization failed" in Add inventory

**Error**: `new row violates row-level security policy for table "inventory"`

**Cause**: n8n node using old direct POST method

**Fix**:
1. Open n8n workflow
2. Find "Add inventory" node
3. Check URL is: `/rest/v1/rpc/add_inventory_secure` (NOT `/rest/v1/inventory`)
4. Verify parameters have `p_` prefix:
   - `p_medicine_name`
   - `p_quantity`
   - `p_shop_id`

**See**: [Walkthrough - Add Inventory Fix](file:///C:/Users/vivek/.gemini/antigravity/brain/8ee3275d-d543-457f-86c3-1c3e2a722211/walkthrough.md)

---

#### 2. Orders not showing after sale

**Symptom**: Complete sale in Billing Hub, but Orders page stays empty

**Cause**: Missing real-time subscription

**Fix**: Already implemented! Orders now update automatically. If not working:
1. Check browser console for WebSocket errors
2. Verify Supabase RLS policies are applied:
   ```bash
   supabase db push
   ```
3. Hard refresh: `Ctrl + Shift + R`

---

#### 3. WhatsApp invoice prompt disappears

**Symptom**: Click "WhatsApp Invoice" → Prompt appears → Disappears

**Cause**: Popup blocker or old `window.prompt()` method

**Fix**: Already implemented! Now uses proper dialog. If still failing:
1. **Check popup blocker**: Disable for your domain
2. **Look for fallback button**: Toast appears with "Open WhatsApp" button
3. **Update Orders.tsx**: Ensure using latest version with popup detection

---

#### 4. Prescription scan not saving

**Symptom**: Scan prescription → AI extracts data → Data disappears

**Cause**: Missing database insertion after n8n processing

**Fix**: Implemented! Prescriptions now save automatically. If not working:
1. Check `DiaryScan.tsx` has database save logic (lines 171-206)
2. Verify n8n webhook is responding (check Network tab)
3. Check browser console for errors

---

#### 5. Inventory not deducting after sale

**Symptom**: Sell medicine → Stock level doesn't decrease

**Cause**: Auto-deduction trigger not applied

**Fix**:
```sql
-- Run this migration
supabase/migrations/20260104_auto_inventory_deduction.sql
```

Or manually:
```sql
CREATE OR REPLACE FUNCTION auto_deduct_inventory()
RETURNS TRIGGER AS $$
BEGIN
  -- Deduct quantity for each order item
  UPDATE inventory
  SET quantity = quantity - oi.quantity
  FROM order_items oi
  WHERE inventory.id = oi.inventory_id
    AND oi.order_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_order_insert
AFTER INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION auto_deduct_inventory();
```

---

#### 6. Gemini API quota exceeded

**Error**: `You exceeded your current quota, please check your plan`

**Solutions**:
1. **Wait**: Free tier resets daily
2. **Upgrade**: Get paid Gemini API plan
3. **Switch model**: Change to `gemini-1.5-flash` (more quota)
4. **Use Groq**: For chatbot, switch to Groq (free, fast):
   - Model: `llama-3.3-70b-versatile`

---

### Performance Tips

#### Speed Up Dashboard

1. **Enable caching**:
   ```typescript
   // In fetchOrders, fetchInventory, etc.
   const { data, error } = await supabase
     .from('orders')
     .select('*')
     .limit(50) // Limit results
     .order('created_at', { ascending: false });
   ```

2. **Lazy load images**: Prescription images load on demand

3. **Debounce search**: Search waits 300ms before querying

#### Reduce API Costs

1. **Use Groq for chat**: Free, unlimited (vs Gemini paid)
2. **Cache common queries**: Store frequent drug info locally
3. **Batch operations**: Upload multiple prescriptions at once

---

## API Configuration

### Supabase

**Get Credentials**:
1. Go to [supabase.com](https://supabase.com)
2. Open your project
3. Settings → API
4. Copy:
   - **Project URL**: `https://xxx.supabase.co`
   - **anon/public key**: `eyJhbG...`

**RLS Policies**: Ensure these are enabled:
- `inventory_access_policy` - Allows multi-shop access
- `orders_access_policy` - User can view their shop orders
- `staging_access_policy` - For prescription drafts

### Google Gemini

**Get API Key**:
1. Go to [ai.google.dev](https://ai.google.dev)
2. Click **Get API Key**
3. Create new key
4. Copy: `AIzaSy...`

**Recommended Models**:
- **Vision**: `gemini-1.5-flash` (OCR, image analysis)
- **Chat**: `gemini-1.5-flash` (fast, cheap)
- **Advanced**: `gemini-1.5-pro` (complex reasoning)

**Quota Management**:
- **Free tier**: 15 requests/minute, 1500/day
- **Paid tier**: 2000 requests/minute

### Groq (Alternative for Chat)

**Get API Key**:
1. Go to [console.groq.com](https://console.groq.com)
2. Sign up (free)
3. API Keys → Create
4. Copy: `gsk_...`

**Best Models for Pharmacy**:
- **Chat**: `llama-3.3-70b-versatile` (128k context)
- **Fast**: `mixtral-8x7b-32768` (ultra-fast)

**Update n8n**: Replace Gemini with Groq Chat Model node

---

## Best Practices

### Daily Operations

1. **Morning**:
   - Check low stock alerts
   - Review restock predictions
   - Verify pending orders

2. **During Sales**:
   - Use Billing Hub for speed
   - Send WhatsApp invoices immediately
   - Record credit sales properly

3. **End of Day**:
   - Review sales report
   - Check ledger balances
   - Back up data (auto-backed by Supabase)

### Data Entry

- **Consistent naming**: Use standard medicine names (e.g., "Paracetamol 500mg" not "Para")
- **Batch tracking**: Always enter batch for expiry management
- **Customer phones**: Add numbers for WhatsApp invoices

### Security

- **Never share** your Supabase `service_role` key
- **Use HTTPS** always (auto with Supabase)
- **Regular backups**: Supabase auto-backs up; download manually monthly

---

## Support

### Documentation
- **This Manual**: `USER_MANUAL.md`
- **Walkthroughs**: `C:\Users\vivek\.gemini\antigravity\brain\...\walkthrough.md`
- **Implementation Plans**: Check artifacts folder

### Logs
- **Browser Console**: `F12` → Console tab
- **n8n Logs**: Workflow → Executions tab
- **Supabase Logs**: Dashboard → Logs

### Need Help?

1. Check [Troubleshooting](#troubleshooting) section
2. Review walkthrough artifacts
3. Check browser/n8n console for errors
4. Verify all migrations are applied

---

## Appendix

### Database Schema

**Key Tables**:
- `shops`: Your pharmacy shops
- `inventory`: Medicine stock
- `orders`: Sales records
- `order_items`: Individual medicines per order
- `prescriptions`: Scanned prescription data
- `customers_ledger`: Credit/payment tracking

### File Structure

```
medix-ai-dashboard-main/
├── src/
│   ├── pages/dashboard/
│   │   ├── LitePOS.tsx          # Billing Hub
│   │   ├── Orders.tsx           # Orders section
│   │   ├── Inventory.tsx        # Stock management
│   │   ├── DiaryScan.tsx        # Prescription scan
│   │   └── Customers.tsx        # Ledger
│   ├── components/
│   └── services/
├── supabase/migrations/         # Database updates
├── _N8N_WORKFLOW_/              # n8n workflows
└── USER_MANUAL.md               # This file
```

---

**Last Updated**: February 10, 2026  
**Version**: 5.0  
**Author**: PharmaAssist.AI Team
