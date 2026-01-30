
import { ContentMetadata } from "./types";

const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/original";

let movieGenres: { [key: number]: string } = {};
let tvGenres: { [key: number]: string } = {};

const fetchGenreList = async (apiKey: string) => {
  if (Object.keys(movieGenres).length > 0) return;

  try {
    const [mRes, tRes] = await Promise.all([
      fetch(`${BASE_URL}/genre/movie/list?api_key=${apiKey}&language=ko-KR`),
      fetch(`${BASE_URL}/genre/tv/list?api_key=${apiKey}&language=ko-KR`)
    ]);

    if (mRes.ok) {
      const mData = await mRes.json();
      mData.genres.forEach((g: any) => (movieGenres[g.id] = g.name));
    }
    if (tRes.ok) {
      const tData = await tRes.json();
      tData.genres.forEach((g: any) => (tvGenres[g.id] = g.name));
    }
  } catch (e) {
    console.warn("장르 목록 로드 실패 (검색은 계속 진행됨)", e);
  }
};

export const searchTmdbContent = async (query: string, apiKey: string): Promise<ContentMetadata[]> => {
  if (!apiKey) throw new Error("TMDB API 키가 설정되지 않았습니다.");

  await fetchGenreList(apiKey);

  try {
    const searchRes = await fetch(
      `${BASE_URL}/search/multi?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=ko-KR`
    );
    
    if (searchRes.status === 401) {
      throw new Error("TMDB API 키가 유효하지 않습니다. 설정을 확인해주세요.");
    }
    
    if (!searchRes.ok) throw new Error(`TMDB 통신 오류 (상태코드: ${searchRes.status})`);
    
    const searchData = await searchRes.json();
    const results = (searchData.results || [])
      .filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv')
      .slice(0, 6);

    if (results.length === 0) return [];

    const detailedResults = await Promise.all(results.map(async (item: any) => {
      let director = "정보 없음";
      let genres: string[] = [];

      const genreMap = item.media_type === 'movie' ? movieGenres : tvGenres;
      if (item.genre_ids) {
        genres = item.genre_ids.map((id: number) => genreMap[id]).filter(Boolean);
      }
      
      try {
        const creditsRes = await fetch(
          `${BASE_URL}/${item.media_type}/${item.id}/credits?api_key=${apiKey}&language=ko-KR`
        );
        if (creditsRes.ok) {
          const creditsData = await creditsRes.json();
          if (item.media_type === 'movie') {
            const dirObj = (creditsData.crew || []).find((c: any) => c.job === 'Director');
            if (dirObj) director = dirObj.name;
          } else {
            const tvDetailRes = await fetch(`${BASE_URL}/tv/${item.id}?api_key=${apiKey}&language=ko-KR`);
            if (tvDetailRes.ok) {
              const tvDetail = await tvDetailRes.json();
              if (tvDetail.created_by && tvDetail.created_by.length > 0) {
                director = tvDetail.created_by.map((p: any) => p.name).join(", ");
              }
            }
          }
        }
      } catch (e) {
        console.warn(`${item.title || item.name} 제작진 정보 로드 실패`);
      }

      return {
        title: item.title || item.name,
        director: director,
        category: item.media_type === 'movie' ? '영화' : '드라마',
        genres: genres,
        coverUrl: item.poster_path ? `${IMAGE_BASE_URL}${item.poster_path}` : "",
        platform: "TMDB",
        releaseDate: item.release_date || item.first_air_date || ""
      };
    }));

    return detailedResults;
  } catch (err: any) {
    throw err;
  }
};
