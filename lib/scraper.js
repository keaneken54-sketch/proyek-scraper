// lib/scraper.js
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Main scraper class for PJU Monitoring website
 */
class PJUScraper {
  constructor() {
    this.baseURL = 'https://pju-monitoring-web-pens.vercel.app';
    this.timeout = 10000;
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
  }

  /**
   * Main method to scrape PJU data
   */
  async scrapeData() {
    try {
      console.log('🔄 Starting PJU data scraping...');
      
      // Try multiple methods to get data
      const results = {
        timestamp: new Date().toISOString(),
        source: 'pju_monitoring_dashboard',
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

      // Method 3: Try JavaScript data extraction
      const jsData = await this.extractJavaScriptData();
      if (jsData) {
        results.js_data = jsData;
        results.methods_tried.push('js_extraction_success');
      }

      // Combine all data
      const combinedData = this.combineData(results);
      
      console.log('✅ Scraping completed successfully');
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
   * Scrape data from HTML content
   */
  async scrapeFromHTML() {
    try {
      const response = await axios.get(`${this.baseURL}/dashboard`, this.axiosConfig);
      const $ = cheerio.load(response.data);
      
      const data = {};

      // Strategy 1: Look for common data card patterns
      const cardSelectors = [
        '.card',
        '.stat-card',
        '.data-card',
        '.metric-card',
        '[class*="card"]',
        '.MuiCard-root',
        '.ant-card'
      ];

      for (const selector of cardSelectors) {
        $(selector).each((index, element) => {
          const card = $(element);
          const title = this.extractText(card, ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', '.title', '.card-title', '.header']);
          const value = this.extractText(card, ['.value', '.number', '.data', '.metric', '.card-text', 'p', 'span']);
          
          if (title && value && this.isValidData(value)) {
            const key = this.normalizeKey(title);
            data[key] = this.cleanValue(value);
          }
        });
      }

      // Strategy 2: Look for table data
      $('table').each((index, table) => {
        $(table).find('tr').each((i, row) => {
          const cells = $(row).find('td, th');
          if (cells.length >= 2) {
            const key = this.normalizeKey($(cells[0]).text());
            const value = this.cleanValue($(cells[1]).text());
            
            if (key && value && this.isValidData(value)) {
              data[key] = value;
            }
          }
        });
      });

      // Strategy 3: Look for specific sensor data patterns
      const sensorPatterns = [
        { pattern: /tegangan|voltage|volt/i, key: 'tegangan' },
        { pattern: /arus|current|ampere/i, key: 'arus' },
        { pattern: /daya|power|watt/i, key: 'daya' },
        { pattern: /energi|energy|kwh/i, key: 'energi' },
        { pattern: /suhu|temperature|temp/i, key: 'suhu' },
        { pattern: /cahaya|light|lux|intensitas/i, key: 'intensitas_cahaya' },
        { pattern: /kelembaban|humidity/i, key: 'kelembaban' },
        { pattern: /tekanan|pressure/i, key: 'tekanan' }
      ];

      // Search in all elements for sensor data
      $('body *').each((index, element) => {
        const text = $(element).text().trim();
        if (text && text.length < 100) {
          for (const { pattern, key } of sensorPatterns) {
            if (pattern.test(text) && !data[key]) {
              // Found a sensor reading, try to extract value
              const value = this.extractValueFromText(text);
              if (value) {
                data[key] = value;
              }
            }
          }
        }
      });

      return data;

    } catch (error) {
      console.error('HTML scraping error:', error.message);
      return null;
    }
  }

  /**
   * Try to find and call API endpoints
   */
  async scrapeFromAPI() {
    const apiEndpoints = [
      '/api/data',
      '/api/sensors',
      '/api/monitoring',
      '/api/pju',
      '/api/reading',
      '/data',
      '/sensor-data',
      '/api/v1/data',
      '/api/v1/sensors'
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
        // Continue to next endpoint
        continue;
      }
    }

    return null;
  }

  /**
   * Extract data from JavaScript variables or scripts
   */
  async extractJavaScriptData() {
    try {
      const response = await axios.get(`${this.baseURL}/dashboard`, this.axiosConfig);
      const html = response.data;

      // Look for JSON data in script tags
      const jsonMatches = html.match(/JSON\.parse\(('|")(\{.*?\})('|")\)/g) || 
                         html.match(/const\s+(\w+)\s*=\s*(\{.*?\})/g) ||
                         html.match(/data\s*:\s*(\{.*?\})/g);

      const data = {};

      if (jsonMatches) {
        jsonMatches.forEach(match => {
          try {
            // Try to extract JSON object
            const jsonStr = match.replace(/JSON\.parse\(('|")/, '')
                                .replace(/('|")\)/, '')
                                .replace(/const\s+\w+\s*=\s*/, '')
                                .replace(/data\s*:\s*/, '');
            
            const jsonData = JSON.parse(jsonStr);
            Object.assign(data, this.flattenObject(jsonData));
          } catch (e) {
            // Skip invalid JSON
          }
        });
      }

      return Object.keys(data).length > 0 ? data : null;

    } catch (error) {
      console.error('JavaScript extraction error:', error.message);
      return null;
    }
  }

  /**
   * Helper methods
   */
  extractText(element, selectors) {
    for (const selector of selectors) {
      const text = element.find(selector).first().text().trim();
      if (text) return text;
    }
    return null;
  }

  normalizeKey(text) {
    return text.toLowerCase()
      .replace(/[^\w\s]/gi, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  cleanValue(value) {
    return value.replace(/\s+/g, ' ').trim();
  }

  isValidData(value) {
    // Filter out very long texts and common non-data elements
    return value && 
           value.length < 50 && 
           !value.includes('<!--') && 
           !value.includes('{') &&
           !value.includes('function(');
  }

  extractValueFromText(text) {
    // Extract numerical values with units
    const valueMatch = text.match(/(\d+[.,]?\d*)\s*([VvAaWwKkMm°°CcLlUuXx%]|Volt|Ampere|Watt|Lux|Celsius|Percent)?/);
    return valueMatch ? valueMatch[0] : null;
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

  combineData(results) {
    // Prioritize data sources: API > HTML > JS
    if (results.api_data) {
      return {
        data: results.api_data.data,
        source: 'api',
        ...results
      };
    } else if (results.html_data && Object.keys(results.html_data).length > 0) {
      return {
        data: results.html_data,
        source: 'html_scraping',
        ...results
      };
    } else if (results.js_data) {
      return {
        data: results.js_data,
        source: 'js_extraction',
        ...results
      };
    } else {
      // Fallback: return dummy data for testing
      return {
        data: this.getDummyData(),
        source: 'dummy_data',
        note: 'Real data not available - using dummy data for testing',
        ...results
      };
    }
  }

  getDummyData() {
    return {
      tegangan: '220.5 V',
      arus: '1.25 A',
      daya: '275.6 W',
      energi: '2.45 kWh',
      suhu: '28.3 °C',
      intensitas_cahaya: '450 Lux',
      kelembaban: '65 %',
      status_pju: 'ON',
      last_update: new Date().toLocaleString('id-ID')
    };
  }
}

export default PJUScraper;