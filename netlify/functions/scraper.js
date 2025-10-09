// netlify/functions/scraper.js
import PuppeteerScraper from '../../lib/scraper-puppeteer.js';

export const handler = async (event, context) => {
  console.log('🚀 Netlify Function started');
  
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Only allow GET
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const scraper = new PuppeteerScraper();
  
  try {
    console.log('🌐 Starting Puppeteer on Netlify...');
    const result = await scraper.scrapeWithBrowser();
    
    console.log('✅ Scraping completed on Netlify');
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result, null, 2)
    };
    
  } catch (error) {
    console.error('❌ Netlify function error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};