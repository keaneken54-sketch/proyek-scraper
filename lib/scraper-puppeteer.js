// lib/scraper-puppeteer.js
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

class PuppeteerScraper {
  constructor() {
    this.baseURL = 'https://pju-monitoring-web-pens.vercel.app/dashboard';
    this.timeout = 25000;
  }

  async scrapeWithBrowser() {
    let browser;
    try {
      console.log('🌐 Launching browser for Vercel...');
      
      let launchOptions;
      
      // Untuk production di Vercel
      if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
        console.log('🚀 Running in Vercel environment');
        launchOptions = {
          args: chromium.args,
          executablePath: await chromium.executablePath(),
          headless: chromium.headless,
          defaultViewport: {
            width: 1280,
            height: 720
          }
        };
      } else {
        // Untuk development lokal
        console.log('💻 Running in local development');
        const puppeteerFull = await import('puppeteer');
        browser = await puppeteerFull.default.launch({
          headless: "new",
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
      }

      if (!browser) {
        browser = await puppeteer.launch(launchOptions);
      }
      
      const page = await browser.newPage();
      
      // Set user agent dan timeout
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      await page.setDefaultTimeout(this.timeout);
      await page.setDefaultNavigationTimeout(this.timeout);
      
      console.log('📄 Navigating to page...');
      await page.goto(this.baseURL, {
        waitUntil: 'domcontentloaded',
        timeout: this.timeout
      });
      
      console.log('⏳ Waiting for page content...');
      await page.waitForTimeout(5000);
      
      console.log('🔍 Extracting page content...');
      
      // Extract semua teks dari page yang sudah di-render
      const pageData = await page.evaluate(() => {
        const result = {
          title: document.title,
          allText: document.body.innerText,
          visibleText: '',
          elementsWithData: [],
          potentialSensorData: []
        };
        
        // Ambil semua teks yang visible
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
                className: el.className,
                id: el.id
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
           el.text.toLowerCase().includes('kelembaban') ||
           el.text.toLowerCase().includes('curah') ||
           el.text.toLowerCase().includes('hujan') ||
           el.text.toLowerCase().includes('radiasi') ||
           el.text.toLowerCase().includes('karbon') ||
           el.text.toLowerCase().includes('oksigen') ||
           el.text.toLowerCase().includes('ozon') ||
           el.text.toLowerCase().includes('nitrogen') ||
           el.text.toLowerCase().includes('sulfur') ||
           el.text.toLowerCase().includes('partikulat') ||
           el.text.toLowerCase().includes('pm'))
        );
        
        // Cari element dengan angka (potensi data sensor)
        visibleElements.forEach(el => {
          if (el.text.match(/[\d.,]+\s*[°%m/sµghPaW/]/) && el.text.length < 50) {
            result.potentialSensorData.push(el);
          }
        });
        
        return result;
      });
      
      console.log('✅ Page content extracted');
      console.log(`📏 Title: ${pageData.title}`);
      console.log(`📊 Visible text length: ${pageData.visibleText.length}`);
      console.log(`🎯 Elements with potential data: ${pageData.elementsWithData.length}`);
      console.log(`🔢 Potential sensor readings: ${pageData.potentialSensorData.length}`);
      
      // Process the extracted data
      const sensorData = this.extractSensorData(pageData);
      
      return {
        success: true,
        timestamp: new Date().toISOString(),
        source: 'puppeteer_browser',
        page_info: {
          title: pageData.title,
          text_length: pageData.visibleText.length,
          elements_found: pageData.elementsWithData.length,
          sensor_readings_found: pageData.potentialSensorData.length
        },
        data: sensorData
      };
      
    } catch (error) {
      console.error('❌ Puppeteer scraping error:', error.message);
      return {
        success: false,
        timestamp: new Date().toISOString(),
        error: error.message
      };
    } finally {
      if (browser) {
        await browser.close();
        console.log('🔚 Browser closed');
      }
    }
  }

  extractSensorData(pageData) {
    const sensorData = {};
    
    console.log('\n🔧 Processing extracted data...');
    
    const sensorPatterns = {
      'suhu_udara': { patterns: [/suhu udara/i], extract: (text) => this.extractTemperature(text) },
      'tekanan_udara': { patterns: [/tekanan udara/i], extract: (text) => this.extractPressure(text) },
      'curah_hujan': { patterns: [/curah hujan/i], extract: (text) => this.extractRainfall(text) },
      'arah_angin': { patterns: [/arah angin/i], extract: (text) => this.extractWindDirection(text) },
      'kelembaban_udara': { patterns: [/kelembaban/i], extract: (text) => this.extractHumidity(text) },
      'kecepatan_angin': { patterns: [/kecepatan angin/i], extract: (text) => this.extractWindSpeed(text) },
      'radiasi_matahari': { patterns: [/radiasi matahari/i], extract: (text) => this.extractSolarRadiation(text) },
      'karbon_dioksida': { patterns: [/karbon dioksida/i], extract: (text) => this.extractCO2(text) },
      'oksigen': { patterns: [/oksigen/i], extract: (text) => this.extractOxygen(text) },
      'gas_ozone': { patterns: [/gas ozone/i], extract: (text) => this.extractOzone(text) },
      'nitrogen_dioksida': { patterns: [/nitrogen dioksida/i], extract: (text) => this.extractNO2(text) },
      'sulfur_dioksida': { patterns: [/sulfur dioksida/i], extract: (text) => this.extractSO2(text) },
      'partikulat_materi_2_5': { patterns: [/partikulat materi 2\.5/i], extract: (text) => this.extractPM25(text) },
      'partikulat_materi_10': { patterns: [/partikulat materi 10/i], extract: (text) => this.extractPM10(text) }
    };
    
    pageData.elementsWithData.forEach(element => {
      const text = element.text;
      
      for (const [sensor, config] of Object.entries(sensorPatterns)) {
        if (sensorData[sensor]) continue;
        
        for (const pattern of config.patterns) {
          if (pattern.test(text)) {
            const value = config.extract(text);
            if (value) {
              sensorData[sensor] = value;
              console.log(`✅ ${sensor}: ${value}`);
              break;
            }
          }
        }
      }
    });
    
    return sensorData;
  }

  extractTemperature(text) {
    const match = text.match(/(\d+\.?\d*)\s*°\s*C/);
    return match ? `${match[1]}°C` : null;
  }

  extractPressure(text) {
    const match = text.match(/(\d+\.?\d*)\s*(mbar|hPa)/);
    return match ? `${match[1]} mbar` : null;
  }

  extractRainfall(text) {
    const match = text.match(/(\d+\.?\d*)\s*mm/);
    return match ? `${match[1]} mm` : '0 mm';
  }

  extractWindDirection(text) {
    const degreeMatch = text.match(/(\d+\.?\d*)°/);
    const directionMatch = text.match(/(Utara|Selatan|Timur|Barat|Tenggara|Barat Daya|Timur Laut|Barat Laut)/);
    if (degreeMatch && directionMatch) {
      return `${degreeMatch[1]}° ${directionMatch[1]}`;
    }
    return null;
  }

  extractHumidity(text) {
    const match = text.match(/(\d+\.?\d*)\s*%/);
    return match ? `${match[1]}%` : null;
  }

  extractWindSpeed(text) {
    const match = text.match(/(\d+\.?\d*)\s*m\/s/);
    return match ? `${match[1]} m/s` : null;
  }

  extractSolarRadiation(text) {
    const match = text.match(/(\d+\.?\d*)\s*W\/m/);
    return match ? `${match[1]} W/m²` : null;
  }

  extractCO2(text) {
    const match = text.match(/(\d+\.?\d*)\s*ppm/);
    return match ? `${match[1]} ppm` : null;
  }

  extractOxygen(text) {
    const match = text.match(/(\d+\.?\d*)\s*%VOL/);
    return match ? `${match[1]} %VOL` : '21 %VOL';
  }

  extractOzone(text) {
    const match = text.match(/(\d+\.?\d*)\s*ppm/);
    return match ? `${match[1]} ppm` : '0.1 ppm';
  }

  extractNO2(text) {
    const match = text.match(/(\d+\.?\d*)\s*ppm/);
    return match ? `${match[1]} ppm` : '0.1 ppm';
  }

  extractSO2(text) {
    const match = text.match(/(\d+\.?\d*)\s*ppm/);
    return match ? `${match[1]} ppm` : '0.1 ppm';
  }

  extractPM25(text) {
    const match = text.match(/(\d+\.?\d*)\s*ug\/m³/);
    return match ? `${match[1]} ug/m³` : null;
  }

  extractPM10(text) {
    const match = text.match(/(\d+\.?\d*)\s*ug\/m³/);
    return match ? `${match[1]} ug/m³` : null;
  }
}

export default PuppeteerScraper;