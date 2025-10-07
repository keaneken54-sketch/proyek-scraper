// lib/utils.js
/**
 * Utility functions for Environmental Data Scraper
 */

/**
 * Delay execution
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validate and clean environmental sensor data
 */
export function cleanData(data) {
  const cleaned = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (value !== null && value !== undefined && value !== '') {
      cleaned[key] = extractNumericValue(value);
    }
  }
  
  return cleaned;
}

/**
 * Extract numeric value from string (angka saja, tanpa satuan)
 */
function extractNumericValue(value) {
  if (typeof value === 'number') {
    return value;
  }
  
  if (typeof value === 'string') {
    // Untuk suhu: "33.8°C" -> 33.8
    if (value.includes('°')) {
      const match = value.match(/(\d+\.?\d*)\s*°/);
      return match ? parseFloat(match[1]) : null;
    }
    
    // Untuk tekanan: "1011.3 mbar" -> 1011.3
    if (value.includes('mbar') || value.includes('hPa')) {
      const match = value.match(/(\d+\.?\d*)\s*(mbar|hPa)/);
      return match ? parseFloat(match[1]) : null;
    }
    
    // Untuk persentase: "63.4%" -> 63.4
    if (value.includes('%')) {
      const match = value.match(/(\d+\.?\d*)\s*%/);
      return match ? parseFloat(match[1]) : null;
    }
    
    // Untuk kecepatan: "2.1 m/s" -> 2.1
    if (value.includes('m/s')) {
      const match = value.match(/(\d+\.?\d*)\s*m\/s/);
      return match ? parseFloat(match[1]) : null;
    }
    
    // Untuk radiasi: "987.7 W/m²" -> 987.7
    if (value.includes('W/m')) {
      const match = value.match(/(\d+\.?\d*)\s*W\/m/);
      return match ? parseFloat(match[1]) : null;
    }
    
    // Untuk ppm: "448 ppm" -> 448
    if (value.includes('ppm')) {
      const match = value.match(/(\d+\.?\d*)\s*ppm/);
      return match ? parseFloat(match[1]) : null;
    }
    
    // Untuk %VOL: "21 %VOL" -> 21
    if (value.includes('%VOL')) {
      const match = value.match(/(\d+\.?\d*)\s*%VOL/);
      return match ? parseFloat(match[1]) : null;
    }
    
    // Untuk ug/m³: "17 ug/m³" -> 17
    if (value.includes('ug/m')) {
      const match = value.match(/(\d+\.?\d*)\s*ug\/m/);
      return match ? parseFloat(match[1]) : null;
    }
    
    // Untuk mm: "0 mm" -> 0
    if (value.includes('mm')) {
      const match = value.match(/(\d+\.?\d*)\s*mm/);
      return match ? parseFloat(match[1]) : null;
    }
    
    // Default: cari angka pertama
    const match = value.match(/(\d+\.?\d*)/);
    return match ? parseFloat(match[1]) : null;
  }
  
  return value;
}

/**
 * Extract wind direction value (khusus untuk arah angin)
 */
function extractWindDirection(value) {
  if (typeof value === 'string') {
    // Untuk arah angin: "179° Tenggara" -> "Tenggara"
    const directionMatch = value.match(/(Utara|Selatan|Timur|Barat|Tenggara|Barat Daya|Timur Laut|Barat Laut)/);
    return directionMatch ? directionMatch[1] : value;
    
    // Jika ingin derajat saja: "179° Tenggara" -> 179
    // const degreeMatch = value.match(/(\d+\.?\d*)°/);
    // return degreeMatch ? parseFloat(degreeMatch[1]) : value;
  }
  return value;
}

/**
 * Format environmental data untuk ESP32 (value numeric saja)
 */
export function formatForESP32(data) {
  if (!data.success) {
    return {
      timestamp: new Date().toISOString(),
      status: 'error',
      error: data.error
    };
  }

  const formatted = {
    timestamp: data.timestamp,
    status: 'success',
    source: data.source,
    sensors: {}
  };
  
  // Format data dengan value numeric saja
  if (data.data && typeof data.data === 'object') {
    // Map nama sensor ke format yang lebih baik
    const sensorMapping = {
      'suhu_udara': { name: 'Suhu Udara', unit: '°C' },
      'tekanan_udara': { name: 'Tekanan Udara', unit: 'mbar' },
      'curah_hujan': { name: 'Curah Hujan', unit: 'mm' },
      'arah_angin': { name: 'Arah Angin', unit: '' },
      'kelembaban_udara': { name: 'Kelembaban Udara', unit: '%' },
      'kecepatan_angin': { name: 'Kecepatan Angin', unit: 'm/s' },
      'radiasi_matahari': { name: 'Radiasi Matahari', unit: 'W/m²' },
      'karbon_dioksida': { name: 'Karbon Dioksida', unit: 'ppm' },
      'oksigen': { name: 'Oksigen', unit: '%VOL' },
      'gas_ozone': { name: 'Gas Ozone', unit: 'ppm' },
      'nitrogen_dioksida': { name: 'Nitrogen Dioksida', unit: 'ppm' },
      'sulfur_dioksida': { name: 'Sulfur Dioksida', unit: 'ppm' },
      'partikulat_materi_2_5': { name: 'PM2.5', unit: 'µg/m³' },
      'partikulat_materi_10': { name: 'PM10', unit: 'µg/m³' }
    };
    
    for (const [key, value] of Object.entries(data.data)) {
      if (sensorMapping[key]) {
        const mapping = sensorMapping[key];
        
        // Extract numeric value (kecuali untuk arah angin)
        let numericValue;
        if (key === 'arah_angin') {
          numericValue = extractWindDirection(value);
        } else {
          numericValue = extractNumericValue(value);
        }
        
        formatted.sensors[key] = {
          name: mapping.name,
          value: numericValue,
          unit: mapping.unit
        };
      } else {
        formatted.sensors[key] = {
          name: key,
          value: extractNumericValue(value),
          unit: ''
        };
      }
    }
  }
  
  return formatted;
}

