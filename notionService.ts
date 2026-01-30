
import { ContentMetadata, NotionConfig, NotionDatabase } from "./types.ts";

const NOTION_VERSION = '2022-06-28';
const PUBLIC_PROXY = 'https://cors-anywhere.herokuapp.com/';

const extractDatabaseId = (input: string): string => {
  const cleaned = input.trim();
  const match = cleaned.match(/([a-f0-9]{32})/);
  return match ? match[1] : cleaned.replace(/-/g, "");
};

const getFetchParams = (path: string, apiKey: string, useFallback: boolean = false) => {
  const baseUrl = useFallback ? `${PUBLIC_PROXY}https://api.notion.com/v1` : `/notion-api`;
  return {
    url: `${baseUrl}${path}`,
    options: {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_VERSION,
        'X-Requested-With': 'XMLHttpRequest'
      }
    }
  };
};

export const listDatabases = async (apiKey: string): Promise<NotionDatabase[]> => {
  try {
    const { url, options } = getFetchParams('/search', apiKey, false);
    let response = await fetch(url, { ...options, body: JSON.stringify({ filter: { property: "object", value: "database" } }) });
    if (response.status === 404 || !response.ok) {
      const { url: fUrl, options: fOpts } = getFetchParams('/search', apiKey, true);
      response = await fetch(fUrl, { ...fOpts, body: JSON.stringify({ filter: { property: "object", value: "database" } }) });
    }
    if (!response.ok) {
      const text = await response.text();
      if (text.includes("Missing required request header") || response.status === 403) throw new Error("PROXY_REQUIRED");
      throw new Error("연결 실패");
    }
    const data = await response.json();
    return (data.results || []).map((db: any) => ({ id: db.id, title: db.title?.[0]?.plain_text || 'Untitled' }));
  } catch (err: any) {
    if (err.message === "PROXY_REQUIRED") throw new Error("PROXY_DEMO_REQUIRED");
    throw err;
  }
};

export const addToNotionDatabase = async (config: NotionConfig, content: ContentMetadata) => {
  const body = JSON.stringify({
    parent: { database_id: extractDatabaseId(config.databaseId) },
    cover: content.coverUrl ? { type: "external", external: { url: content.coverUrl } } : null,
    properties: {
      "제목": { title: [{ text: { content: content.title } }] },
      "감독": { rich_text: [{ text: { content: content.director || "정보 없음" } }] },
      "장르": { multi_select: content.genres.map(name => ({ name })) },
      "분류": { select: { name: content.category || "영화" } }
    }
  });
  const { url, options } = getFetchParams('/pages', config.apiKey, false);
  let response = await fetch(url, { ...options, body });
  if (response.status === 404 || !response.ok) {
    const { url: fUrl, options: fOpts } = getFetchParams('/pages', config.apiKey, true);
    response = await fetch(fUrl, { ...fOpts, body });
  }
  if (!response.ok) throw new Error("저장 실패");
  return response.json();
};
