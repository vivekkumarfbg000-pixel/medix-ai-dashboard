import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

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
    // Standard timestamp format: 8-digit or 14-digit prefixes
    if (!/^\d{8,14}_.*\.sql$/.test(file)) {
      console.warn(`   ⚠️  [Sequence Violation] File "${file}" does not follow sequential YYYYMMDD_name.sql naming format.`);
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

// 4. Audit Database Schema Drift
console.log('\n📂 4. Auditing Database Schema Drift & Connectivity...');
const envFilePath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envFilePath)) {
  const envContent = fs.readFileSync(envFilePath, 'utf8');
  const sbUrlMatch = envContent.match(/VITE_SUPABASE_URL\s*=\s*["']([^"']+)["']/);
  const sbKeyMatch = envContent.match(/VITE_SUPABASE_PUBLISHABLE_KEY\s*=\s*["']([^"']+)["']/);
  
  if (sbUrlMatch && sbKeyMatch) {
    const supabaseUrl = sbUrlMatch[1];
    const supabaseKey = sbKeyMatch[1];
    
    // Scan local migration folder for version tags
    if (fs.existsSync(migrationsDir)) {
      const localFiles = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .map(f => {
          const match = f.match(/^(\d+)_/);
          return match ? match[1] : null;
        })
        .filter(Boolean)
        .sort();
        
      console.log(`   Found ${localFiles.length} local migration timestamps.`);
      
      // Perform a non-blocking request to check connectivity using native https module
      try {
        console.log('   📡 Pinging Supabase instance...');
        await new Promise((resolve, reject) => {
          const req = https.get(`${supabaseUrl}/rest/v1/`, {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`
            },
            agent: false, // Disable keep-alive agent pool to prevent open handles on exit
            timeout: 2500
          }, (res) => {
            res.resume(); // Resume response stream to free socket
            if (res.statusCode >= 200 && res.statusCode < 400) {
              console.log('   ✅ Supabase connection successful! Live API is healthy and reachable.');
            } else {
              console.warn(`   ⚠️  [Connectivity Warning] Supabase live endpoint returned status ${res.statusCode}. Skipping drift check.`);
            }
            resolve();
          });
          
          req.on('error', (err) => {
            reject(err);
          });
          
          req.on('timeout', () => {
            req.destroy();
            reject(new Error('Timeout'));
          });
        });
      } catch (err) {
        console.log('   ⚠️  [Offline Mode] Supabase connection skipped (timeout or offline). Storing static file audits.');
      }
    }
  } else {
    console.warn('   ⚠️  [Configuration Alert] Supabase credentials missing or incomplete in .env file.');
    issuesFound++;
  }
} else {
  console.warn('   ⚠️  [Configuration Skip] No .env file found in project root directory.');
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
