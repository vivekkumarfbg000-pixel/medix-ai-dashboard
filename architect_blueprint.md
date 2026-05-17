# ARCHITECTURAL CONTRACT: Billing Hub Alternative Medicine System
> **CRITICAL NOTICE TO EXECUTING AGENTS:** This document is immutable law. Any code modification that violates the boundaries, data shapes, or security guardrails defined below will cause an immediate system rejection and code revert.

## 1. COMPONENT & REPOSITORY BOUNDARIES
*   **TARGET_FILES_TO_EDIT:** 
    *   `src/pages/dashboard/LitePOS.tsx` -> Core Billing Hub container displaying the catalog and cart items.
    *   `src/components/pos/AlternativeDialog.tsx` -> Dialog modal rendering substitutes and swapping cart rows.
*   **FORBIDDEN_FILES (NO-FLY ZONES):** 
    *   `src/services/drugService.ts` -> Baseline drug matching and margin comparison algorithms must never be edited.
    *   `src/db/db.ts` -> Dexie database layout, local schema indices, and table wrappers must remain untouched.

## 2. DATA CONTRACT & TYPE INTEGRITY
*   **INCOMING_DATA_SHAPE (INPUTS):**
    ```typescript
    interface OfflineInventory {
        id: string;
        shop_id: string;
        medicine_name: string;
        unit_price: number;
        quantity: number;
        purchase_price: number;
        is_synced: number;
        generic_name?: string;
        composition?: string;
        batch_number?: string;
    }
    ```
*   **OUTGOING_DATA_SHAPE (OUTPUTS):**
    ```typescript
    interface SubstituteSelection {
        originalId: string;
        replacementItem: OfflineInventory;
    }
    ```

## 3. SECURITY & POLICY ENVIRONMENT
*   **ENVIRONMENT_VARIABLES_REQUIRED:**
    *   `VITE_SUPABASE_URL` -> Supabase connection endpoint.
    *   `VITE_SUPABASE_ANON_KEY` -> Anonymous API gateway client key.
*   **ACCESS_CONTROL_CONSTRAINTS:**
    *   All queries must be explicitly isolated using `currentShop.id` to prevent cross-tenant leakage of stock and margin statistics under RLS constraints.

## 4. VERIFICATION METRICS (THE DEFENSIVE PASS CRITERIA)
*   The system is considered functional if and only if:
    1. The project compiles with zero TypeScript compiler errors: `npx tsc --noEmit` returns exit code 0.
    2. ESLint returns zero syntax or logical errors: `npx eslint . --quiet` returns exit code 0.
    3. The application does not throw a `TypeError` when clicking "Alt" buttons under any loading state of the `products` live query.
