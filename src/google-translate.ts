import { translate } from "@vitalets/google-translate-api";
import { RawResponse } from "@vitalets/google-translate-api/dist/cjs/types";
import { SocksProxyAgent } from 'socks-proxy-agent';

export async function googleTranslate(
  content: string,
  src: string,
  dst: string,
  proxy?: string
): Promise<string> {
  try {
    let agent;  // 在这里声明 agent

    if (proxy) {
      agent = new SocksProxyAgent(proxy);  // 如果有 proxy，才实例化 agent
    }

    const options = {
      from: src,
      to: dst,
      fetchOptions: {agent},  // 使用外部声明的 agent
    };

    const result = await translate(content, options);
    return result.text;
  } catch (error: any) {
    throw new Error(`Translation failed: ${error.message || error}`);
  }
}