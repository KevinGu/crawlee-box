// crawler-helper.ts
import { PlaywrightCrawler, RequestQueue, ProxyConfiguration } from "crawlee";
import { Request } from "crawlee";
import { Page } from "playwright";

export async function scrape<T>(
  urls: string[],
  proxy: boolean,
  requestHandler: (request: Request, page: Page, results: T[]) => Promise<void>
) {
  const results: T[] = []; // 使用泛型数组来存储结果
  const queueId = `queue-${Date.now()}`;
  const requestQueue = await RequestQueue.open(queueId);
  requestQueue.timeoutSecs = 120;

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
    proxyConfiguration,
    requestQueue,
    maxRequestRetries: 10,
    requestHandlerTimeoutSecs: 120,
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
