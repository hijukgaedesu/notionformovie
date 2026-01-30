
import { ContentMetadata } from "./types.ts";

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
  } catch (e) {}
};

export const searchTmdbContent = async (query: string, apiKey: string): Promise<ContentMetadata[]> => {
  if (!apiKey) throw new Error("TMDB Key 없음");
  await fetchGenreList(apiKey);
  const searchRes = await fetch(`${BASE_URL}/search/multi?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=ko-KR`);
  if (!searchRes.ok) throw new Error("TMDB 통신 오류");
  const searchData = await searchRes.json();
  const results = (searchData.results || []).filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv').slice(0, 6);
  if (results.length === 0) return [];
  return Promise.all(results.map(async (item: any) => {
    let director = "정보 없음";
    let genres = item.genre_ids ? item.genre_ids.map((id: number) => (item.media_type === 'movie' ? movieGenres : tvGenres)[id]).filter(Boolean) : [];
    try {
      const creditsRes = await fetch(`${BASE_URL}/${item.media_type}/${item.id}/credits?api_key=${apiKey}&language=ko-KR`);
      if (creditsRes.ok) {
        const creditsData = await creditsRes.json();
        if (item.media_type === 'movie') {
          const dirObj = (creditsData.crew || []).find((c: any) => c.job === 'Director');
          if (dirObj) director = dirObj.name;
        } else {
          const tvDetailRes = await fetch(`${BASE_URL}/tv/${item.id}?api_key=${apiKey}&language=ko-KR`);
          const tvDetail = await tvDetailRes.json();
          if (tvDetail.created_by?.length > 0) director = tvDetail.created_by.map((p: any) => p.name).join(", ");
        }
      }
    } catch (e) {}
    return {
      title: item.title || item.name,
      director,
      category: item.media_type === 'movie' ? '영화' : '드라마',
      genres,
      coverUrl: item.poster_path ? `${IMAGE_BASE_URL}${item.poster_path}` : "",
      platform: "TMDB",
      releaseDate: item.release_date || item.first_air_date || ""
    };
  }));
};
