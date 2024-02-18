import { scrape } from "./scraper.js";
import { uploadScreenshot } from "./upload-screenshot.js";
import { Request } from "crawlee";
import { Page } from "playwright";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import sharp from "sharp";
import TurndownService from "turndown";

interface WebContentResult {
  url: string;
  markdown: string;
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
  // fullScreenshot: string | undefined;
}

export async function scrapeWebContent(
  urls: string[],
  proxy: boolean,
  filter: boolean,
  screenshot: boolean
) {
  const requestHandler = async (
    request: Request,
    page: Page,
    results: WebContentResult[]
  ) => {
    console.log(`Processing ${request.url}...`);

    await page.waitForLoadState("domcontentloaded");
    //screenshot
    // let fullScreenshotFileName;
    let screenshotFileName;
    if (screenshot) {
      const screenshot = await page.screenshot();
      // const fullScreenshot = await page.screenshot({ fullPage: true });

      try {
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const day = currentDate.getDate();
        const fileNamePrefix = `screenshots/${year}/${month}/${day}`;

        screenshotFileName = `${fileNamePrefix}/${processUrl(
          request.url
        )}.webp`;

        // 使用Sharp转换截图为WebP格式并上传
        const optimizedScreenshot = await sharp(screenshot).webp().toBuffer();
        await uploadScreenshot(
          "hrefgo-cdn",
          screenshotFileName,
          optimizedScreenshot
        );
        console.log("Screenshot uploaded to Cloudflare R2");

        // fullScreenshotFileName = `${fileNamePrefix}/${processUrl(
        //   request.url
        // )}_full.webp`;
        // const optimizedFullScreenshot = await sharp(fullScreenshot)
        //   .webp()
        //   .toBuffer();
        // await uploadScreenshot(
        //   "hrefgo-cdn",
        //   fullScreenshotFileName,
        //   optimizedFullScreenshot
        // );
        // console.log("Full screenshot uploaded to Cloudflare R2");
      } catch (error) {
        console.error("Error during screenshot upload:", error);
      }
    }

    //get content
    const title = await page.title();
    if (filter) {
      console.log("enable filter...");

      await page.evaluate(() => {
        const removeComments = (node: Node) => {
          const childNodes = node.childNodes;
          for (let i = childNodes.length - 1; i >= 0; i--) {
            const child = childNodes[i];
            if (child.nodeType === 8) {
              // Node.COMMENT_NODE
              child.remove();
            } else if (child.childNodes.length > 0) {
              removeComments(child);
            }
          }
        };

        removeComments(document);

        const selectorsToRemove = [
          "meta",
          "style",
          "script",
          "noscript",
          "link",
          "img",
          "path",
          "svg",
          "audio",
          "role",
          "iframe",
          "video",
          "br",
          "picture",
        ];
        const attributesToRemove = [
          "class",
          "id",
          "style",
          "target",
          "role",
          "tabindex",
          "rel",
        ];
        const tagsToFlatten = [
          "div",
          "p",
          "span",
          "small",
          "em",
          "strong",
          "b",
          "i",
          "u",
        ];

        // 替换指定的元素，保留内容
        tagsToFlatten.forEach((tag) => {
          document.querySelectorAll(tag).forEach((element) => {
            const parent = element.parentNode;
            if (parent) {
              while (element.firstChild) {
                parent.insertBefore(element.firstChild, element);
              }
              parent.removeChild(element);
            }
          });
        });

        // 移除指定的元素
        for (const selector of selectorsToRemove) {
          const elements = document.querySelectorAll(selector);
          elements.forEach((element) => element.remove());
          console.log("remove ", selector);
        }
        // 移除指定的属性
        const allElements = document.querySelectorAll("*");

        allElements.forEach((element) => {
          // 获取元素的所有属性
          const attributeNames = element.getAttributeNames();

          attributeNames.forEach((attr) => {
            if (attributesToRemove.includes(attr)) {
              element.removeAttribute(attr);
            }
            // 检查并移除以 'data-' 开头的属性
            if (attr.startsWith("data-")) {
              element.removeAttribute(attr);
            }

            // 检查并移除以 'aria-' 开头的属性
            if (attr.startsWith("aria-")) {
              element.removeAttribute(attr);
            }
          });
        });
      });
    }

    let html = await page.content();
    html = html.replace(/\n/g, " ").replace(/\t/g, " ").replace(/ +/g, " ");
    const turndownService = new TurndownService();
    const markdown: string = turndownService.turndown(html);
    // 使用 jsdom 创建 DOM 环境
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // 现在可以使用 Readability 解析文档了
    const article = new Readability(document).parse();

    results.push({
      url: request.url,
      markdown,
      title,
      html,
      article,
      screenshot: screenshotFileName,
      // fullScreenshot: fullScreenshotFileName,
    });
  };
  // 调用 initializeCrawler 并传入必要的参数，包括泛型类型 SearchResult
  return await scrape<WebContentResult>(urls, proxy, requestHandler);
}

function processUrl(url: string): string {
  // 移除'http://'或'https://'前缀
  let processedUrl = url.replace(/^(http:\/\/|https:\/\/)/, "");

  // 将点、斜杠和破折号替换为下划线
  processedUrl = processedUrl.replace(/[\.\-\/]/g, "_");

  return processedUrl;
}
