
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
  /**
   * 사용자의 요청에 따른 컬럼 매핑 전략:
   * 1. '제목' 칼럼은 따로 없으므로, 노션 페이지의 기본 'title' 속성(보통 '이름')에 영화 제목을 넣습니다.
   * 2. '감독', '장르' 정보는 각각의 타입에 맞춰 데이터를 보냅니다.
   * 3. '감상 완료일', '평점' 칼럼은 노션에 존재하지만 위젯에서는 비워둡니다 (사용자 직접 입력용).
   */
  
  const body = JSON.stringify({
    parent: { database_id: extractDatabaseId(config.databaseId) },
    cover: content.coverUrl ? { type: "external", external: { url: content.coverUrl } } : null,
    properties: {
      // 노션의 기본 제목 속성 (보통 '이름'으로 되어 있습니다)
      "이름": { 
        title: [{ text: { content: content.title } }] 
      },
      "감독": { 
        rich_text: [{ text: { content: content.director || "정보 없음" } }] 
      },
      "장르": { 
        multi_select: (content.genres || []).map(name => ({ name })) 
      }
      // '감상 완료일'과 '평점'은 값을 보내지 않으면 노션에서 빈 칸으로 생성됩니다.
    }
  });
  
  const { url, options } = getFetchParams('/pages', config.apiKey, false);
  let response = await fetch(url, { ...options, body });
  if (response.status === 404 || !response.ok) {
    const { url: fUrl, options: fOpts } = getFetchParams('/pages', config.apiKey, true);
    response = await fetch(fUrl, { ...fOpts, body });
  }
  
  if (!response.ok) {
    const errorData = await response.json();
    // 만약 '이름'이라는 컬럼명이 아니라면 에러가 날 수 있으므로 상세 메시지 출력
    console.error("Notion Import Error:", errorData);
    throw new Error(errorData.message || "노션 저장에 실패했습니다. 컬럼명을 확인해주세요.");
  }
  
  return response.json();
};
