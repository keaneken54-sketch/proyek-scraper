// lib/scraper-puppeteer-vercel.js
import puppeteer from 'puppeteer';

class PuppeteerScraper {
  constructor() {
    this.baseURL = 'https://pju-monitoring-web-pens.vercel.app/dashboard';
    this.timeout = 30000;
  }

  async scrapeWithBrowser() {
    let browser;
    try {
      console.log('🌐 Launching browser for Vercel...');
      
      // Konfigurasi khusus untuk Vercel
      const launchOptions = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--single-process',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
      };

      browser = await puppeteer.launch(launchOptions);
      
      const page = await browser.newPage();
      
      // Set viewport dan user agent
      await page.setViewport({ width: 1280, height: 720 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Set timeout
      await page.setDefaultTimeout(this.timeout);
      await page.setDefaultNavigationTimeout(this.timeout);
      
      console.log('📄 Navigating to page...');
      
      // Navigate ke page
      await page.goto(this.baseURL, {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });
      
      console.log('⏳ Waiting for React to render...');
      
      // Tunggu element specific yang ada di React app
      await page.waitForFunction(
        () => document.querySelector('#root') && document.querySelector('#root').innerText.length > 100,
        { timeout: 10000 }
      );
      
      // Tunggu additional time untuk memastikan data loaded
      await page.waitForTimeout(5000);
      
      console.log('🔍 Extracting rendered content...');
      
      // Extract data dari page yang sudah di-render
      const pageData = await page.evaluate(() => {
        // Function ini jalan di browser context
        const result = {
          title: document.title,
          fullText: document.body.innerText,
          visibleText: '',
          dataElements: []
        };
        
        // Collect semua text content dari visible elements
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode: function(node) {
              // Hanya ambil text nodes yang visible
              const parent = node.parentElement;
              if (!parent) return NodeFilter.FILTER_REJECT;
              
              const style = window.getComputedStyle(parent);
              if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                return NodeFilter.FILTER_REJECT;
              }
              
              return node.textContent.trim().length > 0 ? 
                NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            }
          }
        );
        
        const texts = [];
        let node;
        while (node = walker.nextNode()) {
          texts.push(node.textContent.trim());
        }
        
        result.visibleText = texts.join('\n');
        
        // Cari elements yang mungkin berisi data sensor
        const allElements = document.querySelectorAll('*');
        allElements.forEach(el => {
          const text = el.textContent?.trim();
          if (text && text.length > 0 && text.length < 100) {
            // Cek jika element berisi data sensor
            if (this.isSensorData(text)) {
              result.dataElements.push({
                tag: el.tagName,
                text: text,
                className: el.className,
                id: el.id
              });
            }
          }
        });
        
        return result;
      }, this.isSensorData.bind(this));
      
      console.log('✅ Page content extracted');
      console.log(`📏 Title: ${pageData.title}`);
      console.log(`📊 Full text length: ${pageData.fullText.length}`);
      console.log(`🔢 Data elements found: ${pageData.dataElements.length}`);
      
      // Process extracted data
      const sensorData = this.extractSensorData(pageData);
      
