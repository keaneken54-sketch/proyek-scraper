// lib/scraper.js
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Main scraper class for PJU Monitoring website
 */
class PJUScraper {
  constructor() {
    this.baseURL = 'https://pju-monitoring-web-pens.vercel.app';
    this.timeout = 15000;
    this.axiosConfig = {
      timeout: this.timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      }
    };
    
    // Target sensor parameters
    this.targetSensors = {
      'suhu_udara': ['suhu', 'temperature', 'temp', 'udara'],
      'tekanan_udara': ['tekanan', 'pressure', 'udara'],
      'curah_hujan': ['curah', 'hujan', 'rainfall', 'precipitation'],
      'arah_angin': ['arah', 'angin', 'wind', 'direction'],
      'kelembaban_udara': ['kelembaban', 'humidity', 'lembap'],
      'kecepatan_angin': ['kecepatan', 'angin', 'wind', 'speed'],
      'radiasi_matahari': ['radiasi', 'matahari', 'solar', 'radiation'],
      'karbon_dioksida': ['karbon', 'co2', 'carbon', 'dioksida'],
      'oksigen': ['oksigen', 'oxygen', 'o2'],
      'gas_ozone': ['ozon', 'ozone', 'o3'],
      'nitrogen_dioksida': ['nitrogen', 'no2', 'dioksida'],
      'sulfur_dioksida': ['sulfur', 'so2', 'dioksida'],
      'partikulat_materi_2_5': ['partikulat', 'pm2.5', 'pm25', '2.5'],
      'partikulat_materi_10': ['partikulat', 'pm10', '10']
    };
  }

  /**
   * Main method to scrape PJU data
   */
  async scrapeData() {
    try {
      console.log('🔄 Starting Environmental Data Scraping...');
      
      const results = {
        timestamp: new Date().toISOString(),
        source: 'environmental_monitoring_dashboard',
        methods_tried: []
      };

      // Method 1: Direct HTML scraping from dashboard
      const htmlData = await this.scrapeFromHTML();
      if (htmlData && Object.keys(htmlData).length > 0) {
        results.html_data = htmlData;
        results.methods_tried.push('html_scraping_success');
      } else {
        results.methods_tried.push('html_scraping_failed');
      }

      // Method 2: Try to find API endpoints
      const apiData = await this.scrapeFromAPI();
      if (apiData) {
        results.api_data = apiData;
        results.methods_tried.push('api_scraping_success');
      } else {
        results.methods_tried.push('api_scraping_failed');
      }

      // Combine all data
      const combinedData = this.combineData(results);
      
      console.log('✅ Environmental data scraping completed');
      return {
        success: true,
        ...combinedData
      };

    } catch (error) {
      console.error('❌ Scraping error:', error);
      return {
        success: false,
        timestamp: new Date().toISOString(),
        error: error.message,
        methods_tried: ['all_methods_failed']
      };
    }
  }

  /**
   * Scrape data from HTML content dengan fokus sensor lingkungan
   */
  async scrapeFromHTML() {
    try {
      const response = await axios.get(`${this.baseURL}/dashboard`, this.axiosConfig);
      const $ = cheerio.load(response.data);
      
      const data = {};

      console.log('🔍 Scanning for environmental sensors...');

      // Strategy 1: Cari berdasarkan pattern sensor yang ditargetkan
      this.scanForTargetSensors($, data);

      // Strategy 2: Cari dalam cards/containers
      this.scanInContainers($, data);

      // Strategy 3: Cari dalam tables
      this.scanInTables($, data);

      // Strategy 4: Cari dalam semua elemen text
      this.scanAllText($, data);

      // Clean and validate data
      const cleanedData = this.cleanSensorData(data);
      
      console.log(`📊 Found ${Object.keys(cleanedData).length} sensor readings`);
      return cleanedData;

    } catch (error) {
      console.error('HTML scraping error:', error.message);
      return null;
    }
  }

  /**
   * Scan for target sensors specifically
   */
  scanForTargetSensors($, data) {
    // Cari elemen yang mengandung nama sensor target
    for (const [sensorKey, keywords] of Object.entries(this.targetSensors)) {
      const searchPattern = new RegExp(keywords.join('|'), 'i');
      
      // Cari di semua elemen
      $('*').each((index, element) => {
        const text = $(element).text().trim();
        if (searchPattern.test(text) && text.length < 100) {
          const value = this.extractSensorValue($, element, text);
          if (value && !data[sensorKey]) {
            data[sensorKey] = value;
            console.log(`✅ Found ${sensorKey}: ${value}`);
          }
        }
      });
    }
  }

  /**
   * Scan dalam container yang umum
   */
  scanInContainers($, data) {
    const containerSelectors = [
      '.card', '.stat-card', '.data-card', '.metric-card',
      '.sensor-card', '.environment-card', '.weather-card',
      '[class*="card"]', '[class*="sensor"]', '[class*="data"]',
      '.MuiCard-root', '.ant-card', '.box', '.panel'
    ];

    containerSelectors.forEach(selector => {
      $(selector).each((index, element) => {
        const card = $(element);
        const cardText = card.text().trim();
        
        // Cek jika card berisi sensor data
        for (const [sensorKey, keywords] of Object.entries(this.targetSensors)) {
          const hasKeyword = keywords.some(keyword => 
            new RegExp(keyword, 'i').test(cardText)
          );
          
          if (hasKeyword) {
            const value = this.extractValueFromCard(card, cardText);
            if (value && !data[sensorKey]) {
              data[sensorKey] = value;
            }
          }
        }
      });
    });
  }

  /**
   * Scan dalam tables
   */
  scanInTables($, data) {
    $('table').each((index, table) => {
      $(table).find('tr').each((i, row) => {
        const cells = $(row).find('td, th');
        if (cells.length >= 2) {
          const label = $(cells[0]).text().trim().toLowerCase();
          const value = $(cells[1]).text().trim();
          
          // Match dengan sensor target
          for (const [sensorKey, keywords] of Object.entries(this.targetSensors)) {
            const hasMatch = keywords.some(keyword => 
              label.includes(keyword.toLowerCase())
            );
            
            if (hasMatch && value && !data[sensorKey]) {
              data[sensorKey] = this.cleanValue(value);
            }
          }
        }
      });
    });
  }

  /**
   * Scan semua text content
   */
  scanAllText($, data) {
    $('body *').each((index, element) => {
      const text = $(element).text().trim();
      if (text && text.length < 80) {
        // Coba ekstrak pattern "Label: Value" atau "Value Unit"
        this.extractFromTextPattern(text, data);
      }
    });
  }

  /**
   * Extract value from card element
   */
  extractValueFromCard(card, cardText) {
    // Coba berbagai selector untuk value
    const valueSelectors = [
      '.value', '.number', '.data', '.metric',
      '.reading', '.measurement', '.result',
      'h1', 'h2', 'h3', 'h4', '.display-1', '.display-2',
      'strong', 'b', '.font-weight-bold'
    ];

    for (const selector of valueSelectors) {
      const valueElem = card.find(selector).first();
      if (valueElem.length) {
        const value = valueElem.text().trim();
        if (this.isValidSensorValue(value)) {
          return this.cleanValue(value);
        }
      }
    }

    // Fallback: extract numbers from card text
    return this.extractValueFromText(cardText);
  }

  /**
   * Extract sensor value from element context
   */
  extractSensorValue($, element, text) {
    const $element = $(element);
    
    // Coba ambil dari sibling atau parent
    const possibleValueElements = [
      $element.next(),
      $element.prev(),
      $element.parent().find('.value, .number, .data'),
      $element.siblings().filter((i, el) => {
        const siblingText = $(el).text().trim();
        return this.looksLikeValue(siblingText);
      })
    ];

    for (const valueElem of possibleValueElements) {
      if (valueElem.length) {
        const value = valueElem.first().text().trim();
        if (this.isValidSensorValue(value)) {
          return this.cleanValue(value);
        }
      }
    }

    // Extract dari text langsung
    return this.extractValueFromText(text);
  }

  /**
   * Extract from text patterns
   */
  extractFromTextPattern(text, data) {
    // Pattern: "Suhu: 25.5°C" atau "25.5°C Suhu"
    const patterns = [
      /([a-zA-Z\s]+):\s*([\d.,]+\s*[°a-zA-Z%]*)/gi,
      /([\d.,]+\s*[°a-zA-Z%]*)\s*([a-zA-Z\s]+)/gi
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const [fullMatch, group1, group2] = match;
        
        if (this.looksLikeValue(group1) && this.looksLikeLabel(group2)) {
          this.matchSensorData(group2.trim(), group1.trim(), data);
        } else if (this.looksLikeValue(group2) && this.looksLikeLabel(group1)) {
          this.matchSensorData(group1.trim(), group2.trim(), data);
        }
      }
    }
  }

  /**
   * Match sensor data dengan target sensors
   */
  matchSensorData(label, value, data) {
    const labelLower = label.toLowerCase();
    
    for (const [sensorKey, keywords] of Object.entries(this.targetSensors)) {
      const hasMatch = keywords.some(keyword => 
        labelLower.includes(keyword.toLowerCase())
      );
      
      if (hasMatch && !data[sensorKey]) {
        data[sensorKey] = this.cleanValue(value);
        console.log(`🎯 Matched ${sensorKey} from "${label}": ${value}`);
      }
    }
  }

  /**
   * Helper methods
   */
  looksLikeValue(text) {
    return /^[\d.,]+\s*[°a-zA-Z%]*$/.test(text.trim());
  }

  looksLikeLabel(text) {
    return /^[a-zA-Z\s]+$/.test(text.trim()) && text.length < 30;
  }

  isValidSensorValue(value) {
    return value && 
           value.length < 20 && 
           !value.includes('{') &&
           !value.includes('function') &&
           !value.includes('//');
  }

  extractValueFromText(text) {
    const valueMatch = text.match(/([\d.,]+)\s*([°a-zA-Z%\/]*)/);
    return valueMatch ? valueMatch[0].trim() : null;
  }

  cleanValue(value) {
    return value.replace(/\s+/g, ' ').trim();
  }

  cleanSensorData(data) {
    const cleaned = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (value && this.isValidSensorValue(value)) {
        // Convert to number if possible
        const numMatch = value.match(/([\d.,]+)/);
        if (numMatch) {
          const numValue = parseFloat(numMatch[1].replace(',', '.'));
          if (!isNaN(numValue)) {
            cleaned[key] = numValue;
          } else {
            cleaned[key] = value;
          }
        } else {
          cleaned[key] = value;
        }
      }
    }
    
    return cleaned;
  }

  /**
   * Try to find and call API endpoints
   */
  async scrapeFromAPI() {
    const apiEndpoints = [
      '/api/data',
      '/api/sensors',
      '/api/environment',
      '/api/weather',
      '/api/monitoring',
      '/api/pju',
      '/data',
      '/sensor-data',
      '/environment-data',
      '/weather-data'
    ];

    for (const endpoint of apiEndpoints) {
      try {
        const response = await axios.get(`${this.baseURL}${endpoint}`, {
          ...this.axiosConfig,
          timeout: 5000
        });

        if (response.data && typeof response.data === 'object') {
          console.log(`✅ Found API endpoint: ${endpoint}`);
          return {
            endpoint,
            data: response.data
          };
        }
      } catch (error) {
        continue;
      }
    }

    return null;
  }

  combineData(results) {
    if (results.api_data) {
      return {
        data: this.filterTargetSensors(results.api_data.data),
        source: 'api',
        ...results
      };
    } else if (results.html_data && Object.keys(results.html_data).length > 0) {
      return {
        data: results.html_data,
        source: 'html_scraping',
        ...results
      };
    } else {
      return {
        data: this.getDummyEnvironmentalData(),
        source: 'dummy_data',
        note: 'Real data not available - using environmental dummy data',
        ...results
      };
    }
  }

  filterTargetSensors(apiData) {
    const filtered = {};
    const flatData = this.flattenObject(apiData);
    
    for (const [key, value] of Object.entries(flatData)) {
      const keyLower = key.toLowerCase();
      
      for (const [sensorKey, keywords] of Object.entries(this.targetSensors)) {
        const hasMatch = keywords.some(keyword => 
          keyLower.includes(keyword.toLowerCase())
        );
        
        if (hasMatch && !filtered[sensorKey]) {
          filtered[sensorKey] = value;
        }
      }
    }
    
    return filtered;
  }

  flattenObject(obj, prefix = '') {
    let result = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}_${key}` : key;
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(result, this.flattenObject(value, newKey));
      } else {
        result[newKey] = value;
      }
    }
    
    return result;
  }

  getDummyEnvironmentalData() {
    return {
      suhu_udara: 28.5,
      tekanan_udara: 1013.25,
      curah_hujan: 0.0,
      arah_angin: 'Utara',
      kelembaban_udara: 65.0,
      kecepatan_angin: 3.2,
      radiasi_matahari: 450.0,
      karbon_dioksida: 412.5,
      oksigen: 20.95,
      gas_ozone: 0.05,
      nitrogen_dioksida: 0.02,
      sulfur_dioksida: 0.01,
      partikulat_materi_2_5: 12.3,
      partikulat_materi_10: 23.4
    };
  }
}

export default PJUScraper;