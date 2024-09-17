import { scrape } from "./scraper.js";
import { uploadScreenshot } from "./upload-screenshot.js";
import { Request } from "crawlee";
import { Page } from "playwright";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import sharp from "sharp";

interface WebContentResult {
  url: string;
  title: string;
  desc: string | null;
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
  favicon: string | null; // 新增的属性
}

export async function scrapeWebContent(
  urls: string[],
  proxy: boolean,
  filter: boolean,
  screenshot: boolean,
  waitSec: number
) {
  const requestHandler = async (
    request: Request,
    page: Page,
    results: WebContentResult[]
  ) => {
    console.log(`Processing ${request.url}...`);

    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(waitSec*1000); 

    let desc = await page.evaluate(() => {
      const metaDescription = document.querySelector(
        "meta[name='description']"
      );
      return metaDescription ? metaDescription.getAttribute("content") : "";
    });

    // 提取 favicon URL
    let faviconUrl = await page.evaluate(() => {
      const getFavicon = () => {
        const linkElements = document.getElementsByTagName("link");
        for (let i = 0; i < linkElements.length; i++) {
          const rel = linkElements[i].getAttribute("rel");
          if (rel && (rel.includes("icon") || rel.includes("shortcut icon"))) {
            const href = linkElements[i].getAttribute("href");
            return href;
          }
        }
        return null;
      };

      return getFavicon();
    });

    // 处理 favicon 的相对路径，转换为绝对路径
    if (faviconUrl) {
      faviconUrl = new URL(faviconUrl, request.url).href;
    }

    //截图部分
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
          "placeholder"
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
          "section"
        ];

        // 替换指定的元素，保留内容
        tagsToFlatten.forEach((tag) => {
          document.querySelectorAll(tag).forEach((element) => {
            const parent = element.parentNode;
            if (parent) {
              let content = "";
              while (element.firstChild) {
                const child = element.firstChild;
                // 使用可选链操作符和空值合并操作符来确保 textContent 不为 null
                const childTextContent = child.textContent?.trim() ?? " ";
                if (child.nodeType === Node.TEXT_NODE && childTextContent) {
                  content += childTextContent + "&nbsp;";
                } else {
                  // 对于非文本节点，如果其文本内容非空，也添加到content中并加上空格
                  if (childTextContent) {
                    content += childTextContent + "&nbsp;";
                  }
                }
                parent.insertBefore(child, element);
              }
              // 创建一个新的文本节点，包含修改后带空格的内容
              const newTextContent = document.createTextNode(content.trim());
              // 用新的文本节点替换原来的元素
              parent.replaceChild(newTextContent, element);
            }
          });
        });

        // 移除指定的元素
        for (const selector of selectorsToRemove) {
          const elements = document.querySelectorAll(selector);
          elements.forEach((element) => {
            // 对 meta 标签进行特殊处理
            if (element.tagName.toLowerCase() === "meta") {
              // 检查是否为描述性 meta 标签
              const nameAttr = element.getAttribute("name");
              if (nameAttr === "description") {
                return; // 如果是描述性 meta 标签，则不移除
              }
            }
            element.remove(); // 移除非描述性 meta 标签或其他指定的元素
          });
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

    // 使用 jsdom 创建 DOM 环境
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // 现在可以使用 Readability 解析文档了
    const article = new Readability(document).parse();

    results.push({
      url: request.url,
      title,
      desc,
      html,
      article,
      screenshot: screenshotFileName,
      // fullScreenshot: fullScreenshotFileName,
      favicon: faviconUrl, // 新增的属性
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
