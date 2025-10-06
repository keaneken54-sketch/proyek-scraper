// api/server.js

import express from 'express';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const app = express();

async function scrapeData(req, res) {
  let browser = null; // Definisikan browser di luar try-catch
  try {
    console.log("Meluncurkan browser dengan @sparticuz/chromium...");

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    
    console.log("Membuka halaman target...");
    await page.goto('https://pju-monitoring-web-pens.vercel.app/dashboard', {
      waitUntil: 'networkidle0',
    });

    console.log("Mencari data di halaman...");
    await page.waitForSelector('.grid.gap-4');

    const voltageXPath = "//*[local-name()='svg' and contains(@class, 'lucide-zap')]/ancestor::div[contains(@class, 'flex')]//p[2]";
    const currentXPath = "//*[local-name()='svg' and contains(@class, 'lucide-wave-pulse')]/ancestor::div[contains(@class, 'flex')]//p[2]";
    const powerXPath = "//*[local-name()='svg' and contains(@class, 'lucide-gauge')]/ancestor::div[contains(@class, 'flex')]//p[2]";

    const voltageElements = await page.$$(`xpath/${voltageXPath}`);
    const currentElements = await page.$$(`xpath/${currentXPath}`);
    const powerElements = await page.$$(`xpath/${powerXPath}`);

    if (voltageElements.length === 0 || currentElements.length === 0 || powerElements.length === 0) {
      // Kita sengaja membuat error di sini untuk memicu screenshot
      throw new Error("Satu atau lebih elemen data (berdasarkan ikon) tidak ditemukan di halaman.");
    }

    const voltage = await page.evaluate(el => el.textContent, voltageElements[0]);
    const current = await page.evaluate(el => el.textContent, currentElements[0]);
    const power = await page.evaluate(el => el.textContent, powerElements[0]);
    
    await browser.close();
    console.log("Scraping selesai.");

    res.status(200).json({
      voltage: voltage.trim(),
      current: current.trim(),
      power: power.trim(),
    });

  } catch (error) {
    console.error('Error saat scraping:', error);
    
    // --- BLOK DEBUGGING DENGAN SCREENSHOT ---
    if (browser) { // Pastikan browser sudah terdefinisi
      // Ambil screenshot sebagai Base64
      const page = (await browser.pages())[0]; // Ambil halaman yang aktif
      const screenshotBase64 = await page.screenshot({ encoding: 'base64' });
      await browser.close();

      // Kirim error beserta screenshot
      res.status(500).json({
        error: 'Gagal melakukan scraping, lihat data screenshot.',
        message: error.message,
        screenshot: screenshotBase64 
      });
    } else {
      // Jika browser bahkan gagal启动
      res.status(500).json({ error: 'Gagal meluncurkan browser', message: error.message });
    }
  }
}

app.get('/api/server', scrapeData);

export default app;