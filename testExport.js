const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: 'new'
    });
    const page = await browser.newPage();

    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', error => console.error('BROWSER ERROR:', error.message));

    try {
        console.log("Navigating to http://localhost:20000");
        await page.goto('http://localhost:20000', { waitUntil: 'networkidle0' });

        console.log("Waiting for data load...");
        // Click on the active tab or just wait for table if data is there
        // Assuming default search is triggered or we need to click "Apply Filters"
        // Let's click "開始智能篩選"
        const searchBtn = await page.$('button.bg-brand-primary');
        if (searchBtn) {
            console.log("Found search button, clicking...");
            await searchBtn.click();
            await new Promise(r => setTimeout(r, 2000));
        }

        console.log("Waiting for EXCEL button to appear...");
        // Wait for the EXCEL button
        await page.waitForFunction(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            return btns.some(b => b.textContent && b.textContent.includes('EXCEL'));
        }, { timeout: 10000 });

        console.log("Clicking EXCEL button...");
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const excelBtn = btns.find(b => b.textContent && b.textContent.includes('EXCEL'));
            if (excelBtn) {
                console.log("Found EXCEL btn. Click triggered in DOM.");
                excelBtn.click();
            } else {
                console.log("EXCEL btn NOT found in DOM.");
            }
        });

        // wait 2 seconds to see if any alert or error happens
        await new Promise(r => setTimeout(r, 2000));

        console.log("Test finished.");
    } catch (e) {
        console.error("TEST FAILED:", e);
    } finally {
        await browser.close();
    }
})();
