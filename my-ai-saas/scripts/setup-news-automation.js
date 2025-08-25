#!/usr/bin/env node

/**
 * News Automation Setup Script
 * 
 * This script helps set up automated news scraping for production.
 * It can be run manually or scheduled to trigger the news scraping endpoint.
 */

const https = require('https');
const http = require('http');

// Configuration
const config = {
  // Change this to your production domain
  baseUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  // News scraping endpoint
  endpoint: '/api/news/scrape',
  // How often to check for updates (in milliseconds)
  intervalMs: 30 * 60 * 1000, // 30 minutes
  // Enable/disable logging
  verbose: true
};

function log(message) {
  if (config.verbose) {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }
}

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const lib = urlObj.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'News-Automation-Script/1.0'
      },
      timeout: 120000 // 2 minutes timeout
    };

    const req = lib.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({
            status: res.statusCode,
            data: parsed
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: { raw: data }
          });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    // Send empty body for POST request
    req.write(JSON.stringify({}));
    req.end();
  });
}

async function triggerNewsScrape() {
  try {
    log('🔄 Triggering news scraping...');
    
    const url = `${config.baseUrl}${config.endpoint}`;
    log(`📡 Making request to: ${url}`);
    
    const response = await makeRequest(url);
    
    if (response.status === 200) {
      const { data } = response;
      log(`✅ News scraping completed successfully`);
      log(`📊 Results: ${data.added || 0} new articles, ${data.total || 0} total processed`);
      
      if (data.sources) {
        log(`📰 Sources processed: ${data.sources.join(', ')}`);
      }
      
      return true;
    } else {
      log(`❌ News scraping failed with status ${response.status}`);
      log(`📄 Response: ${JSON.stringify(response.data, null, 2)}`);
      return false;
    }
  } catch (error) {
    log(`❌ Error during news scraping: ${error.message}`);
    return false;
  }
}

async function runOnce() {
  log('🚀 Starting one-time news scraping...');
  const success = await triggerNewsScrape();
  log(success ? '✅ One-time scraping completed' : '❌ One-time scraping failed');
  process.exit(success ? 0 : 1);
}

async function runContinuous() {
  log('🔄 Starting continuous news scraping...');
  log(`⏰ Interval: ${config.intervalMs / 1000 / 60} minutes`);
  
  // Initial run
  await triggerNewsScrape();
  
  // Set up interval
  setInterval(async () => {
    await triggerNewsScrape();
  }, config.intervalMs);
  
  log('📡 Continuous scraping started. Press Ctrl+C to stop.');
}

// Command line interface
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'once':
  case 'run':
    runOnce();
    break;
  
  case 'continuous':
  case 'daemon':
    runContinuous();
    break;
  
  case 'test':
    config.verbose = true;
    log('🧪 Testing news scraping endpoint...');
    runOnce();
    break;
  
  default:
    console.log(`
News Automation Setup Script

Usage:
  node setup-news-automation.js [command]

Commands:
  once        Run news scraping once and exit
  continuous  Run news scraping continuously every 30 minutes
  test        Test the news scraping endpoint with verbose logging

Environment Variables:
  NEXT_PUBLIC_APP_URL   Base URL for your application (default: http://localhost:3000)

Examples:
  # Test the endpoint locally
  node setup-news-automation.js test
  
  # Run once in production
  NEXT_PUBLIC_APP_URL=https://yourdomain.com node setup-news-automation.js once
  
  # Run continuously (for background daemon)
  NEXT_PUBLIC_APP_URL=https://yourdomain.com node setup-news-automation.js continuous
`);
    process.exit(0);
}
