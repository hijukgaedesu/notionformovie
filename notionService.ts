
import { ContentMetadata, NotionConfig, NotionDatabase } from "./types";

const NOTION_VERSION = '2022-06-28';
const PUBLIC_PROXY = 'https://cors-anywhere.herokuapp.com/';

/**
 * 노션 URL 또는 ID에서 순수 32자리 ID만 추출합니다.
 */
const extractDatabaseId = (input: string): string => {
  const cleaned = input.trim();
  const match = cleaned.match(/([a-f0-9]{32})/);
  return match ? match[1] : cleaned.replace(/-/g, "");
};

const sanitizeHeaderValue = (value: string): string => {
  return value.trim().replace(/[^\x00-\x7F]/g, "");
};

/**
 * 통신 환경에 따라 적절한 엔드포인트를 반환합니다.
 */
const getFetchParams = (path: string, apiKey: string, useFallback: boolean = false) => {
  const safeKey = sanitizeHeaderValue(apiKey);
  const baseUrl = useFallback 
    ? `${PUBLIC_PROXY}https://api.notion.com/v1` 
    : `/notion-api`; // Vercel Rewrite path

  return {
    url: `${baseUrl}${path}`,
    options: {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${safeKey}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_VERSION,
        'X-Requested-With': 'XMLHttpRequest'
      }
    }
  };
};

export const listDatabases = async (apiKey: string): Promise<NotionDatabase[]> => {
  // 1차 시도: Vercel Rewrite (최적화 경로)
  try {
    const { url, options } = getFetchParams('/search', apiKey, false);
    let response = await fetch(url, {
      ...options,
      body: JSON.stringify({
        filter: { property: "object", value: "database" },
        page_size: 100
      })
    });

    // 404가 발생하면(Vercel 환경이 아니면) 프록시로 재시도
    if (response.status === 404 || !response.ok) {
      const { url: fallbackUrl, options: fallbackOptions } = getFetchParams('/search', apiKey, true);
      response = await fetch(fallbackUrl, {
        ...fallbackOptions,
        body: JSON.stringify({
          filter: { property: "object", value: "database" },
          page_size: 100
        })
      });
    }

    if (!response.ok) {
      if (response.status === 403) throw new Error("ACCESS_DENIED");
      if (response.status === 401) throw new Error("INVALID_KEY");
      if (response.status === 429) throw new Error("너무 많은 요청이 발생했습니다. 잠시 후 시도하세요.");
      
      // 프록시 권한 문제 체크 (cors-anywhere 특유의 에러)
      const text = await response.text();
      if (text.includes("Missing required request header") || response.status === 403) {
        throw new Error("PROXY_REQUIRED");
      }
      throw new Error(`연결 오류 (${response.status})`);
    }
    
    const data = await response.json();
    return (data.results || []).map((db: any) => ({
      id: db.id,
      title: db.title?.[0]?.plain_text || '이름 없는 DB'
    }));
  } catch (err: any) {
    if (err.message === "ACCESS_DENIED") throw new Error("노션 DB 설정에서 '연결 추가'가 되어있는지 확인하세요.");
    if (err.message === "INVALID_KEY") throw new Error("입력하신 노션 API 키가 올바르지 않습니다.");
    if (err.message === "PROXY_REQUIRED") throw new Error("PROXY_DEMO_REQUIRED");
    throw err;
  }
};

export const addToNotionDatabase = async (
  config: NotionConfig,
  content: ContentMetadata
) => {
  const safeDbId = extractDatabaseId(config.databaseId);
  const body = JSON.stringify({
    parent: { database_id: safeDbId },
    cover: (content.coverUrl) ? {
      type: "external",
      external: { url: content.coverUrl }
    } : null,
    properties: {
      "제목": { title: [{ text: { content: content.title } }] },
      "감독": { rich_text: [{ text: { content: content.director || "정보 없음" } }] },
      "장르": { multi_select: content.genres.map(name => ({ name })) },
      "분류": { select: { name: content.category || "기타" } }
    }
  });

  // 페이지 생성도 동일하게 하이브리드 로직 적용
  const { url, options } = getFetchParams('/pages', config.apiKey, false);
  let response = await fetch(url, { ...options, body });

  if (response.status === 404 || !response.ok) {
    const { url: fUrl, options: fOpts } = getFetchParams('/pages', config.apiKey, true);
    response = await fetch(fUrl, { ...fOpts, body });
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "데이터 저장 실패");
  }

  return await response.json();
};
