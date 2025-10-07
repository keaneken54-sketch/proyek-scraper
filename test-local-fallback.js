// test-local-fallback.js
import axios from 'axios';

async function testFallback() {
  console.log('🧪 Testing fallback data...\n');
  
  // Data dummy untuk testing
  const dummyData = {
    success: true,
    timestamp: new Date().toISOString(),
    source: 'dummy_data',
    data: {
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
    }
  };
  
  console.log('📦 Dummy data for testing:');
  console.log(JSON.stringify(dummyData, null, 2));
}

testFallback();