import { translate } from "@vitalets/google-translate-api";
import { SocksProxyAgent } from "socks-proxy-agent";

interface TranslateOptions {
  from: string;
  to: string;
  fetchOptions: {
    agent?: SocksProxyAgent;
    timeout: number;
  };
}

export async function googleTranslate(
  content: string,
  src: string,
  dst: string,
  jsonMode: boolean = false,
  proxy?: string
): Promise<string> {
  try {
    const options: TranslateOptions = {
      from: src,
      to: dst,
      fetchOptions: {
        agent: proxy ? new SocksProxyAgent(proxy) : undefined,
        timeout: 10000,
      },
    };

    if (jsonMode) {
      let response = await translateJson(content, options);
      return response;
    } else {
      let response = await translate(content, options);
      return response.text.replace(/^"(.*)"$/, '$1');
    }
  } catch (error: any) {
    throw new Error(`translate fail: ${error.message || error}`);
  }
}

async function translateJson(
  content: string,
  options: TranslateOptions
): Promise<string> {
  const keyMap = new Map<string, string>();
  let keyCounter = 0;

  const rootNode = JSON.parse(content);
  const replacedJson = JSON.stringify(
    processNode(rootNode, keyMap, () => keyCounter++)
  );

  //bug，一定要冒号两边有空格，不然翻译会挂
  content = replacedJson.replace(/"\s*:\s*"/g, '" : "');
  const processedJsonResponse = await translate(content, options);

  let processedJsonString = processedJsonResponse.text;
  // console.log("==",processedJsonString);
  processedJsonString = replacePunctuation(processedJsonString);
  // console.log("====",processedJsonString);
  processedJsonString = sanitizeJsonString(processedJsonString);
  // console.log("======",processedJsonString);
  const restoredJson = restoreKeys(processedJsonString, keyMap);
  // console.log("========",restoredJson);
  return restoredJson;
}

function processNode(
  node: any,
  keyMap: Map<string, string>,
  getNextKey: () => number
): any {
  if (typeof node === "object" && node !== null) {
    if (Array.isArray(node)) {
      return node.map((item) => processNode(item, keyMap, getNextKey));
    } else {
      const result: { [key: string]: any } = {};
      for (const [originalKey, value] of Object.entries(node)) {
        const placeholderKey = `#${getNextKey()}#`;//一定要有#，不然翻译会挂
        keyMap.set(placeholderKey, originalKey);
        result[placeholderKey] = processNode(value, keyMap, getNextKey);
      }
      return result;
    }
  }
  return node;
}

function restoreKeys(jsonString: string, keyMap: Map<string, string>): string {
  const rootNode = JSON.parse(jsonString);
  return restoreNode(rootNode, keyMap);
}

function restoreNode(node: any, keyMap: Map<string, string>): any {
  if (typeof node === "object" && node !== null) {
    if (Array.isArray(node)) {
      return node.map((item) => restoreNode(item, keyMap));
    } else {
      const result: { [key: string]: any } = {};
      for (const [placeholderKey, value] of Object.entries(node)) {
        const originalKey = keyMap.get(placeholderKey) || placeholderKey;
        result[originalKey] = restoreNode(value, keyMap);
      }
      return result;
    }
  }
  return node;
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
      p2 = p2.replace(/(?<!\\)"/g, '\\"');
      return p1 + '"' + p2 + '"';
    }
  );

  return sanitizedString;
}
