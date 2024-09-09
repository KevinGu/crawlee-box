import { translate } from "@vitalets/google-translate-api";
import { SocksProxyAgent } from "socks-proxy-agent";

export async function googleTranslate(
  content: string,
  src: string,
  dst: string,
  proxy?: string
): Promise<string> {
  try {
    let agent;

    if (proxy) {
      agent = new SocksProxyAgent(proxy);
    }

    const options = {
      from: src,
      to: dst,
      fetchOptions: { agent },
    };

    const result = await translate(content, options);
    const resultText = replacePunctuation(result.text);
    return JSON.parse(resultText);
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