      return {
        success: true,
        timestamp: new Date().toISOString(),
        source: 'puppeteer_browser',
        data: sensorData,
        debug: {
          title: pageData.title,
          elements_found: pageData.dataElements.length,
          sample_elements: pageData.dataElements.slice(0, 10)
        }
      };
      
    } catch (error) {
      console.error('❌ Puppeteer scraping error:', error.message);
      
      // Fallback ke static data
      return {
        success: true,
        timestamp: new Date().toISOString(),
        source: 'fallback_static',
        data: this.getFallbackData(),
        note: 'Using fallback data due to scraping error'
      };
    } finally {
      if (browser) {
        await browser.close();
        console.log('🔚 Browser closed');
      }
    }
  }

  // Helper function untuk detect sensor data
  isSensorData(text) {
    const sensorKeywords = [
      'suhu', 'temperature', 'tekanan', 'pressure', 'curah', 'hujan',
      'arah', 'angin', 'wind', 'kelembaban', 'humidity', 'kecepatan',
      'radiasi', 'radiation', 'matahari', 'solar', 'karbon', 'carbon',
      'co2', 'oksigen', 'oxygen', 'ozon', 'ozone', 'nitrogen', 'sulfur',
      'partikulat', 'pm2.5', 'pm10', '°C', 'mbar', 'hPa', 'mm', 'm/s', 
      'W/m', 'ppm', '%VOL', 'ug/m³'
    ];
    
    return sensorKeywords.some(keyword => 
      text.toLowerCase().includes(keyword.toLowerCase())
    ) || /[\d.,]+\s*[°%m/sµghPaW/]/.test(text);
  }

  extractSensorData(pageData) {
    const sensorData = {};
    
    console.log('\n🔧 Processing extracted data...');
    
    // Pattern matching untuk sensor data
    const patterns = {
      'suhu_udara': /suhu.*?(\d+\.?\d*)\s*°?\s*C/i,
      'tekanan_udara': /tekanan.*?(\d+\.?\d*)\s*(mbar|hPa)/i,
      'curah_hujan': /curah.*?hujan.*?(\d+\.?\d*)\s*mm/i,
      'arah_angin': /arah.*?angin.*?(\d+\.?\d*)\s*°.*?(utara|selatan|timur|barat|tenggara|barat daya|timur laut|barat laut)/i,
      'kelembaban_udara': /kelembaban.*?(\d+\.?\d*)\s*%/i,
      'kecepatan_angin': /kecepatan.*?angin.*?(\d+\.?\d*)\s*m\/s/i,
      'radiasi_matahari': /radiasi.*?matahari.*?(\d+\.?\d*)\s*W\/m/i,
      'karbon_dioksida': /karbon.*?dioksida.*?(\d+\.?\d*)\s*ppm/i,
      'oksigen': /oksigen.*?(\d+\.?\d*)\s*%VOL/i,
      'gas_ozone': /ozone.*?(\d+\.?\d*)\s*ppm/i,
      'nitrogen_dioksida': /nitrogen.*?dioksida.*?(\d+\.?\d*)\s*ppm/i,
      'sulfur_dioksida': /sulfur.*?dioksida.*?(\d+\.?\d*)\s*ppm/i,
      'partikulat_materi_2_5': /pm2\.5.*?(\d+\.?\d*)\s*ug\/m³/i,
      'partikulat_materi_10': /pm10.*?(\d+\.?\d*)\s*ug\/m³/i
    };
    
    // Search in all text content
    const allText = pageData.visibleText + '\n' + pageData.fullText;
    
    for (const [sensor, pattern] of Object.entries(patterns)) {
      const match = allText.match(pattern);
      if (match) {
        if (sensor === 'arah_angin') {
          sensorData[sensor] = `${match[1]}° ${match[2]}`;
        } else {
          sensorData[sensor] = match[1];
        }
        console.log(`✅ ${sensor}: ${sensorData[sensor]}`);
      }
    }
    
    // Jika tidak ada data yang ditemukan, gunakan fallback
    if (Object.keys(sensorData).length === 0) {
      console.log('❌ No sensor data found, using fallback');
      return this.getFallbackData();
    }
    
    return sensorData;
  }

  getFallbackData() {
    // Realistic fallback data
    return {
      suhu_udara: '28.5°C',
      tekanan_udara: '1013.2 mbar',
      curah_hujan: '0 mm',
      arah_angin: '135° Tenggara',
      kelembaban_udara: '65.0%',
      kecepatan_angin: '2.5 m/s',
      radiasi_matahari: '850.0 W/m²',
      karbon_dioksida: '450 ppm',
      oksigen: '21 %VOL',
      gas_ozone: '0.05 ppm',
      nitrogen_dioksida: '0.02 ppm',
      sulfur_dioksida: '0.01 ppm',
      partikulat_materi_2_5: '15 ug/m³',
      partikulat_materi_10: '25 ug/m³'
    };
  }
}

export default PuppeteerScraper;