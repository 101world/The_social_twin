#!/usr/bin/env node
/**
 * ComfyUI Pod Health Checker
 * Monitors the persistent ComfyUI pod on RunPod and reports status
 * Designed for persistent pods that don't need start/stop management
 */

import fs from 'fs';
import path from 'path';

const POD_URL = process.env.NEXT_PUBLIC_RUNPOD_IMAGE_URL || 'https://9wc6zqlr5p7i6a-3001.proxy.runpod.net';
const CHECK_INTERVAL = Number(process.env.POD_HEALTH_CHECK_SECONDS || '60') * 1000;
const LOG_FILE = path.resolve(process.cwd(), 'pod-health.log');

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function checkPodHealth(): Promise<{ status: 'healthy' | 'unhealthy' | 'error', responseTime?: number, error?: string }> {
  const startTime = Date.now();

  try {
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    // Test basic connectivity
    const response = await fetch(`${POD_URL}/`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    if (response.ok) {
      return { status: 'healthy', responseTime };
    } else {
      return {
        status: 'unhealthy',
        responseTime,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    return {
      status: 'error',
      responseTime,
      error: error.message || 'Connection failed'
    };
  }
}

async function checkComfyUIWorkflow(): Promise<{ status: 'ready' | 'not_ready', details?: string }> {
  try {
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    // Test ComfyUI workflow endpoint
    const response = await fetch(`${POD_URL}/workflow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      return { status: 'ready' };
    } else {
      return {
        status: 'not_ready',
        details: `Workflow endpoint returned ${response.status}`
      };
    }
  } catch (error: any) {
    return {
      status: 'not_ready',
      details: error.message || 'Workflow test failed'
    };
  }
}

function log(message: string) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;

  console.log(message);

  try {
    fs.appendFileSync(LOG_FILE, logEntry);
  } catch (e) {
    // Ignore log file errors
  }
}

async function mainLoop() {
  log(`🚀 ComfyUI Pod Health Checker starting...`);
  log(`📍 Monitoring pod: ${POD_URL}`);
  log(`⏱️  Check interval: ${CHECK_INTERVAL / 1000}s`);
  log(`📝 Logs: ${LOG_FILE}`);

  while (true) {
    try {
      // Check basic pod health
      const health = await checkPodHealth();

      if (health.status === 'healthy') {
        log(`✅ Pod is healthy (Response: ${health.responseTime}ms)`);

        // Check ComfyUI workflow readiness
        const workflow = await checkComfyUIWorkflow();
        if (workflow.status === 'ready') {
          log(`🎨 ComfyUI workflow ready`);
        } else {
          log(`⚠️  ComfyUI workflow not ready: ${workflow.details}`);
        }
      } else {
        log(`❌ Pod health check failed: ${health.error} (Response: ${health.responseTime}ms)`);
      }

    } catch (e) {
      log(`💥 Health check error: ${String(e)}`);
    }

    await sleep(CHECK_INTERVAL);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  mainLoop().catch((e) => {
    console.error('Pod health checker failed:', e);
    process.exit(1);
  });
}

export {};
