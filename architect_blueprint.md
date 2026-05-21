# ARCHITECTURAL CONTRACT: Multi-Module POS, WhatsApp & AI Financial Report Interconnectivity
> **CRITICAL NOTICE TO EXECUTING AGENTS:** This document is immutable law. Any code modification that violates the boundaries, data shapes, or security guardrails defined below will cause an immediate system rejection and code revert.

## 1. COMPONENT & REPOSITORY BOUNDARIES
*   **TARGET_FILES_TO_EDIT:** 
    *   `src/pages/dashboard/LitePOS.tsx` -> Fix `confirmCheckout` invocations in POS modal/guest dialogs by explicitly passing `paymentMode` (or selected values) to prevent undefined parameter errors, resolve checkout split payment mapping, and ensure crash-proof checkout.
    *   `src/services/ai/tools.ts` -> Upgrade the AI `tool_getSalesReport` tool to query the robust `get_sales_report` RPC with a 30-day chronological context (matching the Analytics page calculation) instead of a simple daily order sum.
    *   `src/pages/dashboard/AIInsights.tsx` -> Stabilize the speech briefing integrations and make sure AI chat actions sync smoothly.
*   **FORBIDDEN_FILES (NO-FLY ZONES):** 
    *   `src/db/db.ts` -> Dexie IndexedDB schemas and store hooks must not be modified to prevent client-side corruption.
    *   `src/services/syncService.ts` -> Syncer mechanisms, transaction queue retries, and network listeners remain strictly frozen.

## 2. DATA CONTRACT & TYPE INTEGRITY
*   **INCOMING_DATA_SHAPE (INPUTS):**
    *   The `SplitPayment` structure definition:
    ```typescript
    interface SplitPayment {
        mode: 'cash' | 'upi' | 'card' | 'credit';
        amount: number;
    }
    ```
    *   The `confirmCheckout` function in `src/pages/dashboard/LitePOS.tsx` must correctly receive and utilize the parameters:
    ```typescript
    const confirmCheckout = async (finalPaymentMode: string, splits?: SplitPayment[]) => Promise<void>;
    ```
*   **OUTGOING_DATA_SHAPE (OUTPUTS):**
    *   The AI `tool_getSalesReport` tool must return a descriptive string detailing total sales, profit, and average margin:
    ```typescript
    export const tool_getSalesReport = async (shopId: string, days?: number) => Promise<string>;
    ```

## 3. SECURITY & POLICY ENVIRONMENT
*   **ENVIRONMENT_VARIABLES_REQUIRED:**
    *   `VITE_SUPABASE_URL` -> Endpoint mapping.
    *   `VITE_SUPABASE_PUBLISHABLE_KEY` -> Web access key.
    *   `VITE_GROQ_API_KEY` -> Local proxy AI models processing token.
*   **ACCESS_CONTROL_CONSTRAINTS:**
    *   All financial report requests via the chatbot must strictly limit query data by using `query_shop_id` matching the user's active session metadata to prevent cross-tenant exposure.
    *   The database sales report RPC `get_sales_report(TEXT, TEXT, UUID)` remains guarded with `SECURITY DEFINER` access permissions.

## 4. VERIFICATION METRICS (THE DEFENSIVE PASS CRITERIA)
*   The system is considered functional if and only if:
    1. **Type Safety & Build Gates**: Code builds with zero compilation errors using `npm run build`.
    2. **E2E Verification**: End-to-end headless browser test mounts React successfully via `node scripts/verify_ui_e2e.js` with zero console runtime exceptions.
    3. **Functional Correctness**:
        - Split payment parameters are correctly mapped and synced.
        - AI chatbot responds to financial metrics inquiries with actual calculated margin percentages and profit figures rather than unmapped fallbacks.
        - Invoices generate valid WhatsApp shareable text links and trigger without modal or page crashes.
