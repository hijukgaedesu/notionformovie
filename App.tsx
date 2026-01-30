
import React, { useState, useEffect } from 'react';
import { Search, Check, Settings, Database, AlertCircle, RefreshCw, User, PlusCircle, Image as ImageIcon, ExternalLink, Info, ShieldAlert, ChevronRight, X } from 'lucide-react';
import { searchContentDetails } from './geminiService.ts';
import { searchTmdbContent } from './tmdbService.ts';
import { addToNotionDatabase, listDatabases } from './notionService.ts';
import { ContentMetadata, AppStatus, NotionDatabase } from './types.ts';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'search' | 'setup'>('search');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [results, setResults] = useState<ContentMetadata[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [successIndices, setSuccessIndices] = useState<Set<number>>(new Set());
  
  const [apiKey, setApiKey] = useState(localStorage.getItem('notion_api_key') || '');
  const [selectedDbId, setSelectedDbId] = useState(localStorage.getItem('notion_db_id') || '');
  const [tmdbKey, setTmdbKey] = useState(localStorage.getItem('tmdb_api_key') || '');

  const [databases, setDatabases] = useState<NotionDatabase[]>(() => {
    const cached = localStorage.getItem('notion_databases_cache');
    return cached ? JSON.parse(cached) : [];
  });
  const [isLoadingDbs, setIsLoadingDbs] = useState(false);
  const [needsProxyDemo, setNeedsProxyDemo] = useState(false);

  useEffect(() => {
    localStorage.setItem('notion_api_key', apiKey.trim());
    localStorage.setItem('notion_db_id', selectedDbId.trim());
    localStorage.setItem('tmdb_api_key', tmdbKey.trim());
  }, [apiKey, selectedDbId, tmdbKey]);

  const handleFetchDatabases = async () => {
    if (!apiKey.trim()) { setError("API Key 필요"); return; }
    setIsLoadingDbs(true); setError(null); setNeedsProxyDemo(false);
    try {
      const dbs = await listDatabases(apiKey.trim());
      setDatabases(dbs);
      localStorage.setItem('notion_databases_cache', JSON.stringify(dbs));
    } catch (err: any) {
      if (err.message === "PROXY_DEMO_REQUIRED") setNeedsProxyDemo(true);
      else setError(err.message);
    } finally { setIsLoadingDbs(false); }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setStatus(AppStatus.SEARCHING); setError(null); setResults([]); setSuccessIndices(new Set());
    try {
      let data = tmdbKey.trim() ? await searchTmdbContent(query, tmdbKey.trim()).catch(() => searchContentDetails(query)) : await searchContentDetails(query);
      setResults(data);
      setStatus(AppStatus.SUCCESS);
      if (data.length === 0) setError("결과 없음");
    } catch (err: any) {
      setError(err.message);
      setStatus(AppStatus.ERROR);
    }
  };

  const handleImport = async (index: number) => {
    if (!selectedDbId || !apiKey) { setActiveTab('setup'); return; }
    setSavingIndex(index); setError(null);
    try {
      await addToNotionDatabase({ apiKey: apiKey.trim(), databaseId: selectedDbId.trim() }, results[index]);
      setSuccessIndices(prev => new Set(prev).add(index));
    } catch (err: any) {
      setError(`실패: ${err.message}`);
    } finally { setSavingIndex(null); }
  };

  return (
    <div className="w-[400px] h-[350px] bg-[#E3F2FD] rounded-xl shadow-2xl overflow-hidden flex flex-col border border-white/40 ring-1 ring-black/5 animate-in zoom-in-95 duration-300">
      {/* Mac Chrome Header */}
      <div className="bg-[#B9E2FE] px-3 pt-3 pb-0 flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5 px-1">
            <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57] shadow-inner" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E] shadow-inner" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#28C840] shadow-inner" />
          </div>
          <div className="text-[10px] font-bold text-blue-800/60 tracking-tight uppercase">Notion Widget</div>
        </div>
        
        {/* Chrome Style Tabs */}
        <div className="flex items-end gap-1 px-1 mt-1">
          <button 
            onClick={() => setActiveTab('search')}
            className={`px-4 py-1.5 text-[11px] font-bold rounded-t-lg transition-all flex items-center gap-1.5 ${activeTab === 'search' ? 'bg-[#E3F2FD] text-blue-700 shadow-[0_-2px_5px_rgba(0,0,0,0.05)]' : 'text-blue-900/40 hover:bg-white/30'}`}
          >
            <Search className="w-3 h-3" /> 검색
          </button>
          <button 
            onClick={() => setActiveTab('setup')}
            className={`px-4 py-1.5 text-[11px] font-bold rounded-t-lg transition-all flex items-center gap-1.5 ${activeTab === 'setup' ? 'bg-[#E3F2FD] text-blue-700 shadow-[0_-2px_5px_rgba(0,0,0,0.05)]' : 'text-blue-900/40 hover:bg-white/30'}`}
          >
            <Settings className="w-3 h-3" /> 설정 {(!apiKey || !selectedDbId) && <div className="w-1 h-1 bg-red-500 rounded-full animate-pulse" />}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 relative bg-[#E3F2FD]">
        {activeTab === 'setup' ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest px-1">1. Notion API Key</label>
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="secret_..." className="w-full px-3 py-2 bg-white/60 border border-white/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 text-xs transition-all placeholder:text-blue-200" />
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest px-1">2. Database Selection</label>
              {needsProxyDemo && (
                <a href="https://cors-anywhere.herokuapp.com/corsdemo" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 w-full py-2 bg-red-500 text-white rounded-lg text-[9px] font-black hover:bg-red-600 transition-colors shadow-lg shadow-red-100">
                  <ShieldAlert className="w-3 h-3" /> Proxy 권한 활성화하기 (필수)
                </a>
              )}
              {databases.length > 0 && (
                <div className="grid gap-1 max-h-24 overflow-y-auto p-1 border border-white/40 rounded-lg bg-white/30">
                  {databases.map(db => (
                    <button key={db.id} onClick={() => setSelectedDbId(db.id)} className={`text-left px-2 py-1.5 rounded-md text-[10px] truncate flex items-center justify-between transition-all ${selectedDbId === db.id ? 'bg-white text-blue-700 font-bold shadow-sm' : 'text-gray-500 hover:bg-white/50'}`}>
                      <span className="truncate">{db.title}</span>
                      {selectedDbId === db.id && <Check className="w-2.5 h-2.5" />}
                    </button>
                  ))}
                </div>
              )}
              <button onClick={handleFetchDatabases} disabled={isLoadingDbs || !apiKey.trim()} className="w-full py-2.5 bg-blue-500 text-white rounded-lg text-xs font-bold hover:bg-blue-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-md">
                {isLoadingDbs ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Database className="w-3 h-3" />} DB 목록 가져오기
              </button>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-white/40">
              <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest px-1">3. TMDB Key (Optional)</label>
              <input 
                type="password" 
                value={tmdbKey} 
                onChange={(e) => setTmdbKey(e.target.value)} 
                placeholder="API key for posters..." 
                className="w-full px-3 py-2 bg-white/60 border border-white/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 text-xs placeholder:text-blue-200" 
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in duration-300">
            <form onSubmit={handleSearch} className="relative">
              <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="콘텐츠 제목 입력..." className="w-full pl-9 pr-3 py-2.5 bg-white border border-white/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 text-xs shadow-sm transition-all" />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300" />
              {status === AppStatus.SEARCHING && <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-400 animate-spin" />}
            </form>

            <div className="space-y-2 pb-2">
              {results.map((item, idx) => (
                <div key={idx} className="bg-white/50 hover:bg-white border border-white/60 rounded-xl p-2 flex gap-3 items-center group transition-all animate-in slide-in-from-bottom-1 duration-300">
                  <div className="w-10 h-14 bg-gray-200 rounded-md overflow-hidden shrink-0 shadow-sm">
                    <ImagePreview src={item.coverUrl} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[11px] font-bold text-gray-800 truncate mb-0.5">{item.title}</h4>
                    <p className="text-[9px] text-gray-400 flex items-center gap-1 truncate"><User className="w-2.5 h-2.5" /> {item.director || "정보 없음"}</p>
                    <div className="flex gap-1 mt-1">
                      <span className="text-[8px] font-bold px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-sm truncate">{item.category || "콘텐츠"}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleImport(idx)} 
                    disabled={savingIndex !== null || successIndices.has(idx)}
                    className={`p-2 rounded-full transition-all ${successIndices.has(idx) ? 'bg-green-100 text-green-600' : 'bg-blue-500 text-white hover:bg-blue-600 shadow-md active:scale-90'}`}
                  >
                    {savingIndex === idx ? <RefreshCw className="w-4 h-4 animate-spin" /> : successIndices.has(idx) ? <Check className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />}
                  </button>
                </div>
              ))}
              {status === AppStatus.IDLE && !error && (
                <div className="py-10 text-center space-y-2 opacity-20">
                  <Search className="w-8 h-8 mx-auto" />
                  <p className="text-[10px] font-medium">영화나 드라마 제목을 입력하세요</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Floating Error Toast */}
        {error && (
          <div className="absolute bottom-4 left-4 right-4 p-2 bg-red-500 text-white rounded-lg text-[9px] font-bold flex items-center gap-2 shadow-xl animate-in fade-in slide-in-from-bottom-2">
            <AlertCircle className="w-3 h-3 shrink-0" /> <span className="flex-1 truncate">{error}</span>
            <button onClick={() => setError(null)}><X className="w-3 h-3" /></button>
          </div>
        )}
      </div>
    </div>
  );
};

const ImagePreview: React.FC<{ src: string }> = ({ src }) => {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  if (!src || error) return <div className="w-full h-full flex items-center justify-center bg-gray-100"><ImageIcon className="w-4 h-4 text-gray-300" /></div>;

  return (
    <div className="relative w-full h-full">
      {loading && <div className="absolute inset-0 bg-gray-100 animate-pulse" />}
      <img 
        src={src} 
        className={`w-full h-full object-cover transition-opacity duration-300 ${loading ? 'opacity-0' : 'opacity-100'}`} 
        onLoad={() => setLoading(false)} 
        onError={() => setError(true)} 
        referrerPolicy="no-referrer" 
      />
    </div>
  );
};

export default App;
