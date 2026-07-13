/* ═══════════════════════════════════════════════════════════════════════════
   BIRTAT V4 · ብርታት · script.js
   Personal Growth Operating System
   
   Architecture: Single-file modular (sections mirror separate module files)
   Sections:
     1. CONFIG      — constants, settings defaults, pillar definitions
     2. DATA MODEL  — unified day/week schema
     3. STORAGE     — all localStorage operations (single source of truth)
     4. UTILS       — date helpers, formatters, DOM helpers
     5. SCORING     — score calculations, pillar stats
     6. STATS       — streak, habit rates, aggregates
     7. DASHBOARD   — home page rendering
     8. TODAY       — daily tracker rendering & interaction
     9. CALENDAR    — monthly calendar rendering & navigation
    10. REVIEW      — weekly review rendering & interaction
    11. ANALYTICS   — SVG charts, trend calculations
    12. TIMELINE    — memory timeline rendering & search
    13. PROFILE     — profile page rendering
    14. SETTINGS    — export, import, reset
    15. APP         — navigation, startup, event registration
═══════════════════════════════════════════════════════════════════════════ */

'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   1. CONFIG
   All hardcoded values live here. Edit this section to customise Birtat.
═══════════════════════════════════════════════════════════════════════════ */

const CONFIG = {
  userName:        'Dagim',
  challengeStart:  '2026-07-09',   // YYYY-MM-DD
  challengeDays:   90,
  storageKey:      'birtat-v4',
  legacyKeys:      ['birtat-v3', 'birtat-v2', 'birtat-state'],
  version:         '4.0.0',

  // Score thresholds
  scoreExcellent:  90,
  scoreStrong:     75,
  scoreAverage:    60,

  // A streak day counts if score >= this
  streakThreshold: 60,
};

// Pillar definitions — weights must sum to 100
const PILLARS = {
  faith: {
    label:   'Faith',
    icon:    '✝️',
    weight:  20,
    habits:  ['prayer', 'bible', 'reflect'],
  },
  discipline: {
    label:   'Discipline',
    icon:    '⚔️',
    weight:  20,
    habits:  ['noBadHabit', 'screenTime'],
  },
  health: {
    label:   'Health',
    icon:    '🏋️',
    weight:  20,
    habits:  ['workout', 'sleep', 'ate'],
  },
  learning: {
    label:   'Learning',
    icon:    '🧠',
    weight:  20,
    habits:  ['selfHelp', 'biomedical', 'outsideCurriculum'],
  },
  creation: {
    label:   'Creation',
    icon:    '💻',
    weight:  10,
    habits:  ['gpafy', 'otherProject'],
  },
  relationships: {
    label:   'Relationships',
    icon:    '👥',
    weight:  10,
    habits:  ['meaningful', 'familyTime'],
  },
};

const PILLAR_IDS = Object.keys(PILLARS);

// Flat list of all habits with metadata
const HABITS = Object.entries(PILLARS).flatMap(([pid, p]) =>
  p.habits.map(hid => ({ id: hid, pillar: pid }))
);

const HABIT_META = {
  prayer:             { label: 'Prayed',                icon: '🙏' },
  bible:              { label: 'Bible reading',          icon: '📖' },
  reflect:            { label: 'Spiritual reflection',   icon: '🕯️' },
  noBadHabit:         { label: 'No bad habit',           icon: '🚫' },
  screenTime:         { label: 'Screen time under goal', icon: '📵' },
  workout:            { label: 'Worked out',             icon: '💪' },
  sleep:              { label: 'Slept well',             icon: '😴' },
  ate:                { label: 'Ate enough',             icon: '🍽️' },
  selfHelp:           { label: 'Self-help reading',      icon: '📚' },
  biomedical:         { label: 'Biomedical Eng.',        icon: '🔬' },
  outsideCurriculum:  { label: 'Outside curriculum',     icon: '🌱' },
  gpafy:              { label: 'GPAfy',                  icon: '📱' },
  otherProject:       { label: 'Other project',          icon: '🛠️' },
  meaningful:         { label: 'Meaningful convo',       icon: '💬' },
  familyTime:         { label: 'Family / friends',       icon: '❤️' },
};

const WEEK_SCORE_META = [
  { id: 'faith',         icon: '✝️',  label: 'Faith' },
  { id: 'discipline',    icon: '⚔️',  label: 'Discipline' },
  { id: 'health',        icon: '🏃',  label: 'Health' },
  { id: 'learning',      icon: '🧠',  label: 'Learning' },
  { id: 'creation',      icon: '💻',  label: 'Creation' },
  { id: 'relationships', icon: '👥',  label: 'Relationships' },
];

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const MOOD_EMOJIS = ['', '😔', '😐', '🙂', '😊', '🔥'];

/* ═══════════════════════════════════════════════════════════════════════════
   2. DATA MODEL
   Single schema for all day records. Every module reads from this shape.
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Returns a fresh, validated day record.
 * Any missing field is filled with a safe default.
 * @param {Object} [partial] — existing raw data to merge into
 * @returns {Object}
 */
function createDayRecord(partial = {}) {
  return {
    // Identity
    date:        partial.date        || '',
    createdAt:   partial.createdAt   || new Date().toISOString(),
    updatedAt:   partial.updatedAt   || new Date().toISOString(),

    // Mood & score (calculated, also stored for fast reads)
    mood:        clamp(parseInt(partial.mood)  || 0, 0, 5),
    score:       clamp(parseInt(partial.score) || 0, 0, 100),

    // Habits — each habit is true/false
    habits: Object.fromEntries(
      HABITS.map(h => [h.id, !!partial.habits?.[h.id]])
    ),

    // Backwards-compat: also accept checks (V3 field name)
    // (Merged below in validate())

    // Numbers
    water:        clamp(parseInt(partial.water)        || 0, 0, 30),
    protein:      clamp(parseInt(partial.protein)      || 0, 0, 20),
    screenHours:  clamp(parseInt(partial.screenHours)  || 0, 0, 24),
    gpafyPct:     clamp(parseInt(partial.gpafyPct)     || 0, 0, 100),
    sleepHours:   clamp(parseFloat(partial.sleepHours) || 0, 0, 24),

    // Priorities
    priorities: [
      partial.priorities?.[0] || partial.p1 || '',
      partial.priorities?.[1] || partial.p2 || '',
      partial.priorities?.[2] || partial.p3 || '',
    ],

    // Wake time
    wake:         partial.wake || '',

    // Avoidance & gratitude
    avoid:        partial.avoid    || '',
    grateful:     partial.grateful || '',

    // GPAfy note
    gpafyNote:    partial.gpafyNote || '',

    // Night reflection
    reflection: {
      wentWell:   partial.reflection?.wentWell   || partial.wentWell   || '',
      canImprove: partial.reflection?.canImprove || partial.canImprove || '',
      tomorrow:   partial.reflection?.tomorrow   || partial.tomorrow   || '',
    },

    // Memory timeline
    memorableMoment: partial.memorableMoment || partial.memory || '',
  };
}

/**
 * Validates and repairs a day record in-place.
 * Handles V3 field names (checks → habits).
 */
