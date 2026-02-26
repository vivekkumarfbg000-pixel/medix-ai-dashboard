import puppeteer from 'puppeteer-core';

(async () => {
    try {
        const browser = await puppeteer.launch({
            headless: 'new',
            executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
            args: ['--no-sandbox']
        });
        const page = await browser.newPage();

        let logs = [];

        page.on('console', msg => {
            const text = msg.text();
            logs.push(`[Console ${msg.type()}] ${text}`);
            console.log(`[PAGE LOG] ${msg.type()}:`, text);
        });

        page.on('pageerror', error => {
            logs.push(`[Page Error] ${error.message}`);
            console.log('[PAGE ERROR]:', error.message);
        });

        page.on('requestfailed', request => {
            console.log(`[Request Failed]: ${request.url()} - ${request.failure()?.errorText}`);
        });

        console.log('Navigating to http://localhost:8081...');
        await page.goto('http://localhost:8081', { waitUntil: 'networkidle0', timeout: 15000 });

        console.log('Page loaded. Wait a moment for any async errors...');
        await new Promise(r => setTimeout(r, 2000));

        const rootContent = await page.evaluate(() => {
            return {
                html: document.body.innerHTML,
                errorDisplay: document.getElementById('global-error-display') ? document.getElementById('global-error-display').style.display : null
            };
        });

        console.log('\n--- Root Content Preview ---');
        console.log('Error Display Status:', rootContent.errorDisplay);
        console.log('Body Length:', rootContent.html.length);
        import('fs').then(fs => fs.writeFileSync('page_dump.html', rootContent.html));

        await browser.close();
        console.log('Done.');
    } catch (error) {
        console.error('Script failed:', error);
        process.exit(1);
    }
})();
