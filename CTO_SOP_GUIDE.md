# SOP: Medix AI Dashboard - Engineering & Maintenance Guide for CTO

This Standard Operating Procedure (SOP) provides technical guidance for maintaining, debugging, and extending the Medix AI Dashboard. It is designed to ensure stability while allowing for rapid iteration.

---

## 1. Technical Stack Overview

*   **Frontend**: React 18 (Vite), TypeScript, Tailwind CSS.
*   **UI Components**: Radix UI + Lucide Icons (consistent design system).
*   **State Management**: 
    *   **Server State**: TanStack Query (React Query) for API/Supabase sync.
    *   **Local Persistence**: Dexie (IndexedDB) for offline-capable features.
*   **Backend/DB**: Supabase (PostgreSQL, Auth, Storage, Edge Functions).
*   **Orchestration/AI**: n8n (for complex multi-step AI reasoning and integrations).
*   **Mobile**: Capacitor (targeting Android).
*   **Deployment**: Vercel (Frontend) + Cloudflare Workers (Edge logic).

---

## 2. Core Architectural Patterns

### 2.1 Database First (Supabase)
All data persistence should happen through Supabase. 
*   **RLS (Row Level Security)**: Mandatory for all tables. Policies are shop-based (`shop_id`).
*   **Migrations**: Never make manual schema changes in the Supabase UI. Always use `supabase/migrations/*.sql`.

### 2.2 Workflow-as-a-Service (n8n)
Instead of building complex AI logic in the frontend or Edge Functions, use n8n.
*   **Trigger**: Dashboard sends request to `VITE_N8N_WEBHOOK_URL`.
*   **Processing**: n8n handles Gemini/Groq calls and Supabase writes.
*   **Return**: Standardized JSON response back to the dashboard.

### 2.3 Component-Driven UI
Components are located in `src/components/ui` (primitives) and `src/components/dashboard` (features). 
*   Use `cn()` utility for conditional classes.
*   Maintain accessibility (Radix UI defaults).

---

## 3. Safety Protocol: Modifying Code Without Errors

To add/remove code without breaking the system, follow these steps:

### 3.1 Strict Type Safety
*   **Never use `any`**: Ensure all interfaces are defined in `src/types` or generated via Supabase CLI.
*   **Run Type Check**: Before committing, run `npx tsc --noEmit`.

### 3.2 Database Integrity
*   **Adding a Column**: 
    1. Create a new migration file in `supabase/migrations`.
    2. Run `supabase db push`.
    3. Update `src/integrations/supabase/types.ts` to reflect the new schema.
*   **Subtracting Code**: 
    1. Search for usages across the codebase (Grep).
    2. Verify n8n workflows don't depend on the deleted field/logic.
    3. Remove the code and run `npm run build` to catch orphans.

### 3.3 Linting
*   Ensure ESLint is green: `npm run lint`.

---

## 4. Debugging Guide

### 4.1 Frontend (The "Golden Trio")
1.  **Network Tab**: Check if Supabase requests or n8n webhooks are failing (401/403/500).
2.  **React Query DevTools**: Check if data is stale or if the cache needs invalidation after a mutation.
3.  **Console**: Look for "Hydration errors" or "RLS Policy violations".

### 4.2 Database (Supabase)
*   **RLS Debugging**: If a query returns empty `[]` but data exists, it's an RLS failure. Check the shop context in the `auth.jwt()`.
*   **RPC Logs**: Check `Database -> Logs` in Supabase dashboard for errors in custom functions (like `add_inventory_secure`).

### 4.3 AI/Workflows (n8n)
*   **Execution History**: If the Chatbot or OCR fails, go to n8n -> Executions.
*   **Pinning Data**: Use pinned data in n8n to test nodes without triggering a full workflow.

---

## 5. Adding a New Feature (Workflow)

Example: Adding "Expiry Alerts" feature.
1.  **DB**: Add `alert_sent` boolean to `inventory` table (migration).
2.  **n8n**: Create a scheduled workflow that checks `expiry_date` and sends a webhook to the dashboard or WhatsApp.
3.  **Frontend**: Create a new hook `useExpiryAlerts` in `src/hooks` and a UI component in `src/components/dashboard`.
4.  **Registration**: Add the route in `src/App.tsx`.

---

## 6. Common Error Fixes Checklist

| Symptom | Probable Cause | Action |
| :--- | :--- | :--- |
| **"New row violates RLS"** | Incorrect `shop_id` or missing policy | Verify `auth.uid()` and `shop_id` match the row. |
| **OCR not extracting data** | Gemini Quota or Image format | Check n8n logs; ensure image is < 4MB. |
| **Inventory not updating** | Missing Trigger or RPC error | Run `supabase/migrations/20260104_auto_inventory_deduction.sql`. |
| **WhatsApp not opening** | Browser Popup Blocker | Use the provided toast fallback button. |
| **Blank Screen on Load** | Missing `.env` variables | Ensure `VITE_SUPABASE_URL` is set in Vercel/Local. |

---

## 7. Mobile Build (Capacitor)

If you need to update the Android app:
1.  `npm run build` (Build the web assets).
2.  `npx cap sync android` (Sync assets to Android project).
3.  Open `android` folder in Android Studio.
4.  Generate Signed Bundle/APK.

---

## 8. Troubleshooting Common Errors

### 8.1 Database: "similarity(text, text) does not exist"
- **Cause:** The `pg_trgm` extension is not enabled in the Supabase project.
- **Fix:** Run the following SQL in the Supabase SQL Editor:
  ```sql
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  ```
- **Reference:** See migration `20260429_fix_missing_extensions.sql`.

### 8.2 AI: "GROQ_API_KEY is missing" or "JSON Parse Fail"
- **Cause:** Environment variables not loaded or local AI Proxy (LiteLLM) is down.
- **Fix:** 
  1. Ensure `.env` has `VITE_GROQ_API_KEY`.
  2. Run the diagnostic script: `node scripts/verify-ai-endpoints.js`.
  3. If LiteLLM is not running, either start it or comment out `VITE_AI_URL` in `.env` to fallback to the built-in Vite proxies.

### 8.3 Build: Syntax or Parsing Errors
- **Cause:** Botched merges or missing braces in hooks/components.
- **Fix:** Run `npx eslint . --quiet` to find critical errors. We recently fixed a major parsing error in `src/hooks/useUserShops.ts`.

---

## 9. Summary Checklist for CTO Maintenance
- [x] **Zero Errors:** `npx eslint . --quiet` returns exit code 0.
- [x] **Verified AI:** `node scripts/verify-ai-endpoints.js` shows "SUCCESS" for all tests.
- [x] **Database Health:** `node scripts/system_health_check.js` passes (requires `pg_trgm` extension).
- [ ] All DB changes have corresponding migration files.
- [ ] n8n workflows are exported to `_N8N_WORKFLOW_` folder.
- [ ] `.env.example` is updated if new keys are added.

---
**Prepared by Antigravity AI**  
*Version 1.0 | April 2026*
