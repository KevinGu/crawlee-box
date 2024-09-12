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
      return response.text.replace(/^"(.*)"$/, "$1");
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

  // console.log("+++++replacedJson+----", replacedJson);

  //bug，一定要处理冒号两边有空格，不然翻译会挂
  // if (options.to == "de") {
  //   content = replacedJson.replace(/"\s*:\s*"/g, '": "');
  // } else if (options.to == "no") {
  //   content = replacedJson.replace(/"\s*:\s*"/g, '" : "');
  // } else {
  //   content = replacedJson.replace(/"\s*:\s*"/g, '":"');
  // }

  const replacedSymbolsJson: string = replaceJsonSymbols(replacedJson);
  // console.log("++++++----", content);
  // console.log("++++++", replacedJSON);

  const processedJsonResponse = await translate(replacedSymbolsJson, options);
  // console.log("==", processedJsonResponse.text);

  let processedJsonString = reverseReplaceSymbols(processedJsonResponse.text);
  // console.log("====", processedJsonString);
  // processedJsonString = replacePunctuation(processedJsonString);
  // console.log("======", processedJsonString);
  // processedJsonString = sanitizeJsonString(processedJsonString);
  // console.log("========", processedJsonString);
  const restoredJson = restoreKeys(processedJsonString, keyMap);
  // console.log("==========", restoredJson);
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
        const placeholderKey = `#${getNextKey()}#`; //一定要有#，不然翻译会挂
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
  // console.log("rootNode", rootNode);
  return restoreNode(rootNode, keyMap);
}

function restoreNode(node: any, keyMap: Map<string, string>): any {
  // console.log("keyMap", keyMap);
  if (typeof node === "object" && node !== null) {
    if (Array.isArray(node)) {
      return node.map((item) => restoreNode(item, keyMap));
    } else {
      const result: { [key: string]: any } = {};
      for (const [placeholderKey, value] of Object.entries(node)) {
        let originalKey = keyMap.get(placeholderKey.trim()) || placeholderKey;
        originalKey = originalKey;
        result[originalKey] = restoreNode(value, keyMap);
      }
      // console.log("result", result);
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
  text = text.replace(/„/g, '"'); //for de
  text = text.replace(/“/g, '"'); //for de
  return text;
}

function sanitizeJsonString(jsonString: string): string {
  // 使用正则表达式来匹配和处理多余的引号
  const sanitizedString = jsonString.replace(
    /([:\[,{]\s*)"(.*?)"(?=\s*[:,\]}])/g,
    (_, p1, p2) => {
      p2 = p2.replace(/(?<!\\)"/g, '\\"');
      return p1 + '"' + p2 + '"';
    }
  );

  return sanitizedString;
}

function replaceJsonSymbols(jsonString: string): string {
  const replacements: { [key: string]: string | undefined } = {
    "{": "@123@",
    "}": "@125@",
    "[": "@91@",
    "]": "@93@",
    ",": "@44@",
    ":": "@58@",
    '"': "@34@",
  };

  // 使用正则表达式进行匹配和替换
  return jsonString.replace(
    /"|"([^"\\]*(?:\\.[^"\\]*)*)"|([\[\]{},])|:(?!\d)|(:\d+)/g,
    (match) => {
      // 返回替换映射中的实体，如果没有特别指定，则不替换
      return replacements[match] || match;
    }
  );
}

function reverseReplaceSymbols(input: string): string {
  const replacements: { [key: string]: string } = {
    "@123@": "{",
    "@125@": "}",
    "@91@": "[",
    "@93@": "]",
    "@44@": ",",
    "@58@": ":",
    "@34@": '"',
  };

  let result = input;

  for (const [placeholder, original] of Object.entries(replacements)) {
    result = result.split(placeholder).join(original);
  }

  return result;
}
