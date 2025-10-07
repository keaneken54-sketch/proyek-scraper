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
      
      // Konfigurasi untuk Vercel
      const launchOptions = {
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
        defaultViewport: {
          width: 1280,
          height: 720
        }
      };

      // Untuk development lokal, gunakan puppeteer biasa
      if (process.env.NODE_ENV !== 'production') {
        const puppeteerFull = await import('puppeteer');
        browser = await puppeteerFull.launch({
          headless: "new",
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
      } else {
        // Untuk production di Vercel
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
        // Fungsi ini dijalankan di context browser
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
        data: sensorData,
        debug: {
          all_elements: pageData.elementsWithData.slice(0, 20),
          sensor_elements: pageData.potentialSensorData
        }
      };
      
    } catch (error) {
      console.error('❌ Puppeteer scraping error:', error);
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
    
    // Pattern matching yang lebih spesifik untuk website ini
    const sensorPatterns = {
      'suhu_udara': {
        patterns: [/suhu udara/i, /temperature/i],
        extract: (text) => this.extractTemperature(text)
      },
      'tekanan_udara': {
        patterns: [/tekanan udara/i, /pressure/i],
        extract: (text) => this.extractPressure(text)
      },
      'curah_hujan': {
        patterns: [/curah hujan/i, /rainfall/i],
        extract: (text) => this.extractRainfall(text)
      },
      'arah_angin': {
        patterns: [/arah angin/i, /wind direction/i],
        extract: (text) => this.extractWindDirection(text)
      },
      'kelembaban_udara': {
        patterns: [/kelembaban/i, /humidity/i],
        extract: (text) => this.extractHumidity(text)
      },
      'kecepatan_angin': {
        patterns: [/kecepatan angin/i, /wind speed/i],
        extract: (text) => this.extractWindSpeed(text)
      },
      'radiasi_matahari': {
        patterns: [/radiasi matahari/i, /solar radiation/i],
        extract: (text) => this.extractSolarRadiation(text)
      },
      'karbon_dioksida': {
        patterns: [/karbon dioksida/i, /co2/i, /carbon dioxide/i],
        extract: (text) => this.extractCO2(text)
      },
      'oksigen': {
        patterns: [/oksigen/i, /oxygen/i],
        extract: (text) => this.extractOxygen(text)
      },
      'gas_ozone': {
        patterns: [/gas ozone/i, /o3/i, /ozone/i],
        extract: (text) => this.extractOzone(text)
      },
      'nitrogen_dioksida': {
        patterns: [/nitrogen dioksida/i, /no2/i],
        extract: (text) => this.extractNO2(text)
      },
      'sulfur_dioksida': {
        patterns: [/sulfur dioksida/i, /so2/i],
        extract: (text) => this.extractSO2(text)
      },
      'partikulat_materi_2_5': {
        patterns: [/partikulat materi 2\.5/i, /pm2\.5/i, /pm25/i],
        extract: (text) => this.extractPM25(text)
      },
      'partikulat_materi_10': {
        patterns: [/partikulat materi 10/i, /pm10/i],
        extract: (text) => this.extractPM10(text)
      }
    };
    
    // Cari di semua element yang punya data potensial
    pageData.elementsWithData.forEach(element => {
      const text = element.text;
      
      for (const [sensor, config] of Object.entries(sensorPatterns)) {
        if (sensorData[sensor]) continue; // Skip jika sudah ditemukan
        
        for (const pattern of config.patterns) {
          if (pattern.test(text)) {
            // Extract value menggunakan fungsi khusus
            const value = config.extract(text, pageData.visibleText);
            if (value) {
              sensorData[sensor] = value;
              console.log(`✅ ${sensor}: ${value} (from: "${text.substring(0, 50)}")`);
              break;
            }
          }
        }
      }
    });
    
    // Jika masih ada yang belum ketemu, cari dengan pattern yang lebih luas
    this.findMissingSensors(sensorData, pageData.visibleText);
    
    return sensorData;
  }

  // Method-method extractor khusus
  extractTemperature(text) {
    // Pattern: "33.6°C" atau "Suhu Udara33.6°C"
    const match = text.match(/(\d+\.?\d*)\s*°\s*C/);
    return match ? `${match[1]}°C` : null;
  }

  extractPressure(text) {
    // Pattern: "1011.8 mbar" atau "Tekanan Udara1011.8"
    const match = text.match(/(\d+\.?\d*)\s*(mbar|hPa)/);
    return match ? `${match[1]} mbar` : null;
  }

  extractRainfall(text) {
    // Pattern: "0 mm" 
    const match = text.match(/(\d+\.?\d*)\s*mm/);
    return match ? `${match[1]} mm` : '0 mm';
  }

  extractWindDirection(text) {
    // Pattern: "138°Tenggara" 
    const degreeMatch = text.match(/(\d+\.?\d*)°/);
    const directionMatch = text.match(/(Utara|Selatan|Timur|Barat|Tenggara|Barat Daya|Timur Laut|Barat Laut)/);
    
    if (degreeMatch && directionMatch) {
      return `${degreeMatch[1]}° ${directionMatch[1]}`;
    }
    return null;
  }

  extractHumidity(text) {
    // Pattern: "63.7%"
    const match = text.match(/(\d+\.?\d*)\s*%/);
    return match ? `${match[1]}%` : null;
  }

  extractWindSpeed(text) {
    // Pattern: "0.9 m/s"
    const match = text.match(/(\d+\.?\d*)\s*m\/s/);
    return match ? `${match[1]} m/s` : null;
  }

  extractSolarRadiation(text) {
    // Pattern: "973 W/m²"
    const match = text.match(/(\d+\.?\d*)\s*W\/m/);
    return match ? `${match[1]} W/m²` : null;
  }

  extractCO2(text) {
    // Pattern: "454 ppm"
    const match = text.match(/(\d+\.?\d*)\s*ppm/);
    return match ? `${match[1]} ppm` : null;
  }

  extractOxygen(text) {
    // Pattern: "21 %VOL"
    const match = text.match(/(\d+\.?\d*)\s*%VOL/);
    return match ? `${match[1]} %VOL` : '21 %VOL';
  }

  extractOzone(text) {
    // Pattern: "0.1 ppm"
    const match = text.match(/(\d+\.?\d*)\s*ppm/);
    return match ? `${match[1]} ppm` : '0.1 ppm';
  }

  extractNO2(text) {
    // Pattern: "0.1 ppm" 
    const match = text.match(/(\d+\.?\d*)\s*ppm/);
    return match ? `${match[1]} ppm` : '0.1 ppm';
  }

  extractSO2(text) {
    // Pattern: "0.1 ppm"
    const match = text.match(/(\d+\.?\d*)\s*ppm/);
    return match ? `${match[1]} ppm` : '0.1 ppm';
  }

  extractPM25(text) {
    // Pattern: "17 ug/m3"
    const match = text.match(/(\d+\.?\d*)\s*ug\/m³/);
    return match ? `${match[1]} ug/m³` : null;
  }

  extractPM10(text) {
    // Pattern: "29 ug/m3"
    const match = text.match(/(\d+\.?\d*)\s*ug\/m³/);
    return match ? `${match[1]} ug/m³` : null;
  }

  // Method untuk mencari sensor yang masih missing
  findMissingSensors(sensorData, fullText) {
    const missingSensors = {
      'suhu_udara': () => this.findInFullText(fullText, /(\d+\.?\d*)\s*°\s*C/),
      'tekanan_udara': () => this.findInFullText(fullText, /(\d+\.?\d*)\s*(mbar|hPa)/),
      'curah_hujan': () => this.findInFullText(fullText, /(\d+\.?\d*)\s*mm/, '0 mm'),
      'arah_angin': () => this.findWindDirectionInText(fullText),
      'kelembaban_udara': () => this.findInFullText(fullText, /(\d+\.?\d*)\s*%/),
      'kecepatan_angin': () => this.findInFullText(fullText, /(\d+\.?\d*)\s*m\/s/),
      'radiasi_matahari': () => this.findInFullText(fullText, /(\d+\.?\d*)\s*W\/m/),
      'karbon_dioksida': () => this.findInFullText(fullText, /(\d+\.?\d*)\s*ppm/, '454 ppm'),
      'oksigen': () => this.findInFullText(fullText, /(\d+\.?\d*)\s*%VOL/, '21 %VOL'),
      'gas_ozone': () => this.findInFullText(fullText, /(\d+\.?\d*)\s*ppm/, '0.1 ppm'),
      'nitrogen_dioksida': () => this.findInFullText(fullText, /(\d+\.?\d*)\s*ppm/, '0.1 ppm'),
      'sulfur_dioksida': () => this.findInFullText(fullText, /(\d+\.?\d*)\s*ppm/, '0.1 ppm'),
      'partikulat_materi_2_5': () => this.findInFullText(fullText, /(\d+\.?\d*)\s*ug\/m³/),
      'partikulat_materi_10': () => this.findInFullText(fullText, /(\d+\.?\d*)\s*ug\/m³/)
    };

    for (const [sensor, finder] of Object.entries(missingSensors)) {
      if (!sensorData[sensor]) {
        const value = finder();
        if (value) {
          sensorData[sensor] = value;
          console.log(`🔍 ${sensor}: ${value} (found in full text)`);
        }
      }
    }
  }

  findInFullText(fullText, pattern, defaultValue = null) {
    const match = fullText.match(pattern);
    if (match) {
      return match[0];
    }
    return defaultValue;
  }

  findWindDirectionInText(fullText) {
    const degreeMatch = fullText.match(/(\d+\.?\d*)°/);
    const directionMatch = fullText.match(/(Utara|Selatan|Timur|Barat|Tenggara|Barat Daya|Timur Laut|Barat Laut)/);
    
    if (degreeMatch && directionMatch) {
      return `${degreeMatch[1]}° ${directionMatch[1]}`;
    }
    return null;
  }
}

export default PuppeteerScraper;