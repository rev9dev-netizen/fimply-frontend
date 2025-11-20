# P-Stream Cloudflare Worker Proxy

This Cloudflare Worker acts as a proxy to replace the browser extension functionality, enabling P-Stream to work without requiring users to install an extension.

## Features

- ✅ CORS bypass (server-side requests)
- ✅ Custom header injection
- ✅ API key authentication (optional)
- ✅ Origin validation
- ✅ URL security checks
- ✅ Rate limiting (via Cloudflare)

## Prerequisites

- Cloudflare account (free tier works)
- Node.js 16+ and npm/pnpm
- Wrangler CLI

## Installation

1. **Install dependencies:**
   ```bash
   cd cloudflare-worker
   npm install
   # or
   pnpm install
   ```

2. **Login to Cloudflare:**
   ```bash
   npx wrangler login
   ```

## Configuration

### 1. Update `wrangler.toml`

Replace `account_id` with your Cloudflare account ID:
```toml
account_id = "your-account-id-here"
```

Find your account ID at: https://dash.cloudflare.com/ (in the URL or sidebar)

### 2. Set API Key (Optional but Recommended)

```bash
npx wrangler secret put API_KEY
```

Enter a strong random key when prompted. Example:
```
your-super-secret-api-key-12345
```

### 3. Configure Allowed Origins (Optional)

Edit `wrangler.toml`:
```toml
[vars]
ALLOWED_ORIGINS = "https://pstream.mov,https://yourdomain.com"
```

Or set to `*` to allow all origins (not recommended for production).

## Development

### Local Testing

```bash
npm run dev
```

This starts a local development server at `http://localhost:8787`

Test the endpoints:
```bash
# Test hello endpoint
curl http://localhost:8787/hello

# Test makeRequest endpoint
curl -X POST http://localhost:8787/makeRequest \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "url": "https://httpbin.org/get",
    "method": "GET"
  }'
```

## Deployment

### Deploy to Cloudflare

```bash
npm run deploy
```

Your worker will be deployed to: `https://pstream-proxy-worker.your-subdomain.workers.dev`

### Custom Domain (Optional)

1. Add a route in `wrangler.toml`:
   ```toml
   routes = [
     { pattern = "worker.yourdomain.com/*", zone_name = "yourdomain.com" }
   ]
   ```

2. Deploy again:
   ```bash
   npm run deploy
   ```

## API Endpoints

### `GET /hello`

Health check endpoint.

**Response:**
```json
{
  "success": true,
  "version": "1.0.0",
  "allowed": true,
  "hasPermission": true
}
```

### `POST /makeRequest`

Proxy HTTP requests with custom headers.

**Request:**
```json
{
  "url": "https://example.com/api",
  "method": "GET",
  "headers": {
    "User-Agent": "Custom Agent",
    "Referer": "https://example.com"
  },
  "body": "optional body",
  "bodyType": "string"
}
```

**Response:**
```json
{
  "success": true,
  "response": {
    "statusCode": 200,
    "headers": {
      "content-type": "application/json"
    },
    "finalUrl": "https://example.com/api",
    "body": { "data": "..." }
  }
}
```

### `POST /prepareStream`

Store stream configuration (for compatibility with extension API).

**Request:**
```json
{
  "ruleId": 1,
  "targetDomains": ["cdn.example.com"],
  "requestHeaders": {
    "Origin": "https://example.com"
  }
}
```

**Response:**
```json
{
  "success": true
}
```

## Frontend Integration

Update your P-Stream frontend `.env`:

```env
VITE_CLOUDFLARE_WORKER_URL=https://pstream-proxy-worker.your-subdomain.workers.dev
VITE_CLOUDFLARE_WORKER_API_KEY=your-api-key
```

The frontend will automatically use the worker instead of the extension.

## Security

### API Key Authentication

Always use API key authentication in production:

```bash
npx wrangler secret put API_KEY
```

Frontend must include the key in requests:
```typescript
headers: {
  'X-API-Key': 'your-api-key'
}
```

### Origin Validation

Restrict which domains can use your worker:

```toml
[vars]
ALLOWED_ORIGINS = "https://pstream.mov,https://yourdomain.com"
```

### URL Filtering

The worker automatically blocks:
- Localhost and private IPs
- Non-HTTP(S) protocols
- `.local` domains

### Rate Limiting

Cloudflare automatically rate limits requests. For additional protection:

1. Go to Cloudflare Dashboard
2. Select your worker
3. Enable "Rate Limiting" rules

## Monitoring

### View Logs

```bash
npm run tail
```

This shows real-time logs from your worker.

### Analytics

View analytics in Cloudflare Dashboard:
- Request count
- Error rate
- CPU time
- Bandwidth

## Troubleshooting

### "Invalid API key" error

Make sure:
1. API key is set: `npx wrangler secret put API_KEY`
2. Frontend is sending the key in `X-API-Key` header
3. Key matches exactly

### "Origin not allowed" error

Check `ALLOWED_ORIGINS` in `wrangler.toml` includes your frontend domain.

### "URL not allowed" error

The worker blocks private IPs and localhost for security. This is intentional.

### Worker not updating

Clear Cloudflare cache:
```bash
npx wrangler deploy --compatibility-date=2024-01-01
```

## Cost

### Free Tier
- 100,000 requests/day
- 10ms CPU time per request
- Perfect for testing and small deployments

### Paid Tier ($5/month)
- 10,000,000 requests/month included
- $0.50 per additional million
- Recommended for production

## Limits

- Request timeout: 30 seconds (free) / 50 seconds (paid)
- Request size: 100 MB
- Response size: 100 MB
- CPU time: 10ms (free) / 50ms (paid)

## Support

For issues or questions:
1. Check Cloudflare Workers documentation: https://developers.cloudflare.com/workers/
2. Check P-Stream documentation
3. Open an issue on GitHub

## License

MIT
