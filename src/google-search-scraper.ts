import { scrap } from "./scraper.js";
import { Request } from "crawlee";
import { Page } from "playwright";

interface faq {
  question: string;
  answer: string;
  url: string | null | undefined;
  title: string | null | undefined;
}

interface featuredSnippets {
  url: string | null | undefined;
  title: string | null | undefined;
  content: string[];
}

interface organicResult {
  title: string;
  url: string;
  desc: string;
  emphasizedKeywords?: string[];
  posistion: number;
}

interface SearchResult {
  resultTotal: number;
  url: string;
  title: string;
  featuredSnippets: featuredSnippets;
  peopleAlsoAsk: faq[];
  relatedQueries: string[];
  organicResults: organicResult[];
}

export async function scrapeGoogleSearch(urls: string[], proxy: boolean) {
  const requestHandler = async (
    request: Request,
    page: Page,
    results: SearchResult[]
  ) => {
    // 实现特定的请求处理逻辑
    console.log(`Processing ${request.url}...`);
    const title = await page.title();

    //results total
    const resultTotal = await page.textContent("#result-stats");
    const resultTotalNumber = extractResultTotal(resultTotal || "") || 0;

    //related keywords
    let elements = await page.$$(".EIaa9b a");
    const relatedKeywords = [];
    for (const element of elements) {
      const keyword = await element.textContent();
      if (keyword) {
        relatedKeywords.push(keyword);
      }
    }

    //featured snippets
    let featuredSnippets = {
      content: [] as string[],
      url: "",
      title: "",
    };
    const featuredSnippetsSection = await page.$(".ULSxyf");
    if (featuredSnippetsSection) {
      const featuredUrlEle = await featuredSnippetsSection?.$(".yuRUbf a");
      const featuredUrl = (await featuredUrlEle?.getAttribute("href")) || "";
      const featuredTitleEle = await featuredSnippetsSection?.$(".yuRUbf h3");
      const featuredTitle = (await featuredTitleEle?.textContent()) || "";

      elements = await featuredSnippetsSection.$$(".di3YZe li");
      const snippets = [];
      for (const element of elements) {
        const featuredSnippetContent = await element.textContent();
        if (featuredSnippetContent) {
          snippets.push(featuredSnippetContent);
        }
      }

      featuredSnippets = {
        content: snippets,
        url: featuredUrl,
        title: featuredTitle,
      };
    }

    //faq
    const faqResults: faq[] = [];
    // 直接选择包含 "People also ask" 的区域
    const faqSection = await page.$(".MjjYud:has-text('People also ask')");
    if (faqSection) {
      // 选择该区域内的问题
      const faqsEle = await faqSection.$$(".wQiwMc");
      for (const faqEle of faqsEle) {
        const questionEle = await faqEle.$(".JlqpRe span");
        const question = await questionEle?.textContent();
        const answerEle = await faqEle.$(".wDYxhc span");
        const answer = await answerEle?.textContent();
        const urlEle = await faqEle.$(".yuRUbf a");
        const url = await urlEle?.getAttribute("href");
        const titleEle = await faqEle.$(".yuRUbf h3");
        const title = await titleEle?.textContent();
        if (question && answer) {
          const faqObj: faq = { question, answer, url, title };
          faqResults.push(faqObj);
        }
      }
    }

    //organic search results
    const organicResults: organicResult[] = [];
    const organicSection = await page.$$(".MjjYud");
    if (organicSection) {
      for (const element of organicSection) {
        const urlEle = await element.$("a");
        const url = await urlEle?.getAttribute("href");
        const titleEle = await element.$("h3");
        const title = await titleEle?.textContent();
        const descEle = await element.$(
          ".VwiC3b.yXK7lf.lVm3ye.r025kc.hJNv6b.Hdw6tb"
        );
        const desc = await descEle?.textContent();
        const emList: string[] = [];
        const emEles = await descEle?.$$("em");
        if (emEles) {
          for (const element of emEles) {
            const em = await element.textContent();
            if (em) {
              emList.push(em.toLocaleLowerCase());
            }
          }
        }
        const posistion = organicResults.length + 1;
        if (url && title && desc) {
          const organicResultObj: organicResult = {
            url,
            title,
            desc,
            emphasizedKeywords: Array.from(new Set(emList)),
            posistion,
          };
          organicResults.push(organicResultObj);
        }
      }
    }

    results.push({
      resultTotal: resultTotalNumber,
      url: request.url,
      title,
      featuredSnippets: featuredSnippets,
      peopleAlsoAsk: faqResults,
      relatedQueries: relatedKeywords,
      organicResults,
    });
  };
  // 调用 initializeCrawler 并传入必要的参数，包括泛型类型 SearchResult
  return await scrap<SearchResult>(urls, proxy, requestHandler);
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
