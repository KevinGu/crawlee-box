import axios from "axios";

// 假设环境变量已经设置
const username: string = "geonode_BmIrmyRbd8";
const password: string = "ece7ed10-ce76-4499-9ab3-196c541874f2";
const GEONODE_DNS: string = "shared-datacenter.geonode.com";
const GEONODE_PORT: number = 9000;

export async function getProxy(): Promise<any | null> {
  try {
    const response = await axios.get("http://ip-api.com", {
      proxy: {
        protocol: "https",
        host: GEONODE_DNS,
        port: GEONODE_PORT,
        auth: {
          username,
          password,
        },
      },
    });
    return response.data;
  } catch (err) {
    console.error(err);
    return null; // 明确返回 null 表示失败
  }
}

export async function getProxies(num: number): Promise<any[]> {
  const promises = [];
  for (let i = 0; i < num; i++) {
    promises.push(getProxy());
  }
  return Promise.all(promises); // 使用 Promise.all 等待所有代理
}
