import React, { useState, useEffect, useRef } from 'react';
import { Music, LogIn, LogOut, Info, User, Trash2, PlusCircle, Check, Wand2, Search, Sparkles, ChevronLeft, Shuffle, Languages } from 'lucide-react';

const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_MODEL = 'gemma-3-27b-it';

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

// ─── Language translations ─────────────────────────────────
const translations = {
  en: {
    appName: 'VibeSync',
    tagline: 'Music for the person you are right now — not just how you feel.',
    connect: 'Connect Spotify',
    disconnect: 'Disconnect',
    howFeeling: 'How are you feeling?',
    pickMood: "Pick your mood and we'll figure out the rest.",
    describeIt: 'Describe it.',
    describePlaceholder: 'e.g. 3am driving alone, windows down, thinking about everything and nothing...',
    findMusic: 'Find My Music',
    whatListener: 'What kind of listener are you right now?',
    startOver: 'Start over',
    refresh: 'Refresh',
    tryAgain: 'Try again',
    myPick: 'My Pick',
    saveToSpotify: 'Save to Spotify',
    saving: 'Saving...',
    saved: 'Saved!',
    savedToSpotify: 'Saved to Spotify!',
    saveAll: 'Save All to Spotify',
    saveMyPick: 'Save My Pick',
    noTracksFound: 'No tracks found. Try a different vibe.',
    somethingWrong: 'Something went wrong. Try again.',
    debug: 'Debug',
    redirectUri: 'Redirect URI',
    clientId: 'Client ID',
    geminiKey: 'Gemini Key',
    loaded: 'Loaded',
    missing: 'Missing',
    back: 'Back',
    tryAnotherVibe: 'Try another vibe',
    language: 'ภาษาไทย',
  },
  th: {
    appName: 'VibeSync',
    tagline: 'เพลงสำหรับตัวคุณในตอนนี้ — ไม่ใช่แค่อารมณ์ความรู้สึก',
    connect: 'เชื่อมต่อ Spotify',
    disconnect: 'ออกจากระบบ',
    howFeeling: 'ตอนนี้รู้สึกยังไง?',
    pickMood: 'เลือกอารมณ์แล้วเราจะจัดการที่เหลือให้',
    describeIt: 'บรรยายความรู้สึก',
    describePlaceholder: 'เช่น ขับรถคนเดียวตอนตี 3 เปิดกระจก คิดไปเรื่อย...',
    findMusic: 'หาเพลงให้ฉัน',
    whatListener: 'คุณเป็นผู้ฟังแบบไหนในตอนนี้?',
    startOver: 'เริ่มใหม่',
    refresh: 'สุ่มใหม่',
    tryAgain: 'ลองอีกครั้ง',
    myPick: 'เพลงที่เลือก',
    saveToSpotify: 'บันทึก',
    saving: 'กำลังบันทึก...',
    saved: 'บันทึกแล้ว!',
    savedToSpotify: 'บันทึกแล้ว!',
    saveAll: 'บันทึกทั้งหมด',
    saveMyPick: 'บันทึกที่เลือก',
    noTracksFound: 'ไม่พบเพลง ลองเลือกแบบอื่น',
    somethingWrong: 'เกิดข้อผิดพลาด ลองอีกครั้ง',
    debug: 'ดีบัก',
    redirectUri: 'Redirect URI',
    clientId: 'Client ID',
    geminiKey: 'Gemini Key',
    loaded: 'โหลดแล้ว',
    missing: 'ไม่พบ',
    back: 'กลับ',
    tryAnotherVibe: 'ลองแบบอื่น',
    language: 'English',
  }
};

// ─── Mood config ──────────────────────────────────────────
const MOODS = [
  { id: 'sad', emoji: '😔', label: { en: 'Sad', th: 'เศร้า' } },
  { id: 'happy', emoji: '😁', label: { en: 'Happy', th: 'มีความสุข' } },
  { id: 'angry', emoji: '😤', label: { en: 'Angry', th: 'โกรธ' } },
  { id: 'anxious', emoji: '😰', label: { en: 'Anxious', th: 'เครียด' } },
  { id: 'bored', emoji: '😑', label: { en: 'Bored', th: 'เบื่อ' } },
  { id: 'custom', emoji: '✏️', label: { en: 'Describe it', th: 'บอกหน่อยสิ' } },
];

