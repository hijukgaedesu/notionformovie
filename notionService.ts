
import { ContentMetadata, NotionConfig, NotionDatabase } from "./types.ts";

const NOTION_VERSION = '2022-06-28';
const PUBLIC_PROXY = 'https://cors-anywhere.herokuapp.com/';

const extractDatabaseId = (input: string): string => {
  const cleaned = input.trim();
  const match = cleaned.match(/([a-f0-9]{32})/);
  return match ? match[1] : cleaned.replace(/-/g, "");
};

const getFetchParams = (path: string, apiKey: string, method: string = 'POST', useFallback: boolean = false) => {
  const baseUrl = useFallback ? `${PUBLIC_PROXY}https://api.notion.com/v1` : `/notion-api`;
  return {
    url: `${baseUrl}${path}`,
    options: {
      method,
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
    const { url, options } = getFetchParams('/search', apiKey, 'POST', false);
    let response = await fetch(url, { ...options, body: JSON.stringify({ filter: { property: "object", value: "database" } }) });
    if (response.status === 404 || !response.ok) {
      const { url: fUrl, options: fOpts } = getFetchParams('/search', apiKey, 'POST', true);
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

const getDatabaseSchema = async (apiKey: string, databaseId: string) => {
  const dbId = extractDatabaseId(databaseId);
  const { url, options } = getFetchParams(`/databases/${dbId}`, apiKey, 'GET', false);
  let response = await fetch(url, options);
  if (response.status === 404 || !response.ok) {
    const { url: fUrl, options: fOpts } = getFetchParams(`/databases/${dbId}`, apiKey, 'GET', true);
    response = await fetch(fUrl, fOpts);
  }
  if (!response.ok) throw new Error("데이터베이스 구조를 확인할 수 없습니다.");
  return response.json();
};

export const addToNotionDatabase = async (config: NotionConfig, content: ContentMetadata) => {
  // 1. DB 스키마를 가져와서 제목 타입 컬럼명과 감독/장르 컬럼 존재 확인
  const dbInfo = await getDatabaseSchema(config.apiKey, config.databaseId);
  const schemaProps = dbInfo.properties;
  
  // 제목(title) 타입인 컬럼명 자동 찾기
  const titleKey = Object.keys(schemaProps).find(key => schemaProps[key].type === 'title');
  
  if (!titleKey) {
    throw new Error("데이터베이스에 제목 속성이 없습니다.");
  }

  // 2. 속성 매핑 구성
  const notionProperties: any = {
    [titleKey]: { 
      title: [{ text: { content: content.title } }] 
    }
  };

  // '감독' 컬럼이 있으면 추가 (Rich Text)
  if (schemaProps["감독"]) {
    notionProperties["감독"] = { 
      rich_text: [{ text: { content: content.director || "정보 없음" } }] 
    };
  }

  // '장르' 컬럼이 있으면 추가 (Multi-Select)
  if (schemaProps["장르"] && schemaProps["장르"].type === 'multi_select') {
    const genreTags = (content.genres || []).map(g => ({ name: g.replace(/,/g, '') }));
    notionProperties["장르"] = { multi_select: genreTags };
  }
  
  // 3. 페이지 생성 요청
  const body = JSON.stringify({
    parent: { database_id: extractDatabaseId(config.databaseId) },
    cover: content.coverUrl ? { type: "external", external: { url: content.coverUrl } } : null,
    properties: notionProperties
  });
  
  const { url, options } = getFetchParams('/pages', config.apiKey, 'POST', false);
  let response = await fetch(url, { ...options, body });
  if (response.status === 404 || !response.ok) {
    const { url: fUrl, options: fOpts } = getFetchParams('/pages', config.apiKey, 'POST', true);
    response = await fetch(fUrl, { ...fOpts, body });
  }
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "노션 저장 실패");
  }
  
  return response.json();
};