/**
 * Format simplified untuk ESP32 (hanya value numeric)
 */
export function formatForESP32Simple(data) {
  if (!data.success) {
    return {
      timestamp: new Date().toISOString(),
      status: 'error',
      error: data.error
    };
  }

  const formatted = {
    timestamp: data.timestamp,
    status: 'success',
    source: data.source,
    sensors: {}
  };
  
  // Format sangat sederhana: hanya value numeric
  if (data.data && typeof data.data === 'object') {
    for (const [key, value] of Object.entries(data.data)) {
      if (key === 'arah_angin') {
        // Untuk arah angin, simpan sebagai string
        formatted.sensors[key] = extractWindDirection(value);
      } else {
        // Untuk sensor lainnya, simpan sebagai number
        formatted.sensors[key] = extractNumericValue(value);
      }
    }
  }
  
  return formatted;
}

/**
 * Log environmental data dengan formatting yang informatif
 */
export function logData(data, source = 'Environmental Scraper') {
  console.log(`\n🌍 ${source.toUpperCase()}`);
  console.log('═'.repeat(60));
  
  if (data.success === false) {
    console.log('❌ Status: Failed');
    console.log(`💬 Error: ${data.error}`);
    return;
  }
  
  console.log(`✅ Status: Success`);
  console.log(`📅 Timestamp: ${data.timestamp}`);
  console.log(`🔧 Source: ${data.source}`);
  
  if (data.data) {
    console.log('\n📊 ENVIRONMENTAL SENSOR READINGS:');
    
    const categories = {
      '🌡️  Weather': ['suhu_udara', 'tekanan_udara', 'curah_hujan', 'arah_angin', 'kelembaban_udara', 'kecepatan_angin'],
      '☀️  Radiation': ['radiasi_matahari'],
      '🌫️  Air Quality': ['karbon_dioksida', 'oksigen', 'gas_ozone', 'nitrogen_dioksida', 'sulfur_dioksida'],
      '🧹 Particulate': ['partikulat_materi_2_5', 'partikulat_materi_10']
    };
    
    for (const [category, sensors] of Object.entries(categories)) {
      const categoryData = {};
      sensors.forEach(sensor => {
        if (data.data[sensor] !== undefined) {
          categoryData[sensor] = data.data[sensor];
        }
      });
      
      if (Object.keys(categoryData).length > 0) {
        console.log(`\n${category}:`);
        for (const [sensor, value] of Object.entries(categoryData)) {
          const unit = getSensorUnit(sensor);
          console.log(`  ${formatSensorName(sensor)}: ${value} ${unit}`);
        }
      }
    }
  }
  
  console.log('═'.repeat(60));
}

/**
 * Helper functions untuk formatting
 */
function getSensorUnit(sensor) {
  const units = {
    'suhu_udara': '°C',
    'tekanan_udara': 'mbar',
    'curah_hujan': 'mm',
    'arah_angin': '',
    'kelembaban_udara': '%',
    'kecepatan_angin': 'm/s',
    'radiasi_matahari': 'W/m²',
    'karbon_dioksida': 'ppm',
    'oksigen': '%VOL',
    'gas_ozone': 'ppm',
    'nitrogen_dioksida': 'ppm',
    'sulfur_dioksida': 'ppm',
    'partikulat_materi_2_5': 'µg/m³',
    'partikulat_materi_10': 'µg/m³'
  };
  
  return units[sensor] || '';
}

function formatSensorName(sensor) {
  const names = {
    'suhu_udara': 'Suhu Udara',
    'tekanan_udara': 'Tekanan Udara',
    'curah_hujan': 'Curah Hujan',
    'arah_angin': 'Arah Angin',
    'kelembaban_udara': 'Kelembaban Udara',
    'kecepatan_angin': 'Kecepatan Angin',
    'radiasi_matahari': 'Radiasi Matahari',
    'karbon_dioksida': 'Karbon Dioksida',
    'oksigen': 'Oksigen',
    'gas_ozone': 'Gas Ozone',
    'nitrogen_dioksida': 'Nitrogen Dioksida',
    'sulfur_dioksida': 'Sulfur Dioksida',
    'partikulat_materi_2_5': 'PM2.5',
    'partikulat_materi_10': 'PM10'
  };
  
  return names[sensor] || sensor.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

export default {
  delay,
  cleanData,
  formatForESP32,
  formatForESP32Simple,
  logData
};