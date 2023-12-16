// For more information, see https://crawlee.dev/
import {
  PlaywrightCrawler,
  RequestQueue,
  Configuration,
  ProxyConfiguration,
  Request,
  RequestProviderOptions,
} from "crawlee";

interface WebContentResult {
  url: string;
  title: string;
  html: string;
}

export async function ScrapeWebContent(urls: string[], proxy?: boolean) {
  // 创建一个新的请求队列实例
  const queueId = `queue-${Date.now()}`;
  const requestQueue = await RequestQueue.open(queueId);
  requestQueue.timeoutSecs = 120;

  const proxyConfiguration = proxy
    ? new ProxyConfiguration({
        proxyUrls: process.env.PROXY_URLS
          ? process.env.PROXY_URLS.split(",")
          : [],
      })
    : undefined;

  // 为每个 URL 添加请求到队列
  for (const url of urls) {
    await requestQueue.addRequest({ url });
  }

  const results: WebContentResult[] = [];
  const crawler = new PlaywrightCrawler(
    {
      proxyConfiguration,
      requestQueue,
      maxRequestRetries: 10,
      requestHandlerTimeoutSecs: 120,
      async requestHandler({ request, page }) {
        console.log(`Processing ${request.url}...`);
        const title = await page.title();
        const html = await page.content();

        results.push({
          url: request.url,
          title,
          html,
        });
      },
    },
    new Configuration({
      persistStorage: false,
    })
  );

  try {
    await crawler.run(urls);
    return results;
  } catch (error) {
    throw error;
  }
}

function extractResultTotal(str: string): number | null {
  // 定义一个正则表达式，匹配包含逗号的数字
  const regex = /(\d{1,3}(,\d{3})*(\.\d+)?)|(\d+)/;
  const match = str.match(regex);

  // 如果匹配到数字，则返回转换后的数字
  if (match) {
    // 移除数字中的逗号
    const numberString = match[0].replace(/,/g, "");
    return parseFloat(numberString);
  }

  // 如果没有匹配到，则返回 null
  return null;
}
