// server-local.js
import http from 'http';
import PuppeteerScraper from './lib/scraper-puppeteer.js';

const scraper = new PuppeteerScraper();

const server = http.createServer(async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (req.url === '/api/data' && req.method === 'GET') {
    try {
      console.log('🔄 Received API request...');
      
      const scrapedData = await scraper.scrapeWithBrowser();
      
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify(scrapedData, null, 2));
      
      console.log('✅ API response sent');
      
    } catch (error) {
      console.error('❌ Server error:', error);
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(500);
      res.end(JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }));
    }
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 Local server running at http://localhost:${PORT}/api/data`);
  console.log(`📡 Test with: curl http://localhost:${PORT}/api/data`);
  console.log(`🌐 Or open in browser: http://localhost:${PORT}/api/data`);
  console.log(`⏹️  Press Ctrl+C to stop\n`);
});