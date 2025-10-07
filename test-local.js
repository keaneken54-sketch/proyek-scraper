// test-local.js
import PuppeteerScraper from './lib/scraper-puppeteer.js';
import { formatForESP32Simple } from './lib/utils.js';

async function testLocal() {
  console.log('🧪 Testing scraper locally...\n');
  
  const scraper = new PuppeteerScraper();
  
  try {
    const result = await scraper.scrapeWithBrowser();
    console.log('Scraping result:', result.success);
    
    if (result.success) {
      const formatted = formatForESP32Simple(result);
      console.log('\n📦 Formatted data:');
      console.log(JSON.stringify(formatted, null, 2));
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testLocal();