const ARCHETYPES = {
  sad: [
    { id: 'wallow', label: { en: 'I Loved Her', th: 'คิดถึงใครอ่ะ' }, emoji: '💔', desc: { en: 'Sink into it. Sad songs for sad days.', th: 'ดิ่งเลย' }, searchHint: 'heartbreak melancholy sad ballad emotional' },
    { id: 'cheer', label: { en: 'Cheer Me Up', th: 'ปลุกใจ' }, emoji: '☀️', desc: { en: 'Pull me out of it. Uplifting and warm.', th: 'เพลงที่ทำให้รู้สึกดีขึ้น' }, searchHint: 'uplifting feel-good happy energetic pop' },
    { id: 'rage', label: { en: 'RAHHH', th: 'วากกกก!!!!' }, emoji: '🔥', desc: { en: 'Channel it into something fierce.', th: 'เปลี่ยนความเศร้าเป็นพลัง' }, searchHint: 'angry empowerment fierce punk rock breakup anthem' },
    { id: 'surprise', label: { en: 'Surprise Me', th: 'สุ่ม' }, emoji: '🎲', desc: { en: 'I have no idea what I need. Pick for me.', th: 'ไม่รู้ว่าต้องการอะไร เลือกให้หน่อย' }, searchHint: 'unexpected eclectic genre-blending unique discovery' },
  ],
  happy: [
    { id: 'ride', label: { en: 'Keep It Going', th: 'ไปต่อกันแปะ' }, emoji: '🚀', desc: { en: 'Match the energy. Let\'s go higher.', th: 'รักษาพลังงานนี้ไว้' }, searchHint: 'euphoric energetic dance pop feel-good banger' },
    { id: 'contrast', label: { en: 'Calm Me Down', th: 'ผ่อนคลาย' }, emoji: '🌊', desc: { en: 'Balance it out. Chill and smooth.', th: 'ทำใจให้ร่ม' }, searchHint: 'chill lofi ambient mellow smooth downtempo' },
    { id: 'chaos', label: { en: 'I\'m Unhinged', th: 'สุดเหวี่ยง' }, emoji: '⚡', desc: { en: 'Turn it into something chaotic and loud.', th: 'ปล่อยพลังสุดเหวี่ยง' }, searchHint: 'aggressive metal punk hardcore noise experimental' },
    { id: 'surprise', label: { en: 'Surprise Me', th: 'จ้ำจี้' }, emoji: '🎲', desc: { en: 'Just vibe me something unexpected.', th: 'มะเขือเปาะแปะ' }, searchHint: 'unexpected genre-blending eclectic discovery' },
  ],
  angry: [
    { id: 'fuel', label: { en: 'Feed the Fire', th: 'เติมไฟ' }, emoji: '💢', desc: { en: 'More rage. Louder. Harder.', th: 'เวรย่อมระงับด้วยเวร' }, searchHint: 'metal hardcore punk aggressive heavy brutal' },
    { id: 'detox', label: { en: 'Cool It Down', th: 'เย็นลง' }, emoji: '🧊', desc: { en: 'Something to slowly bring me back.', th: 'เย็นๆนะ' }, searchHint: 'calming ambient peaceful meditative slow' },
    { id: 'groove', label: { en: 'Angry but Groovy', th: 'เหวี่ยงแบบมีสไตล์' }, emoji: '😤', desc: { en: 'Angry energy but with a rhythm.', th: 'โมโหแต่มีจังหวะ' }, searchHint: 'hip hop aggressive trap dark funk groove' },
    { id: 'surprise', label: { en: 'Surprise Me', th: 'สุ่ม' }, emoji: '🎲', desc: { en: 'Anger is just energy. Channel it anywhere.', th: 'เปลี่ยนความโกรธเป็นพลังงาน' }, searchHint: 'unexpected genre-blending unique' },
  ],
  anxious: [
    { id: 'ground', label: { en: 'Ground Me', th: 'ตั้งสติ' }, emoji: '🌿', desc: { en: 'Slow my brain down. Calm and steady.', th: 'ทำให้สมองช้าลง' }, searchHint: 'ambient calm lofi peaceful meditative acoustic' },
    { id: 'mask', label: { en: 'Drown It Out', th: 'กลบเกลื่อน' }, emoji: '🎧', desc: { en: 'Something loud enough to stop the thoughts.', th: 'เพลงดังๆ ให้หยุดคิด' }, searchHint: 'loud energetic intense wall of sound focus' },
    { id: 'relate', label: { en: 'You Get It', th: 'เข้าใจฉัน' }, emoji: '🫂', desc: { en: 'Songs that understand the spiral.', th: 'เพลงที่เข้าใจความรู้สึก' }, searchHint: 'anxiety overthinking introspective indie emotional' },
    { id: 'surprise', label: { en: 'Distract Me', th: 'ดึงสมาธิ' }, emoji: '🎲', desc: { en: 'Literally anything. Just get me out of my head.', th: 'อะไรก็ได้ที่ทำให้ไม่อยู่ในหัว' }, searchHint: 'fun quirky upbeat distraction playful' },
  ],
  bored: [
    { id: 'discover', label: { en: 'Find Me Something New', th: 'อะไรใหม่ๆหน่อย' }, emoji: '🔭', desc: { en: 'I want to hear something I\'ve never heard.', th: 'อยากฟังอะไรที่ไม่เคยฟัง' }, searchHint: 'underground obscure niche emerging artist discovery' },
    { id: 'nostalgia', label: { en: 'Take Me Back', th: 'คิดถึงอดีต' }, emoji: '📼', desc: { en: 'Old favorites. Nostalgic hits.', th: 'เพลงเก่าๆ คิดถึง' }, searchHint: 'nostalgic classic throwback 90s 00s retro' },
    { id: 'intensity', label: { en: 'Wake Me Up', th: 'สะดุ้งแรงๆ' }, emoji: '⚡', desc: { en: 'Something intense to jolt me out of this.', th: 'เพลงที่ทำให้ตื่น' }, searchHint: 'high energy intense fast-paced adrenaline' },
    { id: 'surprise', label: { en: 'Surprise Me', th: 'สุ่มเลย' }, emoji: '🎲', desc: { en: 'Randomize it completely.', th: 'อะไรก็เอา' }, searchHint: 'eclectic random genre-blending unexpected' },
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

const searchTracks = async (token, query, retryCount = 0) => {
  if (!query || query.trim() === '') return [];

  // Clean the query
  const cleanQuery = query
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  if (!cleanQuery) return [];

  console.log('Searching Spotify with:', cleanQuery);

  try {
    console.log('Attempting Spotify search with query:', cleanQuery);
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(cleanQuery)}&type=track&limit=10`,

      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.status === 401) {
      handleLogout();
      return [];
    }

    if (!res.ok) {
      console.error('Search failed:', await res.text());
      return [];
    }

    const data = await res.json();
    console.log('Spotify search results:', data);
    const tracks = (data.tracks?.items || []).map(t => ({
      id: t.id,
      title: t.name,
      artist: t.artists.map(a => a.name).join(', '),
      album: t.album.name,
      uri: t.uri,
      popularity: t.popularity,
      image: t.album.images?.[1]?.url || t.album.images?.[0]?.url || '',
    }));

    // If no tracks found, try progressively simpler queries
    if (tracks.length === 0 && retryCount < 3) {
      const words = cleanQuery.split(' ');

      if (words.length > 2) {
        // Try with fewer words
        const simplerQuery = words.slice(0, 2).join(' ');
        console.log('No results, trying simpler query:', simplerQuery);
        return searchTracks(token, simplerQuery, retryCount + 1);
      } else if (words.length === 2) {
        // Try with just the first word
        const simplerQuery = words[0];
        console.log('No results, trying single word:', simplerQuery);
        return searchTracks(token, simplerQuery, retryCount + 1);
      } else if (retryCount === 0 && userTopData?.artists?.length > 0) {
        // Last resort: use a random artist from their top list
        const randomArtist = userTopData.artists[Math.floor(Math.random() * userTopData.artists.length)]?.name;
        if (randomArtist) {
          console.log('Trying random artist:', randomArtist);
          return searchTracks(token, randomArtist, retryCount + 1);
        }
      }
    }

    return tracks;
  } catch (e) {
    console.error('Search error:', e);
    return [];
  }
};

// Generate search query with variety based on user's taste - SIMPLIFIED VERSION
const generateQuery = (baseHint, userTopData) => {
  if (!userTopData?.artists?.length) return baseHint.split(' ').slice(0, 2).join(' ');

  // Get user's top artists and genres
  const userArtists = userTopData.artists.map(a => a.name).filter(Boolean);
  const userGenres = [...new Set(userTopData.artists.flatMap(a => a.genres || []))].filter(Boolean);

  // Base words from the hint (first 2 words)
  const baseWords = baseHint.split(' ').slice(0, 2).join(' ');

  // Build creative query options - back to the working style
  const queryOptions = [
    // Base + artist
    `${baseWords} ${userArtists[Math.floor(Math.random() * userArtists.length)]}`,

    // Base + genre
    ...(userGenres.length > 0 ? [`${baseWords} ${userGenres[Math.floor(Math.random() * userGenres.length)]}`] : []),

    // Just the base hint
    baseWords,

    // Base + discovery terms
    `${baseWords} underground`,
    `${baseWords} deep cuts`,
    `${baseWords} obscure`,
    `${baseWords} hidden gem`,

    // Mood combinations
    `chill ${baseWords}`,
    `dark ${baseWords}`,
    `upbeat ${baseWords}`,
    `dreamy ${baseWords}`,

    // Artist similar to
    `similar to ${userArtists[Math.floor(Math.random() * userArtists.length)]}`,

    // Random cool combos
    `${userGenres[Math.floor(Math.random() * userGenres.length)]} vibes`,
    `${baseWords} playlist`,
  ];

  // Filter out any undefined or empty options
  const validOptions = queryOptions.filter(q => q && q.length > 0);

  // Pick a random option
  const selectedQuery = validOptions[Math.floor(Math.random() * validOptions.length)];

  console.log('Generated query:', selectedQuery);

  return selectedQuery
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
};

// Mix familiar and discovery tracks with creative filtering - DEBUG VERSION
const mixTracks = (tracks, userTopData) => {
  if (!tracks || tracks.length === 0) return tracks;

  console.log('mixTracks received:', tracks.length, 'tracks');
  console.log('First track sample:', tracks[0]);

  // Safely get user's top artists and tracks
  const userArtists = userTopData?.artists || [];
  const userTracks = userTopData?.tracks || [];

  // Get user's top artist names for reference
  const userArtistNames = new Set(userArtists.map(a => a?.name || '').filter(Boolean));
  const userTrackIds = new Set(userTracks.map(t => t?.id || '').filter(Boolean));

  // Get user's top genres
  const userGenres = [...new Set(userArtists.flatMap(a => a?.genres || []))].filter(Boolean);

  // SIMPLIFIED: Just return all tracks shuffled for now to test
  console.log('Returning all tracks shuffled for testing');
  return [...tracks].sort(() => Math.random() - 0.5).slice(0, 10);
};

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [isConnected, setIsConnected] = useState(!!localStorage.getItem("token"));
  const [userProfile, setUserProfile] = useState(null);
  const [userTopData, setUserTopData] = useState(null);
  const [showDebug, setShowDebug] = useState(false);
  const [language, setLanguage] = useState('en'); // 'en' or 'th'

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

  const t = translations[language];

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

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'th' : 'en');
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
      // Generate query with variety based on user's taste - no genre seeds needed
      const query = generateQuery(archetype.searchHint, userTopData);

      // Search Spotify directly
      let found = await searchTracks(token, query);

      // Mix familiar and discovery tracks
      found = mixTracks(found, userTopData);

      setTracks(found);
      setPlaylistMeta({
        name: `${selectedMood?.emoji || ''} ${archetype.label[language]}`,
        description: archetype.desc[language]
      });

      if (found.length === 0) {
        setError(t.noTracksFound);
      }
    } catch (e) {
      console.error('Search error:', e);
      setError(t.somethingWrong);
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
      
      Generate a simple Spotify search query that would find music matching this vibe with extra moody aesthetics.
      Also generate a short aesthetic playlist name (max 4 words).
      
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
          console.log('Gemini result:', result);

          // Use the search query directly from Gemini - NO artist appending
          let searchQuery = result.searchQuery || customMoodText;

          let found = await searchTracks(token, searchQuery);
          found = mixTracks(found, userTopData);

          setTracks(found);
          setPlaylistMeta({
            name: result.playlistName || t.appName,
            description: customMoodText
          });
        }
      } else {
        throw new Error('No response');
      }
    } catch (e) {
      console.error('Gemini error, falling back to direct search:', e);
      // Fallback to direct search with the custom text
      let found = await searchTracks(token, customMoodText);
      found = mixTracks(found, userTopData);
      setTracks(found);
      setPlaylistMeta({ name: t.appName, description: customMoodText });
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
        body: JSON.stringify({ name: playlistMeta.name || t.appName, description: playlistMeta.description || '', public: false }),
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

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans selection:bg-green-500/20">
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Header */}
        <header className="flex items-center justify-between mb-10 pb-5 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="bg-green-500 p-2 rounded-xl text-black">
              <Music size={20} />
            </div>
            <span className="font-black tracking-tighter uppercase italic text-lg">{t.appName}</span>
          </div>
          <div className="flex items-center gap-2">
            {!isConnected ? (
              <>
                <button onClick={() => setShowDebug(!showDebug)} className="p-2 text-neutral-600 hover:text-white transition-colors"><Info size={18} /></button>
                <button onClick={handleConnect} className="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black px-4 py-2 rounded-full font-bold text-sm transition-all active:scale-95">
                  <LogIn size={16} /> {t.connect}
                </button>
              </>
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
          </div>
        </header>

        {/* Language Toggle - Moved outside header */}
        <div className="flex justify-end mb-4">
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-full border border-neutral-700 transition-colors text-sm"
          >
            <Languages size={16} className="text-neutral-400" />
            <span className="text-neutral-300">{t.language}</span>
          </button>
        </div>

        {showDebug && !isConnected && (
          <div className="mb-6 p-4 bg-neutral-900 border border-blue-500/20 rounded-2xl text-xs space-y-2">
            <p className="text-blue-400 font-bold uppercase tracking-widest text-[10px]">{t.debug}</p>
            <p className="text-neutral-400">{t.redirectUri}:</p>
            <code className="block p-2 bg-black rounded text-green-400 break-all select-all">{REDIRECT_URI}</code>
            <p className="text-neutral-400">{t.clientId}: <span className={SPOTIFY_CLIENT_ID ? "text-green-400" : "text-red-400"}>{SPOTIFY_CLIENT_ID ? t.loaded : t.missing}</span></p>
            <p className="text-neutral-400">{t.geminiKey}: <span className={GEMINI_API_KEY ? "text-green-400" : "text-red-400"}>{GEMINI_API_KEY ? t.loaded : t.missing}</span></p>
          </div>
        )}

        {!isConnected ? (
          <div className="text-center py-24 flex flex-col items-center">
            <Music size={64} className="text-neutral-800 mb-6 animate-pulse" />
            <h2 className="text-5xl font-black uppercase italic mb-3">{t.appName}.</h2>
            <p className="text-neutral-500 max-w-sm text-base leading-relaxed">{t.tagline}</p>
          </div>
        ) : (
          <div className="space-y-8">

            {/* STEP: Mood selection */}
            {step === 'mood' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <h2 className="text-2xl font-black mb-1">{t.howFeeling}</h2>
                <p className="text-neutral-500 text-sm mb-6">{t.pickMood}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {MOODS.map(mood => (
                    <button
                      key={mood.id}
                      onClick={() => handleMoodSelect(mood)}
                      className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 hover:border-neutral-700 transition-all active:scale-95 group"
                    >
                      <span className="text-3xl">{mood.emoji}</span>
                      <span className="font-bold text-sm text-neutral-300 group-hover:text-white transition-colors">{mood.label[language]}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP: Custom mood text input - ONLY PLACE GEMINI IS USED */}
            {step === 'custom' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <button onClick={reset} className="flex items-center gap-1 text-neutral-500 hover:text-white text-sm mb-6 transition-colors">
                  <ChevronLeft size={16} /> {t.back}
                </button>
                <h2 className="text-2xl font-black mb-1">{t.describeIt}</h2>
                <p className="text-neutral-500 text-sm mb-6">{t.pickMood}</p>
                <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-4 focus-within:border-purple-500/50 transition-all">
                  <textarea
                    value={customMoodText}
                    onChange={e => setCustomMoodText(e.target.value)}
                    placeholder={t.describePlaceholder}
                    className="w-full bg-transparent text-white placeholder:text-neutral-600 resize-none focus:outline-none text-sm leading-relaxed min-h-[80px]"
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleCustomSubmit())}
                  />
                </div>
                <button
                  onClick={handleCustomSubmit}
                  disabled={!customMoodText.trim()}
                  className="mt-3 w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-30 text-white py-3.5 rounded-2xl font-black text-sm uppercase tracking-tight transition-all active:scale-95"
                >
                  <Sparkles size={16} /> {t.findMusic}
                </button>
              </div>
            )}

            {/* STEP: Archetype selection */}
            {step === 'archetype' && selectedMood && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <button onClick={reset} className="flex items-center gap-1 text-neutral-500 hover:text-white text-sm mb-6 transition-colors">
                  <ChevronLeft size={16} /> {t.back}
                </button>
                <h2 className="text-2xl font-black mb-1">
                  {selectedMood.emoji} {selectedMood.label[language]}
                </h2>
                <p className="text-neutral-500 text-sm mb-6">{t.whatListener}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(ARCHETYPES[selectedMood.id] || []).map(archetype => (
                    <button
                      key={archetype.id}
                      onClick={() => handleArchetypeSelect(archetype)}
                      className="flex items-start gap-4 p-5 rounded-2xl border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 hover:border-neutral-600 transition-all active:scale-95 text-left group"
                    >
                      <span className="text-2xl mt-0.5">{archetype.emoji}</span>
                      <div>
                        <p className="font-black text-white text-base leading-tight">{archetype.label[language]}</p>
                        <p className="text-neutral-500 text-xs mt-1 group-hover:text-neutral-400 transition-colors">{archetype.desc[language]}</p>
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
                    <ChevronLeft size={16} /> {t.startOver}
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
                      <Shuffle size={14} /> {t.refresh}
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
                      {t.tryAgain}
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
                          <span className="text-xs font-black text-green-400 uppercase tracking-widest">{t.myPick} ({queue.length})</span>
                          <button
                            onClick={savePlaylist}
                            disabled={saveStatus === 'saving'}
                            className={`text-xs px-4 py-1.5 rounded-full font-black uppercase transition-all ${saveStatus === 'saved' ? 'bg-green-500 text-black' : 'bg-green-600 hover:bg-green-500 text-white'}`}
                          >
                            {saveStatus === 'saving' ? t.saving : saveStatus === 'saved' ? t.saved : t.saveToSpotify}
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
                        {saveStatus === 'saving' ? t.saving : saveStatus === 'saved' ? t.savedToSpotify : queue.length > 0 ? t.saveMyPick : t.saveAll}
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