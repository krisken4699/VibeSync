import React, { useState, useEffect, useRef } from 'react';
import { Music, LogIn, LogOut, Info, User, Trash2, PlusCircle, Check, Wand2, Search, Sparkles, ChevronLeft, Shuffle } from 'lucide-react';

const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
// Use the correct model - 2.0 flash is current
const GEMINI_MODEL = 'gemini-2.0-flash-exp';

const isDev = window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname.includes("ngrok-free");

const getRedirectUri = () => {
  const base = isDev ? window.location.origin : import.meta.env.VITE_REDIRECT_URI_PROD;
  return base ? base.replace(/\/$/, '') : '';
};

const REDIRECT_URI = getRedirectUri();
const AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";
const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const SCOPES = "playlist-modify-public playlist-modify-private user-read-private user-read-email user-top-read";

// ─── Mood config ──────────────────────────────────────────
const MOODS = [
  { id: 'sad', emoji: '😔', label: 'Sad' },
  { id: 'happy', emoji: '😁', label: 'Happy' },
  { id: 'angry', emoji: '😤', label: 'Angry' },
  { id: 'anxious', emoji: '😰', label: 'Anxious' },
  { id: 'bored', emoji: '😑', label: 'Bored' },
  { id: 'custom', emoji: '✏️', label: 'Describe it' },
];

const ARCHETYPES = {
  sad: [
    { id: 'wallow', label: 'I Loved Her', emoji: '💔', desc: 'Sink into it. Sad songs for sad days.', searchHint: 'heartbreak melancholy sad ballad emotional' },
    { id: 'cheer', label: 'Cheer Me Up', emoji: '☀️', desc: 'Pull me out of it. Uplifting and warm.', searchHint: 'uplifting feel-good happy energetic pop' },
    { id: 'rage', label: 'RAHHH', emoji: '🔥', desc: 'Channel it into something fierce.', searchHint: 'angry empowerment fierce punk rock breakup anthem' },
    { id: 'surprise', label: 'Surprise Me', emoji: '🎲', desc: 'I have no idea what I need. Pick for me.', searchHint: 'unexpected eclectic genre-blending unique discovery' },
  ],
  happy: [
    { id: 'ride', label: 'Keep It Going', emoji: '🚀', desc: 'Match the energy. Let\'s go higher.', searchHint: 'euphoric energetic dance pop feel-good banger' },
    { id: 'contrast', label: 'Calm Me Down', emoji: '🌊', desc: 'Balance it out. Chill and smooth.', searchHint: 'chill lofi ambient mellow smooth downtempo' },
    { id: 'chaos', label: 'I\'m Unhinged', emoji: '⚡', desc: 'Turn it into something chaotic and loud.', searchHint: 'aggressive metal punk hardcore noise experimental' },
    { id: 'surprise', label: 'Surprise Me', emoji: '🎲', desc: 'Just vibe me something unexpected.', searchHint: 'unexpected genre-blending eclectic discovery' },
  ],
  angry: [
    { id: 'fuel', label: 'Feed the Fire', emoji: '💢', desc: 'More rage. Louder. Harder.', searchHint: 'metal hardcore punk aggressive heavy brutal' },
    { id: 'detox', label: 'Cool It Down', emoji: '🧊', desc: 'Something to slowly bring me back.', searchHint: 'calming ambient peaceful meditative slow' },
    { id: 'groove', label: 'Angry but Groovy', emoji: '😤', desc: 'Angry energy but with a rhythm.', searchHint: 'hip hop aggressive trap dark funk groove' },
    { id: 'surprise', label: 'Surprise Me', emoji: '🎲', desc: 'Anger is just energy. Channel it anywhere.', searchHint: 'unexpected genre-blending unique' },
  ],
  anxious: [
    { id: 'ground', label: 'Ground Me', emoji: '🌿', desc: 'Slow my brain down. Calm and steady.', searchHint: 'ambient calm lofi peaceful meditative acoustic' },
    { id: 'mask', label: 'Drown It Out', emoji: '🎧', desc: 'Something loud enough to stop the thoughts.', searchHint: 'loud energetic intense wall of sound focus' },
    { id: 'relate', label: 'You Get It', emoji: '🫂', desc: 'Songs that understand the spiral.', searchHint: 'anxiety overthinking introspective indie emotional' },
    { id: 'surprise', label: 'Distract Me', emoji: '🎲', desc: 'Literally anything. Just get me out of my head.', searchHint: 'fun quirky upbeat distraction playful' },
  ],
  bored: [
    { id: 'discover', label: 'Find Me Something New', emoji: '🔭', desc: 'I want to hear something I\'ve never heard.', searchHint: 'underground obscure niche emerging artist discovery' },
    { id: 'nostalgia', label: 'Take Me Back', emoji: '📼', desc: 'Old favorites. Nostalgic hits.', searchHint: 'nostalgic classic throwback 90s 00s retro' },
    { id: 'intensity', label: 'Wake Me Up', emoji: '⚡', desc: 'Something intense to jolt me out of this.', searchHint: 'high energy intense fast-paced adrenaline' },
    { id: 'surprise', label: 'Surprise Me', emoji: '🎲', desc: 'Randomize it completely.', searchHint: 'eclectic random genre-blending unexpected' },
  ],
};

