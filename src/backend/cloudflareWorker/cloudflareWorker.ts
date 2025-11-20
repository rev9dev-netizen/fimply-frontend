/* eslint-disable prettier/prettier */
/**
 * Cloudflare Worker Communication Module
 *
 * Handles communication with the Cloudflare Worker proxy
 * that replaces browser extension functionality
 */

import { conf } from "@/setup/config";

// Types matching worker responses
export interface WorkerHelloResponse {
  success: boolean;
  version?: string;
  allowed?: boolean;
  hasPermission?: boolean;
  error?: string;
}

export interface WorkerMakeRequestBody {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string | Record<string, any>;
  bodyType?: "string" | "FormData" | "URLSearchParams" | "object";
}

export interface WorkerMakeRequestResponse<T = any> {
  success: boolean;
  response?: {
    statusCode: number;
    headers: Record<string, string>;
    finalUrl: string;
    body: T;
  };
  error?: string;
}

export interface WorkerPrepareStreamBody {
  ruleId: number;
  targetDomains: string[];
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
}

export interface WorkerBaseResponse {
  success: boolean;
  error?: string;
}

// Cache for worker availability
let workerAvailable: boolean | null = null;
let lastCheckTime = 0;
const CHECK_CACHE_DURATION = 60000; // 1 minute

/**
 * Get worker URL from config
 */
export function getWorkerUrl(): string | null {
  return conf().CLOUDFLARE_WORKER_URL;
}

/**
 * Get API key from config
 */
function getApiKey(): string | null {
  return conf().CLOUDFLARE_WORKER_API_KEY;
}

/**
 * Make request to worker with proper headers
 */
async function workerFetch<T>(
  endpoint: string,
  body?: any,
  timeout = 30000,
): Promise<T | null> {
  const workerUrl = getWorkerUrl();
  if (!workerUrl) return null;

  const apiKey = getApiKey();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(`${workerUrl}${endpoint}`, {
      method: body ? "POST" : "GET",
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Try to parse the response body to show the error message from the worker
      let errorText = '';
      try {
        const text = await response.text();
        try {
          const json = JSON.parse(text);
          errorText = json.error ?? text;
        } catch {
          errorText = text;
        }
      } catch (e) {
        errorText = `Failed to read response body: ${String(e)}`;
      }
      console.error(`Worker request failed: ${response.status} - ${errorText}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Worker request error:", error);
    return null;
  }
}

/**
 * Check worker health
 */
export async function workerHello(): Promise<WorkerHelloResponse | null> {
  return workerFetch<WorkerHelloResponse>("/hello");
}

/**
 * Make HTTP request via worker
 */
export async function workerRequest<T>(
  body: WorkerMakeRequestBody,
): Promise<WorkerMakeRequestResponse<T> | null> {
  return workerFetch<WorkerMakeRequestResponse<T>>("/makeRequest", body);
}

/**
 * Prepare stream via worker
 */
export async function workerPrepareStream(
  body: WorkerPrepareStreamBody,
): Promise<WorkerBaseResponse | null> {
  return workerFetch<WorkerBaseResponse>("/prepareStream", body);
}

/**
 * Check if worker is active and available
 */
export async function isWorkerActive(): Promise<boolean> {
  // Return cached result if recent
  const now = Date.now();
  if (workerAvailable !== null && now - lastCheckTime < CHECK_CACHE_DURATION) {
    return workerAvailable;
  }

  // Check if worker URL is configured
  const workerUrl = getWorkerUrl();
  if (!workerUrl) {
    workerAvailable = false;
    lastCheckTime = now;
    return false;
  }

  // Try to ping worker
  const response = await workerHello();
  workerAvailable = response?.success === true;
  lastCheckTime = now;

  return workerAvailable;
}

/**
 * Get cached worker status (synchronous)
 */
export function isWorkerActiveCached(): boolean {
  return workerAvailable === true;
}

/**
 * Reset worker cache (useful for testing)
 */
export function resetWorkerCache(): void {
  workerAvailable = null;
  lastCheckTime = 0;
}
