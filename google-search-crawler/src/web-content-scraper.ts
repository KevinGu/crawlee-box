// For more information, see https://crawlee.dev/
import { PlaywrightCrawler, Dataset } from "crawlee";

export async function scrapeWebContent(url: string): Promise<any> {
  const crawler = new PlaywrightCrawler({
    maxRequestsPerCrawl: 1,
    async requestHandler({ request, page }) {
      const title = await page.title();
      const html = await page.content();
      await Dataset.pushData({
        url: request.url,
        title,
        html,
      });
    },
  });

  try {
    await crawler.run([url]);
    const data = await Dataset.getData();
    return data;
  } catch (error) {
    throw error;
  }
}
