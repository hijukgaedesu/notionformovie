
export interface ContentMetadata {
  title: string;
  director: string;
  category: string;
  genres: string[]; // 단일 string에서 string[]로 변경
  coverUrl: string;
  platform: string;
  description?: string;
  releaseDate?: string;
  // Added sources property to hold search grounding links as required by guidelines
  sources?: { title: string; uri: string }[];
}

export interface NotionConfig {
  apiKey: string;
  databaseId: string;
  proxyUrl?: string;
}

export interface NotionDatabase {
  id: string;
  title: string;
}

export enum AppStatus {
  IDLE = 'IDLE',
  SEARCHING = 'SEARCHING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  SAVING_TO_NOTION = 'SAVING_TO_NOTION'
}
