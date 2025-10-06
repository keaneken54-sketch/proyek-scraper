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
      cleaned[key] = convertEnvironmentalValue(key, value);
    }
  }
  
  return cleaned;
}

/**
 * Convert environmental values dengan unit yang sesuai
 */
function convertEnvironmentalValue(key, value) {
  if (typeof value === 'string') {
    // Extract number dari string
    const numberMatch = value.match(/-?\d+\.?\d*/);
    if (numberMatch) {
      const num = parseFloat(numberMatch[0]);
      if (!isNaN(num)) {
        return num;
      }
    }
    
    // Handle arah angin (khusus)
    if (key === 'arah_angin') {
      const directions = {
        'utara': 'Utara', 'north': 'Utara',
        'selatan': 'Selatan', 'south': 'Selatan', 
        'timur': 'Timur', 'east': 'Timur',
        'barat': 'Barat', 'west': 'Barat',
        'tenggara': 'Tenggara', 'southeast': 'Tenggara',
        'barat daya': 'Barat Daya', 'southwest': 'Barat Daya',
        'timur laut': 'Timur Laut', 'northeast': 'Timur Laut',
        'barat laut': 'Barat Laut', 'northwest': 'Barat Laut'
      };
      
      const lowerValue = value.toLowerCase();
      for (const [pattern, direction] of Object.entries(directions)) {
        if (lowerValue.includes(pattern)) {
          return direction;
        }
      }
    }
  }
  
  return value;
}

/**
 * Format environmental data untuk ESP32
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
    environmental_data: {}
  };
  
  // Kategorikan data lingkungan
  if (data.data && typeof data.data === 'object') {
    const categories = {
      weather: ['suhu_udara', 'tekanan_udara', 'curah_hujan', 'arah_angin', 'kelembaban_udara', 'kecepatan_angin'],
      radiation: ['radiasi_matahari'],
      air_quality: ['karbon_dioksida', 'oksigen', 'gas_ozone', 'nitrogen_dioksida', 'sulfur_dioksida'],
      particulate: ['partikulat_materi_2_5', 'partikulat_materi_10']
    };
    
    for (const [category, sensors] of Object.entries(categories)) {
      formatted.environmental_data[category] = {};
      sensors.forEach(sensor => {
        if (data.data[sensor] !== undefined) {
          formatted.environmental_data[category][sensor] = data.data[sensor];
        }
      });
      
      // Hapus kategori kosong
      if (Object.keys(formatted.environmental_data[category]).length === 0) {
        delete formatted.environmental_data[category];
      }
    }
    
    // Tambahkan sensor yang tidak terkategori
    const uncategorized = {};
    for (const [sensor, value] of Object.entries(data.data)) {
      let categorized = false;
      for (const sensors of Object.values(categories)) {
        if (sensors.includes(sensor)) {
          categorized = true;
          break;
        }
      }
      if (!categorized) {
        uncategorized[sensor] = value;
      }
    }
    
    if (Object.keys(uncategorized).length > 0) {
      formatted.environmental_data.other = uncategorized;
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
    
    // Tampilkan sensor yang tidak terkategori
    const otherSensors = {};
    for (const [sensor, value] of Object.entries(data.data)) {
      let categorized = false;
      for (const sensors of Object.values(categories)) {
        if (sensors.includes(sensor)) {
          categorized = true;
          break;
        }
      }
      if (!categorized) {
        otherSensors[sensor] = value;
      }
    }
    
    if (Object.keys(otherSensors).length > 0) {
      console.log('\n📋 Other Sensors:');
      for (const [sensor, value] of Object.entries(otherSensors)) {
        console.log(`  ${formatSensorName(sensor)}: ${value}`);
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
    'tekanan_udara': 'hPa',
    'curah_hujan': 'mm',
    'arah_angin': '',
    'kelembaban_udara': '%',
    'kecepatan_angin': 'm/s',
    'radiasi_matahari': 'W/m²',
    'karbon_dioksida': 'ppm',
    'oksigen': '%',
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
  logData
};