import { invoke } from "@tauri-apps/api/core";
import type { AIMessage, Tool, ToolCall } from "./ai";
import type { Language } from "../translations";

interface WebSearchItem {
  title: string;
  url: string;
  snippet: string;
  engine?: string;
}

interface WebPageResult {
  url: string;
  title: string;
  content: string;
}

interface WebSearchToolResult {
  type: "web_search_results";
  query: string;
  result_count: number;
  items: WebSearchItem[];
}

interface WebPageToolResult extends WebPageResult {
  type: "web_page";
}

export const researchTools: Tool[] = [
  {
    type: "function",
    function: {
      name: "search_web",
      description:
        "搜索互联网资料。只要用户明确要求查询资料、搜索文档、联网查信息、查公开情报、查组件说明、查漏洞说明，就应立即优先调用该工具。如果首轮结果不够相关，必须继续自主改写关键词重试，可加入 site:域名、官方站点名、年份、版本号、城市名、引号短语等约束，而不是向用户索要链接。查询 CVE、版本漏洞、攻击模式情报和工具文档时，应优先收敛到官方公告、权威安全站点、技术社区或官方文档。",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "检索关键词" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch_webpage",
      description:
        "抓取网页正文。拿到搜索结果后，如需阅读具体页面内容、提取说明、整理资料摘要，应继续调用该工具。若首个页面不够相关，应返回搜索结果继续选择其他候选页，而不是直接放弃。面对 CVE、版本安全公告和工具文档时，优先抓取官方页面或高质量技术来源正文。",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "要抓取的网页 URL" },
        },
        required: ["url"],
      },
    },
  },
];

export async function executeResearchTool(toolCall: ToolCall, language: Language): Promise<AIMessage | null> {
  if (toolCall.function.name === "search_web") {
    const args = JSON.parse(toolCall.function.arguments) as { query?: string };
    const query = args.query?.trim();
    if (!query) {
      return {
        role: "tool",
        content: language === "zh" ? "搜索关键词为空。" : "Search query is empty.",
        tool_call_id: toolCall.id,
      };
    }

    const results = await invoke<WebSearchItem[]>("web_search", { query });
    const payload: WebSearchToolResult = {
      type: "web_search_results",
      query,
      result_count: results.length,
      items: results,
    };
    return {
      role: "tool",
      content: JSON.stringify(payload, null, 2),
      tool_call_id: toolCall.id,
    };
  }

  if (toolCall.function.name === "fetch_webpage") {
    const args = JSON.parse(toolCall.function.arguments) as { url?: string };
    const url = args.url?.trim();
    if (!url) {
      return {
        role: "tool",
        content: language === "zh" ? "网页地址为空。" : "Web page URL is empty.",
        tool_call_id: toolCall.id,
      };
    }

    const result = await invoke<WebPageResult>("fetch_webpage", { url });
    const payload: WebPageToolResult = {
      type: "web_page",
      ...result,
    };
    return {
      role: "tool",
      content: JSON.stringify(payload, null, 2),
      tool_call_id: toolCall.id,
    };
  }

  return null;
}
