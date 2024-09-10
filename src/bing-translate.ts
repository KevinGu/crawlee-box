import { HttpProxyAgent } from "http-proxy-agent";
import * as bingTranslator from "bing-translate-api";

export async function BingTranslate(
  content: string,
  src: string,
  dst: string,
  jsonMode: boolean = false,
  proxy?: string
): Promise<string> {
  try {
    let agent;

    if (proxy) {
      agent = new HttpProxyAgent(proxy);
    }

    const translation = await bingTranslator.translate(
      content,
      src,
      dst,
      false,
      false,
      undefined,
      { http: agent }
    );

    let resultText = translation?.translation ?? '';
    if (jsonMode) {
      resultText = JSON.parse(replacePunctuation(resultText));
    }
    return resultText;
  } catch (error: any) {
    throw new Error(`Translation failed: ${error.message || error}`);
  }
}

function replacePunctuation(text: string): string {
  text = text.replace(/，/g, ",");
  text = text.replace(/、/g, ",");
  text = text.replace(/：/g, ":");
  text = text.replace(/；/g, ";");
  text = text.replace(/“/g, '"');
  text = text.replace(/”/g, '"');
  text = text.replace(/‘/g, "'");
  text = text.replace(/’/g, "'");
  return text;
}
