# Cloudflare Worker Proxy - Implementation Plan

## Goal

Create a Cloudflare Worker that replicates the browser extension's functionality, allowing the P-Stream frontend to work without requiring users to install a browser extension. The worker will handle CORS bypass, header manipulation, and act as a proxy for streaming requests.

## User Review Required

> [!IMPORTANT]
> **Breaking Change**: This will add a new fetcher type that uses HTTP requests to a Cloudflare Worker instead of browser extension messaging. The frontend will need to be configured to use the worker URL.

> [!WARNING]
> **Security Consideration**: The Cloudflare Worker will be publicly accessible and could be abused for making arbitrary HTTP requests. We should implement:
> - Rate limiting (Cloudflare's built-in)
> - Optional API key authentication
> - Request origin validation
> - URL allowlist/blocklist

> [!CAUTION]
> **Cost Implications**: Cloudflare Workers have usage limits:
> - Free tier: 100,000 requests/day
> - Paid tier: $5/month for 10M requests
> - This could get expensive with high traffic

**Questions:**
1. Should we implement API key authentication for the worker?
2. Do you want to restrict which domains the worker can proxy to?
3. Should we add request logging/analytics?

---

## Proposed Changes

### Cloudflare Worker

#### [NEW] [worker.ts](file:///w:/filmy/fimply-frontend/cloudflare-worker/worker.ts)

Main Cloudflare Worker implementation that handles:
- `/hello` - Health check endpoint (mimics extension hello)
- `/makeRequest` - Proxy HTTP requests with custom headers
- `/prepareStream` - Store stream configuration (for future requests)
- CORS handling
- Error handling
- Optional authentication

**Key Features:**
- Full CORS bypass (worker makes requests server-side)
- Custom header injection
- Body type handling (string, FormData, URLSearchParams, JSON)
- Response header forwarding
- Final URL tracking (for redirects)

---

#### [NEW] [wrangler.toml](file:///w:/filmy/fimply-frontend/cloudflare-worker/wrangler.toml)

Cloudflare Worker configuration:
- Worker name and routes
- KV namespace for stream rules (optional)
- Environment variables
- Compatibility settings

---

#### [NEW] [package.json](file:///w:/filmy/fimply-frontend/cloudflare-worker/package.json)

Dependencies for worker development:
- `@cloudflare/workers-types`
- `wrangler` (Cloudflare CLI)
- TypeScript

---

### Frontend Integration

#### [MODIFY] [fetchers.ts](file:///w:/filmy/fimply-frontend/src/backend/providers/fetchers.ts)

Add new `makeCloudflareWorkerFetcher()` function that:
- Sends requests to Cloudflare Worker instead of extension
- Uses HTTP POST to `/makeRequest` endpoint
- Handles response transformation
- Includes API key if configured

---

#### [MODIFY] [providers.ts](file:///w:/filmy/fimply-frontend/src/backend/providers/providers.ts)

Update `getProviders()` to check for Cloudflare Worker URL:
1. Check if worker URL is configured
2. If yes, use `makeCloudflareWorkerFetcher()`
3. If no, fall back to extension check
4. If no extension, use proxy fetcher

Priority: Worker > Extension > Proxy

---

#### [NEW] [cloudflareWorker.ts](file:///w:/filmy/fimply-frontend/src/backend/cloudflareWorker/cloudflareWorker.ts)

New module for Cloudflare Worker communication:
- `workerRequest()` - Make requests to worker
- `workerHello()` - Health check
- `isWorkerActive()` - Check if worker is available
- `workerPrepareStream()` - Send stream preparation

---

#### [MODIFY] [config.ts](file:///w:/filmy/fimply-frontend/src/setup/config.ts)

Add new configuration options:
- `CLOUDFLARE_WORKER_URL` - Worker endpoint URL
- `CLOUDFLARE_WORKER_API_KEY` - Optional API key for authentication

---

#### [MODIFY] [proxyUrls.ts](file:///w:/filmy/fimply-frontend/src/utils/proxyUrls.ts)

Add function to get Cloudflare Worker URL from config.

---

### Documentation

#### [NEW] [README.md](file:///w:/filmy/fimply-frontend/cloudflare-worker/README.md)

Documentation for deploying and configuring the Cloudflare Worker:
- Setup instructions
- Deployment steps
- Configuration options
- Security best practices
- Troubleshooting

---

## Implementation Details

### Cloudflare Worker API Endpoints

#### 1. `POST /hello`
```typescript
Request: {}
Response: {
  success: true,
  version: "1.0.0",
  allowed: true,
  hasPermission: true
}
```

#### 2. `POST /makeRequest`
```typescript
Request: {
  url: string,
  method: string,
  headers?: Record<string, string>,
  body?: string | object,
  bodyType?: "string" | "FormData" | "URLSearchParams" | "object"
}

Response: {
  success: true,
  response: {
    statusCode: number,
    headers: Record<string, string>,
    finalUrl: string,
    body: any
  }
}
```

#### 3. `POST /prepareStream`
```typescript
Request: {
  ruleId: number,
  targetDomains: string[],
  requestHeaders?: Record<string, string>,
  responseHeaders?: Record<string, string>
}

Response: {
  success: true
}
```

### Request Flow

```
Frontend
  ↓
makeCloudflareWorkerFetcher()
  ↓
POST to worker.example.com/makeRequest
  ↓
Cloudflare Worker
  ↓
fetch(targetUrl, { headers: customHeaders })
  ↓
Streaming Site
  ↓
Response back to worker
  ↓
Worker returns response to frontend
  ↓
Frontend processes stream
```

### Security Measures

1. **Rate Limiting**: Use Cloudflare's built-in rate limiting
2. **API Key**: Optional header-based authentication
3. **Origin Validation**: Check request origin
4. **URL Filtering**: Allowlist/blocklist for target domains
5. **Request Size Limits**: Prevent abuse

### Environment Variables

```bash
CLOUDFLARE_WORKER_URL=https://worker.example.com
CLOUDFLARE_WORKER_API_KEY=your-secret-key  # Optional
```

---

## Verification Plan

### Automated Tests

1. **Worker Deployment**
   ```bash
   cd cloudflare-worker
   npm install
   wrangler deploy
   ```

2. **Test Worker Endpoints**
   ```bash
   # Test hello endpoint
   curl -X POST https://worker.example.com/hello
   
   # Test makeRequest endpoint
   curl -X POST https://worker.example.com/makeRequest \
     -H "Content-Type: application/json" \
     -d '{"url":"https://example.com","method":"GET"}'
   ```

3. **Frontend Integration Test**
   - Set `VITE_CLOUDFLARE_WORKER_URL` in `.env`
   - Run `pnpm dev`
   - Try to play a video
   - Verify requests go through worker (check Network tab)

### Manual Verification

1. **Without Extension**
   - Disable/uninstall browser extension
   - Configure worker URL in frontend
   - Try to stream a video
   - Verify it works

2. **Performance Test**
   - Compare streaming speed: Worker vs Extension vs Proxy
   - Check for buffering issues
   - Monitor worker response times

3. **Error Handling**
   - Test with invalid worker URL
   - Test with worker down
   - Verify fallback to extension/proxy works

4. **Security Test**
   - Test rate limiting
   - Test API key authentication (if enabled)
   - Try to abuse worker with arbitrary requests

---

## Deployment Steps

1. **Create Cloudflare Account**
   - Sign up at cloudflare.com
   - Get API token

2. **Deploy Worker**
   ```bash
   cd cloudflare-worker
   npm install
   wrangler login
   wrangler deploy
   ```

3. **Configure Frontend**
   - Add worker URL to `.env`
   - Optionally add API key
   - Rebuild frontend

4. **Test**
   - Verify worker is accessible
   - Test streaming functionality
   - Monitor for errors

---

## Migration Path

### Phase 1: Development
- Create worker
- Test locally with `wrangler dev`
- Integrate with frontend

### Phase 2: Testing
- Deploy to Cloudflare
- Test with staging frontend
- Verify all features work

### Phase 3: Production
- Update production frontend config
- Monitor usage and errors
- Optimize as needed

### Fallback Strategy
- Worker → Extension → Proxy
- If worker fails, automatically fall back to extension
- If extension not available, fall back to proxy
- User can manually disable worker in settings

---

## Cost Estimation

### Cloudflare Workers Pricing

**Free Tier:**
- 100,000 requests/day
- 10ms CPU time per request
- Good for: Testing, small deployments

**Paid Tier ($5/month):**
- 10,000,000 requests/month included
- $0.50 per additional million
- Good for: Production use

**Estimated Usage:**
- Average user: ~100 requests per video (playlist + segments)
- 1000 daily users = 100,000 requests/day
- Would need paid tier for >1000 concurrent users

---

## Alternatives Considered

1. **Keep Extension Only**
   - ❌ Requires user installation
   - ❌ Not available on mobile
   - ✅ Free, fast, reliable

2. **Use Existing Proxy Servers**
   - ❌ Slower
   - ❌ Less reliable
   - ❌ Limited header control
   - ✅ Already implemented

3. **Cloudflare Worker (This Plan)**
   - ✅ No extension needed
   - ✅ Works on mobile
   - ✅ Fast (edge network)
   - ✅ Full header control
   - ⚠️ Costs money at scale
   - ⚠️ Publicly accessible (security risk)

---

## Next Steps

1. Review this plan
2. Answer security/configuration questions
3. Create Cloudflare Worker implementation
4. Integrate with frontend
5. Test thoroughly
6. Deploy to production
