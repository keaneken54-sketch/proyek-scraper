// api/server.js

import express from 'express';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const app = express();

async function scrapeData(req, res) {
  try {
    console.log("Meluncurkan browser dengan @sparticuz/chromium...");

    const browser = await puppeteer.launch({
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
    
    // Tunggu sampai container utama yang berisi semua statistik muncul
    await page.waitForSelector('.grid.gap-4');

    // --- BAGIAN YANG DIPERBAIKI ---
    // Gunakan metode modern page.$$('xpath/...') untuk memilih elemen
    const voltageElements = await page.$$("xpath///div[p[text()='Tegangan']]/p[2]");
    const currentElements = await page.$$("xpath///div[p[text()='Arus']]/p[2]");
    const powerElements = await page.$$("xpath///div[p[text()='Daya']]/p[2]");

    // Pastikan elemen ditemukan sebelum mencoba membaca isinya
    if (voltageElements.length === 0 || currentElements.length === 0 || powerElements.length === 0) {
      throw new Error("Satu atau lebih elemen data tidak ditemukan di halaman.");
    }

    const voltage = await page.evaluate(el => el.textContent, voltageElements[0]);
    const current = await page.evaluate(el => el.textContent, currentElements[0]);
    const power = await page.evaluate(el => el.textContent, powerElements[0]);
    
    await browser.close();
    console.log("Scraping selesai.");

    // Kirim hasil sebagai JSON
    res.status(200).json({
      voltage: voltage.trim(),
      current: current.trim(),
      power: power.trim(),
    });
  } catch (error) {
    console.error('Error saat scraping:', error);
    res.status(500).json({ error: 'Gagal melakukan scraping', message: error.message });
  }
}

app.get('/api/server', scrapeData);

export default app;