// api/server.js

import express from 'express';
import chromium from 'chrome-aws-lambda';
import puppeteer from 'puppeteer-core';

const app = express();

// Endpoint utama yang akan di-scrape
async function scrapeData(req, res) {
  try {
    console.log("Meluncurkan browser...");
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();

    console.log("Membuka halaman target...");
    await page.goto('https://pju-monitoring-web-pens.vercel.app/dashboard');

    // Menunggu elemen yang spesifik muncul (tandanya data sudah dimuat)
    // Kita gunakan XPath untuk mencari div yang berisi teks "Tegangan"
    console.log("Mencari data di halaman...");
    const voltageXPath = "//div[p[text()='Tegangan']]/p[2]";
    await page.waitForXPath(voltageXPath);

    // Ambil semua data berdasarkan strukturnya
    const voltageElement = await page.$x(voltageXPath);
    const currentElement = await page.$x("//div[p[text()='Arus']]/p[2]");
    const powerElement = await page.$x("//div[p[text()='Daya']]/p[2]");

    const voltage = await page.evaluate(el => el.textContent, voltageElement[0]);
    const current = await page.evaluate(el => el.textContent, currentElement[0]);
    const power = await page.evaluate(el => el.textContent, powerElement[0]);

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

// Arahkan semua request ke fungsi scrapeData
app.get('*', scrapeData);

// Ekspor aplikasi untuk Vercel
export default app;