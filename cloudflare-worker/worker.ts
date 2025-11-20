/**
 * Cloudflare Worker - P-Stream Proxy
 *
 * This worker mimics the browser extension functionality by:
 * - Bypassing CORS restrictions
 * - Injecting custom headers
 * - Proxying requests to streaming sites
 */

// Types matching the frontend extension interface
type ExtensionBaseResponse<T = object> =
  | {
    success: true;
    data?: T;
  }
  | {
    success: false;
    error: string;
  };

type HelloResponse = {
  success: true;
  version: string;
  allowed: boolean;
  hasPermission: boolean;
};

type MakeRequestBody = {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string | Record<string, any>;
  bodyType?: "string" | "FormData" | "URLSearchParams" | "object";
};

type MakeRequestResponse = {
  success: true;
  response: {
    statusCode: number;
    headers: Record<string, string>;
    finalUrl: string;
    body: any;
  };
};

type PrepareStreamBody = {
  ruleId: number;
  targetDomains: string[];
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
};

// Environment variables interface
interface Env {
  API_KEY?: string;
  ALLOWED_ORIGINS?: string;
  ALLOW_ALL_ORIGINS?: string; // Set to 'true' in wrangler vars for dev to allow all origins
  STREAM_RULES?: KVNamespace; // Optional KV for storing stream rules
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
  'Access-Control-Max-Age': '86400',
};

/**
 * Validate API key if configured
 */
function validateApiKey(request: Request, env: Env): boolean {
  if (!env.API_KEY) return true; // No API key required

  const apiKey = request.headers.get('X-API-Key');
  return apiKey === env.API_KEY;
}

/**
 * Validate request origin
 */
function validateOrigin(request: Request, env: Env): boolean {
  // If explicitly configured to allow all origins (dev-only use), allow
  if (env.ALLOW_ALL_ORIGINS && env.ALLOW_ALL_ORIGINS.toLowerCase() === 'true') return true;
  if (!env.ALLOWED_ORIGINS) return true; // No origin restriction

  const origin = request.headers.get('Origin');
  if (!origin) return false;

  const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
  return allowedOrigins.includes(origin) || allowedOrigins.includes('*');
}

/**
 * Check if URL is allowed (basic security)
 * Returns { allowed: boolean, reason?: string }
 */
function isUrlAllowed(url: string): { allowed: boolean; reason?: string } {
  try {
    const parsedUrl = new URL(url);

    // Block localhost and private IPs
    const hostname = parsedUrl.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname.startsWith("127.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.16.") ||
      hostname.endsWith(".local")
    ) {
      return {
        allowed: false,
        reason: `Blocked private/local address: ${hostname}`,
      };
    }

    // Only allow http and https
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return {
        allowed: false,
        reason: `Invalid protocol: ${parsedUrl.protocol}`,
      };
    }

    return { allowed: true };
  } catch (error) {
    return {
      allowed: false,
      reason: `Invalid URL format: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Convert body based on bodyType
 */
function prepareRequestBody(body: any, bodyType?: string): BodyInit | null {
  if (!body) return null;

  switch (bodyType) {
    case 'string':
      return String(body);

    case 'FormData':
      const formData = new FormData();
      if (Array.isArray(body)) {
        body.forEach(([key, value]) => formData.append(key, value));
      }
      return formData;

    case 'URLSearchParams':
      const params = new URLSearchParams();
      if (Array.isArray(body)) {
        body.forEach(([key, value]) => params.append(key, value));
      }
      return params;

    case 'object':
    default:
      return JSON.stringify(body);
  }
}

/**
 * Handle /hello endpoint
 */
async function handleHello(): Promise<Response> {
  const response: HelloResponse = {
    success: true,
    version: '1.0.0',
    allowed: true,
    hasPermission: true,
  };

  return new Response(JSON.stringify(response), {
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

/**
 * Handle /makeRequest endpoint
 */
async function handleMakeRequest(request: Request): Promise<Response> {
  try {
    const body: MakeRequestBody = await request.json();

    // Validate URL
    if (!isUrlAllowed(body.url)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'URL not allowed',
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    // Prepare request options
    const requestOptions: RequestInit = {
      method: body.method || 'GET',
      headers: body.headers || {},
      redirect: 'follow',
    };

    // Add body if present
    if (body.body) {
      requestOptions.body = prepareRequestBody(body.body, body.bodyType);
    }

    // Make the actual request
    const targetResponse = await fetch(body.url, requestOptions);

    // Read response body
    const responseBody = await targetResponse.text();
    let parsedBody: any = responseBody;

    // Try to parse as JSON
    try {
      parsedBody = JSON.parse(responseBody);
    } catch {
      // Keep as text if not JSON
    }

    // Extract headers
    const responseHeaders: Record<string, string> = {};
    targetResponse.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    // Build response
    const response: MakeRequestResponse = {
      success: true,
      response: {
        statusCode: targetResponse.status,
        headers: responseHeaders,
        finalUrl: targetResponse.url,
        body: parsedBody,
      },
    };

    return new Response(JSON.stringify(response), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Request failed',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
}

/**
 * Handle /prepareStream endpoint
 * Note: This is a no-op in the worker since we can't inject headers like the extension
 * We just acknowledge the request
 */
async function handlePrepareStream(request: Request, env: Env): Promise<Response> {
  try {
    const body: PrepareStreamBody = await request.json();

    // Optionally store in KV for future use
    if (env.STREAM_RULES) {
      await env.STREAM_RULES.put(
        `rule_${body.ruleId}`,
        JSON.stringify(body),
        { expirationTtl: 3600 } // 1 hour
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to prepare stream',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
}

/**
 * Handle OPTIONS requests (CORS preflight)
 */
function handleOptions(): Response {
  return new Response(null, {
    headers: corsHeaders,
  });
}

/**
 * Main request handler
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions();
    }

    // Validate API key
    if (!validateApiKey(request, env)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid API key',
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    // Validate origin
    if (!validateOrigin(request, env)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Origin not allowed',
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    // Route requests
    switch (url.pathname) {
      case '/':
      case '/hello':
        return handleHello();

      case '/makeRequest':
        if (request.method !== 'POST') {
          return new Response('Method not allowed', { status: 405 });
        }
        return handleMakeRequest(request);

      case '/prepareStream':
        if (request.method !== 'POST') {
          return new Response('Method not allowed', { status: 405 });
        }
        return handlePrepareStream(request, env);

      default:
        return new Response('Not found', {
          status: 404,
          headers: corsHeaders,
        });
    }
  },
};