function validateDayRecord(rec) {
  // V3 migration: checks → habits
  if (rec.checks && !rec.habits) {
    rec.habits = rec.checks;
    delete rec.checks;
  }
  if (!rec.habits || typeof rec.habits !== 'object') rec.habits = {};

  // Ensure all habit keys exist
  HABITS.forEach(h => {
    if (typeof rec.habits[h.id] !== 'boolean') {
      rec.habits[h.id] = false;
    }
  });

  // Clamp numerics
  rec.water       = clamp(parseInt(rec.water)       || 0, 0, 30);
  rec.protein     = clamp(parseInt(rec.protein)     || 0, 0, 20);
  rec.screenHours = clamp(parseInt(rec.screenHours) || 0, 0, 24);
  rec.gpafyPct    = clamp(parseInt(rec.gpafyPct)    || 0, 0, 100);
  rec.mood        = clamp(parseInt(rec.mood)        || 0, 0, 5);

  // Ensure priorities is array
  if (!Array.isArray(rec.priorities)) {
    rec.priorities = [rec.p1||'', rec.p2||'', rec.p3||''];
  }
  while (rec.priorities.length < 3) rec.priorities.push('');

  // Ensure reflection object
  if (!rec.reflection || typeof rec.reflection !== 'object') {
    rec.reflection = {
      wentWell:   rec.wentWell   || '',
      canImprove: rec.canImprove || '',
      tomorrow:   rec.tomorrow   || '',
    };
  }

  // Ensure memorableMoment (V3 used memory)
  if (!rec.memorableMoment && rec.memory) {
    rec.memorableMoment = rec.memory;
  }
  rec.memorableMoment = rec.memorableMoment || '';

  return rec;
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. STORAGE
   Single source of truth for all persistence.
   Only this section may call localStorage directly.
═══════════════════════════════════════════════════════════════════════════ */

/** Top-level application state */
let AppState = {
  days:     {},    // { 'YYYY-MM-DD': DayRecord }
  reviews:  {},    // { 'w1': WeekReview }
  settings: {},    // user-configurable settings
  meta: {
    startDate:      CONFIG.challengeStart,
    longestStreak:  0,
    version:        CONFIG.version,
  },
};

/**
 * Load state from localStorage.
 * Migrates legacy keys automatically.
 */
function Storage_load() {
  try {
    // Try current key first, then legacy keys
    let raw = localStorage.getItem(CONFIG.storageKey);
    if (!raw) {
      for (const legacyKey of CONFIG.legacyKeys) {
        raw = localStorage.getItem(legacyKey);
        if (raw) break;
      }
    }
    if (!raw) return;

    const parsed = JSON.parse(raw);
    Storage_merge(parsed);
  } catch (err) {
    console.warn('[Birtat] State load failed, starting fresh:', err);
  }
}

/**
 * Merge a parsed state object into AppState.
 * Validates each day record.
 */
function Storage_merge(parsed) {
  if (!parsed || typeof parsed !== 'object') return;

  // Days
  if (parsed.days && typeof parsed.days === 'object') {
    for (const [dateStr, raw] of Object.entries(parsed.days)) {
      AppState.days[dateStr] = validateDayRecord(
        Object.assign(createDayRecord(), raw)
      );
    }
  }

  // Reviews
  if (parsed.reviews && typeof parsed.reviews === 'object') {
    AppState.reviews = Object.assign({}, parsed.reviews);
  }

  // Settings
  if (parsed.settings && typeof parsed.settings === 'object') {
    AppState.settings = Object.assign({}, parsed.settings);
  }

  // Meta
  if (parsed.meta && typeof parsed.meta === 'object') {
    AppState.meta = Object.assign(AppState.meta, parsed.meta);
  }
}

/** Persist full state to localStorage */
function Storage_save() {
  try {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(AppState));
  } catch (err) {
    console.warn('[Birtat] State save failed:', err);
  }
}

/**
 * Get a day record by date string.
 * Creates a new validated record if none exists.
 */
function Storage_loadDay(dateStr) {
  if (!AppState.days[dateStr]) {
    AppState.days[dateStr] = createDayRecord({ date: dateStr });
  }
  return AppState.days[dateStr];
}

/**
 * Update a day record and persist.
 * Accepts a partial update object; merges with existing record.
 */
function Storage_saveDay(dateStr, updates) {
  const existing = Storage_loadDay(dateStr);
  const merged   = Object.assign(existing, updates);
  merged.updatedAt = new Date().toISOString();
  merged.score     = Scoring_calcDayScore(merged.habits);
  AppState.days[dateStr] = validateDayRecord(merged);
  Storage_save();
}

/** Get a week review object */
function Storage_loadWeek(weekKey) {
  if (!AppState.reviews[weekKey]) AppState.reviews[weekKey] = {};
  return AppState.reviews[weekKey];
}

/** Save a week review object */
function Storage_saveWeek(weekKey, data) {
  AppState.reviews[weekKey] = Object.assign(
    Storage_loadWeek(weekKey), data
  );
  Storage_save();
}

