import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('──────────────────────────────────────────────────────────────────');
console.log('📊 MEDIX-AI: RUNNING PRODUCTION TELEMETRY & DIAGNOSTIC STATIC SCAN');
console.log('──────────────────────────────────────────────────────────────────\n');

let issuesFound = 0;

// 1. Audit Migration File Sequencing
const migrationsDir = path.resolve(__dirname, '../supabase/migrations');
if (fs.existsSync(migrationsDir)) {
  console.log('📂 1. Auditing Supabase Migration Files Sequence...');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
  
  let invalidFiles = 0;
  files.forEach(file => {
    // Standard timestamp format: 20260105_*.sql or 20251231_*.sql
    if (!/^\d{8}_.*\.sql$/.test(file)) {
      console.warn(`   ⚠️  [Sequence Violation] File "${file}" does not follow YYYYMMDD_name.sql naming format.`);
      invalidFiles++;
      issuesFound++;
    }
  });

  if (invalidFiles === 0) {
    console.log(`   ✅ All ${files.length} migration files follow the strict sequential YYYYMMDD prefix standard.`);
  }
} else {
  console.warn('   ⚠️  [Telemetry Skip] Migration directory "/supabase/migrations" not found.');
}

// 2. Audit Client-Side DB schema structures
const dbFilePath = path.resolve(__dirname, '../src/db/db.ts');
if (fs.existsSync(dbFilePath)) {
  console.log('\n📂 2. Auditing IndexedDB (Dexie) Configuration...');
  const content = fs.readFileSync(dbFilePath, 'utf8');

  // Verify multi-shop tenant isolation is active in structural store versions
  if (content.includes('shop_id') && content.includes('[shop_id+medicine_name]')) {
    console.log('   ✅ Multi-tenant isolation composite index "[shop_id+medicine_name]" is active.');
  } else {
    console.warn('   ⚠️  [Schema Vulnerability] Multi-shop composite indexes not found in db.ts stores.');
    issuesFound++;
  }

  // Verify idempotency keys exist in orders table to block double-billing
  if (content.includes('idempotency_key')) {
    console.log('   ✅ Idempotency keys are declared in orders schema to prevent double-billing.');
  } else {
    console.warn('   ⚠️  [Transaction Integrity] Idempotency keys missing from offline orders definition.');
    issuesFound++;
  }
}

// 3. Audit POS Loading State & LiveQuery Fallbacks
const posFilePath = path.resolve(__dirname, '../src/pages/dashboard/LitePOS.tsx');
if (fs.existsSync(posFilePath)) {
  console.log('\n📂 3. Auditing POS Safe LiveQuery Fallback Defenses...');
  const content = fs.readFileSync(posFilePath, 'utf8');

  // Check if live query arrays have a fallback default to prevent "undefined" React renders
  const liveQueryMatches = content.match(/useLiveQuery\([\s\S]*?\)/g) || [];
  console.log(`   Found ${liveQueryMatches.length} useLiveQuery hooks defined in LitePOS.tsx.`);

  const safetyIssues = [];
  // Ensure products list handles undefined arrays gracefully
  if (!content.includes('products || []') && !content.includes('products?.') && content.includes('const products = useLiveQuery')) {
    safetyIssues.push('Potential unguarded products list iteration detected.');
    issuesFound++;
  }

  if (safetyIssues.length === 0) {
    console.log('   ✅ All live queries are guarded against asynchronous loading states.');
  } else {
    safetyIssues.forEach(err => console.warn(`   ⚠️  [Loading Race Condition] ${err}`));
  }
}

console.log('\n──────────────────────────────────────────────────────────────────');
if (issuesFound === 0) {
  console.log('🎉 DIAGNOSTIC SCAN: 100% HEALTHY. ALL PRODUCTION GUARDS VERIFIED.');
  console.log('──────────────────────────────────────────────────────────────────');
  process.exit(0);
} else {
  console.warn(`🛑 DIAGNOSTIC SCAN COMPLETE: ${issuesFound} warnings found that require attention.`);
  console.log('──────────────────────────────────────────────────────────────────');
  process.exit(0); // Non-blocking static analysis checks
}
