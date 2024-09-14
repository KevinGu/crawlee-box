import express, { Request, Response } from "express";
import { scrapeGoogleSearch } from "./google-search-scraper.js";
import { scrapeWebContent } from "./web-content-scraper.js";
import { googleTranslate } from "./google-translate.js";
import dotenv from "dotenv";
import { BingTranslate } from "./bing-translate.js";

dotenv.config();

const app = express();
const port = 3002;

app.use(express.json());

app.post("/scrape-google-search", async (req: Request, res: Response) => {
  const { proxy, queries, gl, hl, lr, uule } = req.body;

  const urls: string[] = [];

  // const queryArray = JSON.parse(queries);
  queries.forEach((query: string) => {
    const url = `http://www.google.com/search?hl=${hl}&q=${encodeURIComponent(
      query
    )}&gl=${gl}&lr=${lr}&uule=${uule}`;
    urls.push(url);
  });

  try {
    const result = await scrapeGoogleSearch(urls, proxy ? proxy : false);
    res.json(result);
  } catch (error: any) {
    res.status(500).send(error.message);
  }
});

app.post("/scrape-web-content", async (req: Request, res: Response) => {
  const { proxy, urls, filter, screenshot, waitSec } = req.body;

  try {
    const result = await scrapeWebContent(
      urls,
      proxy,
      filter,
      screenshot,
      waitSec
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).send(error.message);
  }
});

app.post("/google-translate", async (req: Request, res: Response) => {
  const { content, src, dst, jsonMode, proxy, type } = req.body;

  try {
    const result = await googleTranslate(
      content,
      src,
      dst,
      type,
      jsonMode,
      proxy
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).send(error.message);
  }
});

app.post("/bing-translate", async (req: Request, res: Response) => {
  const { content, src, dst, jsonMode, proxy } = req.body;

  try {
    const result = await BingTranslate(content, src, dst, jsonMode, proxy);
    res.json(result);
  } catch (error: any) {
    res.status(500).send(error.message);
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
