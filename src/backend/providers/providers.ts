import {
  makeProviders,
  makeStandardFetcher,
  targets,
} from "@p-stream/providers";

import { isWorkerActiveCached } from "@/backend/cloudflareWorker/cloudflareWorker";
import { isExtensionActiveCached } from "@/backend/extension/messaging";
import {
  makeCloudflareWorkerFetcher,
  makeExtensionFetcher,
  makeLoadBalancedSimpleProxyFetcher,
  setupM3U8Proxy,
} from "@/backend/providers/fetchers";

// Initialize M3U8 proxy on module load
setupM3U8Proxy();

export function getProviders() {
  // Priority: Cloudflare Worker > Extension > Proxy

  // Check if Cloudflare Worker is configured and available
  if (isWorkerActiveCached()) {
    return makeProviders({
      fetcher: makeStandardFetcher(fetch),
      proxiedFetcher: makeCloudflareWorkerFetcher(),
      target: targets.BROWSER_EXTENSION,
      consistentIpForRequests: true,
    });
  }

  // Fall back to extension if available
  if (isExtensionActiveCached()) {
    return makeProviders({
      fetcher: makeStandardFetcher(fetch),
      proxiedFetcher: makeExtensionFetcher(),
      target: targets.BROWSER_EXTENSION,
      consistentIpForRequests: true,
    });
  }

  // Fall back to proxy servers
  setupM3U8Proxy();

  return makeProviders({
    fetcher: makeStandardFetcher(fetch),
    proxiedFetcher: makeLoadBalancedSimpleProxyFetcher(),
    target: targets.BROWSER,
  });
}

export function getAllProviders() {
  return makeProviders({
    fetcher: makeStandardFetcher(fetch),
    target: targets.BROWSER_EXTENSION,
    consistentIpForRequests: true,
  });
}
