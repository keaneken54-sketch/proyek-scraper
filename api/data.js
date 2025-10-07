// api/data.js
import PuppeteerScraper from '../lib/scraper-puppeteer.js';
import { formatForESP32Simple } from '../lib/utils.js';

const scraper = new PuppeteerScraper();

// Cache untuk mengurangi request berulang
let cache = {
  data: null,
  timestamp: null,
  ttl: 30000 // 30 detik
};

export default async function handler(req, res) {
  // Set CORS headers manually
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    res.status(405).json({
      success: false,
      error: 'Method not allowed. Use GET or OPTIONS.'
    });
    return;
  }

  try {
    console.log('🔄 Received API request...');

    // Check cache
    const now = Date.now();
    if (cache.data && cache.timestamp && (now - cache.timestamp) < cache.ttl) {
      console.log('⚡ Serving from cache');
      res.status(200).json(cache.data);
      return;
    }

    console.log('🌐 Starting Puppeteer scraping...');
    
    // Scrape data dengan Puppeteer
    const scrapedData = await scraper.scrapeWithBrowser();
    
    if (!scrapedData.success) {
      res.status(500).json({
        success: false,
        timestamp: new Date().toISOString(),
        error: scrapedData.error
      });
      return;
    }

    // Format untuk ESP32 (simple - numeric values only)
    const responseData = formatForESP32Simple(scrapedData);
    
    // Update cache
    cache = {
      data: responseData,
      timestamp: now,
      ttl: 30000
    };

    console.log('✅ Scraping completed successfully');
    
    res.status(200).json(responseData);

  } catch (error) {
    console.error('❌ API Error:', error);
    
    // Return cached data jika ada, meskipun error
    if (cache.data) {
      console.log('🔄 Returning cached data due to error');
      res.status(200).json({
        ...cache.data,
        note: 'Data from cache (recent error)',
        cached: true
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
}