// ─── Auth helpers ─────────────────────────────────────────
const generateRandomString = (length) => {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], "");
};
const sha256 = async (plain) => window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(plain));
const base64encode = (input) => btoa(String.fromCharCode(...new Uint8Array(input))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

// Simple fetch without retry for Spotify (your old code worked, so keep it simple)
const searchTracks = async (token, query) => {
  if (!query || query.trim() === '') return [];

  // Clean the query - remove special characters and limit length
  const cleanQuery = query
    .replace(/[^\w\s]/g, ' ')  // Replace special chars with space
    .replace(/\s+/g, ' ')       // Replace multiple spaces with single space
    .trim()
    .slice(0, 50);              // Limit to 50 chars max

  if (!cleanQuery) return [];

  console.log('Searching Spotify with:', cleanQuery); // Debug

  try {
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(cleanQuery)}&type=track&limit=10`, // Changed to 10
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (res.status === 401) {
      handleLogout();
      return [];
    }

    if (!res.ok) {
      const errorText = await res.text();
      console.error('Search failed:', errorText);
      return [];
    }

    const data = await res.json();
    return (data.tracks?.items || []).map(t => ({
      id: t.id,
      title: t.name,
      artist: t.artists.map(a => a.name).join(', '),
      album: t.album.name,
      uri: t.uri,
      image: t.album.images?.[1]?.url || t.album.images?.[0]?.url || '',
    }));
  } catch (e) {
    console.error('Search error:', e);
    return [];
  }
};
// Generate search query with variety based on user's taste
const generateQuery = (baseHint, userTopData) => {
  if (!userTopData?.artists?.length) return baseHint;

  const artists = userTopData.artists;

  // Pick ONE random artist name (just the first word if it's long)
  const randomArtist = artists[Math.floor(Math.random() * artists.length)]?.name || '';
  const shortArtist = randomArtist.split(' ')[0]; // Take just first word

  // Much simpler queries - just the base hint OR hint + artist
  // Removed genres which can be weird strings
  const variations = [
    baseHint.split(' ').slice(0, 3).join(' '), // Only first 3 words of hint
    `${baseHint.split(' ')[0]} ${shortArtist}`, // First word of hint + artist
    shortArtist, // Just the artist name
  ].filter(q => q.length > 2); // Remove very short queries

  // Return a very simple query
  return variations[Math.floor(Math.random() * variations.length)]
    .replace(/[^\w\s]/g, '')
    .trim()
    .slice(0, 30); // Max 30 chars
};
export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [isConnected, setIsConnected] = useState(!!localStorage.getItem("token"));
  const [userProfile, setUserProfile] = useState(null);
  const [userTopData, setUserTopData] = useState(null);
  const [showDebug, setShowDebug] = useState(false);

  const [step, setStep] = useState('mood');
  const [selectedMood, setSelectedMood] = useState(null);
  const [selectedArchetype, setSelectedArchetype] = useState(null);
  const [customMoodText, setCustomMoodText] = useState('');

  const [tracks, setTracks] = useState([]);
  const [queue, setQueue] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [playlistMeta, setPlaylistMeta] = useState({ name: '', description: '' });
  const [saveStatus, setSaveStatus] = useState('');
  const [error, setError] = useState('');

  const processedCode = useRef(null);

  // ─── Auth ──────────────────────────────────────────────
  const fetchUserProfile = async (t) => {
    if (!t) return;
    const res = await fetch('https://api.spotify.com/v1/me', { headers: { Authorization: `Bearer ${t}` } });
    if (res.ok) setUserProfile(await res.json());
    else if (res.status === 401) handleLogout();
  };

  const fetchUserTopData = async (t) => {
    if (!t) return;
    try {
      const [ar, tr] = await Promise.all([
        fetch('https://api.spotify.com/v1/me/top/artists?limit=10&time_range=medium_term', { headers: { Authorization: `Bearer ${t}` } }),
        fetch('https://api.spotify.com/v1/me/top/tracks?limit=10&time_range=medium_term', { headers: { Authorization: `Bearer ${t}` } }),
      ]);
      setUserTopData({
        artists: ar.ok ? (await ar.json()).items : [],
        tracks: tr.ok ? (await tr.json()).items : [],
      });
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (token) { fetchUserProfile(token); fetchUserTopData(token); }
  }, [token]);

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      if (!code || processedCode.current === code) return;
      processedCode.current = code;
      window.history.replaceState({}, '', window.location.pathname);
      const verifier = localStorage.getItem('code_verifier');
      try {
        const res = await fetch(TOKEN_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ client_id: SPOTIFY_CLIENT_ID, grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI, code_verifier: verifier }),
        });
        const data = await res.json();
        if (data.access_token) {
          localStorage.setItem('token', data.access_token);
          setToken(data.access_token);
          setIsConnected(true);
        }
      } catch (e) { console.error(e); }
    };
    run();
  }, []);

  const handleConnect = async () => {
    const verifier = generateRandomString(64);
    const challenge = base64encode(await sha256(verifier));
    localStorage.setItem('code_verifier', verifier);
    window.location.href = `${AUTH_ENDPOINT}?${new URLSearchParams({
      response_type: 'code', client_id: SPOTIFY_CLIENT_ID, scope: SCOPES,
      code_challenge_method: 'S256', code_challenge: challenge, redirect_uri: REDIRECT_URI,
    })}`;
  };

  const handleLogout = () => {
    localStorage.removeItem('token'); localStorage.removeItem('code_verifier');
    setToken(''); setIsConnected(false); setUserProfile(null); setUserTopData(null);
    reset();
  };

  // ─── Main logic ────────────────────────────────────────
  const handleMoodSelect = (mood) => {
    if (mood.id === 'custom') {
      setSelectedMood(mood);
      setStep('custom');
    } else {
      setSelectedMood(mood);
      setStep('archetype');
    }
  };

  // For regular archetypes - NO GEMINI, just taste-based search with variety
  const handleArchetypeSelect = async (archetype) => {
    setSelectedArchetype(archetype);
    setStep('results');
    setIsLoading(true);
    setError('');
    setTracks([]);

    try {
      // Generate query with variety based on user's taste
      const query = generateQuery(archetype.searchHint, userTopData);

      // Search Spotify directly - just like your old code worked
      const found = await searchTracks(token, query);

      setTracks(found);
      setPlaylistMeta({
        name: `${selectedMood.emoji} ${archetype.label}`,
        description: archetype.desc
      });

      if (found.length === 0) {
        setError('No tracks found. Try a different vibe.');
      }
    } catch (e) {
      console.error('Search error:', e);
      setError('Something went wrong. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // For custom text - ONLY HERE WE USE GEMINI for NLP
  const handleCustomSubmit = async () => {
    if (!customMoodText.trim()) return;

    setStep('results');
    setIsLoading(true);
    setError('');
    setTracks([]);

    try {
      // Try Gemini to understand the natural language
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

      const prompt = `
        The user describes their current mood as: "${customMoodText}"
        
        Generate a simple Spotify search query (3-5 words) that would find music matching this vibe.
        Also generate a short playlist name (max 4 words).
        
        Output ONLY JSON: { 
          "searchQuery": string, 
          "playlistName": string 
        }
      `;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7 },
        }),
      });

      if (!res.ok) throw new Error('Gemini failed');

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (text) {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);

          // Add taste-based variety to the search query
          let searchQuery = result.searchQuery || customMoodText;
          if (userTopData?.artists?.length > 0) {
            const artists = userTopData.artists;
            searchQuery = `${searchQuery} ${artists[Math.floor(Math.random() * artists.length)]?.name || ''}`;
          }

          const found = await searchTracks(token, searchQuery);
          setTracks(found);
          setPlaylistMeta({
            name: result.playlistName || 'Your Vibe',
            description: customMoodText
          });
        }
      } else {
        throw new Error('No response');
      }
    } catch (e) {
      console.error('Gemini error, falling back to direct search:', e);
      // Fallback to direct search with the custom text
      const found = await searchTracks(token, customMoodText);
      setTracks(found);
      setPlaylistMeta({ name: 'Your Vibe', description: customMoodText });
    } finally {
      setIsLoading(false);
    }
  };

  const addToQueue = (track) => {
    if (queue.find(t => t.id === track.id)) return;
    setQueue(prev => [...prev, track]);
  };

  const removeFromQueue = (id) => setQueue(prev => prev.filter(t => t.id !== id));

  const savePlaylist = async () => {
    const toSave = queue.length > 0 ? queue : tracks;
    if (!token || toSave.length === 0 || !userProfile?.id) return;
    setSaveStatus('saving');
    try {
      const plRes = await fetch('https://api.spotify.com/v1/me/playlists', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: playlistMeta.name || 'VibeSync', description: playlistMeta.description || '', public: false }),
      });
      if (!plRes.ok) { setSaveStatus('error'); return; }
      const pl = await plRes.json();
      const addRes = await fetch(`https://api.spotify.com/v1/playlists/${pl.id}/items`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ uris: toSave.map(t => t.uri) }),
      });
      setSaveStatus(addRes.ok ? 'saved' : 'error');
      if (addRes.ok) setTimeout(() => setSaveStatus(''), 3000);
    } catch (e) { setSaveStatus('error'); }
  };

  const reset = () => {
    setStep('mood'); setSelectedMood(null); setSelectedArchetype(null);
    setTracks([]); setQueue([]); setCustomMoodText(''); setError(''); setSaveStatus('');
    setPlaylistMeta({ name: '', description: '' });
  };

  // ─── UI (keep your existing UI exactly the same) ────────────
  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans selection:bg-green-500/20">
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Header */}
        <header className="flex items-center justify-between mb-10 pb-5 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="bg-green-500 p-2 rounded-xl text-black">
              <Music size={20} />
            </div>
            <span className="font-black tracking-tighter uppercase italic text-lg">VibeSync</span>
          </div>
          {!isConnected ? (
            <div className="flex items-center gap-2">
              <button onClick={() => setShowDebug(!showDebug)} className="p-2 text-neutral-600 hover:text-white transition-colors"><Info size={18} /></button>
              <button onClick={handleConnect} className="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black px-4 py-2 rounded-full font-bold text-sm transition-all active:scale-95">
                <LogIn size={16} /> Connect Spotify
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              {userTopData?.artists?.length > 0 && (
                <div className="hidden sm:flex items-center gap-2 flex-wrap">
                  {userTopData.artists.slice(0, 3).map(a => (
                    <span key={a.id} className="flex items-center gap-1 bg-neutral-800 border border-neutral-700 px-2 py-0.5 rounded-full text-[11px] font-bold text-neutral-400">
                      {a.images?.[2]?.url && <img src={a.images[2].url} className="w-3 h-3 rounded-full" alt="" />}
                      {a.name}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 bg-neutral-800 p-1 pr-3 rounded-full border border-neutral-700">
                {userProfile?.images?.[0]?.url
                  ? <img src={userProfile.images[0].url} className="w-7 h-7 rounded-full object-cover" alt="" />
                  : <div className="w-7 h-7 rounded-full bg-neutral-700 flex items-center justify-center"><User size={12} /></div>
                }
                <span className="text-xs font-bold hidden sm:inline truncate max-w-[100px]">{userProfile?.display_name}</span>
              </div>
              <button onClick={handleLogout} className="p-2 text-neutral-600 hover:text-red-400 transition-colors bg-neutral-800 rounded-full border border-neutral-700"><LogOut size={16} /></button>
            </div>
          )}
        </header>

        {showDebug && !isConnected && (
          <div className="mb-6 p-4 bg-neutral-900 border border-blue-500/20 rounded-2xl text-xs space-y-2">
            <p className="text-blue-400 font-bold uppercase tracking-widest text-[10px]">Debug</p>
            <p className="text-neutral-400">Redirect URI:</p>
            <code className="block p-2 bg-black rounded text-green-400 break-all select-all">{REDIRECT_URI}</code>
            <p className="text-neutral-400">Client ID: <span className={SPOTIFY_CLIENT_ID ? "text-green-400" : "text-red-400"}>{SPOTIFY_CLIENT_ID ? "Loaded" : "Missing"}</span></p>
            <p className="text-neutral-400">Gemini Key: <span className={GEMINI_API_KEY ? "text-green-400" : "text-red-400"}>{GEMINI_API_KEY ? "Loaded" : "Missing"}</span></p>
          </div>
        )}

        {!isConnected ? (
          <div className="text-center py-24 flex flex-col items-center">
            <Music size={64} className="text-neutral-800 mb-6 animate-pulse" />
            <h2 className="text-5xl font-black uppercase italic mb-3">VibeSync.</h2>
            <p className="text-neutral-500 max-w-sm text-base leading-relaxed">Music for the person you are right now — not just how you feel.</p>
          </div>
        ) : (
          <div className="space-y-8">

            {/* STEP: Mood selection */}
            {step === 'mood' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <h2 className="text-2xl font-black mb-1">How are you feeling?</h2>
                <p className="text-neutral-500 text-sm mb-6">Pick your mood and we'll figure out the rest.</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {MOODS.map(mood => (
                    <button
                      key={mood.id}
                      onClick={() => handleMoodSelect(mood)}
                      className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 hover:border-neutral-700 transition-all active:scale-95 group"
                    >
                      <span className="text-3xl">{mood.emoji}</span>
                      <span className="font-bold text-sm text-neutral-300 group-hover:text-white transition-colors">{mood.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP: Custom mood text input - ONLY PLACE GEMINI IS USED */}
            {step === 'custom' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <button onClick={reset} className="flex items-center gap-1 text-neutral-500 hover:text-white text-sm mb-6 transition-colors">
                  <ChevronLeft size={16} /> Back
                </button>
                <h2 className="text-2xl font-black mb-1">Describe it.</h2>
                <p className="text-neutral-500 text-sm mb-6">What's the vibe? Be as specific or as abstract as you want.</p>
                <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-4 focus-within:border-purple-500/50 transition-all">
                  <textarea
                    value={customMoodText}
                    onChange={e => setCustomMoodText(e.target.value)}
                    placeholder="e.g. 3am driving alone, windows down, thinking about everything and nothing..."
                    className="w-full bg-transparent text-white placeholder:text-neutral-600 resize-none focus:outline-none text-sm leading-relaxed min-h-[80px]"
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleCustomSubmit())}
                  />
                </div>
                <button
                  onClick={handleCustomSubmit}
                  disabled={!customMoodText.trim()}
                  className="mt-3 w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-30 text-white py-3.5 rounded-2xl font-black text-sm uppercase tracking-tight transition-all active:scale-95"
                >
                  <Sparkles size={16} /> Find My Music
                </button>
              </div>
            )}

            {/* STEP: Archetype selection */}
            {step === 'archetype' && selectedMood && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <button onClick={reset} className="flex items-center gap-1 text-neutral-500 hover:text-white text-sm mb-6 transition-colors">
                  <ChevronLeft size={16} /> Back
                </button>
                <h2 className="text-2xl font-black mb-1">
                  You're feeling {selectedMood.emoji} {selectedMood.label}.
                </h2>
                <p className="text-neutral-500 text-sm mb-6">What kind of listener are you right now?</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(ARCHETYPES[selectedMood.id] || []).map(archetype => (
                    <button
                      key={archetype.id}
                      onClick={() => handleArchetypeSelect(archetype)}
                      className="flex items-start gap-4 p-5 rounded-2xl border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 hover:border-neutral-600 transition-all active:scale-95 text-left group"
                    >
                      <span className="text-2xl mt-0.5">{archetype.emoji}</span>
                      <div>
                        <p className="font-black text-white text-base leading-tight">{archetype.label}</p>
                        <p className="text-neutral-500 text-xs mt-1 group-hover:text-neutral-400 transition-colors">{archetype.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP: Results */}
            {step === 'results' && (
              <div className="animate-in fade-in duration-300 space-y-6">
                <div className="flex items-center justify-between">
                  <button onClick={reset} className="flex items-center gap-1 text-neutral-500 hover:text-white text-sm transition-colors">
                    <ChevronLeft size={16} /> Start over
                  </button>
                  {!isLoading && tracks.length > 0 && (
                    <button
                      onClick={() => {
                        if (selectedArchetype) {
                          handleArchetypeSelect(selectedArchetype);
                        } else if (customMoodText) {
                          handleCustomSubmit();
                        }
                      }}
                      className="flex items-center gap-1 text-neutral-500 hover:text-white text-sm transition-colors"
                    >
                      <Shuffle size={14} /> Refresh
                    </button>
                  )}
                </div>

                {isLoading ? (
                  <div className="space-y-4">
                    <div className="h-8 w-48 bg-neutral-800 animate-pulse rounded-lg" />
                    <div className="h-4 w-64 bg-neutral-800 animate-pulse rounded" />
                    {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 bg-neutral-900 animate-pulse rounded-2xl" />)}
                  </div>
                ) : error ? (
                  <div className="text-center py-12">
                    <p className="text-neutral-500 mb-4">{error}</p>
                    <button onClick={() => selectedArchetype ? handleArchetypeSelect(selectedArchetype) : handleCustomSubmit()}
                      className="bg-neutral-800 hover:bg-neutral-700 px-6 py-2.5 rounded-full text-sm font-bold transition-all">
                      Try again
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <h2 className="text-3xl font-black leading-tight">{playlistMeta.name}</h2>
                      <p className="text-neutral-500 text-sm mt-1">{playlistMeta.description}</p>
                    </div>

                    {/* Queue */}
                    {queue.length > 0 && (
                      <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-4 space-y-2">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-black text-green-400 uppercase tracking-widest">My Pick ({queue.length})</span>
                          <button
                            onClick={savePlaylist}
                            disabled={saveStatus === 'saving'}
                            className={`text-xs px-4 py-1.5 rounded-full font-black uppercase transition-all ${saveStatus === 'saved' ? 'bg-green-500 text-black' : 'bg-green-600 hover:bg-green-500 text-white'}`}
                          >
                            {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : 'Save to Spotify'}
                          </button>
                        </div>
                        {queue.map(track => (
                          <div key={track.id} className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <img src={track.image} className="w-8 h-8 rounded-lg shrink-0" alt="" />
                              <div className="min-w-0">
                                <p className="text-sm font-bold truncate">{track.title}</p>
                                <p className="text-xs text-neutral-500 truncate">{track.artist}</p>
                              </div>
                            </div>
                            <button onClick={() => removeFromQueue(track.id)} className="text-neutral-600 hover:text-red-400 transition-colors shrink-0"><Trash2 size={15} /></button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Track list */}
                    <div className="space-y-1">
                      {tracks.map((track, i) => (
                        <div
                          key={track.id}
                          className="group flex items-center gap-4 p-3 rounded-xl hover:bg-neutral-900 transition-all"
                        >
                          <span className="text-xs text-neutral-700 w-4 text-center shrink-0 group-hover:hidden">{i + 1}</span>
                          <img src={track.image} className="w-10 h-10 rounded-lg shrink-0 shadow-lg" alt="" />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate text-white">{track.title}</p>
                            <p className="text-xs text-neutral-500 truncate">{track.artist} · {track.album}</p>
                          </div>
                          <button
                            onClick={() => addToQueue(track)}
                            className={`shrink-0 p-1.5 rounded-full transition-all ${queue.find(t => t.id === track.id) ? 'text-green-400 bg-green-500/10' : 'text-neutral-600 hover:text-white hover:bg-neutral-700'}`}
                          >
                            {queue.find(t => t.id === track.id) ? <Check size={16} strokeWidth={3} /> : <PlusCircle size={16} />}
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Save all */}
                    {tracks.length > 0 && (
                      <button
                        onClick={savePlaylist}
                        disabled={saveStatus === 'saving'}
                        className={`w-full py-3 rounded-2xl font-black text-sm uppercase tracking-tight transition-all active:scale-95 ${saveStatus === 'saved' ? 'bg-green-500 text-black' : 'bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 text-white'}`}
                      >
                        {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved to Spotify!' : queue.length > 0 ? 'Save My Pick' : 'Save All to Spotify'}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}