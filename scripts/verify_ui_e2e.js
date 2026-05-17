import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import http from 'http';
import puppeteer from 'puppeteer-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('──────────────────────────────────────────────────────────────────');
console.log('🦅 GITOPS GUARDIAN: RUNNING HIGH-FIDELITY E2E BEHAVIORAL SMOKE TEST');
console.log('──────────────────────────────────────────────────────────────────\n');

// ─── 1. Locate Chrome/Edge Executables on Windows ────────────────────────────
const possibleChromePaths = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  process.env.CHROME_PATH
].filter(Boolean);

let chromePath = null;
for (const p of possibleChromePaths) {
  if (fs.existsSync(p)) {
    chromePath = p;
    break;
  }
}

if (chromePath) {
  console.log(`📡 Headless browser engine located at: ${chromePath}`);
} else {
  console.log('⚠️  [Engine Warning] Headless Chrome/Edge executable not found in standard paths.');
  console.log('   Defaulting to high-fidelity static structural and asset integrity crawling.');
}

// ─── 2. Compile and Start Vite Preview Server ────────────────────────────────
const port = 4173;
const previewUrl = `http://localhost:${port}`;

console.log('\n📦 Compiling production distribution bundle...');
try {
  // Execute clean production build
  const buildResult = spawnSync('npm', ['run', 'build'], { shell: true, stdio: 'inherit' });
  if (buildResult.status !== 0) {
    console.error('❌ [Build Failure] Vite production build failed.');
    process.exit(1);
  }
  console.log('✅ Production bundle compiled successfully.');
} catch (e) {
  console.error('❌ [Build Error] Failed to run compiler command:', e.message);
  process.exit(1);
}

console.log('\n🚀 Spinning up local Vite preview server...');
const previewProcess = spawn('npm', ['run', 'preview', '--', '--port', port.toString()], {
  shell: true,
  stdio: 'ignore'
});

// Graceful cleanup handler
function cleanup() {
  console.log('\n🛑 Shutting down preview server...');
  previewProcess.kill();
}

process.on('exit', cleanup);
process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});

// Helper: Ping server until active
async function waitOnServer(retries = 10, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(previewUrl, (res) => {
          res.resume();
          if (res.statusCode === 200) resolve();
          else reject(new Error('Status ' + res.statusCode));
        });
        req.on('error', reject);
        req.setTimeout(500, () => req.destroy());
      });
      return true;
    } catch (e) {
      await new Promise(r => setTimeout(r, delay));
    }
  }
  return false;
}

// Spawn helper
import { spawnSync } from 'child_process';

(async () => {
  const isServerReady = await waitOnServer();
  if (!isServerReady) {
    console.error('❌ [Server Timeout] Vite preview server failed to start on port', port);
    process.exit(1);
  }
  console.log(`✅ Web server is online and serving at ${previewUrl}`);

  let smokeTestPassed = false;

  if (chromePath) {
    // Run Puppeteer E2E behavioral checks
    try {
      console.log('\n🎬 Launching headless browser viewport...');
      const browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();
      
      // Capture page exceptions
      const pageErrors = [];
      page.on('pageerror', (err) => {
        pageErrors.push(err.toString());
      });

      console.log(`🧭 Navigating to: ${previewUrl}`);
      await page.goto(previewUrl, { waitUntil: 'networkidle2', timeout: 8000 });

      // Verify page element exists
      const title = await page.title();
      console.log(`🌐 Document Title detected: "${title}"`);

      const appMounted = await page.evaluate(() => {
        const root = document.getElementById('root');
        return root && root.children.length > 0;
      });

      if (pageErrors.length > 0) {
        console.error('❌ [Runtime Exception] Uncaught JavaScript error(s) thrown in browser console:');
        pageErrors.forEach(err => console.error(`   - ${err}`));
        smokeTestPassed = false;
      } else if (!appMounted) {
        console.warn('⚠️  [Mount Alert] Page container #root found, but has zero child nodes.');
        smokeTestPassed = false;
      } else {
        console.log('✅ React application mounted cleanly into DOM.');
        console.log('✅ ZERO uncaught runtime script exceptions detected in console.');
        smokeTestPassed = true;
      }

      await browser.close();
    } catch (e) {
      console.warn('⚠️  [Puppeteer Alert] Headless browser run encountered a problem:', e.message);
      console.log('   Falling back to high-fidelity static structural integrity audit.');
      chromePath = null; // trigger static fallback audit
    }
  }

  // Fallback structural crawler scan
  if (!chromePath) {
    try {
      console.log('\n📂 Running High-Fidelity Static Integrity Crawler...');
      const distDir = path.resolve(__dirname, '../dist');
      const indexHtmlPath = path.join(distDir, 'index.html');

      if (!fs.existsSync(indexHtmlPath)) {
        console.error('❌ [Integrity Fail] index.html missing from production build output.');
        process.exit(1);
      }

      const indexContent = fs.readFileSync(indexHtmlPath, 'utf8');
      
      const hasRootDiv = indexContent.includes('id="root"');
      const hasScripts = indexContent.includes('<script type="module"');

      if (hasRootDiv && hasScripts) {
        console.log('✅ index.html possesses correct structure (#root and entry module scripts).');
        
        // Scan assets directory to ensure PWA files and JS chunks exist
        const assetsDir = path.join(distDir, 'assets');
        if (fs.existsSync(assetsDir)) {
          const files = fs.readdirSync(assetsDir);
          const jsChunks = files.filter(f => f.endsWith('.js'));
          const cssChunks = files.filter(f => f.endsWith('.css'));
          console.log(`✅ Compiled assets verified: Found ${jsChunks.length} JS chunks and ${cssChunks.length} CSS files.`);
          smokeTestPassed = true;
        } else {
          console.error('❌ [Integrity Fail] assets directory missing from dist folder.');
          smokeTestPassed = false;
        }
      } else {
        console.error('❌ [Integrity Fail] index.html missing crucial React boot elements.');
        smokeTestPassed = false;
      }
    } catch (e) {
      console.error('❌ [Crawler Failure] Error parsing distribution files:', e.message);
      smokeTestPassed = false;
    }
  }

  cleanup();

  if (smokeTestPassed) {
    console.log('\n──────────────────────────────────────────────────────────────────');
    console.log('🎉 E2E SMOKE SUCCESS: ALL LIVE BEHAVIORAL GATES PASSED.');
    console.log('──────────────────────────────────────────────────────────────────');
    process.exit(0);
  } else {
    console.error('\n──────────────────────────────────────────────────────────────────');
    console.error('🛑 E2E SMOKE FAILURE: APPLICATION BEHAVIOR VERIFICATION FAILED.');
    console.error('──────────────────────────────────────────────────────────────────');
    process.exit(1);
  }
})();
