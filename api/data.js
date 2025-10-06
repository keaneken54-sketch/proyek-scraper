// api/data.js (updated version)
import PJUScraper from '../lib/scraper.js';
import { logData, formatForESP32, isValidData } from '../lib/utils.js';

const scraper = new PJUScraper();

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');

  // Handle OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    console.log('🔄 Received request for PJU data');
    
    // Scrape data
    const scrapedData = await scraper.scrapeData();
    
    // Log the data
    logData(scrapedData, 'Vercel API');
    
    // Format for ESP32
    const responseData = formatForESP32(scrapedData);
    
    // Send response
    return res.status(200).json(responseData);

  } catch (error) {
    console.error('❌ API Error:', error);
    
    return res.status(500).json({
      success: false,
      timestamp: new Date().toISOString(),
      error: error.message,
      note: 'Check server logs for details'
    });
  }
}