// test-local.js
import PuppeteerScraper from './lib/scraper-puppeteer.js';

async function testLocal() {
  console.log('🧪 Testing Puppeteer locally...\n');
  
  const scraper = new PuppeteerScraper();
  
  try {
    const result = await scraper.scrapeWithBrowser();
    
    console.log('='.repeat(50));
    console.log('📋 RESULT:');
    console.log('='.repeat(50));
    
    console.log('Success:', result.success);
    console.log('Source:', result.source);
    console.log('Timestamp:', result.timestamp);
    
    if (result.data) {
      console.log('\n📊 SENSOR DATA:');
      Object.entries(result.data).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    }
    
    if (result.note) {
      console.log('\n💡 Note:', result.note);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testLocal();