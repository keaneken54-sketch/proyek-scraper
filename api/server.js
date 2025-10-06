// api/server.js

import express from 'express';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { addExtra } from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

const puppeteerExtra = addExtra(puppeteer);

const stealth = StealthPlugin();
stealth.enabledEvasions.delete('chrome.app');
stealth.enabledEvasions.delete('chrome.csi');

puppeteerExtra.use(stealth);

const app = express();

async function scrapeData(req, res) {
  let browser = null;
  try {
    console.log("Meluncurkan browser dengan @sparticuz/chromium dan stealth yang dimodifikasi...");

    browser = await puppeteerExtra.launch({
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
    if (browser) await browser.close();
    res.status(500).json({ error: 'Gagal melakukan scraping', message: error.message });
  }
}

app.get('/api/server', scrapeData);

export default app;