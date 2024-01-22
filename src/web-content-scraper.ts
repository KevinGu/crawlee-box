import { scrape } from "./scraper.js";
import { uploadScreenshot } from "./upload-screenshot.js";
import { Request } from "crawlee";
import { Page } from "playwright";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';

interface WebContentResult {
  url: string;
  title: string;
  html: string;
  article: {
    title: string;
    content: string;
    textContent: string;
    length: number;
    excerpt: string;
    byline: string;
    dir: string;
    siteName: string;
    lang: string;
    publishedTime: string;
  } | null;
  screenshot: string | undefined;
  fullScreenshot: string | undefined;
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

    await page.waitForLoadState("domcontentloaded");
    //screenshot
    const screenshot = await page.screenshot();
    const fullScreenshot = await page.screenshot({ fullPage: true });

    let fullScreenshotFileName;
    let screenshotFileName;
    try {
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const day = currentDate.getDate();
      const uuid = uuidv4();
      const fileNamePrefix = `screenshots/${year}/${month}/${day}`;
      fullScreenshotFileName = `${fileNamePrefix}/${processUrl(request.url)}_full.webp`;
      screenshotFileName = `${fileNamePrefix}/${processUrl(request.url)}.webp`;

      // 使用Sharp转换截图为WebP格式并上传
      const optimizedScreenshot = await sharp(screenshot).webp().toBuffer();
      await uploadScreenshot("hrefgo-cdn", screenshotFileName, optimizedScreenshot);
      console.log("Screenshot uploaded to Cloudflare R2");

      const optimizedFullScreenshot = await sharp(fullScreenshot).webp().toBuffer();
      await uploadScreenshot("hrefgo-cdn", fullScreenshotFileName, optimizedFullScreenshot);
      console.log("Full screenshot uploaded to Cloudflare R2");
    } catch (error) {
      console.error("Error during screenshot upload:", error);
    }

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
    // 使用 jsdom 创建 DOM 环境
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // 现在可以使用 Readability 解析文档了
    const article = new Readability(document).parse();

    results.push({
      url: request.url,
      title,
      html,
      article,
      screenshot: screenshotFileName,
      fullScreenshot: fullScreenshotFileName,
    });
  };
  // 调用 initializeCrawler 并传入必要的参数，包括泛型类型 SearchResult
  return await scrape<WebContentResult>(urls, proxy, requestHandler);
}

function processUrl(url: string): string {
  // 移除'http://'或'https://'前缀
  let processedUrl = url.replace(/^(http:\/\/|https:\/\/)/, '');

  // 将点、斜杠和破折号替换为下划线
  processedUrl = processedUrl.replace(/[\.\-\/]/g, '_');

  return processedUrl;
}
