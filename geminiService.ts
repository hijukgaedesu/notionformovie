
import { GoogleGenAI, Type } from "@google/genai";
import { ContentMetadata } from "./types";

export const searchContentDetails = async (query: string): Promise<ContentMetadata[]> => {
  // Fix: Create a new GoogleGenAI instance right before making an API call as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `사용자가 입력한 "${query}"와 관련된 영화/드라마 정보를 최대 5개 찾아주세요.
    
    [이미지 수집 특명 - 절대 준수]
    1. 'googleSearch'를 사용하여 작품의 공식 포스터를 찾으세요.
    2. **반드시 .jpg, .png, .webp 등으로 끝나는 "이미지 파일 자체의 직링크"를 가져오세요.** 웹페이지(html) 주소는 절대 안 됩니다.
    3. TMDB(image.tmdb.org), IMDb(m.media-amazon.com), 넷플릭스/왓챠 정적 이미지 서버의 주소를 최우선으로 선택하세요.
    4. 다음/네이버 등의 검색 결과 썸네일 주소는 만료될 수 있으므로 피하세요.
    
    JSON 반환 형식:
    - title: 작품 제목
    - director: 감독/작가 이름
    - genres: 작품의 장르 목록 (예: ["액션", "SF"])
    - coverUrl: 반드시 이미지 파일 직링크 (예: https://image.tmdb.org/t/p/original/abc.jpg)
    - platform: Netflix, Watcha 등 서비스 중인 플랫폼`,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            director: { type: Type.STRING },
            genres: { type: Type.ARRAY, items: { type: Type.STRING } },
            coverUrl: { type: Type.STRING },
            platform: { type: Type.STRING }
          },
          required: ["title", "director", "genres", "coverUrl", "platform"]
        }
      }
    }
  });

  try {
    const text = response.text.trim();
    let data = JSON.parse(text) as any[];
    
    // Fix: Extract grounding chunks as required by Search Grounding guidelines
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = groundingChunks
      .filter((chunk: any) => chunk.web)
      .map((chunk: any) => ({
        title: chunk.web.title,
        uri: chunk.web.uri
      }));
    
    return data.map(item => ({
      title: item.title,
      director: item.director,
      genres: item.genres,
      coverUrl: item.coverUrl,
      platform: item.platform,
      category: "", 
      sources: sources.length > 0 ? sources : undefined
    }));
  } catch (error) {
    console.error("Gemini Search Error:", error);
    throw new Error("정보를 검색하는 중 오류가 발생했습니다.");
  }
};
