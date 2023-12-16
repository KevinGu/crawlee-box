import { scrape } from "./scraper.js";
import { Request } from "crawlee";
import { Page } from "playwright";
interface WebContentResult {
  url: string;
  title: string;
  html: string;
}

export async function scrapeWebContent(urls: string[], proxy: boolean) {
  const requestHandler = async (
    request: Request,
    page: Page,
    results: WebContentResult[]
  ) => {
    console.log(`Processing ${request.url}...`);
    const title = await page.title();
    const html = await page.content();

    results.push({
      url: request.url,
      title,
      html,
    });
  };
  // 调用 initializeCrawler 并传入必要的参数，包括泛型类型 SearchResult
  return await scrape<WebContentResult>(urls, proxy, requestHandler);
}
