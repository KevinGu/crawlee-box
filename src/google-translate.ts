// 从 "@vitalets/google-translate-api" 模块导入翻译函数
import { translate } from "@vitalets/google-translate-api";
// 从 "socks-proxy-agent" 模块导入 Socks 代理代理器
import { SocksProxyAgent } from "socks-proxy-agent";

// 定义翻译选项的接口
interface TranslateOptions {
  // 源语言代码
  from: string;
  // 目标语言代码
  to: string;
  // 翻译类型，例如 "html" 或 "text"
  type: string;
  fetchOptions: {
    // 可选的代理代理器
    agent?: SocksProxyAgent;
    // 请求超时时间（毫秒）
    timeout: number;
  };
}

// 主翻译函数，支持普通文本和 JSON 模式
export async function googleTranslate(
  content: string,          // 要翻译的内容
  src: string,              // 源语言代码
  dst: string,              // 目标语言代码
  type: string,             // 翻译类型
  jsonMode: boolean = false, // 是否为 JSON 模式
  proxy?: string            // 可选的代理地址
): Promise<string> {
  try {
    // 构建翻译选项
    const options: TranslateOptions = {
      from: src,
      to: dst,
      type: type,
      fetchOptions: {
        // 如果提供了代理地址，则创建代理代理器
        agent: proxy ? new SocksProxyAgent(proxy) : undefined,
        timeout: 10000, // 请求超时时间设为 10 秒
      },
    };

    if (jsonMode) {
      // 如果是 JSON 模式，调用专门的 JSON 翻译函数
      let response = await translateJson(content, options);
      return response;
    } else {
      // 否则，直接调用普通的翻译函数
      let response = await translate(content, options);
      // 去除翻译结果中的首尾引号
      return response.text.replace(/^"(.*)"$/, "$1");
    }
  } catch (error: any) {
    // 捕获并抛出翻译过程中的错误
    throw new Error(`翻译失败: ${error.message || error}`);
  }
}

// 处理 JSON 内容的翻译函数
async function translateJson(
  content: string,          // 要翻译的 JSON 内容
  options: TranslateOptions // 翻译选项
): Promise<string> {
  // 创建一个映射，用于存储原始的键名
  const keyMap = new Map<string, string>();
  let keyCounter = 0; // 用于生成唯一的占位符键

  // 解析 JSON 内容为对象
  const rootNode = JSON.parse(content);
  // 替换 JSON 值中的 &quot; 为 "
  const updatedJson = replaceInJsonValueStrings(rootNode, "&quot;", '"');
  // 处理节点，替换键名为占位符，并记录映射关系
  const replacedJson = JSON.stringify(
    processNode(updatedJson, keyMap, () => keyCounter++)
  );

  // 定义需要替换的特殊符号
  const symbols = ["{", "}", "[", "]", ",", ":", '"'];
  // 创建符号的占位符映射
  const replacements = createReplacements(symbols, "@");
  // 替换 JSON 字符串中的特殊符号为占位符，防止被翻译
  const replacedSymbolsJson: string = replaceJsonSymbols(
    replacedJson,
    replacements
  );
  // 翻译处理后的 JSON 字符串
  const processedJsonResponse = await translate(replacedSymbolsJson, options);

  // 恢复占位符中的数字，并将占位符替换回原始符号
  let processedJsonString = reverseReplaceSymbols(
    trimNumbersInPlaceHoderString(processedJsonResponse.text),
    replacements
  );

  // 恢复原始的键名
  const restoredJson = restoreKeys(processedJsonString, keyMap);

  if (options.type == "html") {
    // 如果类型是 HTML，需要将引号替换回 &quot;
    const updatedResult = replaceInJsonValueStrings(restoredJson, '"', "&quot;");
    return updatedResult;
  } else {
    // 返回最终的翻译结果
    return restoredJson;
  }
}

// 处理 JSON 节点，替换键名为占位符，防止被翻译
function processNode(
  node: any,                        // 当前节点
  keyMap: Map<string, string>,      // 键名映射
  getNextKey: () => number          // 获取下一个唯一键的函数
): any {
  if (typeof node === "object" && node !== null) {
    if (Array.isArray(node)) {
      // 如果是数组，递归处理每个元素
      return node.map((item) => processNode(item, keyMap, getNextKey));
    } else {
      // 如果是对象，替换键名为占位符
      const result: { [key: string]: any } = {};
      for (const [originalKey, value] of Object.entries(node)) {
        const placeholderKey = `#${getNextKey()}#`; // 使用 # 包裹，防止翻译出错
        keyMap.set(placeholderKey, originalKey);
        result[placeholderKey] = processNode(value, keyMap, getNextKey);
      }
      return result;
    }
  }
  // 非对象或数组，直接返回
  return node;
}

