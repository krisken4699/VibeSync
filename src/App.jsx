import React, { useState, useEffect, useRef } from 'react';
import { Music, LogIn, LogOut, Info, User, Trash2, PlusCircle, Check, Sparkles, ChevronLeft, Shuffle, Languages } from 'lucide-react';

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

// Fetch a guest-level app token from our serverless proxy (no user login needed)
// Used for search only — no access to any user's account data
let guestTokenCache = null;
const getGuestToken = async () => {
  if (guestTokenCache && guestTokenCache.expires > Date.now()) {
    return guestTokenCache.token;
  }
  try {
    const res = await fetch('/api/spotify-token');
    if (!res.ok) return null;
    const data = await res.json();
    guestTokenCache = {
      token: data.access_token,
      expires: Date.now() + (data.expires_in - 120) * 1000, // 2min buffer
    };
    return guestTokenCache.token;
  } catch (e) {
    console.error('Guest token fetch failed:', e);
    return null;
  }
};

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
  { id: 'confused', emoji: '❓', label: { en: 'Confused', th: 'ฮะ?' } },
];

// ─── Archetype config ─────────────────────────────────────
// genrePool: arrays of [searchQuery, weight] — real genre names Spotify actually indexes
//   Format options:
//     "indie pop"           → plain genre search (most common)
//     "genre:shoegaze"      → exact genre field match (precise but narrower)
//   Rule: NEVER use vibe descriptions ("upbeat banger", "feel good dance")
//         ALWAYS use real genre names a DJ/Spotify editor would use
//
// compatibleUserGenres: keywords OK to pull from user's top genres (mood gate)
// incompatibleKeywords: if user's top genre contains any of these, skip it
const ARCHETYPES = {
  sad: [
    {
      id: 'wallow',
      label: { en: 'I Loved Her', th: 'คิดถึงใครอ่ะ' },
      emoji: '💔',
      desc: { en: 'Sink into it. Sad songs for sad days.', th: 'ดิ่งเลย' },
      // Real genres: slowcore, emo, sad folk, chamber pop, post-rock (all proven Spotify terms)
      genrePool: ['slowcore', 'genre:emo', 'sad folk', 'chamber pop', 'indie folk heartbreak', 'shoegaze melancholy', 'bedroom pop sad'],
      compatibleUserGenres: ['indie', 'folk', 'singer-songwriter', 'alternative', 'emo', 'shoegaze', 'dream pop', 'acoustic', 'post-hardcore', 'atmospheric', 'dark'],
      incompatibleKeywords: ['dance', 'edm', 'party', 'upbeat', 'hype', 'pop punk'],
    },
    {
      id: 'cheer',
      label: { en: 'Cheer Me Up', th: 'ปลุกใจ' },
      emoji: '☀️',
      desc: { en: 'Pull me out of it. Uplifting and warm.', th: 'เพลงที่ทำให้รู้สึกดีขึ้น' },
      // Sunshine pop, twee pop, jangle pop — real uplifting genres
      genrePool: ['sunshine pop', 'twee pop', 'jangle pop', 'indie pop', 'folk pop uplifting', 'soft rock warm'],
      compatibleUserGenres: ['indie', 'pop', 'folk', 'acoustic', 'singer-songwriter', 'soft rock'],
      incompatibleKeywords: ['metal', 'hardcore', 'aggressive', 'dark', 'heavy', 'doom'],
    },
    {
      id: 'rage',
      label: { en: 'RAHHH', th: 'วากกกก!!!!' },
      emoji: '🔥',
      desc: { en: 'Channel it into something fierce.', th: 'เปลี่ยนความเศร้าเป็นพลัง' },
      // Post-hardcore, screamo, skramz — cathartic real genre names
      genrePool: ['post-hardcore', 'genre:screamo', 'skramz', 'melodic hardcore', 'emo violence', 'grunge'],
      compatibleUserGenres: ['rock', 'punk', 'emo', 'alternative', 'post-hardcore', 'metal', 'grunge'],
      incompatibleKeywords: ['dance', 'edm', 'lofi', 'chill', 'ambient'],
    },
    {
      id: 'surprise',
      label: { en: 'Surprise Me', th: 'สุ่ม' },
      emoji: '🎲',
      desc: { en: 'I have no idea what I need. Pick for me.', th: 'ไม่รู้ว่าต้องการอะไร เลือกให้หน่อย' },
      genrePool: ['neo soul melancholy', 'trip hop', 'dark folk', 'indie r&b', 'art pop melancholy'],
      compatibleUserGenres: ['indie', 'alternative', 'r&b', 'hip hop', 'folk', 'pop', 'soul'],
      incompatibleKeywords: ['party', 'dance', 'edm', 'hype'],
    },
  ],
  happy: [
    {
      id: 'ride',
      label: { en: 'Keep It Going', th: 'ไปต่อกันแปะ' },
      emoji: '🚀',
      desc: { en: "Match the energy. Let's go higher.", th: 'รักษาพลังงานนี้ไว้' },
      // Nu disco, electropop, dance pop, funk — real energetic genres
      genrePool: ['nu disco', 'electropop', 'genre:dance-pop', 'funk', 'indie pop dance', 'power pop'],
      compatibleUserGenres: ['pop', 'dance', 'indie pop', 'electropop', 'funk', 'r&b', 'disco', 'nu metal', 'metal', 'rock', 'electronic', 'core'],
      incompatibleKeywords: ['sad', 'melancholy', 'doom', 'depressing', 'slowcore', 'funeral'],
    },
    {
      id: 'contrast',
      label: { en: 'Calm Me Down', th: 'ผ่อนคลาย' },
      emoji: '🌊',
      desc: { en: 'Balance it out. Chill and smooth.', th: 'ทำใจให้ร่ม' },
      // Lo-fi hip hop, chillwave, smooth r&b, ambient pop
      genrePool: ['genre:lo-fi', 'chillwave', 'smooth r&b', 'genre:ambient', 'downtempo', 'nu jazz'],
      compatibleUserGenres: ['lofi', 'chill', 'ambient', 'jazz', 'soul', 'r&b', 'indie', 'acoustic'],
      incompatibleKeywords: ['aggressive', 'metal', 'hardcore', 'loud', 'intense'],
    },
    {
      id: 'chaos',
      label: { en: "I'm Unhinged", th: 'สุดเหวี่ยง' },
      emoji: '⚡',
      desc: { en: 'Turn it into something chaotic and loud.', th: 'ปล่อยพลังสุดเหวี่ยง' },
      // Hyperpop, noise rock, mathcore, punk — all real genres
      genrePool: ['genre:hyperpop', 'noise rock', 'mathcore', 'genre:punk', 'no wave', 'power electronics'],
      compatibleUserGenres: ['punk', 'metal', 'hardcore', 'noise', 'experimental', 'rock', 'hyperpop', 'nu metal', 'core', 'electronic', 'industrial'],
      incompatibleKeywords: ['chill', 'lofi', 'ambient', 'soft', 'acoustic'],
    },
    {
      id: 'surprise',
      label: { en: 'Surprise Me', th: 'จ้ำจี้' },
      emoji: '🎲',
      desc: { en: 'Just vibe me something unexpected.', th: 'มะเขือเปาะแปะ' },
      genrePool: ['art pop', 'genre:afrobeats', 'bossa nova', 'city pop', 'neo soul'],
      compatibleUserGenres: ['indie', 'pop', 'alternative', 'r&b', 'hip hop', 'funk', 'soul', 'metal', 'rock', 'electronic', 'comedy'],
      incompatibleKeywords: ['funeral', 'doom', 'depressing', 'slowcore'],
    },
  ],
  angry: [
    {
      id: 'fuel',
      label: { en: 'Feed the Fire', th: 'เติมไฟ' },
      emoji: '💢',
      desc: { en: 'More rage. Louder. Harder.', th: 'เวรย่อมระงับด้วยเวร' },
      // Thrash metal, death metal, grindcore, powerviolence — legit extreme genres
      genrePool: ['genre:thrash-metal', 'death metal', 'grindcore', 'powerviolence', 'genre:hardcore', 'industrial metal'],
      compatibleUserGenres: ['metal', 'hardcore', 'core', 'punk', 'death metal', 'thrash', 'rap', 'industrial', 'electronic'],
      incompatibleKeywords: ['chill', 'lofi', 'soft', 'acoustic', 'ambient'],
    },
    {
      id: 'detox',
      label: { en: 'Cool It Down', th: 'เย็นลง' },
      emoji: '🧊',
      desc: { en: 'Something to slowly bring me back.', th: 'เย็นๆนะ' },
      genrePool: ['genre:ambient', 'new age', 'genre:acoustic', 'fingerstyle guitar', 'genre:classical', 'piano instrumental'],
      compatibleUserGenres: ['ambient', 'lofi', 'acoustic', 'classical', 'jazz', 'folk', 'new age'],
      incompatibleKeywords: ['aggressive', 'metal', 'hardcore', 'loud', 'intense', 'punk'],
    },
    {
      id: 'groove',
      label: { en: 'Angry but Groovy', th: 'เหวี่ยงแบบมีสไตล์' },
      emoji: '😤',
      desc: { en: 'Angry energy but with a rhythm.', th: 'โมโหแต่มีจังหวะ' },
      // Nu metal, rap rock, dark funk — angry but rhythmic real genres
      genrePool: ['genre:nu-metal', 'rap rock', 'dark funk', 'genre:trap', 'g-funk', 'drill'],
      compatibleUserGenres: ['hip hop', 'funk', 'r&b', 'rap', 'trap', 'nu metal', 'rock'],
      incompatibleKeywords: ['soft', 'acoustic', 'lofi', 'ambient', 'chill', 'classical'],
    },
    {
      id: 'surprise',
      label: { en: 'Surprise Me', th: 'สุ่ม' },
      emoji: '🎲',
      desc: { en: 'Anger is just energy. Channel it anywhere.', th: 'เปลี่ยนความโกรธเป็นพลังงาน' },
      genrePool: ['post-punk', 'noise pop', 'genre:industrial', 'art punk', 'math rock'],
      compatibleUserGenres: ['rock', 'rap', 'alternative', 'indie', 'r&b', 'metal', 'punk'],
      incompatibleKeywords: ['soft pop', 'lofi', 'chill', 'ambient'],
    },
  ],
  anxious: [
    {
      id: 'ground',
      label: { en: 'Ground Me', th: 'ตั้งสติ' },
      emoji: '🌿',
      desc: { en: 'Slow my brain down. Calm and steady.', th: 'ทำให้สมองช้าลง' },
      // Drone ambient, new age, fingerstyle, minimalist classical
      genrePool: ['genre:ambient', 'drone', 'new age', 'fingerstyle guitar', 'genre:lo-fi', 'minimalist classical'],
      compatibleUserGenres: ['ambient', 'folk', 'acoustic', 'lofi', 'classical', 'jazz', 'new age'],
      incompatibleKeywords: ['fast', 'intense', 'aggressive', 'loud', 'hardcore'],
    },
    {
      id: 'mask',
      label: { en: 'Drown It Out', th: 'กลบเกลื่อน' },
      emoji: '🎧',
      desc: { en: 'Something loud enough to stop the thoughts.', th: 'เพลงดังๆ ให้หยุดคิด' },
      // Shoegaze, post-rock, noise pop, dream pop — dense and immersive, real genres
      genrePool: ['genre:shoegaze', 'post-rock', 'noise pop', 'dream pop', 'blackgaze'],
      compatibleUserGenres: ['shoegaze', 'dream pop', 'indie rock', 'alternative', 'noise rock', 'post-rock', 'math rock', 'core', 'metal', 'electronic'],
      incompatibleKeywords: ['acoustic', 'sparse', 'minimal', 'lofi'],
    },
    {
      id: 'relate',
      label: { en: 'You Get It', th: 'เข้าใจฉัน' },
      emoji: '🫂',
      desc: { en: 'Songs that understand the spiral.', th: 'เพลงที่เข้าใจความรู้สึก' },
      // Indie folk confessional, bedroom pop, emo — songs with introspective lyrics
      genrePool: ['genre:emo', 'bedroom pop', 'indie folk', 'confessional singer-songwriter', 'lo-fi indie'],
      compatibleUserGenres: ['indie', 'alternative', 'singer-songwriter', 'emo', 'pop', 'folk'],
      incompatibleKeywords: ['party', 'dance', 'hype', 'aggressive', 'metal'],
    },
    {
      id: 'surprise',
      label: { en: 'Distract Me', th: 'ดึงสมาธิ' },
      emoji: '🎲',
      desc: { en: 'Literally anything. Just get me out of my head.', th: 'อะไรก็ได้ที่ทำให้ไม่อยู่ในหัว' },
      genrePool: ['genre:afrobeats', 'bossa nova', 'city pop', 'genre:funk', 'bubblegum pop'],
      compatibleUserGenres: ['indie', 'pop', 'alternative', 'funk', 'r&b'],
      incompatibleKeywords: ['dark', 'depressing', 'heavy', 'doom'],
    },
  ],
  confused: [
    {
      id: 'what',
      label: { en: 'what', th: 'อะไรนะ' },
      emoji: '❓',
      desc: { en: 'okay.', th: 'โอเค.' },
      // Genuinely weird Spotify-legible genres — not vibe descriptions
      genrePool: [
        // ── the void (genuinely unlistenable to most humans) ──
        'genre:noise',
        'power electronics',
        'harsh noise wall',
        'musique concrete',
        'lowercase',
        'electroacoustic',
        'acousmatic',
        'onkyo',
        'plunderphonics',
        'zeuhl',
        'spectralism',
        'microtonal',
        'totalism',
        'drone doom',
        'outsider music',
        'deconstructed club',
        'glitch',
        'genre:industrial',
        'japanoise',
        'merzbow',
        'clown core',
        'skramz',
        'pornogrind',
        'gorenoise',
        'brutal slamming deathcore',
        'genre:grindcore',
        'freak folk',
        'dark cabaret',
        'death industrial',
        'ritual ambient',
        'neofolk dark',
        // ── borderline ──
        'genre:vaporwave',
        'genre:hypnagogic-pop',
        'math jazz',
        'genre:free-jazz',
        'genre:avant-garde',
        'contemporary classical',
        'genre:jazz-fusion',
        'breakcore',
        // ── funny/chaotic/random ──
        'comedy rap',
        'genre:novelty',
        'nerdcore',
        'wizard rock',          // harry potter fan genre. yes it exists.
        'bardcore',             // medieval cover songs. also yes.
        'sea shanty',
        'cowpunk',
        'pirate metal',
        'polka punk',
        'nintendo core',
        'bounce',               // new orleans bounce. extremely unserious.
        'chiptune',
        'anime rap',
        'goregrind',            // grindcore but the lyrics are all about food
        'stoner doom',          // extremely slow metal for extremely high people
        'bubblegum bass',
        'nightcore',
        'speedcore',            // 300+ bpm. legally not music.
        'extratone',            // 1000+ bpm. physically not music.
        'happy hardcore',
        'gabber',               // dutch hardcore that sounds like a jackhammer at a rave
        'jug band',
        'comedy country',
        'parody',
        'surreal meme music',
        'turkish psychedelic',  // wildly underrated, wildly unhinged
        'brostep',
        'genre:ska',
        'ska punk',
        'genre:reggaeton',      // in here purely to confuse
      ],
      // No user genre filtering — the whole point is it ignores your taste
      compatibleUserGenres: [],
      incompatibleKeywords: [],
    },
  ],
  bored: [
    {
      id: 'discover',
      label: { en: 'Find Me Something New', th: 'อะไรใหม่ๆหน่อย' },
      emoji: '🔭',
      desc: { en: "I want to hear something I've never heard.", th: 'อยากฟังอะไรที่ไม่เคยฟัง' },
      // Micro-genres and genuinely niche real Spotify terms
      genrePool: ['genre:hypnagogic-pop', 'vaporwave', 'genre:witch-house', 'outsider house', 'post-punk revival'],
      compatibleUserGenres: ['indie', 'alternative', 'experimental', 'art rock', 'post-punk', 'avant-garde'],
      incompatibleKeywords: ['mainstream', 'top 40', 'popular'],
    },
    {
      id: 'nostalgia',
      label: { en: 'Take Me Back', th: 'คิดถึงอดีต' },
      emoji: '📼',
      desc: { en: 'Old favorites. Nostalgic hits.', th: 'เพลงเก่าๆ คิดถึง' },
      // Decade-specific real Spotify genre tags
      genrePool: ['genre:new-wave', 'synthpop 80s', 'genre:grunge', 'britpop', 'genre:trip-hop'],
      compatibleUserGenres: ['classic rock', 'oldies', 'retro', 'soul', 'r&b', 'pop', 'new wave'],
      incompatibleKeywords: ['emerging', 'underground'],
    },
    {
      id: 'intensity',
      label: { en: 'Wake Me Up', th: 'สะดุ้งแรงๆ' },
      emoji: '⚡',
      desc: { en: 'Something intense to jolt me out of this.', th: 'เพลงที่ทำให้ตื่น' },
      // Drum and bass, big beat, speed metal, jungle — genuinely high-BPM genres
      genrePool: ['genre:drum-and-bass', 'big beat', 'speed metal', 'genre:jungle', 'electro house'],
      compatibleUserGenres: ['rock', 'electronic', 'metal', 'punk', 'hip hop', 'dance', 'edm'],
      incompatibleKeywords: ['slow', 'chill', 'lofi', 'ambient', 'acoustic', 'mellow'],
    },
    {
      id: 'surprise',
      label: { en: 'Surprise Me', th: 'สุ่มเลย' },
      emoji: '🎲',
      desc: { en: 'Randomize it completely.', th: 'อะไรก็เอา' },
      // Genuinely eclectic real genres — something from left field
      genrePool: ['genre:cumbia', 'genre:afrobeat', 'genre:reggaeton', 'chiptune', 'genre:psych-rock'],
      compatibleUserGenres: ['indie', 'alternative', 'pop', 'hip hop', 'r&b', 'electronic', 'rock', 'folk'],
      incompatibleKeywords: [],
    },
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

// ─── Core: extract user's top genres from top artists ────────
// Pulls all unique genres from top 20 artists — Spotify tags these with
// micro-genres like "vapor soul", "indie poptimism", "escape room" etc.
const extractUserGenres = (userTopData) => {
  if (!userTopData) return [];
  // Prefer Gemma-inferred genres (artist names → genre mapping)
  // since Spotify's API no longer returns genre data on top artists
  if (userTopData.inferredGenres?.length) return userTopData.inferredGenres;
  // Fallback: try native genre field in case it ever comes back
  return [...new Set((userTopData.artists || []).flatMap(a => a.genres || []))].filter(Boolean);
};

// Fisher-Yates — unbiased unlike sort(() => random)
const shuffleArray = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ─── Core: build personalized pool from user genres + archetype ──
// Goal: at least half the pool comes from the user's actual taste.
// The archetype's hardcoded genrePool acts as a backbone/floor —
// always present so new users (no taste data) still get good results.
//
// Compatibility check uses word-level matching so "vapor soul" matches
// the "soul" compatible keyword, "indie poptimism" matches "indie", etc.
const buildPersonalizedPool = (archetype, userGenres) => {
  // Confused/what archetype: no personalization — pure random chaos from the full pool
  if (archetype.id === 'what') {
    return shuffleArray(archetype.genrePool);
  }

  // FIXED archetypes skip personalization entirely — pure chaos, no taste blending
  if (archetype.FIXED) return shuffleArray([...archetype.genrePool]);

  // Word-level match: "vapor soul" → ["vapor", "soul"], checks against keywords
  const wordMatch = (genre, keyword) => {
    const genreWords = genre.toLowerCase().split(/[\s-]+/);
    const kwWords = keyword.toLowerCase().split(/[\s-]+/);
    return genreWords.some(gw => kwWords.some(kw => gw.includes(kw) || kw.includes(gw)));
  };

  // Qualifier words that poison a genre match even if a keyword matches
  // e.g. "comedy pop" matches keyword "pop" but "comedy" disqualifies it for music moods
  // Only block genres that are genuinely non-music or would break results
  // comedy, novelty etc are valid if that's what the user listens to
  const QUALIFIER_POISON = ['children', 'holiday', 'christmas', 'religious'];

  console.log('--- Genre gate debug ---');
  console.log('Raw user genres:', userGenres);
  console.log('Compatible keywords:', archetype.compatibleUserGenres);

  const compatible = userGenres.filter(genre => {
    const genreLower = genre.toLowerCase();

    // Reject if genre contains a poison qualifier regardless of keyword match
    if (QUALIFIER_POISON.some(p => genreLower.includes(p))) {
      console.log('  POISON:', genre);
      return false;
    }

    const isCompatible = archetype.compatibleUserGenres.some(compat => wordMatch(genre, compat));
    const isIncompatible = archetype.incompatibleKeywords.some(bad => wordMatch(genre, bad));
    if (isCompatible && !isIncompatible) console.log('  PASS:', genre);
    else console.log('  FAIL:', genre);
    return isCompatible && !isIncompatible;
  });

  // Deduplicate user genres against hardcoded pool (avoid near-duplicates)
  const hardcodedLower = archetype.genrePool.map(g => g.replace('genre:', '').toLowerCase());
  const uniqueUserGenres = compatible.filter(g =>
    !hardcodedLower.some(h => h.includes(g.toLowerCase()) || g.toLowerCase().includes(h))
  );

  // Target: user genres = at least half the pool
  // e.g. if hardcoded pool has 6 items, we want at least 6 user genres alongside
  const targetUserCount = Math.max(archetype.genrePool.length, uniqueUserGenres.length);
  const userSlice = shuffleArray(uniqueUserGenres).slice(0, targetUserCount);

  // Combine: ALL hardcoded (backbone) + as many user genres as available
  const combined = [...archetype.genrePool, ...userSlice];

  console.log(`Pool for ${archetype.id}: ${combined.length} total (${archetype.genrePool.length} hardcoded + ${userSlice.length} from user taste)`);
  console.log('User genres available:', uniqueUserGenres.length);
  console.log('Sample:', combined.slice(0, 6));

  return shuffleArray(combined);
};

// ─── Core: single Spotify search ─────────────────────────────
const searchTracks = async (token, query) => {
  if (!query?.trim()) return [];
  // If no user token, fall back to guest app-level token for search
  const activeToken = token || await getGuestToken();
  if (!activeToken) return [];

  // Preserve Spotify field operators like genre:shoegaze before cleaning
  const genreMatches = [];
  const withPlaceholders = query.replace(/genre:([a-z0-9_-]+)/gi, (match, g) => {
    genreMatches.push(g);
    return `GENREPLACEHOLDER${genreMatches.length - 1}`;
  });
  const cleaned = withPlaceholders.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const clean = cleaned.replace(/GENREPLACEHOLDER(\d+)/g, (_, i) => `genre:${genreMatches[i]}`).slice(0, 80);

  if (!clean) return [];
  console.log('Spotify search query:', clean);

  try {
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(clean)}&type=track&limit=10&offset=${Math.floor(Math.random() * 5) * 10}`,
      { headers: { Authorization: `Bearer ${activeToken}` } }
    );
    if (res.status === 401) { if (token) handleLogout(); guestTokenCache = null; return []; }
    if (!res.ok) return [];
    const data = await res.json();
    return (data.tracks?.items || []).map(t => ({
      id: t.id,
      title: t.name,
      artist: t.artists.map(a => a.name).join(', '),
      album: t.album.name,
      uri: t.uri,
      popularity: t.popularity,
      image: t.album.images?.[1]?.url || t.album.images?.[0]?.url || '',
    }));
  } catch (e) {
    console.error('Search error:', e);
    return [];
  }
};

// ─── Core: parallel multi-query search + merge ───────────────
// Runs 3 searches in parallel, merges results, deduplicates by track ID,
// then shuffles to give variety across queries
const multiSearch = async (token, queries) => {
  const results = await Promise.all(queries.map(q => searchTracks(token, q)));
  const seen = new Set();
  const merged = [];
  const maxLen = Math.max(0, ...results.map(r => r.length));
  for (let i = 0; i < maxLen; i++) {
    for (const result of results) {
      if (result[i] && !seen.has(result[i].id)) {
        seen.add(result[i].id);
        merged.push(result[i]);
      }
    }
  }
  return merged.slice(0, 20);
};

// ─── Core: build search queries from archetype + user genres ──
// 5 parallel queries: ~3 from user taste + ~2 from hardcoded pool (3/5 user ratio)
const buildArchetypeQueries = (archetype, userTopData) => {
  if (archetype.id === 'what') return shuffleArray(archetype.genrePool).slice(0, 5);

  const userGenres = extractUserGenres(userTopData);

  const wordMatch = (g, k) => {
    const gw = g.toLowerCase().split(/[\s-]+/);
    const kw = k.toLowerCase().split(/[\s-]+/);
    return gw.some(a => kw.some(b => a.includes(b) || b.includes(a)));
  };

  // Score each user genre by how many compatible keywords it matches
  // e.g. "progressive metal" matching both "metal" + "core" scores 2, beats "alt metal" at 1
  const scored = userGenres
    .map(genre => {
      const bad = archetype.incompatibleKeywords.some(b => wordMatch(genre, b));
      if (bad) return null;
      const score = archetype.compatibleUserGenres.filter(c => wordMatch(genre, c)).length;
      if (score === 0) return null;
      return { genre, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score); // highest match count first

  // Add small random jitter so equally-scored genres shuffle each refresh
  const jittered = scored.map(s => ({ ...s, score: s.score + Math.random() * 0.5 }))
    .sort((a, b) => b.score - a.score);

  // Take top 3 most compatible user genres
  const userPicks = jittered.slice(0, 3).map(s => s.genre);
  const hardcodedPool = shuffleArray(archetype.genrePool);
  const hardcodedPicks = hardcodedPool.filter(g => !userPicks.includes(g)).slice(0, 5 - userPicks.length);
  const queries = [...userPicks, ...hardcodedPicks];

  console.log(`Queries [scored]: ${userPicks.length} user + ${hardcodedPicks.length} hardcoded`);
  console.log('User picks (most compatible first):', userPicks);
  console.log('Hardcoded picks:', hardcodedPicks);
  return queries;
};

// ─── Core: Gemma-3 for custom text ───────────────────────────
const getGemmaQueries = async (customText, userTopData) => {
  const userGenres = extractUserGenres(userTopData).slice(0, 8);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const prompt = `The user describes their mood: "${customText}"

Their music taste includes these genres: ${userGenres.length ? userGenres.join(', ') : 'unknown'}.

Generate exactly 3 Spotify search queries to find music matching this vibe.

CRITICAL RULES:
- Use ONLY real established music genre names that Spotify indexes (e.g. "shoegaze", "nu disco", "trip hop", "post-hardcore", "bedroom pop", "neo soul", "synthpop", "drill")
- You may prefix with "genre:" for exact matching (e.g. "genre:shoegaze")
- NEVER use vibe descriptions like "feel good", "upbeat banger", "emotional depth" — these match song titles not genres
- NEVER use artist names or song titles
- Blend 1-2 of the user genres ONLY if they match the emotional tone
- Also generate a short poetic playlist name (max 4 words)
- Output ONLY valid JSON, no markdown

Output format: { "queries": ["genre1", "genre2", "genre3"], "playlistName": "name here" }`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.8 },
    }),
  });

  if (!res.ok) throw new Error('Gemma failed');
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in response');
  return JSON.parse(jsonMatch[0]);
};

// ─── Fallback: if multiSearch returns <3 tracks, broaden ─────
const fallbackSearch = async (token, archetype) => {
  // Try 3 different broad queries from the pool to maximize chance of results
  const pool = shuffleArray([...archetype.genrePool]);
  const broadQueries = pool.slice(0, 3).map(q =>
    q.replace('genre:', '').split(' ').slice(0, 2).join(' ')
  );
  const results = await Promise.all(broadQueries.map(q => searchTracks(token, q)));
  const seen = new Set();
  return results.flat().filter(t => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
};

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [isConnected, setIsConnected] = useState(!!localStorage.getItem("token"));
  const [userProfile, setUserProfile] = useState(null);
  const [userTopData, setUserTopData] = useState(null);
  const [showDebug, setShowDebug] = useState(false);
  const [language, setLanguage] = useState('en');

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
  const [loadingStatus, setLoadingStatus] = useState('');

  const processedCode = useRef(null);
  const genreInferenceRef = useRef(null); // holds the pending Gemma promise
  const t = translations[language];

  // ─── Auth ──────────────────────────────────────────────
  const handleLogout = () => {
    localStorage.removeItem('token'); localStorage.removeItem('code_verifier');
    setToken(''); setIsConnected(false); setUserProfile(null); setUserTopData(null);
    reset();
  };

  const fetchUserProfile = async (tk) => {
    if (!tk) return;
    const res = await fetch('https://api.spotify.com/v1/me', { headers: { Authorization: `Bearer ${tk}` } });
    if (res.ok) setUserProfile(await res.json());
    else if (res.status === 401) handleLogout();
  };

  const fetchUserTopData = async (tk) => {
    if (!tk) return;
    try {
      // Fetch all 3 time ranges in parallel — short=4wks, medium=6mo, long=years
      // This way a jazz phase from 2 years ago still informs the genre pool,
      // not just whatever metal you've been on this month
      const ranges = ['short_term', 'medium_term', 'long_term'];
      const fetches = ranges.flatMap(range => [
        fetch(`https://api.spotify.com/v1/me/top/artists?limit=20&time_range=${range}`, { headers: { Authorization: `Bearer ${tk}` } }),
        fetch(`https://api.spotify.com/v1/me/top/tracks?limit=10&time_range=${range}`, { headers: { Authorization: `Bearer ${tk}` } }),
      ]);
      const responses = await Promise.all(fetches);
      const [arS, trS, arM, trM, arL, trL] = await Promise.all(responses.map(r => r.ok ? r.json() : { items: [] }));

      // Merge artists across all ranges, deduplicate by id
      // Weight: short_term artists appear first (most recent taste leads)
      const allArtists = [...(arS.items || []), ...(arM.items || []), ...(arL.items || [])];
      const seenIds = new Set();
      const artists = allArtists.filter(a => {
        if (seenIds.has(a.id)) return false;
        seenIds.add(a.id);
        return true;
      });

      const tracks = [...(trS.items || []), ...(trM.items || []), ...(trL.items || [])];

      setUserTopData({ artists, tracks });

      if (artists.length > 0) {
        // Pass all unique artist names — across all time ranges gives Gemma
        // a much wider picture of taste breadth, not just recent obsessions
        const names = artists.map(a => a.name).join(', ');
        genreInferenceRef.current = inferGenresFromArtists(names, tk);
      }
    } catch (e) { console.error(e); }
  };

  // Ask Gemma to infer genres from artist names — fires once after login
  const inferGenresFromArtists = async (artistNames, tk) => {
    if (!GEMINI_API_KEY) return;
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
      const prompt = `Given these music artists the user listens to across their entire Spotify history: ${artistNames}

Infer what music genres this person enjoys. Return 15-25 specific genre names that Spotify actually uses.

Rules:
- Use real Spotify genre names only (e.g. "progressive metal", "math rock", "dream pop", "neo soul", "bedroom pop", "darkwave", "jazz fusion", "lo-fi hip hop")
- Be specific — "progressive metal" not just "metal"
- REFLECT THE FULL BREADTH of the artist list — if they listen to both metal AND jazz AND ambient, include all of them
- Do NOT just focus on the dominant genre — surface the variety
- Output ONLY a JSON array of strings, nothing else

Example output: ["progressive metal", "math rock", "art pop", "lo-fi hip hop", "dark ambient", "jazz fusion"]`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3 },
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const match = text.match(/\[.*\]/s);
      if (!match) return;
      const inferredGenres = JSON.parse(match[0]);
      console.log('Gemma inferred genres:', inferredGenres);
      setUserTopData(prev => ({ ...prev, inferredGenres }));
      return inferredGenres; // return so callers can use immediately without waiting for re-render
    } catch (e) {
      console.error('Genre inference failed:', e);
      return [];
    }
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

  const toggleLanguage = () => setLanguage(prev => prev === 'en' ? 'th' : 'en');

  // ─── Loading status text system ──────────────────────────────────────────
  // Each step has multiple variants — picked randomly each time.
  // Some variants reference actual artist names from user's top list.
  const LOAD_TEXTS = {
    en: {
      readingTaste: [
        "reading your music taste...",
        "snooping through your spotify history...",
        "judging your music taste (respectfully)...",
        "okay let's see what you're actually about...",
        "pulling up your vibe profile...",
      ],
      inferringGenres: [
        "asking AI what your artists mean...",
        "translating your chaos into genres...",
        "figuring out the vibe...",
        "connecting the dots between your artists...",
        "running your taste through the machine...",
      ],
      buildingPool: [
        "mixing your taste with the mood...",
        "building your personal sound pool...",
        "blending genres like a DJ who knows you...",
        "crafting your search ingredients...",
        "combining vibes...",
      ],
      searching: [
        "digging through spotify...",
        "hunting for the right tracks...",
        "searching the depths of music...",
        "sifting through millions of songs...",
        "looking for exactly this feeling...",
      ],
      almostDone: [
        "almost there...",
        "just about done...",
        "putting it together...",
        "finalizing...",
        "one sec...",
      ],
      confused: [
        "finding the weirdest corners of the internet...",
        "unearthing things that should not exist...",
        "consulting the void...",
        "this may cause permanent damage. loading.",
        "looking for sounds that haven't been named yet...",
        "searching: music? debatable.",
        "digging through the parts of spotify no one talks about...",
      ],
    },
    th: {
      readingTaste: [
        "แอบส่องประวัติ spotify แปปนึงนะ อย่าบอกใคร",
        "โอ้โห ฟังอะไรบ้างเนี่ย ขอดูหน่อย...",
        "กำลังตัดสินรสนิยม (แบบรักๆ) อยู่นะ",
        "เดี๋ยวก็รู้ว่าคุณเป็นคนยังไง...",
        "สแกน vibe... ได้กลิ่นบางอย่างแล้ว",
        "ขอแอบดูหน่อยนึงได้ไหม ดูแล้ว",
      ],
      inferringGenres: [
        "ให้ AI เนรมิตแนวเพลงจากศิลปินที่คุณฟังอยู่...",
        "กำลังถอดรหัสความโกลาหลในหัวคุณ...",
        "AI กำลังคิดหนักอยู่ รอแปป!",
        "ประมวลผล vibe... ไม่ได้ง่ายอย่างที่คิดนะ",
        "แปลงศิลปินเป็นแนวเพลง เหมือนแปลภาษามนุษย์ต่างดาว",
      ],
      buildingPool: [
        "กำลังผสมเพลงให้เข้ากับอารมณ์... เหมือนทำสูตรยา",
        "คัดเลือกแนวเพลงที่ใช่ ไม่ใช่แค่สุ่มมั่วนะ",
        "ปั้นแต่ง pool เพลงให้เหมาะกับคุณโดยเฉพาะ",
        "ผสม vibe กำลังดีไม่มากไม่น้อย",
        "กำลังทำการบ้านให้คุณอยู่ ขอบคุณก็ดีนะ",
      ],
      searching: [
        "หาเข็มในกองเข็ม... แต่ต้องหาให้ได้",
        "กำลังขุดหาเพลงในมหาสมุทร spotify...",
        "ค้นหาอยู่ อย่าเพิ่งไปไหน!",
        "สแกนเพลงนับล้าน เพื่อคุณคนเดียว (อย่าซึ้งมาก)",
        "กำลังเสิร์ชอยู่ ใจเย็นๆ!",
        "ตามหาความรู้สึกนี้ให้เจอ ไม่ยอมแพ้",
      ],
      almostDone: [
        "เกือบละ! ใจเย็น!",
        "รอแปป! เกือบได้แล้ว",
        "อีกนิดเดียว อย่าปิดหนีไปไหน",
        "จวนจะเสร็จ... ช้าแต่ชัวร์",
        "โหลดอยู่นะ ไม่ได้หลับ",
      ],
      confused: [
        "กำลังหาเพลงที่ไม่ควรมีอยู่...",
        "ปรึกษาความว่างเปล่าอยู่ รอแปป",
        "ขุดหาส่วนที่แปลกที่สุดของ spotify...",
        "เตือนแล้วนะ ถ้าหูพัง อย่ามาโทษ",
        "กำลังค้นหา: เสียง? ไม่แน่ใจ.",
        "หาเพลงที่ยังไม่มีชื่อเรียก...",
      ],
    },
  };

  // Artist callout — reacts to specific artists in user's top list
  const NOTABLE_ARTISTS = {
    en: {
      'Igorrr': ["igorrr? so you can count.", "igorrr detected. you're fine.", "oh you count. interesting."],
      'Polyphia': ["polyphia... so you're one of those people.", "polyphia? nerd. (compliment)", "polyphia listener spotted. illegal taste."],
      'STOMACH BOOK': ["stomach book?? who told you about them", "never heard of them. you win.", "okay underground. noted. 👀"],
      'Miracle Musical': ["MIRACLE MUSICAL NO WAYYYYYYYYYYYYYY", "miracle musical?? hello???", "HAWAII PART II??? IN THIS ECONOMY???"],
      'Anomalie': ["anomalie. you're automatically cool.", "anomalie? yeah okay. respect."],
      'Rammstein': ["DU. DU HAST. DU HAST MICH.", "rammstein. german therapy. understood.", "du hast understood the assignment."],
      'Avenged Sevenfold': ["a7x. drama enjoyer. got it.", "a7x? classic. no notes.", "so you like theatrics. same."],
      'Slipknot': ["slipknot!! let's go!!", "9 people wasn't enough apparently.", "slipknot? this playlist goes hard."],
      'Billie Eilish': ["billie eilish. sad pop with dread. same.", "billie fan 🖤 got it.", "pop but make it ominous. respect."],
      'Bo Burnham': ["bo burnham?? okay you get it.", "comedy that hits too hard. you know.", "bo burnham listener detected. you're going to be okay."],
      'C418': ["c418. wet hands jumpscare 😭", "c418!! minecraft feelings loading...", "you felt things in a pixelated world. valid."],
      'Mick Gordon': ["MICK GORDON. RIP AND TEAR.", "doom ost listener. built different.", "mick gordon? this playlist will be unhinged."],
      'HYBS': ["hybs! thai taste spotted 🇹🇭", "hybs? sawasdee krub/kha 👋"],
    },
    th: {
      'Igorrr': ["igorrr? นับได้นะ เก่ง", "เจอคนฟัง igorrr. ขอก้มหัว.", "igorrr เหรอ. โอเค. เจ๋ง."],
      'Polyphia': ["polyphia... เป็นพวกนั้นด้วย งั้นหรอ", "polyphia? เนิร์ด (แบบชม)", "polyphia เหรอ. รสนิยมผิดกฎหมาย."],
      'STOMACH BOOK': ["stomach book?? ใครบอกให้รู้จักเนี่ย", "ไม่รู้จักเลย. คุณชนะ.", "underground เกิน google ยังไม่รู้จัก 👀"],
      'Miracle Musical': ["MIRACLE MUSICAL อย่าาาาาาาา", "miracle musical?? เฮ้ยยยย???", "HAWAII PART II??? จริงเหรอ???"],
      'Anomalie': ["anomalie. เท่โดยอัตโนมัติ.", "anomalie เหรอ โอเค นับถือ"],
      'Rammstein': ["DU. DU HAST. DU HAST MICH.", "rammstein. therapy แบบเยอรมัน. เข้าใจ.", "du hast เข้าใจ assignment แล้ว"],
      'Avenged Sevenfold': ["a7x. ชอบ drama. ได้เลย.", "a7x? คลาสสิก ไม่มีติ.", "theatrics enjoyer. เหมือนกันเลย."],
      'Slipknot': ["slipknot!! ไปเลย!!", "9 คนยังไม่พอ งั้นหรอ", "slipknot? playlist นี้โหดแน่"],
      'Billie Eilish': ["billie eilish. pop + ความหม่น. เหมือนกัน.", "billie fan 🖤 โอเค", "pop แต่น่ากลัวนิดนึง. นับถือ."],
      'Bo Burnham': ["bo burnham? โอเค คุณเข้าใจ.", "comedy ที่เจ็บเกินไป. รู้ดี.", "bo burnham listener. คุณโอเคนะ?"],
      'C418': ["c418. wet hands jumpscare 😭", "c418!! กำลังโหลดความรู้สึก minecraft...", "เคยร้องไห้ใน pixelated world. ปกติ."],
      'Mick Gordon': ["MICK GORDON. RIP AND TEAR เลย.", "doom ost listener. เกิดมาเพื่อสิ่งนี้.", "mick gordon? playlist นี้จะโกลาหล."],
      'HYBS': ["hybs! เจอคนไทยซะที 🇹🇭", "hybs? สวัสดีจ้า 👋"],
    },
  };

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const GENERIC_CALLOUTS = {
    en: [
      (a) => `${a}? good taste.`,
      (a) => `oh you listen to ${a}? respect.`,
      (a) => `${a} spotted. nice.`,
      (a) => `${a}... okay i see you.`,
      (a) => `${a}? didn't expect that. cool.`,
      (a) => `so you're a ${a} person. noted.`,
      (a) => `${a}!! solid choice.`,
    ],
    th: [
      (a) => `${a}? รสนิยมดีนะ`,
      (a) => `ฟัง ${a} ด้วยเหรอ นับถือ`,
      (a) => `${a} เจอแล้ว โอเคมาก`,
      (a) => `${a}... โอ้โห เห็นคุณแล้ว`,
      (a) => `${a}? ไม่คาดคิดเลย เก๋ดี`,
      (a) => `คนฟัง ${a} งั้นหรอ จดไว้แล้ว`,
      (a) => `${a}!! เลือกได้ดีมาก`,
    ],
  };

  const getArtistCallout = (lang) => {
    const artists = userTopData?.artists?.map(a => a.name) || [];
    if (!artists.length) return null;

    const texts = NOTABLE_ARTISTS[lang];
    // Collect ALL hardcoded matches first
    const allMatches = artists
      .filter(a => texts[a])
      .map(a => pick(texts[a]));

    if (allMatches.length > 0) {
      return allMatches[Math.floor(Math.random() * allMatches.length)];
    }

    // No hardcoded match — pick a random artist and use a generic template
    const randomArtist = artists[Math.floor(Math.random() * artists.length)];
    const templates = GENERIC_CALLOUTS[lang];
    return pick(templates)(randomArtist);
  };

  const setLoadStep = (key) => {
    const texts = LOAD_TEXTS[language];
    const arr = texts[key];
    setLoadingStatus(pick(arr));
  };

  // ─── Main logic ────────────────────────────────────────
  const handleMoodSelect = (mood) => {
    if (mood.id === 'custom') {
      setSelectedMood(mood);
      setStep('custom');
    } else if (mood.id === 'confused') {
      setSelectedMood(mood);
      setStep('confused');
    } else {
      setSelectedMood(mood);
      setStep('archetype');
    }
  };

  // Pre-defined archetype: build genre-blended queries, run parallel search
  const handleArchetypeSelect = async (archetype) => {
    setSelectedArchetype(archetype);
    setStep('results');
    setIsLoading(true);
    setError('');
    setTracks([]);

    try {
      const pause = (ms) => new Promise(r => setTimeout(r, ms));
      const MIN_MSG_TIME = 650;

      // ── Confused path: skip all taste/inference logic, pure hardcoded chaos ──
      if (archetype.id === 'what') {
        setLoadStep('confused');
        await pause(MIN_MSG_TIME);
        setLoadStep('confused'); // pick another random one
        const queries = buildArchetypeQueries(archetype, null);
        const searchStart = Date.now();
        let found = await multiSearch(token, queries);
        if (found.length < 3) {
          const fallback = await fallbackSearch(token, archetype);
          const seen = new Set(found.map(t => t.id));
          found = [...found, ...fallback.filter(t => !seen.has(t.id))];
        }
        const elapsed = Date.now() - searchStart;
        if (elapsed < MIN_MSG_TIME) await pause(MIN_MSG_TIME - elapsed);
        setLoadStep('confused');
        await pause(500);
        setTracks(found);
        setPlaylistMeta({ name: language === 'en' ? '❓ what' : '❓ ฮะ?', description: language === 'en' ? 'okay.' : 'โอเค.' });
        if (found.length === 0) setError(t.noTracksFound);
        return;
      }

      // ── Normal path ──────────────────────────────────────────────────────────
      // Step 1: reading taste
      setLoadStep('readingTaste');
      await pause(MIN_MSG_TIME);

      // Maybe swap to an artist callout
      const callout = getArtistCallout(language);
      if (callout) {
        setLoadingStatus(callout);
        await pause(MIN_MSG_TIME + 200);
      }

      // Step 2: genre inference — only shows if Gemma is still running
      let effectiveUserTopData = userTopData;
      if (genreInferenceRef.current && !userTopData?.inferredGenres) {
        setLoadStep('inferringGenres');
        const inferredGenres = await genreInferenceRef.current;
        if (inferredGenres?.length) {
          effectiveUserTopData = { ...userTopData, inferredGenres };
        }
      }

      // Step 3: building pool
      setLoadStep('buildingPool');
      const queriesPromise = Promise.resolve(buildArchetypeQueries(archetype, effectiveUserTopData));
      await pause(MIN_MSG_TIME);
      const queries = await queriesPromise;

      // Step 4: searching
      setLoadStep('searching');
      const searchStart = Date.now();
      let found = await multiSearch(token, queries);

      if (found.length < 3) {
        const fallback = await fallbackSearch(token, archetype);
        const seen = new Set(found.map(t => t.id));
        found = [...found, ...fallback.filter(t => !seen.has(t.id))];
      }

      // If search was super fast, pad so "searching" message was readable
      const searchElapsed = Date.now() - searchStart;
      if (searchElapsed < MIN_MSG_TIME) await pause(MIN_MSG_TIME - searchElapsed);

      // Step 5: almost done — always show briefly before results pop
      setLoadStep('almostDone');
      await pause(500);

      setTracks(found);
      setPlaylistMeta({
        name: `${selectedMood?.emoji || ''} ${archetype.label[language]}`,
        description: archetype.desc[language],
      });

      if (found.length === 0) setError(t.noTracksFound);
    } catch (e) {
      console.error('Archetype search error:', e);
      setError(t.somethingWrong);
    } finally {
      setIsLoading(false);
      setLoadingStatus('');
    }
  };

  // Custom text: Gemma generates genre queries → same pipeline
  const handleCustomSubmit = async () => {
    if (!customMoodText.trim()) return;
    setStep('results');
    setIsLoading(true);
    setError('');
    setTracks([]);

    try {
      setLoadStep('readingTaste');
      const callout = getArtistCallout(language);
      if (callout) {
        await new Promise(r => setTimeout(r, 400));
        setLoadingStatus(callout);
        await new Promise(r => setTimeout(r, 600));
      }

      setLoadStep('inferringGenres');
      await new Promise(r => setTimeout(r, 200));

      let queries;
      let playlistName = t.appName;

      try {
        const gemmaResult = await getGemmaQueries(customMoodText, userTopData);
        queries = gemmaResult.queries || [];
        playlistName = gemmaResult.playlistName || t.appName;
        console.log('Gemma queries:', queries);
      } catch (e) {
        console.error('Gemma failed, falling back to raw text search:', e);
        // Fallback: split custom text into simple keyword queries
        queries = [customMoodText.slice(0, 30)];
      }

      setLoadStep('searching');
      let found = await multiSearch(token, queries);

      // Fallback if too few
      if (found.length < 3 && queries.length > 0) {
        const simpleQuery = queries[0].split(' ').slice(0, 2).join(' ');
        const fallback = await searchTracks(token, simpleQuery);
        const seen = new Set(found.map(t => t.id));
        found = [...found, ...fallback.filter(t => !seen.has(t.id))];
      }

      setTracks(found);
      setPlaylistMeta({ name: playlistName, description: customMoodText });

      setLoadStep('almostDone');
      await new Promise(r => setTimeout(r, 200));
      if (found.length === 0) setError(t.noTracksFound);
    } catch (e) {
      console.error('Custom submit error:', e);
      setError(t.somethingWrong);
    } finally {
      setIsLoading(false);
      setLoadingStatus('');
    }
  };

  const addToQueue = (track) => {
    if (queue.find(q => q.id === track.id)) return;
    setQueue(prev => [...prev, track]);
  };

  const removeFromQueue = (id) => setQueue(prev => prev.filter(q => q.id !== id));

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
        <header className="flex items-center justify-between mb-6 pb-5 border-b border-neutral-800">
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
                    : <div className="w-7 h-7 rounded-full bg-neutral-700 flex items-center justify-center text-xs font-bold text-white">
                      {userProfile?.display_name?.[0]?.toUpperCase() || '?'}
                    </div>
                  }
                  <span className="text-xs font-bold hidden sm:inline truncate max-w-[100px]">{userProfile?.display_name}</span>
                </div>
                <button onClick={handleLogout} className="p-2 text-neutral-600 hover:text-red-400 transition-colors bg-neutral-800 rounded-full border border-neutral-700"><LogOut size={16} /></button>
              </div>
            )}
          </div>
        </header>

        {/* Language Toggle */}
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

        <div className="space-y-8">

          {/* STEP: Mood selection */}
          {step === 'mood' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <h2 className="text-2xl font-black mb-1">{t.howFeeling}</h2>
              <p className="text-neutral-500 text-sm mb-4">{t.pickMood}</p>
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
              {!isConnected && (
                <p className="mt-5 text-[11px] text-neutral-600 leading-relaxed text-center">
                  {language === 'en'
                    ? <>can't log in or save to spotify? you might not be authorized yet. don't worry — you can host your own copy and add your friends. <a href="https://github.com/YOUR_GITHUB/vibesync" target="_blank" rel="noopener noreferrer" className="text-neutral-500 underline underline-offset-2 hover:text-neutral-300 transition-colors">here's how →</a></>
                    : <>ล็อกอินไม่ได้หรือบันทึกไม่ได้? อาจยังไม่ได้รับสิทธิ์ ไม่เป็นไร — สามารถโฮสต์เองและเพิ่มเพื่อนได้เลย <a href="https://github.com/YOUR_GITHUB/vibesync" target="_blank" rel="noopener noreferrer" className="text-neutral-500 underline underline-offset-2 hover:text-neutral-300 transition-colors">ดูวิธีตรงนี้ →</a></>
                  }
                </p>
              )}
            </div>
          )}

          {/* STEP: Custom mood */}
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

          {/* STEP: Confused — one big "what" button */}
          {step === 'confused' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <button onClick={reset} className="flex items-center gap-1 text-neutral-500 hover:text-white text-sm mb-6 transition-colors">
                <ChevronLeft size={16} /> {t.back}
              </button>
              <div className="flex flex-col items-center justify-center py-16 gap-6">
                <p className="text-neutral-600 text-sm">{language === 'en' ? 'are you sure?' : 'แน่ใจนะ?'}</p>
                <button
                  onClick={() => handleArchetypeSelect(ARCHETYPES.confused[0])}
                  className="group relative px-12 py-8 rounded-3xl border-2 border-neutral-700 bg-neutral-900 hover:bg-neutral-800 hover:border-neutral-500 active:scale-95 transition-all duration-150 select-none cursor-pointer"
                >
                  <span className="text-7xl font-black uppercase italic tracking-tighter text-white group-hover:text-neutral-100 transition-colors block"
                    style={{ textShadow: '0 0 40px rgba(255,255,255,0.1)' }}>
                    {language === 'en' ? 'what' : 'ฮะ?'}
                  </span>
                  <span className="block text-center text-neutral-600 text-xs mt-2 group-hover:text-neutral-400 transition-colors">
                    {language === 'en' ? 'press it' : 'กด'}
                  </span>
                </button>
                <p className="text-neutral-700 text-xs">{language === 'en' ? 'no refunds' : 'ไม่รับผิดชอบนะ'}</p>
              </div>
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
                    onClick={() => selectedArchetype ? handleArchetypeSelect(selectedArchetype) : handleCustomSubmit()}
                    className="flex items-center gap-1 text-neutral-500 hover:text-white text-sm transition-colors"
                  >
                    <Shuffle size={14} /> {t.refresh}
                  </button>
                )}
              </div>

              {isLoading ? (
                <div className="space-y-6 py-8">
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="w-2 h-2 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                    <p className="text-neutral-400 text-sm text-center min-h-[20px] transition-all duration-300">
                      {loadingStatus}
                    </p>
                  </div>
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 bg-neutral-900 animate-pulse rounded-2xl" style={{ animationDelay: `${i * 0.05}s` }} />)}
                  </div>
                </div>
              ) : error ? (
                <div className="text-center py-12">
                  <p className="text-neutral-500 mb-4">{error}</p>
                  <button
                    onClick={() => selectedArchetype ? handleArchetypeSelect(selectedArchetype) : handleCustomSubmit()}
                    className="bg-neutral-800 hover:bg-neutral-700 px-6 py-2.5 rounded-full text-sm font-bold transition-all"
                  >
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
                        {isConnected && (
                          <button
                            onClick={savePlaylist}
                            disabled={saveStatus === 'saving'}
                            className={`text-xs px-4 py-1.5 rounded-full font-black uppercase transition-all ${saveStatus === 'saved' ? 'bg-green-500 text-black' : 'bg-green-600 hover:bg-green-500 text-white'}`}
                          >
                            {saveStatus === 'saving' ? t.saving : saveStatus === 'saved' ? t.saved : t.saveToSpotify}
                          </button>
                        )}
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
                      <div key={track.id} className="group flex items-center gap-4 p-3 rounded-xl hover:bg-neutral-900 transition-all">
                        <span className="text-xs text-neutral-700 w-4 text-center shrink-0 group-hover:hidden">{i + 1}</span>
                        <img src={track.image} className="w-10 h-10 rounded-lg shrink-0 shadow-lg" alt="" />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate text-white">{track.title}</p>
                          <p className="text-xs text-neutral-500 truncate">{track.artist} · {track.album}</p>
                        </div>
                        <button
                          onClick={() => addToQueue(track)}
                          className={`shrink-0 p-1.5 rounded-full transition-all ${queue.find(q => q.id === track.id) ? 'text-green-400 bg-green-500/10' : 'text-neutral-600 hover:text-white hover:bg-neutral-700'}`}
                        >
                          {queue.find(q => q.id === track.id) ? <Check size={16} strokeWidth={3} /> : <PlusCircle size={16} />}
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Save all — only if logged in */}
                  {tracks.length > 0 && isConnected && (
                    <button
                      onClick={savePlaylist}
                      disabled={saveStatus === 'saving'}
                      className={`w-full py-3 rounded-2xl font-black text-sm uppercase tracking-tight transition-all active:scale-95 ${saveStatus === 'saved' ? 'bg-green-500 text-black' : 'bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 text-white'}`}
                    >
                      {saveStatus === 'saving' ? t.saving : saveStatus === 'saved' ? t.savedToSpotify : queue.length > 0 ? t.saveMyPick : t.saveAll}
                    </button>
                  )}
                  {/* Connect nudge in results for unauthed users */}
                  {tracks.length > 0 && !isConnected && (
                    <button
                      onClick={handleConnect}
                      className="w-full py-3 rounded-2xl font-black text-sm uppercase tracking-tight transition-all active:scale-95 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-500 hover:text-white"
                    >
                      {language === 'en' ? '+ Connect Spotify to save & personalize' : '+ เชื่อมต่อ Spotify เพื่อบันทึกและปรับแต่ง'}
                    </button>
                  )}
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}