/** Export full state as a JSON download */
function Storage_backup() {
  const blob = new Blob(
    [JSON.stringify(AppState, null, 2)],
    { type: 'application/json' }
  );
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = `birtat-backup-${Utils_dateKey(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Restore state from an imported JSON file */
function Storage_restore(jsonText) {
  try {
    const parsed = JSON.parse(jsonText);
    Storage_merge(parsed);
    Storage_save();
    return true;
  } catch (err) {
    console.warn('[Birtat] Restore failed:', err);
    return false;
  }
}

/** Wipe all data and reset to defaults */
function Storage_reset() {
  localStorage.removeItem(CONFIG.storageKey);
  AppState = {
    days: {}, reviews: {}, settings: {},
    meta: { startDate: CONFIG.challengeStart, longestStreak: 0, version: CONFIG.version },
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. UTILS
   Pure helper functions — no side effects, no DOM access.
═══════════════════════════════════════════════════════════════════════════ */

/** Clamp a number between min and max */
function clamp(val, min, max) {
  return Math.min(Math.max(Number(val) || 0, min), max);
}

/** Format a Date object as 'YYYY-MM-DD' */
function Utils_dateKey(d) {
  return d.toISOString().split('T')[0];
}

/** Today's date key */
function Utils_today() {
  return Utils_dateKey(new Date());
}

/** Summer / challenge day number (1-based) */
function Utils_challengeDay() {
  const start = new Date(CONFIG.challengeStart);
  const diff  = Math.floor((new Date() - start) / 86400000);
  return clamp(diff + 1, 1, CONFIG.challengeDays);
}

/** True if dateStr is in the future */
function Utils_isFuture(dateStr) {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return new Date(dateStr + 'T00:00:00') > t;
}

/** True if dateStr falls within the summer challenge window */
function Utils_isInChallenge(dateStr) {
  const start = new Date(CONFIG.challengeStart);
  const end   = new Date(start);
  end.setDate(end.getDate() + CONFIG.challengeDays - 1);
  const d = new Date(dateStr + 'T00:00:00');
  return d >= start && d <= end;
}

/** Long date string, e.g. "Monday, July 7, 2026" */
function Utils_fmtDateLong(d) {
  return d.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

/** Short date string, e.g. "Jul 7" */
function Utils_fmtDateShort(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Time-of-day greeting */
function Utils_greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning,' : h < 17 ? 'Good afternoon,' : 'Good evening,';
}

/* ─── DOM helpers ─────────────────────────────────────────────────────────── */

/** Set element text content safely */
function DOM_setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(val ?? '');
}

/** Set an element's inline style property safely */
function DOM_setStyle(id, prop, val) {
  const el = document.getElementById(id);
  if (el) el.style[prop] = val;
}

/** Set element value safely */
function DOM_setValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val ?? '';
}


/* ─── DOM Cache ─────────────────────────────────────────────────────────────
   Populated once on startup. Use DOMEl(id) instead of getElementById
   to avoid repeated DOM lookups.
─────────────────────────────────────────────────────────────────────────── */
const _domCache = {};
function DOMEl(id) {
  if (!_domCache[id]) _domCache[id] = document.getElementById(id);
  return _domCache[id];
}

// Override DOM helpers to use cache
function DOM_setText(id, val) {
  const el = DOMEl(id);
  if (el) el.textContent = String(val ?? '');
}
function DOM_setStyle(id, prop, val) {
  const el = DOMEl(id);
  if (el) el.style[prop] = val;
}
function DOM_setValue(id, val) {
  const el = DOMEl(id);
  if (el) el.value = val ?? '';
}

/* ─── Debounce ───────────────────────────────────────────────────────────── */
function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}
const _debouncedSetField = debounce((dateStr, key, value) => {
  Today_setField(dateStr, key, value);
}, 400);

/* ═══════════════════════════════════════════════════════════════════════════
   5. SCORING
   Pure calculations — returns values, never touches DOM.
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Calculate the overall daily score (0–100) from a habits map.
 * Each pillar contributes its weight proportionally to habits completed.
 */
function Scoring_calcDayScore(habits = {}) {
  let total = 0;
  for (const [, p] of Object.entries(PILLARS)) {
    const done     = p.habits.filter(hid => !!habits[hid]).length;
    const fraction = done / p.habits.length;
    total += fraction * p.weight;
  }
  return clamp(Math.round(total), 0, 100);
}

/**
 * Calculate completion % for a single pillar.
 */
function Scoring_pillarPct(pillarId, habits = {}) {
  const p    = PILLARS[pillarId];
  const done = p.habits.filter(hid => !!habits[hid]).length;
  return clamp(Math.round((done / p.habits.length) * 100), 0, 100);
}

/**
 * Points earned in a pillar out of its weight.
 */
function Scoring_pillarPts(pillarId, habits = {}) {
  const p    = PILLARS[pillarId];
  const done = p.habits.filter(hid => !!habits[hid]).length;
  return Math.round((done / p.habits.length) * p.weight);
}

/** CSS color variable for a given score */
function Scoring_color(score) {
  if (score >= CONFIG.scoreExcellent) return 'var(--green)';
  if (score >= CONFIG.scoreStrong)    return 'var(--blue)';
  if (score >= CONFIG.scoreAverage)   return 'var(--yellow)';
  return score > 0 ? 'var(--red)' : 'var(--ghost)';
}

/** Human-readable label for a score */
function Scoring_label(score) {
  if (score >= CONFIG.scoreExcellent) return '🟢 Excellent day';
  if (score >= CONFIG.scoreStrong)    return '🔵 Strong day';
  if (score >= CONFIG.scoreAverage)   return '🟡 Average day';
  if (score > 0)                      return '🔴 Needs improvement';
  return 'Start checking off habits';
}

/** CSS class suffix for a progress bar fill */
function Scoring_pfillClass(score) {
  if (score >= CONFIG.scoreExcellent) return 'g';
  if (score >= CONFIG.scoreStrong)    return 'b';
  if (score >= CONFIG.scoreAverage)   return 'y';
  return score > 0 ? 'r' : '';
}

/** CSS class for a calendar cell based on score */
function Scoring_calClass(score) {
  if (score >= CONFIG.scoreExcellent) return 'c-green';
  if (score >= CONFIG.scoreAverage)   return 'c-yellow';
  if (score > 0)                      return 'c-red';
  return 'c-empty';
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. STATS
   Aggregate calculations over the challenge period.
   Pure functions — read AppState, return values, never touch DOM.
═══════════════════════════════════════════════════════════════════════════ */

/** Iterate over all challenge days up to today, calling cb(dateStr, dayRecord|null) */
function Stats_eachDay(cb) {
  const start = new Date(CONFIG.challengeStart);
  const now   = new Date(); now.setHours(0, 0, 0, 0);
  for (let i = 0; i < CONFIG.challengeDays; i++) {
    const d = new Date(start); d.setDate(d.getDate() + i);
    if (d > now) break;
    const key = Utils_dateKey(d);
    cb(key, AppState.days[key] || null);
  }
}

/** Current streak (days with score >= threshold, counting back from today) */
function Stats_currentStreak() {
  let streak = 0;
  const now  = new Date(); now.setHours(0, 0, 0, 0);
  for (let i = 0; i < CONFIG.challengeDays; i++) {
    const d    = new Date(now); d.setDate(d.getDate() - i);
    const rec  = AppState.days[Utils_dateKey(d)];
    const sc   = rec ? Scoring_calcDayScore(rec.habits) : 0;
    if (sc >= CONFIG.streakThreshold)         streak++;
    else if (i === 0)                         continue; // today partial — don't break
    else                                      break;
  }
  return streak;
}

/** Longest streak ever recorded across the challenge */
function Stats_longestStreak() {
  let best = 0, cur = 0;
  Stats_eachDay((_, rec) => {
    const sc = rec ? Scoring_calcDayScore(rec.habits) : 0;
    if (sc >= CONFIG.streakThreshold) { cur++; if (cur > best) best = cur; }
    else cur = 0;
  });
  return Math.max(best, AppState.meta.longestStreak || 0);
}

/** Number of days with score >= threshold */
function Stats_completedDays() {
  let n = 0;
  Stats_eachDay((_, rec) => {
    if (rec && Scoring_calcDayScore(rec.habits) >= CONFIG.streakThreshold) n++;
  });
  return n;
}

/** Average daily score across all tracked days */
function Stats_avgScore() {
  let total = 0, n = 0;
  Stats_eachDay((_, rec) => {
    total += rec ? Scoring_calcDayScore(rec.habits) : 0;
    n++;
  });
  return n > 0 ? Math.round(total / n) : 0;
}

/** How many days a specific habit was completed */
function Stats_habitCount(habitId) {
  let n = 0;
  Stats_eachDay((_, rec) => { if (rec?.habits?.[habitId]) n++; });
  return n;
}

/** Completion rate % for a specific habit */
function Stats_habitRate(habitId) {
  let total = 0, done = 0;
  Stats_eachDay((_, rec) => {
    total++;
    if (rec?.habits?.[habitId]) done++;
  });
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

/** Array of { dateStr, score } for all tracked days — used by charts */
function Stats_scoreSeries() {
  const series = [];
  Stats_eachDay((key, rec) => {
    series.push({
      dateStr: key,
      score:   rec ? Scoring_calcDayScore(rec.habits) : 0,
    });
  });
  return series;
}

/** Array of { week, avgScore } for each completed week */
function Stats_weeklyScores() {
  const start = new Date(CONFIG.challengeStart);
  const now   = new Date(); now.setHours(0, 0, 0, 0);
  const weeks = [];
  for (let w = 0; w < Math.ceil(CONFIG.challengeDays / 7); w++) {
    let total = 0, n = 0;
    for (let d2 = 0; d2 < 7; d2++) {
      const d = new Date(start); d.setDate(d.getDate() + w * 7 + d2);
      if (d > now) break;
      const rec = AppState.days[Utils_dateKey(d)];
      total += rec ? Scoring_calcDayScore(rec.habits) : 0;
      n++;
    }
    if (n > 0) weeks.push({ week: w + 1, avgScore: Math.round(total / n) });
  }
  return weeks;
}

/* ═══════════════════════════════════════════════════════════════════════════
   7. DASHBOARD
   Renders the Home page. Reads from AppState via scoring/stats helpers.
═══════════════════════════════════════════════════════════════════════════ */

function Dashboard_render() {
  const todayKey = Utils_today();
  const rec      = Storage_loadDay(todayKey);
  const score    = Scoring_calcDayScore(rec.habits);
  const sd       = Utils_challengeDay();
  const streak   = Stats_currentStreak();
  const longest  = Stats_longestStreak();

  // Update meta
  AppState.meta.longestStreak = longest;

  // Greeting & date
  DOM_setText('h-greeting-label', Utils_greeting());
  DOM_setText('h-date-label', Utils_fmtDateLong(new Date()));

  // Summer day progress
  DOM_setText('h-day-num', sd);
  DOM_setText('h-days-left', CONFIG.challengeDays - sd);
  DOM_setStyle('h-summer-bar', 'width', Math.round((sd / CONFIG.challengeDays) * 100) + '%');

  // Score ring
  const ring = document.getElementById('h-ring-fill');
  if (ring) {
    const circ   = 2 * Math.PI * 56;
    ring.style.strokeDashoffset = circ - (score / 100) * circ;
    ring.style.stroke           = Scoring_color(score);
  }
  const scoreEl = document.getElementById('h-score-num');
  if (scoreEl) { scoreEl.textContent = score; scoreEl.style.color = Scoring_color(score); }

  // Smart stats
  DOM_setText('ss-streak',  streak);
  DOM_setText('ss-longest', longest);
  DOM_setText('ss-prayer',  Stats_habitRate('prayer') + '%');
  DOM_setText('ss-workout', Stats_habitCount('workout'));
  DOM_setText('ss-reading', Stats_habitCount('selfHelp'));
  DOM_setText('ss-gpafy',   Stats_habitCount('gpafy'));

  // Six pillars
  const grid = document.getElementById('h-pillars');
  if (grid) {
    grid.innerHTML = PILLAR_IDS.map(pid => {
      const p   = PILLARS[pid];
      const pct = Scoring_pillarPct(pid, rec.habits);
      return `<div class="pill-card rip ${pct === 100 ? 'full' : ''}" onclick="App_nav('today')">
        <div class="pill-icon">${p.icon}</div>
        <div class="pill-name">${p.label}</div>
        <div class="pill-pct" style="color:${Scoring_color(pct)}">${pct}%</div>
        <div class="pbar" style="margin-top:5px;">
          <div class="pfill ${Scoring_pfillClass(pct)}" style="width:${pct}%"></div>
        </div>
      </div>`;
    }).join('');
  }

  // Today's focus — unfinished habits
  const unfin  = HABITS.filter(h => !rec.habits[h.id]);
  const focusEl = document.getElementById('h-focus');
  if (focusEl) {
    if (unfin.length === 0) {
      focusEl.innerHTML = `<div class="focus-item">
        <span style="color:var(--green);font-weight:700;font-size:15px;">🎉 All habits done — ${score}/100 today!</span>
      </div>`;
    } else {
      focusEl.innerHTML = unfin.slice(0, 7).map(h => {
        const m = HABIT_META[h.id];
        return `<div class="focus-item">
          <div class="focus-dot"></div>
          <span class="focus-text">${m.icon} ${m.label}</span>
        </div>`;
      }).join('') + (unfin.length > 7
        ? `<div class="focus-item"><span class="t-muted" style="font-size:13px;">+${unfin.length - 7} more</span></div>`
        : '');
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   8. TODAY
   Daily tracker — renders form elements, handles all user interactions.
═══════════════════════════════════════════════════════════════════════════ */

/** Which date is currently displayed in the Today page */
let Today_viewDate = Utils_today();

/** Render the Today page for a given date (defaults to today) */
function Today_render(dateKey) {
  Today_viewDate = dateKey || Utils_today();
  const rec      = Storage_loadDay(Today_viewDate);
  const isToday  = Today_viewDate === Utils_today();
  const d        = new Date(Today_viewDate + 'T00:00:00');

  DOM_setText('td-date-lbl',
    Utils_fmtDateLong(d) + (isToday ? ' · Today' : '')
  );

  // Restore checkboxes
  HABITS.forEach(h => {
    const box   = document.getElementById('cb-' + h.id);
    const label = document.getElementById('cl-' + h.id);
    if (box)   box.className   = 'cbox'   + (rec.habits[h.id] ? ' on' : '');
    if (label) label.className = 'clabel' + (rec.habits[h.id] ? ' done' : '');
  });

  // Numbers
  DOM_setText('nv-water',       rec.water);
  DOM_setText('nv-protein',     rec.protein);
  DOM_setText('nv-screenHours', rec.screenHours);

  // Mood
  document.querySelectorAll('.mood-btn').forEach(b =>
    b.classList.toggle('on', parseInt(b.dataset.m) === rec.mood)
  );

  // Text fields — mapped to record paths via data-k attribute
  document.querySelectorAll('#pg-today [data-k]').forEach(el => {
    const k   = el.dataset.k;
    const val = Today_getField(rec, k) || '';
    if (el.value !== val) el.value = val;
    // Attach save handler
    el.oninput = () => { _debouncedSetField(Today_viewDate, k, el.value); };
  });

  // Wake time
  const wakeEl = document.querySelector('#pg-today input[type="time"]');
  if (wakeEl) {
    wakeEl.value     = rec.wake || '';
    wakeEl.onchange  = () => { Storage_saveDay(Today_viewDate, { wake: wakeEl.value }); };
  }

  // GPAfy slider
  const slider = document.getElementById('gpafy-slider');
  if (slider) {
    slider.value = rec.gpafyPct || 0;
    DOM_setText('gpafy-pct-lbl', (rec.gpafyPct || 0) + '%');
  }

  Today_updateScore();
}

/** Map flat data-k keys to nested record fields */
function Today_getField(rec, key) {
  const fieldMap = {
    p1: rec.priorities?.[0], p2: rec.priorities?.[1], p3: rec.priorities?.[2],
    avoid: rec.avoid, grateful: rec.grateful, gpafyNote: rec.gpafyNote,
    wentWell: rec.reflection?.wentWell, canImprove: rec.reflection?.canImprove,
    tomorrow: rec.reflection?.tomorrow, memory: rec.memorableMoment,
  };
  return fieldMap[key] ?? '';
}

/** Save a single field (supports nested paths via flat key) */
function Today_setField(dateStr, key, value) {
  const rec = Storage_loadDay(dateStr);
  switch (key) {
    case 'p1': rec.priorities[0] = value; break;
    case 'p2': rec.priorities[1] = value; break;
    case 'p3': rec.priorities[2] = value; break;
    case 'wentWell':   rec.reflection.wentWell   = value; break;
    case 'canImprove': rec.reflection.canImprove = value; break;
    case 'tomorrow':   rec.reflection.tomorrow   = value; break;
    case 'memory':     rec.memorableMoment        = value; break;
    default:           rec[key]                   = value; break;
  }
  rec.updatedAt = new Date().toISOString();
  rec.score     = Scoring_calcDayScore(rec.habits);
  AppState.days[dateStr] = validateDayRecord(rec);
  Storage_save();
}

/** Recalculate and display the current score */
function Today_updateScore() {
  const rec   = Storage_loadDay(Today_viewDate);
  const score = Scoring_calcDayScore(rec.habits);

  DOM_setText('td-score', score);
  const scoreEl = document.getElementById('td-score');
  if (scoreEl) scoreEl.style.color = Scoring_color(score);

  const bar = document.getElementById('td-score-bar');
  if (bar) {
    bar.style.width = score + '%';
    bar.className   = 'pfill ' + Scoring_pfillClass(score);
  }
  DOM_setText('td-score-label', Scoring_label(score));

  // Pillar point badges
  PILLAR_IDS.forEach(pid => {
    const pts = Scoring_pillarPts(pid, rec.habits);
    DOM_setText('pts-' + pid, pts + '/' + PILLARS[pid].weight);
  });

  // Refresh home if visible
  if (App_currentPage === 'home') Dashboard_render();
}

/** Toggle a habit checkbox */
function Today_toggleHabit(habitId) {
  const rec           = Storage_loadDay(Today_viewDate);
  rec.habits[habitId] = !rec.habits[habitId];
  rec.score           = Scoring_calcDayScore(rec.habits);
  rec.updatedAt       = new Date().toISOString();
  AppState.days[Today_viewDate] = validateDayRecord(rec);
  Storage_save();

  const box   = document.getElementById('cb-' + habitId);
  const label = document.getElementById('cl-' + habitId);
  const row   = document.getElementById('row-' + habitId);
  const isOn  = rec.habits[habitId];
  if (box)   box.className   = 'cbox'   + (isOn ? ' on' : '');
  if (label) label.className = 'clabel' + (isOn ? ' done' : '');
  if (row)   row.setAttribute('aria-checked', isOn ? 'true' : 'false');

  Today_updateScore();
}

/** Set mood value */
function Today_setMood(val) {
  Storage_saveDay(Today_viewDate, { mood: val });
  document.querySelectorAll('.mood-btn').forEach(b =>
    b.classList.toggle('on', parseInt(b.dataset.m) === val)
  );
}

/** Adjust a numeric counter field */
function Today_adjustNum(field, delta) {
  const rec   = Storage_loadDay(Today_viewDate);
  const limits = { water: [0, 30], protein: [0, 20], screenHours: [0, 24] };
  const [min, max] = limits[field] || [0, 99];
  const newVal = clamp((rec[field] || 0) + delta, min, max);
  Storage_saveDay(Today_viewDate, { [field]: newVal });
  DOM_setText('nv-' + field, newVal);
}

/** Update GPAfy progress slider */
function Today_updateGpafySlider(val) {
  const pct = clamp(parseInt(val), 0, 100);
  Storage_saveDay(Today_viewDate, { gpafyPct: pct });
  DOM_setText('gpafy-pct-lbl', pct + '%');
}

/** Open a specific date in the Today tracker */
function Today_openDate(dateStr) {
  App_nav('today');
  Today_render(dateStr);
}

/* ═══════════════════════════════════════════════════════════════════════════
   9. CALENDAR
   Monthly calendar grid with date selection and day detail panel.
═══════════════════════════════════════════════════════════════════════════ */

let Cal_year       = new Date().getFullYear();
let Cal_month      = new Date().getMonth();
let Cal_selectedDate = null;

function Cal_prevMonth() {
  Cal_month--;
  if (Cal_month < 0) { Cal_month = 11; Cal_year--; }
  Calendar_render();
}

function Cal_nextMonth() {
  Cal_month++;
  if (Cal_month > 11) { Cal_month = 0; Cal_year++; }
  Calendar_render();
}

function Calendar_render() {
  DOM_setText('cal-month-lbl', `${MONTH_NAMES[Cal_month]} ${Cal_year}`);

  // Stats
  const streak  = Stats_currentStreak();
  const longest = Stats_longestStreak();
  const done    = Stats_completedDays();
  AppState.meta.longestStreak = longest;

  DOM_setText('cal-streak', streak);
  DOM_setText('cal-done',   done);
  DOM_setText('cal-best',   longest);

  // Weekday headers (Mon–Sun)
  const wdEl = document.getElementById('cal-weekdays');
  if (wdEl) {
    wdEl.innerHTML = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
      .map(d => `<div class="cal-wdl">${d}</div>`).join('');
  }

  // Day grid
  const grid = document.getElementById('cal-days-grid');
  if (!grid) return;

  const todayStr  = Utils_today();
  const firstDay  = new Date(Cal_year, Cal_month, 1);
  const offset    = (firstDay.getDay() + 6) % 7;   // Mon-based offset
  const daysInMo  = new Date(Cal_year, Cal_month + 1, 0).getDate();

  let html = '';
  for (let i = 0; i < offset; i++) html += '<div></div>';

  for (let day = 1; day <= daysInMo; day++) {
    const d       = new Date(Cal_year, Cal_month, day);
    const dStr    = Utils_dateKey(d);
    const rec     = AppState.days[dStr];
    const score   = rec ? Scoring_calcDayScore(rec.habits) : 0;
    const isFut   = Utils_isFuture(dStr);
    const inChal  = Utils_isInChallenge(dStr);
    const isToday = dStr === todayStr;
    const isSel   = dStr === Cal_selectedDate;

    // Build class list
    let cls = 'cal-cell rip';
    if (isFut || !inChal) cls += ' fut';
    else                  cls += ' ' + Scoring_calClass(score);
    if (isToday) cls += ' c-today';
    if (isSel)   cls += ' c-sel';

    // Score label inside cell (only for days with data)
    const inner = score > 0
      ? `<span class="cd">${day}</span>
         <span class="cscore" style="color:${Scoring_color(score)}">${score}</span>`
      : `<span class="cd">${day}</span>
         <span class="cs"></span>`;

    // Journal indicator dot
    const hasJournal = !!(rec?.memorableMoment?.trim() || rec?.reflection?.wentWell?.trim());
    const journalDot = hasJournal
      ? `<span class="cal-journal-dot"></span>` : '';

    const clickable = !isFut && inChal;
    const onclick  = clickable ? `onclick="Cal_clickDate('${dStr}')"` : '';
    const dataAttr = clickable ? `data-date="${dStr}"` : '';
    const ariaLbl  = `aria-label="Day ${day}${score > 0 ? ', score ' + score : ''}"`;
    html += `<div class="${cls}" ${onclick} ${dataAttr} ${ariaLbl}>${inner}${journalDot}</div>`;
  }

  grid.innerHTML = html;

  // Re-render detail if a date is selected
  if (Cal_selectedDate) {
    if (Utils_isFuture(Cal_selectedDate) || !Utils_isInChallenge(Cal_selectedDate)) {
      Cal_selectedDate = null;
      const detail = document.getElementById('cal-detail');
      if (detail) detail.style.display = 'none';
    } else {
      Cal_renderDetail(Cal_selectedDate);
    }
  }
}

function Cal_clickDate(dStr) {
  // Toggle off if same date tapped twice
  if (Cal_selectedDate === dStr) {
    Cal_selectedDate = null;
    const detail = document.getElementById('cal-detail');
    if (detail) detail.style.display = 'none';
    document.querySelectorAll('.cal-cell').forEach(c => c.classList.remove('c-sel'));
    return;
  }
  Cal_selectedDate = dStr;

  // Update selected highlight efficiently using data attribute
  document.querySelectorAll('.cal-cell.c-sel').forEach(c => c.classList.remove('c-sel'));
  document.querySelector(`.cal-cell[data-date="${dStr}"]`)?.classList.add('c-sel');

  Cal_renderDetail(dStr);
}

function Cal_renderDetail(dStr) {
  const rec    = Storage_loadDay(dStr);
  const score  = Scoring_calcDayScore(rec.habits);
  const d      = new Date(dStr + 'T00:00:00');
  const detail = document.getElementById('cal-detail');
  if (!detail) return;

  const doneHabits   = HABITS.filter(h => rec.habits[h.id]);
  const missedHabits = HABITS.filter(h => !rec.habits[h.id]);

  let html = `<div class="day-slide">
    <div class="day-slide-head">
      <div>
        <div class="t-gold fw7" style="font-size:15px;">${Utils_fmtDateLong(d)}</div>
        <div class="t-sub" style="font-size:12px;margin-top:2px;">
          Score: <span style="color:${Scoring_color(score)};font-weight:700;">${score}/100</span>
          &nbsp;·&nbsp; ${Scoring_label(score)}
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <button class="btn btn-out rip" style="padding:7px 12px;font-size:12px;"
          onclick="Today_openDate('${dStr}')">✏️ Edit</button>
        <span class="day-slide-close rip" onclick="Cal_clickDate('${dStr}')">✕</span>
      </div>
    </div>
    <div style="padding:14px 16px;">
      <div class="pbar" style="margin-bottom:14px;height:7px;">
        <div class="pfill ${Scoring_pfillClass(score)}" style="width:${score}%"></div>
      </div>`;

  // Completed habits
  if (doneHabits.length) {
    html += `<div class="t-label" style="margin-bottom:8px;">✓ Completed (${doneHabits.length})</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">
        ${doneHabits.map(h => `<span class="tag-green">${HABIT_META[h.id].icon} ${HABIT_META[h.id].label}</span>`).join('')}
      </div>`;
  }

  // Missed habits
  if (missedHabits.length) {
    html += `<div class="t-label" style="margin-bottom:8px;">✗ Missed (${missedHabits.length})</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">
        ${missedHabits.map(h => `<span class="tag-ghost">${HABIT_META[h.id].label}</span>`).join('')}
      </div>`;
  }

  // Mood
  if (rec.mood) {
    html += `<div class="t-label" style="margin-bottom:4px;">Mood</div>
      <div style="font-size:24px;margin-bottom:12px;">${MOOD_EMOJIS[rec.mood] || ''}</div>`;
  }

  // Journal / reflection
  if (rec.reflection?.wentWell) {
    html += `<div class="t-label" style="margin-bottom:4px;">What went well</div>
      <p class="t-sub" style="margin-bottom:10px;font-style:italic;">"${rec.reflection.wentWell}"</p>`;
  }

  // Memory
  if (rec.memorableMoment) {
    html += `<div class="t-label" style="margin-bottom:4px;">📖 Memory</div>
      <p class="t-sub" style="margin-bottom:10px;font-style:italic;">"${rec.memorableMoment}"</p>`;
  }

  // Priorities
  if (rec.priorities?.[0]) {
    html += `<div class="t-label" style="margin-top:8px;margin-bottom:4px;">Priorities</div>
      <p class="t-sub">
        1. ${rec.priorities[0]}
        ${rec.priorities[1] ? '<br>2. ' + rec.priorities[1] : ''}
        ${rec.priorities[2] ? '<br>3. ' + rec.priorities[2] : ''}
      </p>`;
  }

  // Health numbers
  if (rec.water || rec.protein) {
    html += `<div class="t-label" style="margin-top:10px;margin-bottom:4px;">Health</div>
      <p class="t-sub">💧 ${rec.water || 0} glasses · 🥩 ${rec.protein || 0} protein meals</p>`;
  }

  html += `</div></div>`;
  detail.innerHTML = html;
  detail.style.display = 'block';
  setTimeout(() => detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
}

/* ═══════════════════════════════════════════════════════════════════════════
   10. REVIEW
   Weekly review form — renders sliders and saves responses.
═══════════════════════════════════════════════════════════════════════════ */

let Review_currentWeek = Math.ceil(Utils_challengeDay() / 7);

function Review_render() {
  Review_currentWeek = Math.ceil(Utils_challengeDay() / 7);
  Review_renderTabs();
  Review_renderScores();
  Review_loadText();
  Analytics_render();
}

function Review_renderTabs() {
  const total = Math.ceil(CONFIG.challengeDays / 7);
  const tabs  = document.getElementById('rv-week-tabs');
  if (!tabs) return;
  tabs.innerHTML = Array.from({ length: total }, (_, i) => i + 1)
    .map(w => `<div class="week-tab rip ${w === Review_currentWeek ? 'on' : ''}"
      onclick="Review_selectWeek(${w})">Wk ${w}</div>`)
    .join('');
}

function Review_selectWeek(w) {
  Review_currentWeek = w;
  Review_renderTabs();
  Review_renderScores();
  Review_loadText();
}

function Review_renderScores() {
  const wk  = 'w' + Review_currentWeek;
  const rv  = Storage_loadWeek(wk);
  const el  = document.getElementById('rv-scores');
  if (!el) return;
  el.innerHTML = WEEK_SCORE_META.map(s => {
    const val = rv[s.id] || 5;
    return `<div class="rsrow">
      <span class="rsicon">${s.icon}</span>
      <span class="rslabel">${s.label}</span>
      <div style="flex:1;">
        <input type="range" min="1" max="10" value="${val}"
          oninput="Review_saveScore('${s.id}', this.value);
                   document.getElementById('rs-${s.id}').textContent = this.value + '/10'"/>
      </div>
      <span class="rsval" id="rs-${s.id}">${val}/10</span>
    </div>`;
  }).join('');
}

function Review_saveScore(key, val) {
  Storage_saveWeek('w' + Review_currentWeek, { [key]: parseInt(val) });
}

function Review_loadText() {
  const wk = 'w' + Review_currentWeek;
  const rv = Storage_loadWeek(wk);
  ['win', 'struggle', 'lesson', 'next'].forEach(k => {
    DOM_setValue('rv-' + k, rv[k] || '');
  });
}

function Review_save() {
  const wk = 'w' + Review_currentWeek;
  const updates = {};
  ['win', 'struggle', 'lesson', 'next'].forEach(k => {
    const el = document.getElementById('rv-' + k);
    if (el) updates[k] = el.value;
  });
  Storage_saveWeek(wk, updates);
  App_toast('✓ Week ' + Review_currentWeek + ' review saved');
}

/* ═══════════════════════════════════════════════════════════════════════════
   11. ANALYTICS
   SVG charts — pure rendering, reads from Stats_* helpers.
═══════════════════════════════════════════════════════════════════════════ */

function Analytics_render() {
  requestAnimationFrame(() => {
    Analytics_renderHabitBars();
    Analytics_renderScoreTrend();
    Analytics_renderWeeklyBars();
  });
}

function Analytics_renderHabitBars() {
  const habitsToShow = [
    { id: 'prayer',    label: 'Prayer',     icon: '✝️'  },
    { id: 'workout',   label: 'Workout',    icon: '🏋️' },
    { id: 'selfHelp',  label: 'Reading',    icon: '📚'  },
    { id: 'biomedical',label: 'BME Study',  icon: '🔬'  },
    { id: 'screenTime',label: 'Screen ✓',   icon: '📵'  },
    { id: 'gpafy',     label: 'GPAfy',      icon: '💻'  },
    { id: 'noBadHabit',label: 'Stay Clean', icon: '🚫'  },
  ];

  const el = document.getElementById('analytics-bars');
  if (!el) return;

  el.innerHTML = habitsToShow.map(h => {
    const rate = Stats_habitRate(h.id);
    const cnt  = Stats_habitCount(h.id);
    const days = Math.max(Utils_challengeDay() - 1, 1);
    return `<div class="chart-row-bar">
      <span class="crb-icon">${h.icon}</span>
      <span class="crb-label">${h.label}</span>
      <div class="crb-bar"><div class="crb-fill" style="width:${rate}%"></div></div>
      <span class="crb-pct">${rate}%</span>
    </div>
    <div style="padding:0 16px 4px;">
      <div class="t-sub" style="font-size:11px;">${cnt} of ${days} days</div>
    </div>`;
  }).join('');
}

function Analytics_renderScoreTrend() {
  const svg    = document.getElementById('score-chart');
  if (!svg) return;
  const series = Stats_scoreSeries();

  if (series.length < 2) {
    svg.innerHTML = `<text x="50%" y="50%" text-anchor="middle" fill="var(--ghost)" font-size="12">No data yet</text>`;
    return;
  }

  const W = 320, H = 80, padL = 22, padB = 14, padT = 6;
  const cW = W - padL - 4, cH = H - padB - padT;
  const n  = series.length;
  const xS = cW / (n - 1);
  const yS = cH / 100;

  const pts  = series.map((p, i) => `${padL + i * xS},${padT + cH - p.score * yS}`).join(' ');
  const area = `M${padL},${padT + cH} ` +
    series.map((p, i) => `L${padL + i * xS},${padT + cH - p.score * yS}`).join(' ') +
    ` L${padL + (n - 1) * xS},${padT + cH} Z`;

  const gridLines = [0, 25, 50, 75, 100].map(v => {
    const y = padT + cH - v * yS;
    return `<line x1="${padL}" y1="${y}" x2="${W}" y2="${y}" stroke="var(--border)" stroke-width="1"/>
            <text x="${padL - 3}" y="${y + 3}" font-size="7" fill="var(--ghost)" text-anchor="end">${v}</text>`;
  }).join('');

  svg.innerHTML = `
    <defs>
      <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#D4AF37" stop-opacity=".35"/>
        <stop offset="100%" stop-color="#D4AF37" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${gridLines}
    <path d="${area}" fill="url(#sg)"/>
    <polyline points="${pts}" fill="none" stroke="#D4AF37" stroke-width="2"
      stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${padL + (n - 1) * xS}" cy="${padT + cH - series[n - 1].score * yS}" r="3.5" fill="#D4AF37"/>`;
}

