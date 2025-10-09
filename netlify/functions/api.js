// netlify/functions/api.js
import puppeteer from 'puppeteer';

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

  let browser;
  try {
    console.log('🌐 Launching Puppeteer on Netlify...');
    
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    console.log('📄 Navigating to page...');
    await page.goto('https://pju-monitoring-web-pens.vercel.app/dashboard', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    console.log('⏳ Waiting for page to load...');
    await page.waitForTimeout(8000);
    
    console.log('🔍 Extracting data...');
    
    const pageData = await page.evaluate(() => {
      const result = {
        title: document.title,
        allText: document.body.innerText,
        visibleText: '',
        elementsWithData: []
      };
      
      const allElements = document.querySelectorAll('*');
      const visibleElements = [];
      
      allElements.forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null) {
          const text = el.textContent?.trim();
          if (text && text.length > 0) {
            visibleElements.push({
              tag: el.tagName,
              text: text,
              className: el.className
            });
          }
        }
      });
      
      result.visibleText = visibleElements.map(el => el.text).join('\n');
      result.elementsWithData = visibleElements.filter(el => 
        el.text.length < 100 && 
        (/\d/.test(el.text) || 
         el.text.toLowerCase().includes('suhu') ||
         el.text.toLowerCase().includes('tekanan') ||
         el.text.toLowerCase().includes('angin') ||
         el.text.toLowerCase().includes('kelembaban'))
      );
      
      return result;
    });
    
    console.log('✅ Page content extracted');
    
    // Extract sensor data
    const sensorData = extractSensorData(pageData.visibleText);
    
    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      source: 'netlify_puppeteer',
      data: sensorData
    };
    
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
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔚 Browser closed');
    }
  }
};

function extractSensorData(text) {
  const data = {};
  
  const patterns = {
    suhu_udara: /suhu.*?(\d+\.?\d*)\s*°?\s*C/gi,
    tekanan_udara: /tekanan.*?(\d+\.?\d*)\s*(mbar|hPa)/gi,
    kelembaban_udara: /kelembaban.*?(\d+\.?\d*)\s*%/gi,
    kecepatan_angin: /kecepatan.*?angin.*?(\d+\.?\d*)\s*m\/s/gi,
    arah_angin: /arah.*?angin.*?(\d+\.?\d*)\s*°.*?(utara|selatan|timur|barat|tenggara|barat daya|timur laut|barat laut)/gi,
    curah_hujan: /curah.*?hujan.*?(\d+\.?\d*)\s*mm/gi,
    radiasi_matahari: /radiasi.*?matahari.*?(\d+\.?\d*)\s*W\/m/gi,
    karbon_dioksida: /karbon.*?dioksida.*?(\d+\.?\d*)\s*ppm/gi,
    oksigen: /oksigen.*?(\d+\.?\d*)\s*%VOL/gi
  };
  
  for (const [sensor, pattern] of Object.entries(patterns)) {
    const matches = [...text.matchAll(pattern)];
    if (matches.length > 0) {
      const match = matches[0];
      if (sensor === 'arah_angin') {
        data[sensor] = `${match[1]}° ${match[2]}`;
      } else if (sensor === 'tekanan_udara') {
        data[sensor] = `${match[1]} ${match[2]}`;
      } else {
        data[sensor] = match[1];
      }
      console.log(`✅ ${sensor}: ${data[sensor]}`);
    }
  }
  
  return data;
}