// 恢复被替换的键名
function restoreKeys(jsonString: string, keyMap: Map<string, string>): string {
  // 解析 JSON 字符串为对象
  const rootNode = JSON.parse(jsonString);
  // 递归恢复键名
  return restoreNode(rootNode, keyMap);
}

// 递归处理节点，恢复原始键名
function restoreNode(node: any, keyMap: Map<string, string>): any {
  if (typeof node === "object" && node !== null) {
    if (Array.isArray(node)) {
      // 如果是数组，递归处理每个元素
      return node.map((item) => restoreNode(item, keyMap));
    } else {
      // 如果是对象，恢复键名
      const result: { [key: string]: any } = {};
      for (const [placeholderKey, value] of Object.entries(node)) {
        // 获取原始键名，如果不存在则使用占位符键名
        let originalKey = keyMap.get(placeholderKey.trim()) || placeholderKey.trim();
        result[originalKey] = restoreNode(value, keyMap);
      }
      return result;
    }
  }
  // 非对象或数组，直接返回
  return node;
}

/**
 * 匹配值中的双引号，并进行适当的替换
 * @param jsonString 要处理的 JSON 字符串
 * @returns 处理后的字符串
 */
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

// 创建特殊符号与占位符的映射关系
function createReplacements(
  symbols: string[],     // 要替换的符号列表
  placeHolder: string    // 占位符标记
): { [key: string]: string } {
  return symbols.reduce((acc, symbol) => {
    const code = `${placeHolder}${symbol.charCodeAt(0)}${placeHolder}`;
    acc[symbol] = code;
    acc[code] = symbol;
    return acc;
  }, {} as { [key: string]: string });
}

// 替换 JSON 字符串中的特殊符号为占位符
function replaceJsonSymbols(
  jsonString: string,                     // 要处理的 JSON 字符串
  replacements: { [key: string]: string } // 符号与占位符的映射
): string {
  // 使用正则表达式进行匹配和替换
  return jsonString.replace(
    /"|"([^"\\]*(?:\\.[^"\\]*)*)"|([\[\]{},])|:(?!\d)|(:\d+)/g,
    (match) => {
      // 返回替换映射中的占位符，如果没有则返回原始匹配
      return replacements[match] || match;
    }
  );
}

// 将占位符替换回原始的特殊符号
function reverseReplaceSymbols(
  input: string,                          // 包含占位符的字符串
  replacements: { [key: string]: string } // 符号与占位符的映射
): string {
  let result = input;

  for (const [placeholder, original] of Object.entries(replacements)) {
    result = result.split(placeholder).join(original);
  }

  return result;
}

// 定义 JSON 值的类型
type JsonValue = string | number | boolean | JsonObject | JsonArray | null;

// 定义 JSON 对象的接口
interface JsonObject {
  [key: string]: JsonValue;
}

// 定义 JSON 数组的接口
interface JsonArray extends Array<JsonValue> {}

// 替换 JSON 值字符串中的指定子字符串
function replaceInJsonValueStrings(
  jsonObj: any,              // 要处理的 JSON 对象
  targetSubstring: string,   // 目标子字符串
  replacementString: string  // 替换的字符串
): any {
  if (typeof jsonObj === "string") {
    // 使用全局正则表达式替换所有匹配项
    return jsonObj.replace(new RegExp(targetSubstring, "g"), replacementString);
  } else if (Array.isArray(jsonObj)) {
    // 递归处理数组中的每个元素
    return jsonObj.map((item) =>
      replaceInJsonValueStrings(item, targetSubstring, replacementString)
    );
  } else if (jsonObj !== null && typeof jsonObj === "object") {
    // 递归处理对象中的每个属性
    const result: any = {};
    for (const key in jsonObj) {
      if (jsonObj.hasOwnProperty(key)) {
        result[key] = replaceInJsonValueStrings(
          jsonObj[key],
          targetSubstring,
          replacementString
        );
      }
    }
    return result;
  }
  // 其他类型，直接返回
  return jsonObj;
}

// 修剪占位符中的数字，去除多余的空格
function trimNumbersInPlaceHoderString(input: string): string {
  return input.replace(/@(\s*\d+\s*)@/g, (_, p1) => {
    return `@${p1.replace(/\s+/g, '')}@`;
  });
}