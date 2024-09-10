import { translate } from "@vitalets/google-translate-api";
import { SocksProxyAgent } from "socks-proxy-agent";

export async function googleTranslate(
  content: string,
  src: string,
  dst: string,
  jsonMode: boolean = false,
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
      fetchOptions: { agent, timeout: 10000 },
    };

    const result = await translate(content, options);
    let resultText = result.text;
    if (jsonMode) {
      resultText = replacePunctuation(resultText);
      console.log(resultText);
      resultText = sanitizeJsonString(resultText);
      console.log(resultText);
      console.log(resultText);
      resultText = JSON.parse(resultText);
    }
    console.log(resultText);
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

function sanitizeJsonString(jsonString: string): string {
  // 使用你提供的正则表达式来匹配和处理多余的引号
  const sanitizedString = jsonString.replace(
    /([:\[,{]\s*)"(.*?)"(?=\s*[:,\]}])/g,
    (_, p1, p2) => {
      p2 = p2.replace(/"/g, '\\"');
      return p1 + '"' + p2 + '"';
    }
  );

  return sanitizedString;
}
