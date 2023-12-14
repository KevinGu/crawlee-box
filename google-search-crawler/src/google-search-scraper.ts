// For more information, see https://crawlee.dev/
import { PlaywrightCrawler } from "crawlee";

interface SearchResult {
  url: string;
  title: string;
  relatedKeywords: string[];
  organicSearchResults: any;
}

export async function ScrapeGoogleSearch(url: string[]) {
  const results: SearchResult[] = [];
  const crawler = new PlaywrightCrawler({
    // maxRequestsPerCrawl: 1,
    async requestHandler({ request, page }) {
      console.log(`Processing ${request.url}...`);
      const title = await page.title();

      //related keywords
      let elements = await page.$$(".EIaa9b a");
      const relatedKeywords = [];
      for (const element of elements) {
        const keyword = await element.textContent();
        if (keyword) {
          relatedKeywords.push(keyword);
        }
      }

      //organic search results
      elements = await page.$$(".MjjYud a");
      const organicSearchResults: string[] = [];
      for (const element of elements) {
        const organicSearchResult = await element.textContent();
        if (organicSearchResult) {
          organicSearchResults.push(organicSearchResult);
        }
      }

      results.push({
        url: request.url,
        title,
        relatedKeywords,
        organicSearchResults,
      });
    },
  });

  try {
    await crawler.run(url);
    return results;
  } catch (error) {
    throw error;
  }
}
