// lib/utils.js
/**
 * Utility functions for PJU Scraper
 */

/**
 * Delay execution
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise}
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validate and clean scraped data
 * @param {Object} data - Raw scraped data
 * @returns {Object} Cleaned data
 */
export function cleanData(data) {
  const cleaned = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (value !== null && value !== undefined && value !== '') {
      // Convert string numbers to actual numbers when possible
      const cleanedValue = convertNumbers(value);
      cleaned[key] = cleanedValue;
    }
  }
  
  return cleaned;
}

/**
 * Convert string numbers to numbers
 * @param {*} value - Value to convert
 * @returns {*} Converted value
 */
function convertNumbers(value) {
  if (typeof value === 'string') {
    // Try to extract number from string (e.g., "220 V" -> 220)
    const numberMatch = value.match(/-?\d+\.?\d*/);
    if (numberMatch) {
      const num = parseFloat(numberMatch[0]);
      if (!isNaN(num)) {
        return num;
      }
    }
    
    // Common unit conversions
    if (value.includes('kV')) {
      const num = parseFloat(value) * 1000;
      if (!isNaN(num)) return num;
    }
    
    if (value.includes('mA')) {
      const num = parseFloat(value) / 1000;
      if (!isNaN(num)) return num;
    }
  }
  
  return value;
}

/**
 * Format data for ESP32 consumption
 * @param {Object} data - Scraped data
 * @returns {Object} Formatted data
 */
export function formatForESP32(data) {
  const formatted = {
    timestamp: new Date().toISOString(),
    status: 'success',
    sensors: {}
  };
  
  // Categorize data
  for (const [key, value] of Object.entries(data)) {
    const category = categorizeData(key);
    formatted.sensors[category] = formatted.sensors[category] || {};
    formatted.sensors[category][key] = value;
  }
  
  return formatted;
}

/**
 * Categorize sensor data
 * @param {string} key - Data key
 * @returns {string} Category
 */
function categorizeData(key) {
  const categories = {
    electrical: ['tegangan', 'voltage', 'arus', 'current', 'daya', 'power', 'energi', 'energy'],
    environmental: ['suhu', 'temperature', 'kelembaban', 'humidity', 'tekanan', 'pressure'],
    light: ['cahaya', 'light', 'lux', 'intensitas'],
    status: ['status', 'mode', 'state', 'condition']
  };
  
  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => key.includes(keyword))) {
      return category;
    }
  }
  
  return 'other';
}

/**
 * Check if data has changed significantly
 * @param {Object} oldData - Previous data
 * @param {Object} newData - New data
 * @param {number} threshold - Change threshold percentage
 * @returns {boolean} True if significant change detected
 */
export function hasSignificantChange(oldData, newData, threshold = 5) {
  if (!oldData || !newData) return true;
  
  const numericalKeys = Object.keys(newData).filter(key => 
    typeof newData[key] === 'number' && typeof oldData[key] === 'number'
  );
  
  for (const key of numericalKeys) {
    const change = Math.abs((newData[key] - oldData[key]) / oldData[key]) * 100;
    if (change > threshold) {
      return true;
    }
  }
  
  return false;
}

/**
 * Generate mock data for testing
 * @returns {Object} Mock sensor data
 */
export function generateMockData() {
  const baseValues = {
    tegangan: 220,
    arus: 1.2,
    daya: 264,
    energi: 2.4,
    suhu: 28,
    intensitas_cahaya: 450,
    kelembaban: 65
  };
  
  // Add some random variation
  const mockData = {};
  for (const [key, baseValue] of Object.entries(baseValues)) {
    const variation = (Math.random() - 0.5) * 0.1 * baseValue; // ±5% variation
    mockData[key] = parseFloat((baseValue + variation).toFixed(2));
  }
  
  mockData.timestamp = new Date().toISOString();
  mockData.status_pju = Math.random() > 0.1 ? 'ON' : 'OFF';
  
  return mockData;
}

/**
 * Log data with formatting
 * @param {Object} data - Data to log
 * @param {string} source - Data source
 */
export function logData(data, source = 'Unknown') {
  console.log(`\n📊 ${source.toUpperCase()} DATA`);
  console.log('═'.repeat(50));
  
  if (data.success === false) {
    console.log('❌ Status: Failed');
    console.log(`💬 Error: ${data.error}`);
    return;
  }
  
  console.log(`✅ Status: Success`);
  console.log(`📅 Timestamp: ${data.timestamp}`);
  console.log(`🔧 Source: ${data.source}`);
  
  if (data.data) {
    console.log('\n--- SENSOR READINGS ---');
    for (const [key, value] of Object.entries(data.data)) {
      console.log(`  ${key}: ${value}`);
    }
  }
  
  console.log('═'.repeat(50));
}

/**
 * Error handling utilities
 */
export class ScraperError extends Error {
  constructor(message, type = 'SCRAPER_ERROR') {
    super(message);
    this.name = 'ScraperError';
    this.type = type;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Retry function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} retries - Number of retries
 * @param {number} delayMs - Initial delay in ms
 * @returns {Promise}
 */
export async function retryWithBackoff(fn, retries = 3, delayMs = 1000) {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) throw error;
    
    console.log(`Retrying... ${retries} attempts left`);
    await delay(delayMs);
    
    return retryWithBackoff(fn, retries - 1, delayMs * 2);
  }
}

/**
 * Validate response data structure
 * @param {Object} data - Data to validate
 * @returns {boolean} True if valid
 */
export function isValidData(data) {
  if (!data || typeof data !== 'object') return false;
  if (data.success === false) return false;
  
  // Check if we have at least some sensor data
  if (data.data && typeof data.data === 'object') {
    const sensorKeys = Object.keys(data.data);
    return sensorKeys.length > 0;
  }
  
  return false;
}

export default {
  delay,
  cleanData,
  formatForESP32,
  hasSignificantChange,
  generateMockData,
  logData,
  ScraperError,
  retryWithBackoff,
  isValidData
};