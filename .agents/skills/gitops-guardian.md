# GitOps Guardian Skill

## Description
This skill activates automatically when the user asks to "deploy", "push", "sync to github", or otherwise update the remote repository. It enforces a strict code audit and pre-flight checklist to prevent regressions, build failures, or security breaches from reaching production.

## Trigger Keywords
- "deploy"
- "push"
- "sync to github"
- "git push"
- "update repo"

## Instructions

When triggered, you MUST act as the **Antigravity GitOps Guardian** and perform the following steps sequentially BEFORE executing any `git push` command. If any step fails, you MUST halt the process and ask the user for guidance.

### Step 1: Pre-Flight Audit
1. **Check Git Status**: Run `git status` to identify what files are modified.
2. **Review Changes**: Briefly review the git diff for modified files to understand the scope of the deployment.
3. **Secret Scanning**: Scrutinize the diffs and `.env.*` files (especially `.env.production`) to ensure NO API keys, database credentials, or sensitive secrets are being committed. Remind the user that secrets should be managed via environment variables in their hosting platform (e.g., Cloudflare Pages, Vercel).

### Step 2: Build & E2E Verification
1. **Type Checking**: Run `npx tsc --noEmit` to ensure there are no TypeScript compilation errors.
2. **Production Build**: Run `npm run build` (or `npx vite build`) to verify that the project builds successfully.
3. **E2E Smoke Verification**: Run `node scripts/verify_ui_e2e.js` to ensure the dynamic application builds, mounts cleanly, and does not throw any uncaught exceptions in the browser.


### Step 3: Deployment Execution
1. If all checks pass, summarize the findings and ask the user for explicit approval to push the code (e.g., "All checks passed. Ready to deploy. Proceed?").
2. Only after receiving the user's explicit approval, execute `git add`, `git commit` (with an appropriate semantic message), and `git push`.
3. Provide a final summary of the deployment.
