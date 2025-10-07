// api/data.js
import PuppeteerScraper from '../lib/scraper-puppeteer-vercel.js';
import { formatForESP32Simple } from '../lib/utils.js';

const scraper = new PuppeteerScraper();

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    console.log('🔄 Starting Puppeteer scraping...');
    
    const scrapedData = await scraper.scrapeWithBrowser();
    
    // Format untuk ESP32
    const responseData = formatForESP32Simple(scrapedData);
    
    console.log(`✅ Data source: ${scrapedData.source}`);
    
    return res.status(200).json(responseData);

  } catch (error) {
    console.error('❌ API Error:', error);
    
    return res.status(500).json({
      success: false,
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
}