function Analytics_renderWeeklyBars() {
  const svg   = document.getElementById('weekly-chart');
  if (!svg) return;
  const weeks = Stats_weeklyScores();
  if (!weeks.length) { svg.innerHTML = ''; return; }

  const W = 320, H = 80, padL = 20, padB = 18, padT = 6;
  const cW = W - padL - 4, cH = H - padB - padT;
  const n  = weeks.length;
  const bw = Math.max(6, (cW / n) - 4);

  const bars = weeks.map((wk, i) => {
    const x  = padL + i * (cW / n) + (cW / n - bw) / 2;
    const bh = Math.max(wk.avgScore * (cH / 100), 1);
    const y  = padT + cH - bh;
    const c  = Scoring_color(wk.avgScore);
    return `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="3" fill="${c}"/>
            <text x="${x + bw / 2}" y="${padT + cH + 12}" font-size="7"
              fill="var(--ghost)" text-anchor="middle">W${wk.week}</text>`;
  }).join('');

  svg.innerHTML = bars;
}

/* ═══════════════════════════════════════════════════════════════════════════
   12. TIMELINE
   Memory timeline — renders entries chronologically with search.
═══════════════════════════════════════════════════════════════════════════ */

function Timeline_render(filter) {
  const entries = [];
  const start   = new Date(CONFIG.challengeStart);
  const now     = new Date(); now.setHours(0, 0, 0, 0);

  for (let i = 0; i < CONFIG.challengeDays; i++) {
    const d = new Date(start); d.setDate(d.getDate() + i);
    if (d > now) break;
    const key = Utils_dateKey(d);
    const rec = AppState.days[key];
    const txt = rec?.memorableMoment?.trim();
    if (!txt) continue;
    if (filter && !txt.toLowerCase().includes(filter.toLowerCase())) continue;
    entries.push({ date: d, text: txt, key });
  }

  const container = document.getElementById('mem-timeline');
  if (!container) return;

  if (!entries.length) {
    container.innerHTML = `<div style="padding:0 14px 12px;">
      <div class="card card-p" style="text-align:center;color:var(--ghost);font-style:italic;font-size:14px;">
        No memories yet.<br>
        <span style="font-size:12px;">Answer "What made today memorable?" each night.</span>
      </div>
    </div>`;
    return;
  }

  // Newest first
  entries.reverse();
  container.innerHTML = entries.map(e => `
    <div class="mem-card">
      <div class="mem-date">
        ${e.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
      </div>
      <div class="mem-text">"${e.text}"</div>
    </div>`
  ).join('');
}

