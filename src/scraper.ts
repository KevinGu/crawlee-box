import {
  PlaywrightCrawler,
  RequestQueue,
  ProxyConfiguration,
  Request,
} from "crawlee";
import { Page, chromium } from "playwright";
import { DeviceCategory, OperatingSystemsName } from '@crawlee/browser-pool';

export async function scrape<T>(
  urls: string[],
  proxy: boolean,
  requestHandler: (request: Request, page: Page, results: T[]) => Promise<void>
) {
  const results: T[] = []; // 使用泛型数组来存储结果
  const queueId = `queue-${Date.now()}`;
  const requestQueue = await RequestQueue.open(queueId);
  requestQueue.timeoutSecs = 50;

  const proxyUrls = process.env.PROXY_URLS
    ? process.env.PROXY_URLS.split(",")
    : [];

  const proxyConfiguration = proxy
    ? new ProxyConfiguration({
        proxyUrls: proxyUrls,
      })
    : undefined;

  if (proxyConfiguration) {
    console.log("Using proxy: ", proxyUrls);
  }

  for (const url of urls) {
    await requestQueue.addRequest({ url });
  }

  const crawler = new PlaywrightCrawler({
    launchContext: {
      // Set the Firefox browser to be used by the crawler.
      // If launcher option is not specified here,
      // default Chromium browser will be used.
      launcher: chromium,
  },
    browserPoolOptions: {
      useFingerprints: true, // this is the default
      fingerprintOptions: {
          fingerprintGeneratorOptions: {
              devices: [
                  DeviceCategory.desktop,
              ],
              operatingSystems: [
                  OperatingSystemsName.macos,
              ],
          },
      },
  },
    proxyConfiguration,
    requestQueue,
    maxRequestRetries: 3,
    requestHandlerTimeoutSecs: 50,
    async requestHandler({ request, page }) {
      await requestHandler(request, page, results); // 传递泛型结果数组给处理函数
    },
  });

  try {
    await crawler.run(urls);
    console.log("Crawler execution completed");
    return results; // 返回泛型结果数组
  } catch (error) {
    console.error("Error during crawler execution:", error);
    throw error;
  }
}
