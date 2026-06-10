import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: './dogfood-output/videos/' }
  });
  
  const page = await context.newPage();
  
  // Log console messages
  page.on('console', msg => console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => console.error(`[BROWSER ERROR] ${err.message}`));
  
  console.log('Navigating to http://localhost:3005');
  await page.goto('http://localhost:3005');
  await page.waitForLoadState('domcontentloaded');
  
  // Take initial screenshot
  await page.screenshot({ path: './dogfood-output/screenshots/initial.png' });
  console.log('Initial screenshot saved.');

  // Click on a trend (e.g., england vs india)
  console.log('Clicking on trend link: england vs india');
  await page.locator('.trend-item').first().click();
  
  // Wait for explanation and debate to generate
  console.log('Waiting for AI content...');
  await page.waitForTimeout(5000); // Wait 5s for full debate turns
  
  await page.screenshot({ path: './dogfood-output/screenshots/debate-loaded.png' });
  console.log('Debate loaded screenshot saved.');
  
  // Click on Optimist Bot Wins
  console.log('Clicking verdict: Optimist Bot Wins');
  const optButton = page.locator('#btn-verdict-optimist');
  if (await optButton.isVisible()) {
    await optButton.click();
    console.log('Clicked Optimist Bot Wins button.');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: './dogfood-output/screenshots/after-vote.png' });
    console.log('Screenshot after vote saved.');
  } else {
    console.error('Optimist Bot Wins button is not visible!');
  }

  // Check if share button is visible
  const shareBtn = page.locator('#btn-share-debate-x');
  console.log(`Share button visible: ${await shareBtn.isVisible()}`);

  // Dismiss banner
  const dismissBtn = page.locator('#btn-close-banner');
  if (await dismissBtn.isVisible()) {
    console.log('Dismissing banner');
    await dismissBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: './dogfood-output/screenshots/banner-dismissed.png' });
  }

  await context.close();
  await browser.close();
  console.log('Done!');
}

run().catch(console.error);