function Timeline_filter(val) {
  Timeline_render(val);
}

/* ═══════════════════════════════════════════════════════════════════════════
   13. PROFILE
   Profile page — stats, habit rates, memory timeline.
═══════════════════════════════════════════════════════════════════════════ */

function Profile_render() {
  const streak  = Stats_currentStreak();
  const longest = Stats_longestStreak();
  const done    = Stats_completedDays();
  const avg     = Stats_avgScore();

  AppState.meta.longestStreak = longest;

  DOM_setText('pf-streak', streak);
  DOM_setText('pf-best',   longest);
  DOM_setText('pf-done',   done);
  DOM_setText('pf-avg',    avg);

  // Habit rate bars
  const barsEl = document.getElementById('profile-habit-bars');
  if (barsEl) {
    const items = [
      { id: 'prayer',    label: 'Prayer',     icon: '✝️'  },
      { id: 'workout',   label: 'Workout',    icon: '🏋️' },
      { id: 'selfHelp',  label: 'Reading',    icon: '📚'  },
      { id: 'gpafy',     label: 'GPAfy',      icon: '💻'  },
      { id: 'biomedical',label: 'BME Study',  icon: '🔬'  },
      { id: 'noBadHabit',label: 'Stay Clean', icon: '🚫'  },
    ];
    barsEl.innerHTML = items.map(h => {
      const rate = Stats_habitRate(h.id);
      return `<div class="chart-row-bar">
        <span class="crb-icon">${h.icon}</span>
        <span class="crb-label">${h.label}</span>
        <div class="crb-bar"><div class="crb-fill" style="width:${rate}%"></div></div>
        <span class="crb-pct">${rate}%</span>
      </div>`;
    }).join('');
  }

  Timeline_render();
}

