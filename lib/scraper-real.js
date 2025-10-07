// lib/scraper-real.js
import axios from 'axios';
import * as cheerio from 'cheerio';

class RealPJUScraper {
  constructor() {
    this.baseURL = 'https://pju-monitoring-web-pens.vercel.app';
    this.timeout = 20000;
  }

  async scrapeRealData() {
    try {
      console.log('🚀 SCRAPING REAL DATA FROM WEBSITE...\n');
      
      const response = await axios.get(`${this.baseURL}/dashboard`, {
        timeout: this.timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      const realData = {};

      console.log('🔍 Mencari data sensor di HTML...\n');

      // METHOD 1: Cari berdasarkan pola teks
      this.extractByTextPattern($, realData);

      // METHOD 2: Cari di semua element dengan angka + unit
      this.extractNumberWithUnits($, realData);

      // METHOD 3: Cari di specific elements
      this.extractFromSpecificElements($, realData);

      // METHOD 4: Debug - tampilkan semua teks yang mungkin relevan
      this.debugRelevantText($);

      console.log('\n📊 HASIL SCRAPING REAL:');
      console.log(realData);

      return {
        success: true,
        timestamp: new Date().toISOString(),
        source: 'real_website_scraping',
        data: realData,
        note: Object.keys(realData).length === 0 ? 
          'Tidak ada data yang ditemukan. Perlu analisis struktur website lebih lanjut.' :
          'Data berhasil di-scrape dari website'
      };

    } catch (error) {
      console.error('❌ Error scraping real data:', error.message);
      return {
        success: false,
        timestamp: new Date().toISOString(),
        error: error.message,
        data: {}
      };
    }
  }

  extractByTextPattern($, data) {
    const patterns = {
      'suhu_udara': [/suhu/i, /temperature/i, /temp/i],
      'tekanan_udara': [/tekanan/i, /pressure/i],
      'curah_hujan': [/curah/i, /hujan/i, /rainfall/i],
      'arah_angin': [/arah angin/i, /wind direction/i],
      'kelembaban_udara': [/kelembaban/i, /humidity/i],
      'kecepatan_angin': [/kecepatan angin/i, /wind speed/i],
      'radiasi_matahari': [/radiasi/i, /radiation/i, /solar/i],
      'karbon_dioksida': [/karbon/i, /co2/i, /carbon/i],
      'oksigen': [/oksigen/i, /oxygen/i],
      'gas_ozone': [/ozon/i, /ozone/i],
      'nitrogen_dioksida': [/nitrogen/i, /no2/i],
      'sulfur_dioksida': [/sulfur/i, /so2/i],
      'partikulat_materi_2_5': [/pm2\.5/i, /pm25/i, /partikulat.*2\.5/i],
      'partikulat_materi_10': [/pm10/i, /partikulat.*10/i]
    };

    console.log('🎯 Mencari berdasarkan pola teks...');
    
    for (const [sensor, regexPatterns] of Object.entries(patterns)) {
      let found = false;
      
      for (const pattern of regexPatterns) {
        const elements = $(`*:contains(${pattern.source.replace(/[^\w\s]/g, '')})`);
        
        elements.each((i, el) => {
          if (found) return;
          
          const element = $(el);
          const text = element.text().trim();
          
          if (pattern.test(text) && text.length < 100) {
            // Coba ambil value dari element atau sibling/parent
            const value = this.extractValueNearby($, element, text);
            if (value && !data[sensor]) {
              data[sensor] = value;
              console.log(`✅ ${sensor}: ${value} (dari: "${text.substring(0, 50)}")`);
              found = true;
            }
          }
        });
        
        if (found) break;
      }
      
      if (!found) {
        console.log(`❌ ${sensor}: Tidak ditemukan`);
      }
    }
  }

  extractValueNearby($, element, contextText) {
    // Coba beberapa strategi untuk extract value
    
    // 1. Cari di element yang sama
    const selfValue = this.extractValueFromText(contextText);
    if (selfValue) return selfValue;

    // 2. Cari di sibling elements
    const siblings = element.siblings();
    for (let i = 0; i < siblings.length; i++) {
      const siblingText = $(siblings[i]).text().trim();
      const value = this.extractValueFromText(siblingText);
      if (value) return value;
    }

    // 3. Cari di parent
    const parentText = element.parent().text().trim();
    const parentValue = this.extractValueFromText(parentText);
    if (parentValue) return parentValue;

    // 4. Cari di children
    const children = element.children();
    for (let i = 0; i < children.length; i++) {
      const childText = $(children[i]).text().trim();
      const value = this.extractValueFromText(childText);
      if (value) return value;
    }

    return null;
  }

  extractValueFromText(text) {
    // Extract nilai numerik dengan unit
    const valueMatch = text.match(/([\d.,]+)\s*([°℃℉%m/skm/hmphPa hPammW/m²µg/m³ppm]*)/);
    if (valueMatch) {
      return valueMatch[0].trim();
    }
    
    // Extract arah angin
    const windDirections = ['utara', 'selatan', 'timur', 'barat', 'tenggara', 'barat daya', 'timur laut', 'barat laut'];
    for (const direction of windDirections) {
      if (text.toLowerCase().includes(direction)) {
        return direction.charAt(0).toUpperCase() + direction.slice(1);
      }
    }
    
    return null;
  }

  extractNumberWithUnits($, data) {
    console.log('\n🔢 Mencari angka dengan unit...');
    
    $('*').each((i, el) => {
      const text = $(el).text().trim();
      
      if (text.match(/^[\d.,]+\s*[°%m/sµghPaW/]/) && text.length < 30) {
        console.log(`   Potensi data: "${text}"`);
        console.log(`   → Element: <${$(el).prop('tagName')}> class="${$(el).attr('class')}"`);
        
        // Coba tebak jenis sensor berdasarkan context
        const sensorType = this.guessSensorType(text, $(el));
        if (sensorType && !data[sensorType]) {
          data[sensorType] = text;
          console.log(`   ✅ Ditambahkan sebagai: ${sensorType}`);
        }
      }
    });
  }

  guessSensorType(value, $element) {
    const text = $element.text().toLowerCase();
    const parentText = $element.parent().text().toLowerCase();
    const context = text + ' ' + parentText;

    if (context.includes('suhu') || context.includes('temp') || value.includes('°')) {
      return 'suhu_udara';
    } else if (context.includes('tekanan') || value.includes('hPa')) {
      return 'tekanan_udara';
    } else if (context.includes('kelembaban') || value.includes('%')) {
      return 'kelembaban_udara';
    } else if (context.includes('kecepatan') || value.includes('m/s')) {
      return 'kecepatan_angin';
    } else if (context.includes('arah') || context.includes('direction')) {
      return 'arah_angin';
    } else if (context.includes('curah') || context.includes('hujan')) {
      return 'curah_hujan';
    } else if (context.includes('radiasi') || value.includes('W/m')) {
      return 'radiasi_matahari';
    } else if (context.includes('pm2.5') || context.includes('pm25')) {
      return 'partikulat_materi_2_5';
    } else if (context.includes('pm10')) {
      return 'partikulat_materi_10';
    } else if (context.includes('co2')) {
      return 'karbon_dioksida';
    }
    
    return null;
  }

  extractFromSpecificElements($, data) {
    console.log('\n🎨 Mencari di element spesifik...');
    
    // Cari di berbagai jenis element
    const selectors = [
      'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      '.value', '.data', '.number', '.metric', '.reading',
      '[class*="sensor"]', '[class*="data"]', '[class*="value"]'
    ];
    
    selectors.forEach(selector => {
      $(selector).each((i, el) => {
        const text = $(el).text().trim();
        if (text && this.looksLikeSensorValue(text)) {
          console.log(`   ${selector}: "${text}"`);
        }
      });
    });
  }

  looksLikeSensorValue(text) {
    return text.match(/[\d.,]+\s*[°%m/sµghPaW/]/) !== null && 
           text.length < 30 &&
           !text.includes('{') &&
           !text.includes('function');
  }

  debugRelevantText($) {
    console.log('\n🐛 DEBUG: Semua teks yang mungkin relevan:');
    
    $('*').each((i, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 5 && text.length < 100) {
        // Filter teks yang mungkin berisi data
        if (this.containsSensorKeywords(text) || this.looksLikeSensorValue(text)) {
          console.log(`   "${text}"`);
          console.log(`   → Tag: <${$(el).prop('tagName')}>, Class: "${$(el).attr('class')}"`);
        }
      }
    });
  }

  containsSensorKeywords(text) {
    const keywords = [
      'suhu', 'tekanan', 'curah', 'hujan', 'arah', 'angin', 
      'kelembaban', 'kecepatan', 'radiasi', 'matahari',
      'karbon', 'oksigen', 'ozon', 'nitrogen', 'sulfur', 'partikulat'
    ];
    
    return keywords.some(keyword => 
      text.toLowerCase().includes(keyword)
    );
  }
}

export default RealPJUScraper;