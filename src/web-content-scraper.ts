import { scrape } from "./scraper.js";
import { Request } from "crawlee";
import { Page } from "playwright";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
interface WebContentResult {
  url: string;
  title: string;
  html: string;
  // article: {
  //   title: string;
  //   content: string;
  //   textContent: string;
  //   length: number;
  //   excerpt: string;
  //   byline: string;
  //   dir: string;
  //   siteName: string;
  //   lang: string;
  //   publishedTime: string;
  // } | null;
}

export async function scrapeWebContent(
  urls: string[],
  proxy: boolean,
  filter: boolean
) {
  const requestHandler = async (
    request: Request,
    page: Page,
    results: WebContentResult[]
  ) => {
    console.log(`Processing ${request.url}...`);
    await page.screenshot({ path: 'screenshot.png' });
    const title = await page.title();
    if (filter) {
      console.log("enable filter...");
      // 移除特定元素
      await page.evaluate(() => {
        const selectors = [
          "script",
          "style",
          "noscript",
          "svg",
          '[role="alert"]',
          '[role="banner"]',
          '[role="dialog"]',
          '[role="alertdialog"]',
          '[role="region"][aria-label*="skip" i]',
          '[aria-modal="true"]',
        ];
        selectors.forEach((selector) => {
          const elements = document.querySelectorAll(selector);
          elements.forEach((element) => element.remove());
        });

        // 移除所有元素的 class 和 id 属性
        const allElements = document.getElementsByTagName("*");
        for (let element of allElements) {
          element.removeAttribute("class");
          element.removeAttribute("id");
        }
      });
    }
    const html = await page.content();
    // // 使用 jsdom 创建 DOM 环境
    // const dom = new JSDOM(html);
    // const document = dom.window.document;

    // // 现在可以使用 Readability 解析文档了
    // const article = new Readability(document).parse();

    results.push({
      url: request.url,
      title,
      html,
      // article,
    });
  };
  // 调用 initializeCrawler 并传入必要的参数，包括泛型类型 SearchResult
  return await scrape<WebContentResult>(urls, proxy, requestHandler);
}
