import { translate } from "@vitalets/google-translate-api";
import { SocksProxyAgent } from "socks-proxy-agent";

// 定义翻译选项的接口
interface TranslateOptions {
  from: string;
  to: string;
  fetchOptions: {
    agent?: SocksProxyAgent;
    timeout: number;
  };
}

// 主翻译函数，支持普通文本和 JSON 模式
export async function googleTranslate(
  content: string,
  src: string,
  dst: string,
  jsonMode: boolean = false,
  proxy?: string
): Promise<string> {
  try {
    // 构建翻译选项
    const options: TranslateOptions = {
      from: src,
      to: dst,
      fetchOptions: {
        agent: proxy ? new SocksProxyAgent(proxy) : undefined,
        timeout: 10000,
      },
    };

    if (jsonMode) {
      // 使用 JSON 翻译策略
      let response = await translateJson(content, options);
      return response;
    } else {
      let response = await translate(content, options);
      // console.log("response: ", response);
      return response.text;
    }
  } catch (error: any) {
    throw new Error(`translate fail: ${error}`);
  }
}

// 处理 JSON 内容的翻译函数，使用新的策略
async function translateJson(
  content: string,
  options: TranslateOptions
): Promise<string> {
  // 解析 JSON 内容为对象
  const rootNode = JSON.parse(content);

  // 存储值的路径和原始值
  const entries: { path: (string | number)[]; value: string }[] = [];

  // 提取值和路径的函数
  traverseAndExtractValues(rootNode, [], entries);
  //console.log("entries:", entries);

  // 生成一个独特的分隔符
  const delimiters = ["^^", "^#", "##", "@@","__","$$","%%"];
  for (const delimiter of delimiters) {
    try {
      // 拼接所有值为一个字符串
      const valuesToTranslate = entries.map((entry) => entry.value);
      const concatenatedText = valuesToTranslate.join(delimiter);
      // console.log("concatenatedText: ", concatenatedText);

      // 翻译拼接的文本
      const translatedConcatenatedText = await translate(
        concatenatedText,
        options
      );
      // console.log(
      //   "translated text: ",
      //   translatedConcatenatedText.raw.sentences
      // );

      const translatedString = replaceWithNoSpaces(
        translatedConcatenatedText.text,
        delimiter
      );
      // console.log("translate: ", translatedConcatenatedText.text);

      // 拆分翻译后的文本回单个值
      const translatedValues = translatedString.split(delimiter);
      // console.log("translate split: ", translatedValues);

      // 确保翻译后的值数量匹配
      if (translatedValues.length === valuesToTranslate.length) {
        // 将翻译后的值重新设置回 JSON 对象
        for (let i = 0; i < entries.length; i++) {
          setValueAtPath(rootNode, entries[i].path, translatedValues[i]);
        }

        // 返回更新后的 JSON 对象
        return rootNode;
      } else {
        console.warn(
          `Delimiter "${delimiter}" mismatch in number of translated values, try next.`
        );
      }
    } catch (error) {
      console.warn(`Delimiter "${delimiter}" translated error, try next.`);
    }
  }

  throw new Error("Mismatch in number of translated values");
}

// 遍历 JSON 对象，提取值和路径
function traverseAndExtractValues(
  node: any,
  currentPath: (string | number)[],
  entries: { path: (string | number)[]; value: string }[]
): void {
  if (typeof node === "string") {
    entries.push({ path: [...currentPath], value: node });
  } else if (Array.isArray(node)) {
    node.forEach((item, index) => {
      traverseAndExtractValues(item, [...currentPath, index], entries);
    });
  } else if (node !== null && typeof node === "object") {
    Object.keys(node).forEach((key) => {
      traverseAndExtractValues(node[key], [...currentPath, key], entries);
    });
  }
}

// 根据路径设置值到 JSON 对象中
function setValueAtPath(obj: any, path: (string | number)[], value: any): void {
  let current = obj;
  for (let i = 0; i < path.length - 1; i++) {
    current = current[path[i]];
  }
  current[path[path.length - 1]] = value;
}

/**
 * 创建一个正则表达式，允许目标字符串中的字符之间有任意空白字符。
 * @param {string} target - 目标字符串。
 * @returns {RegExp} - 构建好的正则表达式。
 */
function createRegex(target: string) {
  // 转义正则表达式中的特殊字符
  const escaped = target.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
  // 在每个字符之间插入 \s*，允许有任意空白字符
  const pattern = escaped.split("").join("\\s*");
  return new RegExp(pattern, "g");
}

/**
 * 替换文本中匹配目标字符串（允许中间有空白）的部分为目标字符串本身。
 * @param {string} text - 原始文本。
 * @param {string} target - 目标字符串。
 * @returns {string} - 替换后的文本。
 */
function replaceWithNoSpaces(text: string, target: string) {
  const regex = createRegex(target);
  return text.replace(regex, target);
}