/* ═══════════════════════════════════════════════════════════════════════════
   14. SETTINGS
   Export, import, reset — all delegate storage operations to Storage_*.
═══════════════════════════════════════════════════════════════════════════ */

function Settings_export() {
  Storage_backup();
  App_toast('✓ Data exported');
}

function Settings_import() {
  document.getElementById('imp-file')?.click();
}

function Settings_handleImport(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const ok = Storage_restore(ev.target.result);
    App_toast(ok ? '✓ Data imported' : '✗ Invalid backup file');
    if (ok) App_nav(App_currentPage);
  };
  reader.readAsText(file);
}

function Settings_reset() {
  if (!confirm('Reset ALL data? This cannot be undone.')) return;
  Storage_reset();
  App_toast('✓ Reset complete');
  App_nav('home');
}

/* ═══════════════════════════════════════════════════════════════════════════
   15. APP
   Navigation, startup, event registration.
   This section wires everything together.
═══════════════════════════════════════════════════════════════════════════ */

let App_currentPage = 'home';

/** Navigate to a page */
function App_nav(page) {
  if (App_currentPage === page && page !== 'home') {
    // Already on this page — just scroll to top
    document.getElementById('pg-' + page)?.scrollTo?.(0, 0);
    return;
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nb').forEach(b => b.classList.remove('on'));

  document.getElementById('pg-' + page)?.classList.add('active');
  document.querySelector(`.nb[data-p="${page}"]`)?.classList.add('on');

  // Update aria-selected on nav tabs
  document.querySelectorAll('.nb[role="tab"]').forEach(t => {
    t.setAttribute('aria-selected', t.dataset.p === page ? 'true' : 'false');
  });

  App_currentPage = page;
  document.getElementById('pg-' + page)?.scrollTo?.(0, 0);

  switch (page) {
    case 'home':     Dashboard_render();   break;
    case 'today':    Today_render();       break;
    case 'calendar': Calendar_render();    break;
    case 'review':   Review_render();      break;
    case 'profile':  Profile_render();     break;
  }
}

/** Show a brief toast notification */
let _toastTimer = null;
function App_toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}


