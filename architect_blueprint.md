# ARCHITECTURAL CONTRACT: GitOps Guardian High-Fidelity Behavioral Smoke & Auth Integration Verification Suite
> **CRITICAL NOTICE TO EXECUTING AGENTS:** This document is immutable law. Any code modification that violates the boundaries, data shapes, or security guardrails defined below will cause an immediate system rejection and code revert.

## 1. COMPONENT & REPOSITORY BOUNDARIES
*   **TARGET_FILES_TO_EDIT:** 
    *   `scripts/verify_ui_e2e.js` [NEW] -> Lightweight E2E preview validation script.
    *   `src/__tests__/AuthFlow.test.tsx` [NEW] -> JSDOM functional integration test for sticky session recovery and logout redirect loops.
    *   `.agents/skills/gitops-guardian.md` [MODIFY] -> Add E2E verification check requirements.
    *   `ULTIMATE_TECH_TEAM_PIPELINE.md` [MODIFY] -> Integrate E2E checklist items.
*   **FORBIDDEN_FILES (NO-FLY ZONES):** 
    *   `src/context/AuthContext.tsx` -> Core AuthProvider state machine is frozen to prevent collateral regression.
    *   `src/integrations/supabase/client.ts` -> Central client configurations must remain unchanged.

## 2. DATA CONTRACT & TYPE INTEGRITY
*   **INCOMING_DATA_SHAPE (INPUTS):**
    ```typescript
    interface TestUserSession {
        user: {
            id: string;
            email: string;
            role: 'authenticated' | 'anon';
        } | null;
        session: {
            access_token: string;
            expires_at: number;
        } | null;
        isLoading: boolean;
    }
    ```
*   **OUTGOING_DATA_SHAPE (OUTPUTS):**
    *   `scripts/verify_ui_e2e.js` exit code must be `0` on success and `1` on any uncaught exception, blank container render, or console error.

## 3. SECURITY & POLICY ENVIRONMENT
*   **ENVIRONMENT_VARIABLES_REQUIRED:**
    *   `VITE_SUPABASE_URL` -> Endpoint mapping.
    *   `VITE_SUPABASE_PUBLISHABLE_KEY` -> Client api access.
*   **ACCESS_CONTROL_CONSTRAINTS:**
    *   The headless E2E verification server must run locally on port `4173` without exposing open ports to external networks.

## 4. VERIFICATION METRICS (THE DEFENSIVE PASS CRITERIA)
*   The system is considered functional if and only if:
    1. **TypeScript Build Gate**: `npx tsc --noEmit` compiles cleanly with zero errors.
    2. **Linting Verification**: `npx eslint . --quiet` completes without any syntax warnings.
    3. **DOM Integration Integrity**: `npm run test` executes successfully and compiles all tests under `src/__tests__/`.
    4. **Headless Boot verification**: `node scripts/verify_ui_e2e.js` runs a local Vite preview server and successfully validates that the UI renders without errors.
