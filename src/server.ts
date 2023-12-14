// server.ts
import express, { Request, Response } from "express";
import { ScrapeGoogleSearch } from "./google-search-scraper";

const app = express();
const port = 3002;

app.use(express.json());

app.post("/scrape-google-search", async (req: Request, res: Response) => {
  const { queries, gl, hl, lr, uule } = req.body;

  const urls = [];
  for (const query of queries) {
    const url = `http://www.google.com/search?hl=${hl}&q=${encodeURIComponent(
      query
    )}&gl=${gl}&lr=${lr}&uule=${uule}`;
    urls.push(url);
  }

  try {
    const result = await ScrapeGoogleSearch(urls);
    res.json(result);
  } catch (error: any) {
    res.status(500).send(error.message);
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