/** Keyboard support for checkbox rows and buttons */
function App_registerKeyboard() {
  document.addEventListener('keydown', e => {
    const target = e.target;
    if (e.key === 'Enter' || e.key === ' ') {
      // Fire click on role=checkbox or role=button with tabindex
      if (target.getAttribute('role') === 'checkbox' ||
          target.getAttribute('role') === 'button') {
        e.preventDefault();
        target.click();
      }
    }
  });
}

/** Handle deep links from PWA shortcuts (e.g. index.html#today) */
function App_handleDeepLink() {
  const hash = window.location.hash.replace('#', '');
  const pages = ['home','today','calendar','review','profile'];
  if (pages.includes(hash)) {
    App_nav(hash);
    // Clear hash without reloading
    history.replaceState(null, '', window.location.pathname);
  }
}

/** Ripple effect on .rip elements */
function App_registerRipple() {
  document.addEventListener('click', e => {
    const target = e.target.closest('.rip');
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const el   = document.createElement('span');
    el.className = 'rip-wave';
    el.style.cssText = `width:${size}px;height:${size}px;` +
      `left:${e.clientX - rect.left - size / 2}px;` +
      `top:${e.clientY - rect.top  - size / 2}px;`;
    target.appendChild(el);
    setTimeout(() => el.remove(), 550);
  });
}

/** Auto-save review text on blur */
function App_registerReviewAutoSave() {
  document.addEventListener('blur', e => {
    const id = e.target.id || '';
    if (!id.startsWith('rv-')) return;
    const key = id.replace('rv-', '');
    Storage_saveWeek('w' + Review_currentWeek, { [key]: e.target.value });
  }, true);
}

/** PWA install prompt */
let _installEvent = null;
function App_registerPWA() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    _installEvent = e;
    setTimeout(() => {
      document.getElementById('install-bar')?.classList.add('show');
    }, 5000);
  });
  window.addEventListener('appinstalled', () => {
    App_toast('✓ ብርታት installed!');
    App_dismissInstall();
  });
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(() => {});
    });
  }
}

function App_installPWA() {
  if (!_installEvent) return;
  _installEvent.prompt();
  _installEvent.userChoice.then(() => {
    _installEvent = null;
    App_dismissInstall();
  });
}

function App_dismissInstall() {
  document.getElementById('install-bar')?.classList.remove('show');
}

/* ─── Global function aliases ────────────────────────────────────────────────
   The HTML uses short names in onclick attributes.
   These one-liners map them to the namespaced functions above.
─────────────────────────────────────────────────────────────────────────── */

// Navigation
function nav(page)             { App_nav(page); }

// Today page
function tc(id)                { Today_toggleHabit(id); }
function setMood(v)            { Today_setMood(v); }
function adjNum(f, d)          { Today_adjustNum(f, d); }
function updateGpafySlider(v)  { Today_updateGpafySlider(v); }

// Calendar
function calPrev()             { Cal_prevMonth(); }
function calNext()             { Cal_nextMonth(); }
// Cal_clickDate is directly callable — no alias needed

// Review
function selWeek(w)            { Review_selectWeek(w); }
function Review_saveScore(k,v) { Review_saveScore(k,v); } // already namespaced
function saveReview()          { Review_save(); }

// Timeline
function filterMemories(v)     { Timeline_filter(v); }

// Settings
function exportData()          { Settings_export(); }
function handleImport(e)       { Settings_handleImport(e); }
function confirmReset()        { Settings_reset(); }
function installApp()          { App_installPWA(); }
function dismissInstall()      { App_dismissInstall(); }
function openDayInTracker(d)   { Today_openDate(d); }

/* ─── Startup ────────────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  Storage_load();
  App_handleDeepLink();
  App_registerRipple();
  App_registerKeyboard();
  App_registerReviewAutoSave();
  App_registerPWA();
  App_nav('home');
});
