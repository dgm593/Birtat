/* ═══════════════════════════════════════════════════════════════════════════
   BIRTAT V7.0 · ብርታት · script.js
   Personal Discipline Command Center
   
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
  semester: { id:'2026-27-s1', name:'2026/27 · Semester 1', start:'2026-09-28', end:'2027-01-31' },
  storageKey:      'birtat-v4',
  legacyKeys:      ['birtat-v3', 'birtat-v2', 'birtat-state'],
  version:         '7.0.0',

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
const SEMESTER_COURSES = [
  {id:'dsa', name:'Data Structures & Algorithms', short:'DSA', icon:'🧠'},
  {id:'em', name:'Electromagnetic Devices and Electrical Machines', short:'EM Devices', icon:'⚡'},
  {id:'tech', name:'Appropriate Technology', short:'Appropriate Tech', icon:'🛠️'},
  {id:'workshop', name:'General Workshop', short:'Workshop', icon:'🔧'},
  {id:'inclusion', name:'Inclusiveness', short:'Inclusiveness', icon:'🤝'},
  {id:'electronics', name:'Applied Electronics I', short:'Electronics I', icon:'🔌'},
  {id:'biochem', name:'Fundamentals of Bio-Chemistry', short:'Biochemistry', icon:'🧪'},
  {id:'biofluid', name:'Bio-fluid Mechanics', short:'Bio-fluid', icon:'🌊'},
];

function Semester_default(){
  const courses={};
  SEMESTER_COURSES.forEach(c=>courses[c.id]={progress:0,studyHours:0,assignmentsDone:0,assignmentsTotal:0,assessmentsDone:0,assessmentsTotal:0,note:''});
  return {id:CONFIG.semester.id,name:CONFIG.semester.name,start:CONFIG.semester.start,end:CONFIG.semester.end,courses,notionUrl:'https://www.notion.so/',targets:{studyHours:18,bmeHours:4,gymSessions:3,faithDays:7,sleepHours:7}};
}

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

    // Study sessions — linked to semester courses
    studySessions: Array.isArray(partial.studySessions) ? partial.studySessions.map(x => ({
      ...x, courseId: x.courseId || '', hours: clamp(parseFloat(x.hours) || 0, 0, 24), task: x.task || ''
    })) : [],

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
  semester: Semester_default(),
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
  if (parsed.semester) { AppState.semester = Object.assign(Semester_default(), parsed.semester); AppState.semester.courses = Object.assign(Semester_default().courses, parsed.semester.courses || {}); }

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
  // Additive V7 migration: preserve V4 records and merge new module data.
  if (typeof V7_mergeState === 'function') V7_mergeState(parsed);
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
    if (typeof V7_validateImport === 'function' && !V7_validateImport(parsed)) return false;
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
  CONFIG.legacyKeys.forEach(key => localStorage.removeItem(key));
  AppState = typeof V7_createInitialState === 'function' ? V7_createInitialState() : {
    days: {}, reviews: {}, settings: {}, semester: Semester_default(),
    meta: { startDate: CONFIG.challengeStart, longestStreak: 0, version: CONFIG.version },
  };
  Storage_save();
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
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

/** Today's date key */
function Utils_today() {
  const zone=AppState?.profile?.timeZone;
  if(zone&&zone!=='local'){try{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));if(p.year&&p.month&&p.day)return `${p.year}-${p.month}-${p.day}`;}catch(e){console.warn('[Birtat] Invalid time zone; using device local time',e);}}
  return Utils_dateKey(new Date());
}

/** Summer / challenge day number (1-based) */
function Utils_challengeDay() {
  const start = new Date(CONFIG.challengeStart + 'T12:00:00');
  const now = new Date(Utils_today() + 'T12:00:00');
  const diff  = Math.floor((now - start) / 86400000);
  return clamp(diff + 1, 1, CONFIG.challengeDays);
}

/** True if dateStr is in the future */
function Utils_isFuture(dateStr) {
  return String(dateStr) > Utils_today();
}

/** True if dateStr falls within the preserved legacy challenge window */
function Utils_isInChallenge(dateStr) {
  const start = new Date(CONFIG.challengeStart + 'T12:00:00');
  const end   = new Date(start);
  end.setDate(end.getDate() + CONFIG.challengeDays - 1);
  const d = new Date(dateStr + 'T12:00:00');
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
  let h = new Date().getHours();try{const zone=AppState?.profile?.timeZone;if(zone&&zone!=='local')h=Number(new Intl.DateTimeFormat('en-US',{hour:'2-digit',hourCycle:'h23',timeZone:zone}).format(new Date()));}catch(e){}
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

/** Iterate from the original challenge start through today, including null days for streak boundaries. */
function Stats_eachDay(cb) {
  const start = new Date(CONFIG.challengeStart + 'T12:00:00');
  const now = new Date(Utils_today() + 'T12:00:00');
  for (let d = new Date(start); d <= now; d.setDate(d.getDate()+1)) {
    const key = Utils_dateKey(d);
    cb(key, AppState.days[key] || null);
  }
}

/** A day is tracked only when it contains at least one user-entered signal. */
function Stats_hasData(rec) {
  if (!rec || typeof rec !== 'object') return false;
  return Object.values(rec.habits||{}).some(Boolean) || Number(rec.mood)>0 || Number(rec.water)>0 || Number(rec.protein)>0 || Number(rec.screenHours)>0 || Number(rec.gpafyPct)>0 || Number(rec.sleepHours)>0 || !!String(rec.wake||'').trim() || (rec.studySessions||[]).length>0 || (rec.priorities||[]).some(x=>String(x||'').trim()) || !!String(rec.avoid||'').trim() || !!String(rec.grateful||'').trim() || !!String(rec.gpafyNote||'').trim() || !!String(rec.memorableMoment||'').trim() || Object.values(rec.reflection||{}).some(x=>String(x||'').trim());
}
function Stats_trackedDays(){let n=0;Stats_eachDay((_,rec)=>{if(Stats_hasData(rec))n++;});return n;}

/** Current streak (days with score >= threshold, counting back from today) */
function Stats_currentStreak() {
  let streak = 0;
  const now  = new Date(Utils_today() + 'T00:00:00');
  for (let i = 0; i < CONFIG.challengeDays; i++) {
    const d    = new Date(now); d.setDate(d.getDate() - i);
    const rec  = AppState.days[Utils_dateKey(d)];
    const sc   = Stats_hasData(rec) ? Scoring_calcDayScore(rec.habits) : 0;
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
    const sc = Stats_hasData(rec) ? Scoring_calcDayScore(rec.habits) : 0;
    if (sc >= CONFIG.streakThreshold) { cur++; if (cur > best) best = cur; }
    else cur = 0;
  });
  return Math.max(best, AppState.meta.longestStreak || 0);
}

/** Number of days with score >= threshold */
function Stats_completedDays() {
  let n = 0;
  Stats_eachDay((_, rec) => {
    if (Stats_hasData(rec) && Scoring_calcDayScore(rec.habits) >= CONFIG.streakThreshold) n++;
  });
  return n;
}

/** Average daily score across all tracked days */
function Stats_avgScore() {
  let total = 0, n = 0;
  Stats_eachDay((_, rec) => {
    if (!Stats_hasData(rec)) return;
    total += Scoring_calcDayScore(rec.habits);
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
    if (!Stats_hasData(rec)) return;
    total++;
    if (rec?.habits?.[habitId]) done++;
  });
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

/** Array of { dateStr, score } for all tracked days — used by charts */
function Stats_scoreSeries() {
  const series = [];
  Stats_eachDay((key, rec) => {
    if (!Stats_hasData(rec)) return;
    series.push({ dateStr: key, score: Scoring_calcDayScore(rec.habits) });
  });
  return series;
}

/** Average score per Monday-start week, excluding days without records. */
function Stats_weeklyScores() {
  const start = new Date(CONFIG.challengeStart + 'T12:00:00');
  start.setDate(start.getDate()-((start.getDay()+6)%7));
  const now = new Date(Utils_today() + 'T12:00:00');
  const weeks=[];let index=1;
  for(let ws=new Date(start);ws<=now;ws.setDate(ws.getDate()+7),index++){
    let total=0,n=0;
    for(let i=0;i<7;i++){const d=new Date(ws);d.setDate(d.getDate()+i);if(d>now)break;const rec=AppState.days[Utils_dateKey(d)];if(!Stats_hasData(rec))continue;total+=Scoring_calcDayScore(rec.habits);n++;}
    if(n)weeks.push({week:index,avgScore:Math.round(total/n),trackedDays:n});
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
  const hasData  = Stats_hasData(AppState.days[todayKey]);
  const score    = hasData ? Scoring_calcDayScore(rec.habits) : null;
  const sd       = Utils_challengeDay();
  const streak   = Stats_currentStreak();
  const longest  = Stats_longestStreak();

  // Update meta
  AppState.meta.longestStreak = longest;

  // Greeting & date
  DOM_setText('h-greeting-label', Utils_greeting());
  DOM_setText('h-date-label', Utils_fmtDateLong(new Date()));

  // Current semester status. Summer challenge data remains available as history,
  // but the home screen now reflects the active academic season.
  const semStart = new Date(CONFIG.semester.start + 'T00:00:00');
  const semEnd   = new Date(CONFIG.semester.end + 'T00:00:00');
  const today    = new Date(todayKey + 'T00:00:00');
  const semLabel = document.getElementById('h-sem-label');
  const semSub   = document.getElementById('h-sem-sub');
  const daysLeft = document.getElementById('h-days-left');
  if (today < semStart) {
    const until = Math.ceil((semStart - today) / 86400000);
    DOM_setText('h-day-num', semStart.toLocaleDateString('en-US', {month:'short', day:'numeric'}));
    DOM_setText('h-days-left', `${until} day${until === 1 ? '' : 's'} until semester`);
    if (semLabel) semLabel.textContent = 'Semester starts';
    if (semSub) semSub.textContent = CONFIG.semester.name;
    DOM_setStyle('h-summer-bar', 'width', '0%');
  } else if (today <= semEnd) {
    const elapsed = Math.floor((today - semStart) / 86400000) + 1;
    const total = Math.floor((semEnd - semStart) / 86400000) + 1;
    const week = Math.min(16, Math.floor((elapsed - 1) / 7) + 1);
    DOM_setText('h-day-num', `W${week}`);
    DOM_setText('h-days-left', `${Math.max(0, total - elapsed)} days remaining`);
    if (semLabel) semLabel.textContent = `Week ${week} of 16`;
    if (semSub) semSub.textContent = CONFIG.semester.name;
    DOM_setStyle('h-summer-bar', 'width', Math.round((elapsed / total) * 100) + '%');
  } else {
    DOM_setText('h-day-num', '✓');
    DOM_setText('h-days-left', 'Semester complete');
    if (semLabel) semLabel.textContent = 'Semester complete';
    if (semSub) semSub.textContent = CONFIG.semester.name;
    DOM_setStyle('h-summer-bar', 'width', '100%');
  }

  // Score ring
  const ring = document.getElementById('h-ring-fill');
  if (ring) {
    const circ   = 2 * Math.PI * 56;
    ring.style.strokeDashoffset = circ - ((score||0) / 100) * circ;
    ring.style.stroke           = score===null ? 'var(--border)' : Scoring_color(score);
  }
  const scoreEl = document.getElementById('h-score-num');
  if (scoreEl) { scoreEl.textContent = score===null ? '—' : score; scoreEl.style.color = score===null ? 'var(--muted)' : Scoring_color(score); }

  // Smart stats
  DOM_setText('ss-streak',  streak);
  DOM_setText('ss-longest', longest);
  DOM_setText('ss-prayer',  Stats_trackedDays() ? Stats_habitRate('prayer') + '%' : '—');
  DOM_setText('ss-workout', Stats_habitCount('workout'));
  DOM_setText('ss-reading', Stats_habitCount('selfHelp'));
  DOM_setText('ss-gpafy',   Stats_habitCount('gpafy'));

  // Six pillars
  const grid = document.getElementById('h-pillars');
  if (grid) {
    grid.innerHTML = PILLAR_IDS.map(pid => {
      const p   = PILLARS[pid];
      const pct = Scoring_pillarPct(pid, rec.habits);
      return `<div class="pill-card rip ${hasData && pct === 100 ? 'full' : ''}" onclick="App_nav('today')">
        <div class="pill-icon">${p.icon}</div>
        <div class="pill-name">${p.label}</div>
        <div class="pill-pct" style="color:${hasData?Scoring_color(pct):'var(--muted)'}">${hasData?pct+'%':'—'}</div>
        <div class="pbar" style="margin-top:5px;">
          <div class="pfill ${Scoring_pfillClass(pct)}" style="width:${pct}%"></div>
        </div>
      </div>`;
    }).join('');
  }

  // Today's focus — unfinished habits + study
  const studyHours=(rec.studySessions||[]).reduce((a,x)=>a+Number(x.hours||0),0);
  const unfin  = HABITS.filter(h => !rec.habits[h.id]);
  const focusEl = document.getElementById('h-focus');
  if (focusEl) {
    if (unfin.length === 0) {
      focusEl.innerHTML = `<div class="focus-item"><div class="focus-dot"></div><span class="focus-text">🎓 Study logged: ${studyHours.toFixed(1)}h</span></div><div class="focus-item">
        <span style="color:var(--green);font-weight:700;font-size:15px;">🎉 All habits done — ${score}/100 today!</span>
      </div>`;
    } else {
      focusEl.innerHTML = `<div class="focus-item"><div class="focus-dot"></div><span class="focus-text">🎓 Study logged: ${studyHours.toFixed(1)}h</span></div>` + unfin.slice(0, 6).map(h => {
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

  // Study sessions
  const studyLog = document.getElementById('today-study-log');
  if (studyLog) {
    const sessions = rec.studySessions || [];
    const names = Object.fromEntries(SEMESTER_COURSES.map(c => [c.id, c.short])); names['bme-skill']='BME Skill';
    const total = sessions.reduce((a,x)=>a+Number(x.hours||0),0);
    studyLog.innerHTML = sessions.length ? `<div class="study-total">Today: <strong>${total.toFixed(2)}h</strong></div>` + sessions.map((x,i)=>`<div class="study-item"><div><strong>${names[x.courseId]||x.courseId}</strong><span>${Number(x.hours||0).toFixed(2)}h${x.task ? ' · '+escapeHtml(x.task) : ''}</span></div><button class="icon-btn" onclick="removeStudySession(${i})" aria-label="Remove study session">×</button></div>`).join('') : `<div class="t-sub study-empty">No study sessions logged yet.</div>`;
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
  const hasData = Stats_hasData(AppState.days[Today_viewDate]);
  const score = hasData ? Scoring_calcDayScore(rec.habits) : null;

  DOM_setText('td-score', score===null ? '—' : score);
  const scoreEl = document.getElementById('td-score');
  if (scoreEl) scoreEl.style.color = score===null ? 'var(--muted)' : Scoring_color(score);

  const bar = document.getElementById('td-score-bar');
  if (bar) {
    bar.style.width = (score||0) + '%';
    bar.className   = 'pfill ' + (score===null?'':Scoring_pfillClass(score));
  }
  DOM_setText('td-score-label', score===null ? 'No entries recorded yet' : Scoring_label(score));

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
function addStudySession(){
  const course=document.getElementById('study-course')?.value;
  const hours=document.getElementById('study-hours')?.value;
  const task=document.getElementById('study-task')?.value || '';
  Semester_addStudySession(course,hours,task);
}
function removeStudySession(index){ Semester_removeStudySession(index); }
function escapeHtml(v){ return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

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
    const inChal  = true;
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
    if (Utils_isFuture(Cal_selectedDate)) {
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
      onclick="Review_selectWeek(${w})">W${w}</div>`)
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
    const days = Math.max(Stats_trackedDays(), 1);
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
  for (const [key,rec] of Object.entries(AppState.days||{})) {
    const txt = rec?.memorableMoment?.trim();
    if (!txt || !/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
    if (filter && !txt.toLowerCase().includes(filter.toLowerCase()) && !key.includes(filter)) continue;
    entries.push({ date: V7_parseDate(key), text: txt, key });
  }
  const container = document.getElementById('mem-timeline');
  if (!container) return;
  if (!entries.length) {
    container.innerHTML = `<div class="mem-empty">${filter ? 'No memories match your search.' : 'No memories saved yet. Add one in Today’s tracker and it will be filed here automatically.'}</div>`;
    return;
  }
  entries.sort((a,b)=>b.key.localeCompare(a.key));
  const months = new Map();
  for (const e of entries) {
    const monthKey=e.key.slice(0,7);
    if(!months.has(monthKey)) months.set(monthKey,[]);
    months.get(monthKey).push(e);
  }
  container.innerHTML = [...months.entries()].map(([monthKey,items],idx)=>{
    const monthDate=V7_parseDate(monthKey+'-01');
    const monthLabel=monthDate.toLocaleDateString('en-US',{month:'long',year:'numeric'});
    const dayHtml=items.map(e=>{
      const label=e.date.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
      return `<details class="mem-day-folder"><summary><span class="mem-day-icon">📄</span><span class="mem-day-label"><strong>${escapeHtml(label)}</strong><small>Daily memory</small></span><span class="mem-folder-chevron">⌄</span></summary><div class="mem-day-content">${escapeHtml(e.text)}</div></details>`;
    }).join('');
    return `<details class="mem-month-folder" ${filter||idx===0?'open':''}><summary><span class="mem-folder-icon">📂</span><span class="mem-month-label"><strong>${escapeHtml(monthLabel)}</strong><small>${items.length} ${items.length===1?'memory':'memories'}</small></span><span class="mem-folder-chevron">⌄</span></summary><div class="mem-month-content">${dayHtml}</div></details>`;
  }).join('');
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
  DOM_setText('pf-avg',    Stats_trackedDays() ? avg : '—');

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
   14B. SEMESTER
═══════════════════════════════════════════════════════════════════════════ */
function Semester_save(){ Storage_save(); }
function Semester_dateProgress(){
  const s=new Date(CONFIG.semester.start+'T00:00:00'), e=new Date(CONFIG.semester.end+'T00:00:00'), n=new Date();
  const total=Math.max(1,Math.round((e-s)/86400000)+1), elapsed=Math.min(total,Math.max(0,Math.floor((n-s)/86400000)+1));
  return {pct:Math.round(elapsed/total*100), week:Math.min(16,Math.max(1,Math.floor((elapsed-1)/7)+1)), elapsed,total};
}
function Semester_loggedHours(){
  const totals={};
  const start=CONFIG.semester.start, end=CONFIG.semester.end;
  Object.entries(AppState.days||{}).forEach(([date,rec])=>{
    if(date<start || date>end) return;
    (rec.studySessions||[]).forEach(x=>{
      if(!x.courseId) return;
      totals[x.courseId]=(totals[x.courseId]||0)+Number(x.hours||0);
    });
  });
  return totals;
}
function Semester_addStudySession(courseId,hours,task){
  hours=Number(hours)||0; if(!courseId || hours<=0) return App_toast('Choose a course and enter study time');
  const rec=Storage_loadDay(Today_viewDate);
  rec.studySessions=Array.isArray(rec.studySessions)?rec.studySessions:[];
  rec.studySessions.push({courseId,hours:Math.min(24,hours),task:(task||'').trim()});
  Storage_saveDay(Today_viewDate,{studySessions:rec.studySessions});
  Today_render(Today_viewDate); App_toast(`Logged ${hours}h of study`);
}
function Semester_removeStudySession(index){
  const rec=Storage_loadDay(Today_viewDate); if(!rec.studySessions?.[index]) return;
  rec.studySessions.splice(index,1); Storage_saveDay(Today_viewDate,{studySessions:rec.studySessions}); Today_render(Today_viewDate);
}

function Semester_weekDates(){
  const now=new Date(); const day=(now.getDay()+6)%7;
  const monday=new Date(now); monday.setHours(0,0,0,0); monday.setDate(now.getDate()-day);
  const sunday=new Date(monday); sunday.setDate(monday.getDate()+6);
  const iso=d=>{const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),x=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${x}`};
  return {start:iso(monday),end:iso(sunday)};
}
function Semester_weekStats(){
  const w=Semester_weekDates(), stats={study:0,bme:0,gym:0,faith:0,sleepTotal:0,sleepCount:0};
  Object.entries(AppState.days||{}).forEach(([date,rec])=>{
    if(date<w.start||date>w.end) return;
    (rec.studySessions||[]).forEach(x=>{const h=Number(x.hours||0);stats.study+=h;if(x.courseId==='bme-skill')stats.bme+=h;});
    if(rec.habits?.workout) stats.gym++;
    if(rec.habits?.prayer) stats.faith++;
    const sh=Number(rec.sleepHours||0); if(sh>0){stats.sleepTotal+=sh;stats.sleepCount++;}
  });
  stats.sleepAvg=stats.sleepCount?stats.sleepTotal/stats.sleepCount:0;
  return stats;
}
function Semester_targetPct(value,target){return target>0?Math.min(100,Math.round(value/target*100)):0;}
function Semester_openNotion(){
  const url=(AppState.semester?.notionUrl||'https://www.notion.so/').trim();
  window.open(url,'_blank','noopener');
}
function Semester_saveNotionUrl(val){
  const sem=AppState.semester||(AppState.semester=Semester_default()); sem.notionUrl=(val||'').trim()||'https://www.notion.so/'; Storage_save();
}
function Semester_render(){
  const sem=AppState.semester || (AppState.semester=Semester_default());
  sem.targets=Object.assign({studyHours:18,bmeHours:4,gymSessions:3,faithDays:7,sleepHours:7},sem.targets||{});
  const prog=Semester_dateProgress();
  DOM_setText('sem-title',sem.name); DOM_setText('sem-week',`Week ${prog.week} of 16`); DOM_setText('sem-date-range',`${sem.start} → ${sem.end}`);
  DOM_setText('sem-time-pct',prog.pct+'%'); DOM_setStyle('sem-time-bar','width',prog.pct+'%');
  const logged=Semester_loggedHours();
  const cards=SEMESTER_COURSES.map(c=>{const d=sem.courses[c.id]||{}; const hrs=Math.max(Number(d.studyHours||0),Number(logged[c.id]||0)); return `<div class="card sem-course"><div class="sem-course-head"><div><span class="sem-icon">${c.icon}</span><strong>${c.name}</strong><div class="t-sub">${c.short}</div></div><span class="sem-pct">${d.progress||0}%</span></div><div class="pbar"><div class="pfill" style="width:${d.progress||0}%"></div></div><div class="sem-grid"><label>Progress<input type="range" min="0" max="100" value="${d.progress||0}" oninput="Semester_update('${c.id}','progress',this.value)"/></label><label>Study hours<input type="number" min="0" step="0.5" value="${hrs.toFixed(1)}" readonly/></label></div><textarea class="finput sem-note" placeholder="Course notes / next action..." onchange="Semester_update('${c.id}','note',this.value)">${escapeHtml(d.note||'')}</textarea></div>`}).join('');
  document.getElementById('sem-courses').innerHTML=cards;
  const totalH=Object.values(logged).reduce((a,h)=>a+Number(h||0),0)+SEMESTER_COURSES.reduce((a,c)=>a+(logged[c.id]?0:Number(sem.courses[c.id]?.studyHours||0)),0);
  const avg=SEMESTER_COURSES.reduce((a,c)=>a+Number(sem.courses[c.id]?.progress||0),0)/SEMESTER_COURSES.length;
  DOM_setText('sem-study-total',totalH.toFixed(1)); DOM_setText('sem-course-avg',Math.round(avg)+'%');

  const ws=Semester_weekStats(), t=sem.targets;
  const targetRows=[
    ['📚','University study',ws.study,t.studyHours,'h','study'],
    ['🧠','BME skills',ws.bme,t.bmeHours,'h','bme'],
    ['💪','Gym',ws.gym,t.gymSessions,'sessions','gym'],
    ['✝️','Faith',ws.faith,t.faithDays,'days','faith'],
    ['😴','Sleep average',ws.sleepAvg,t.sleepHours,'h/night','sleep']
  ];
  const targetHtml=targetRows.map(([icon,label,val,target,unit,key])=>{const pct=Semester_targetPct(val,target);const shown=key==='sleep'?val.toFixed(1):Number.isInteger(val)?val:val.toFixed(1);return `<div class="target-row"><div class="target-top"><span>${icon} <strong>${label}</strong></span><span><strong>${shown}</strong> / ${target} ${unit}</span></div><div class="pbar"><div class="pfill" style="width:${pct}%"></div></div></div>`}).join('');
  const targetEditor=`<div class="target-edit-grid"><label>Study h/week<input type="number" min="0" step="1" value="${t.studyHours}" onchange="Semester_updateTarget('studyHours',this.value)"></label><label>BME h/week<input type="number" min="0" step="1" value="${t.bmeHours}" onchange="Semester_updateTarget('bmeHours',this.value)"></label><label>Gym/week<input type="number" min="0" step="1" value="${t.gymSessions}" onchange="Semester_updateTarget('gymSessions',this.value)"></label><label>Faith days/week<input type="number" min="0" max="7" step="1" value="${t.faithDays}" onchange="Semester_updateTarget('faithDays',this.value)"></label><label>Sleep avg<input type="number" min="0" step="0.5" value="${t.sleepHours}" onchange="Semester_updateTarget('sleepHours',this.value)"></label></div>`;
  const tw=document.getElementById('sem-targets'); if(tw) tw.innerHTML=targetHtml+targetEditor;
  const nu=document.getElementById('sem-notion-url'); if(nu) nu.value=sem.notionUrl||'https://www.notion.so/';
}
function Semester_updateTarget(key,val){
  const sem=AppState.semester||(AppState.semester=Semester_default()); sem.targets=Object.assign({studyHours:18,bmeHours:4,gymSessions:3,faithDays:7,sleepHours:7},sem.targets||{}); sem.targets[key]=Math.max(0,Number(val)||0); Storage_save(); Semester_render();
}

function Semester_update(id,key,val){
  const sem=AppState.semester || (AppState.semester=Semester_default()); if(!sem.courses[id]) sem.courses[id]={};
  sem.courses[id][key]= key==='note' ? val : Number(val)||0; Storage_save();
  const pct=sem.courses[id].progress||0; const el=document.querySelector(`[oninput="Semester_update('${id}','progress',this.value)"]`); if(el && key==='progress'){ const parent=el.closest('.sem-course'); parent?.querySelector('.sem-pct') && (parent.querySelector('.sem-pct').textContent=pct+'%'); parent?.querySelector('.pfill') && (parent.querySelector('.pfill').style.width=pct+'%'); }
  if(key==='studyHours'||key==='progress') Semester_render();
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
    case 'semester': Semester_render();  break;
    case 'calendar': Calendar_render();    break;
    case 'review':   Review_render();      break;
    case 'profile':  Profile_render();     break;
    case 'systems':  V7_systemsRender();  break;
    case 'more':     break;
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
  const pages = ['home','today','semester','calendar','review','profile','systems'];
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
function Review_saveScoreAlias(k,v) { Review_saveScore(k,v); } // compatibility alias; does not override the implementation
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

/* ═══════════════════════════════════════════════════════════════════════════
   BIRTAT 7.0 SYSTEMS MODULES
   Additive modules. Existing v4 day records and keys remain compatible.
═══════════════════════════════════════════════════════════════════════════ */

const V7_COURSES = [
  {id:'dsa',name:'Data Structures and Algorithms',short:'DSA',kind:'technical'},
  {id:'em',name:'Electromagnetic Devices and Electrical Machines',short:'EM Devices',kind:'technical'},
  {id:'tech',name:'Appropriate Technology',short:'Appropriate Tech',kind:'conceptual'},
  {id:'workshop',name:'General Workshop',short:'Workshop',kind:'practical'},
  {id:'inclusion',name:'Inclusiveness',short:'Inclusiveness',kind:'conceptual'},
  {id:'electronics',name:'Applied Electronics I',short:'Electronics I',kind:'technical'},
  {id:'biochem',name:'Fundamentals of Biochemistry',short:'Biochemistry',kind:'conceptual'},
  {id:'biofluid',name:'Bio-fluid Mechanics',short:'Bio-fluid',kind:'technical'}
];

function V7_defaultProfile(){
  return {name:'Dagim',wakeTime:'06:00',bedtime:'22:00',faithPriority:1,studyTargetMinutes:180,gymTarget:4,trainingDays:['Monday','Tuesday','Thursday','Saturday'],phoneTargetMinutes:null,phoneCutoff:'21:30',weekStartsMonday:true,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone||'local',weeklyReviewDay:0};
}
function V7_defaultTimetable(){
  const raw=[
    [1,'biofluid','Bio-fluid Mechanics','10:00','12:00'],[1,'dsa','Data Structures and Algorithms','13:30','15:30'],[1,'workshoplab','General Workshop Lab','15:30','17:30'],
    [2,'biochem','Fundamentals of Biochemistry','08:00','10:00'],[2,'electronics','Applied Electronics I','10:00','12:00'],[2,'ceed','CEED','15:30','17:30'],
    [3,'dsa','Data Structures and Algorithms','08:00','10:00'],[3,'inclusion','Inclusiveness','10:00','12:00'],[3,'em','Electromagnetic Devices and Electrical Machines','13:30','15:30'],
    [4,'electronics','Applied Electronics I','08:00','10:00'],[4,'workshop','General Workshop','10:00','12:00'],[4,'biofluid','Bio-fluid Mechanics','13:30','15:30'],[4,'dsalab','Data Structures and Algorithms Lab','15:30','17:30'],
    [5,'em','Electromagnetic Devices and Electrical Machines','08:00','10:00'],[5,'biochem','Fundamentals of Biochemistry','10:00','12:00'],[5,'inclusion','Inclusiveness','13:30','15:30'],[5,'electronicslab','Applied Electronics Lab','15:30','17:30']
  ];
  return {recurring:raw.map((x,i)=>({id:'class-'+x[0]+'-'+x[1]+'-'+i,dayOfWeek:x[0],courseId:x[1],title:x[2],startTime:x[3],endTime:x[4],location:'Varnero Building, CR 8103',kind:'class',active:true})),exceptions:{},oneOff:[]};
}
function V7_createInitialState(){
  return {days:{},reviews:{},settings:{},semester:Semester_default(),customHabits:[],habitLogs:{},meta:{startDate:CONFIG.challengeStart,longestStreak:0,version:CONFIG.version,schemaVersion:7},schemaVersion:7,profile:V7_defaultProfile(),timetable:V7_defaultTimetable(),tasks:[],academic:{courses:V7_COURSES.map(c=>({...c,credits:'',topics:[],practiceQuestions:[],practicals:[],assignments:[],resources:[],notes:'',mastery:0})),weeklyAllocation:{dsa:210,em:180,tech:90,workshop:180,inclusion:60,electronics:210,biochem:120,biofluid:210},sessions:[],activeSession:null},fitness:{workouts:[],bodyMetrics:[],nutrition:[],templates:{'Upper A':[{name:'Bench press',sets:3,reps:'6-10',weight:''},{name:'Chest-supported row',sets:3,reps:'8-12',weight:''},{name:'Overhead press',sets:2,reps:'8-12',weight:''},{name:'Lat pulldown',sets:3,reps:'8-12',weight:''},{name:'Lateral raise',sets:2,reps:'12-15',weight:''},{name:'Biceps curl',sets:2,reps:'10-15',weight:''},{name:'Triceps pushdown',sets:2,reps:'10-15',weight:''}],'Lower A':[{name:'Squat or leg press',sets:3,reps:'6-10',weight:''},{name:'Romanian deadlift',sets:3,reps:'8-10',weight:''},{name:'Leg curl',sets:3,reps:'10-15',weight:''},{name:'Calf raise',sets:3,reps:'10-15',weight:''},{name:'Plank',sets:3,reps:'30-60 sec',weight:''}],'Upper B':[{name:'Incline dumbbell press',sets:3,reps:'8-12',weight:''},{name:'Lat pulldown or pull-up',sets:3,reps:'8-12',weight:''},{name:'Cable row',sets:3,reps:'8-12',weight:''},{name:'Dumbbell shoulder press',sets:2,reps:'8-12',weight:''},{name:'Chest fly',sets:2,reps:'12-15',weight:''},{name:'Hammer curl',sets:2,reps:'10-15',weight:''},{name:'Overhead triceps extension',sets:2,reps:'10-15',weight:''}],'Lower B':[{name:'Hip hinge or deadlift variation',sets:3,reps:'6-10',weight:''},{name:'Bulgarian split squat',sets:3,reps:'8-12',weight:''},{name:'Leg extension',sets:3,reps:'10-15',weight:''},{name:'Seated leg curl',sets:3,reps:'10-15',weight:''},{name:'Calf raise',sets:3,reps:'10-15',weight:''}]}},phone:{sessions:[],screenLogs:[],distractionLogs:[],activeFocus:null,rules:{morningPhoneFree:true,phoneOutsideStudy:true,eveningCutoff:'21:30',socialMediaLimitMinutes:null,blocklist:[]}},faith:{logs:{},customCommitments:[]},personal:{books:[],readingSessions:[],goals:[],familyCommitments:[]},dailyReviews:{},weeklyReviews:{}};
}
function V7_mergeState(parsed){
  if(!parsed||typeof parsed!=='object')return;
  const base=V7_createInitialState();
  if(!AppState.profile)AppState.profile=base.profile;
  AppState.profile=Object.assign({},base.profile,AppState.profile,parsed.profile||{});
  if(!AppState.timetable)AppState.timetable=base.timetable;
  const pt=parsed.timetable||{};
  AppState.timetable={...base.timetable,...AppState.timetable,...pt,recurring:Array.isArray(pt.recurring)?pt.recurring:(AppState.timetable.recurring||base.timetable.recurring),oneOff:Array.isArray(pt.oneOff)?pt.oneOff:(AppState.timetable.oneOff||[]),exceptions:{...(AppState.timetable.exceptions||{}),...(pt.exceptions||{})}};
  AppState.tasks=Array.isArray(parsed.tasks)?parsed.tasks:(Array.isArray(AppState.tasks)?AppState.tasks:[]);
  AppState.customHabits=Array.isArray(parsed.customHabits)?parsed.customHabits:(Array.isArray(AppState.customHabits)?AppState.customHabits:[]);
  AppState.habitLogs={...(AppState.habitLogs||{}),...(parsed.habitLogs||{})};
  const oldAcademic=AppState.academic||base.academic, incomingAcademic=parsed.academic||{};
  const courseMap=new Map();
  const oldCourses=Array.isArray(oldAcademic.courses)?oldAcademic.courses:[], incomingCourses=Array.isArray(incomingAcademic.courses)?incomingAcademic.courses:[];
  [...base.academic.courses,...oldCourses,...incomingCourses].forEach(c=>{if(c&&typeof c==='object'&&c.id)courseMap.set(c.id,{...(courseMap.get(c.id)||{}),...c});});
  V7_COURSES.forEach(c=>{if(!courseMap.has(c.id))courseMap.set(c.id,{...c,credits:'',topics:[],practiceQuestions:[],practicals:[],assignments:[],resources:[],notes:'',mastery:0});});
  AppState.academic={...base.academic,...oldAcademic,...incomingAcademic,courses:[...courseMap.values()],weeklyAllocation:{...base.academic.weeklyAllocation,...(oldAcademic.weeklyAllocation||{}),...(incomingAcademic.weeklyAllocation||{})},sessions:Array.isArray(incomingAcademic.sessions)?incomingAcademic.sessions:(Array.isArray(oldAcademic.sessions)?oldAcademic.sessions:[]),activeSession:incomingAcademic.activeSession!==undefined?incomingAcademic.activeSession:(oldAcademic.activeSession||null)};
  const oldFitness=AppState.fitness||base.fitness, incomingFitness=parsed.fitness||{};
  AppState.fitness={...base.fitness,...oldFitness,...incomingFitness,workouts:Array.isArray(incomingFitness.workouts)?incomingFitness.workouts:(oldFitness.workouts||[]),bodyMetrics:Array.isArray(incomingFitness.bodyMetrics)?incomingFitness.bodyMetrics:(oldFitness.bodyMetrics||[]),nutrition:Array.isArray(incomingFitness.nutrition)?incomingFitness.nutrition:(oldFitness.nutrition||[]),templates:{...base.fitness.templates,...(oldFitness.templates||{}),...(incomingFitness.templates||{})}};Object.keys(base.fitness.templates).forEach(k=>{if(!Array.isArray(AppState.fitness.templates[k])||!AppState.fitness.templates[k].length)AppState.fitness.templates[k]=base.fitness.templates[k];});
  const oldPhone=AppState.phone||base.phone, incomingPhone=parsed.phone||{};
  AppState.phone={...base.phone,...oldPhone,...incomingPhone,sessions:Array.isArray(incomingPhone.sessions)?incomingPhone.sessions:(oldPhone.sessions||[]),screenLogs:Array.isArray(incomingPhone.screenLogs)?incomingPhone.screenLogs:(oldPhone.screenLogs||[]),distractionLogs:Array.isArray(incomingPhone.distractionLogs)?incomingPhone.distractionLogs:(oldPhone.distractionLogs||[]),activeFocus:incomingPhone.activeFocus!==undefined?incomingPhone.activeFocus:(oldPhone.activeFocus||null),rules:{...base.phone.rules,...(oldPhone.rules||{}),...(incomingPhone.rules||{})}};
  const oldFaith=AppState.faith||base.faith, incomingFaith=parsed.faith||{};
  AppState.faith={...base.faith,...oldFaith,...incomingFaith,logs:{...(oldFaith.logs||{}),...(incomingFaith.logs||{})},customCommitments:Array.isArray(incomingFaith.customCommitments)?incomingFaith.customCommitments:(oldFaith.customCommitments||[])};
  const oldPersonal=AppState.personal||base.personal, incomingPersonal=parsed.personal||{};
  AppState.personal={...base.personal,...oldPersonal,...incomingPersonal};
  ['books','readingSessions','goals','familyCommitments'].forEach(k=>{AppState.personal[k]=Array.isArray(incomingPersonal[k])?incomingPersonal[k]:(Array.isArray(oldPersonal[k])?oldPersonal[k]:[])});
  AppState.dailyReviews={...(AppState.dailyReviews||{}),...(parsed.dailyReviews||{})};
  AppState.weeklyReviews={...(AppState.weeklyReviews||{}),...(parsed.weeklyReviews||{})};
  Object.values(AppState.days||{}).forEach(day=>{if(!Array.isArray(day.studySessions))return;const seen=new Set();day.studySessions=day.studySessions.filter(session=>{if(!session.sessionId)return true;if(seen.has(session.sessionId))return false;seen.add(session.sessionId);return true;});});
  AppState.tasks=V7_dedupe(AppState.tasks);AppState.academic.sessions=V7_dedupe(AppState.academic.sessions);AppState.fitness.workouts=V7_dedupe(AppState.fitness.workouts);AppState.fitness.bodyMetrics=V7_dedupe(AppState.fitness.bodyMetrics);AppState.fitness.nutrition=V7_dedupe(AppState.fitness.nutrition);AppState.phone.sessions=V7_dedupe(AppState.phone.sessions);AppState.phone.screenLogs=V7_dedupe(AppState.phone.screenLogs);AppState.phone.distractionLogs=V7_dedupe(AppState.phone.distractionLogs);AppState.personal.books=V7_dedupe(AppState.personal.books);AppState.personal.readingSessions=V7_dedupe(AppState.personal.readingSessions);AppState.personal.goals=V7_dedupe(AppState.personal.goals);AppState.personal.familyCommitments=V7_dedupe(AppState.personal.familyCommitments);
  AppState.schemaVersion=7;
  AppState.meta=Object.assign({},AppState.meta||{},parsed.meta||{},{schemaVersion:7,version:CONFIG.version});
}
function V7_migrateState(){
  try{const raw=localStorage.getItem(CONFIG.storageKey);if(raw&&!localStorage.getItem('birtat-v4-pre-v7-backup')){let shouldBackup=true;try{const old=JSON.parse(raw);shouldBackup=!old.schemaVersion||Number(old.schemaVersion)<7;}catch(e){shouldBackup=true;}if(shouldBackup)localStorage.setItem('birtat-v4-pre-v7-backup',raw);}}catch(e){console.warn('[Birtat] Could not create pre-V7 snapshot',e);}
  if(!AppState||typeof AppState!=='object')AppState=V7_createInitialState();
  V7_mergeState(AppState);
  // Preserve old habit records and ensure new academic course is available to the legacy semester view.
  if(!AppState.semester)AppState.semester=Semester_default();
  const defaults=Semester_default();
  AppState.semester.courses=Object.assign({},defaults.courses,AppState.semester.courses||{});
  if(!AppState.semester.targets)AppState.semester.targets=defaults.targets;
  Storage_save();
}
function V7_safeExternalUrl(value){try{const u=new URL(String(value||''));return ['http:','https:'].includes(u.protocol)?u.href:'';}catch(e){return '';}}
function V7_uuid(prefix='r'){
  return prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);
}
function V7_dedupe(list){if(!Array.isArray(list))return [];const seen=new Set();return list.filter(item=>{if(!item||typeof item!=='object')return false;const key=item.id?String(item.id):JSON.stringify(item);if(seen.has(key))return false;seen.add(key);return true;});}
function V7_validateImport(parsed){
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return false;
  const known=['days','reviews','settings','semester','meta','schemaVersion','profile','timetable','tasks','academic','fitness','phone','faith','personal','dailyReviews','weeklyReviews','customHabits','habitLogs'];
  if(!known.some(k=>Object.prototype.hasOwnProperty.call(parsed,k)))return false;
  if(parsed.days!==undefined&&(!parsed.days||typeof parsed.days!=='object'||Array.isArray(parsed.days)))return false;
  if(parsed.days&&Object.entries(parsed.days).some(([d,r])=>!/^\d{4}-\d{2}-\d{2}$/.test(d)||!r||typeof r!=='object'||Array.isArray(r)))return false;
  if(parsed.tasks!==undefined&&!Array.isArray(parsed.tasks))return false;
  if(parsed.customHabits!==undefined&&!Array.isArray(parsed.customHabits))return false;
  if(parsed.habitLogs!==undefined&&(!parsed.habitLogs||typeof parsed.habitLogs!=='object'||Array.isArray(parsed.habitLogs)))return false;
  if(parsed.timetable!==undefined&&(!parsed.timetable||typeof parsed.timetable!=='object'||Array.isArray(parsed.timetable)))return false;
  if(parsed.timetable?.recurring!==undefined&&!Array.isArray(parsed.timetable.recurring))return false;
  if(parsed.timetable?.oneOff!==undefined&&!Array.isArray(parsed.timetable.oneOff))return false;
  if(parsed.timetable?.exceptions!==undefined&&(!parsed.timetable.exceptions||typeof parsed.timetable.exceptions!=='object'||Array.isArray(parsed.timetable.exceptions)))return false;
  for(const [key,fields] of Object.entries({academic:['sessions','courses'],fitness:['workouts','bodyMetrics','nutrition'],phone:['sessions','screenLogs','distractionLogs'],personal:['books','readingSessions','goals','familyCommitments'],faith:['customCommitments']})){
    if(parsed[key]!==undefined&&(!parsed[key]||typeof parsed[key]!=='object'||Array.isArray(parsed[key])))return false;
    for(const field of fields)if(parsed[key]?.[field]!==undefined&&!Array.isArray(parsed[key][field]))return false;
  }
  return true;
}
function V7_today(){return Utils_dateKey(new Date());}
function V7_parseDate(key){const [y,m,d]=String(key).split('-').map(Number);return new Date(y,(m||1)-1,d||1,12,0,0,0);}
function V7_timeMinutes(t){const [h,m]=String(t||'0:0').split(':').map(Number);return (h||0)*60+(m||0);}
function V7_nowTime(){const d=new Date();return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');}
function V7_dayName(n){return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][n];}
function V7_shortDate(k){return V7_parseDate(k).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});}
function V7_currentWeek(){const d=V7_parseDate(V7_today());const shift=(d.getDay()+6)%7;d.setDate(d.getDate()-shift);return Utils_dateKey(d);}
function V7_weekEnd(){const d=V7_parseDate(V7_currentWeek());d.setDate(d.getDate()+6);return Utils_dateKey(d);}
function V7_getCourse(id){return (AppState.academic?.courses||[]).find(c=>c.id===id);}
function V7_save(){AppState.meta=AppState.meta||{};AppState.meta.schemaVersion=7;AppState.meta.version=CONFIG.version;Storage_save();}
function V7_getFaith(date=V7_today()){if(!AppState.faith.logs[date])AppState.faith.logs[date]={};return AppState.faith.logs[date];}
function V7_getEvents(date){
  const d=V7_parseDate(date), dow=d.getDay();
  const exceptions=AppState.timetable.exceptions||{};
  const base=(AppState.timetable.recurring||[]).filter(e=>e.active!==false&&Number(e.dayOfWeek)===dow).map(e=>{
    const ex=exceptions[date+':'+e.id]||{};return {...e,...ex,source:'recurring',recurringId:e.id,date};
  }).filter(e=>e.status!=='cancelled');
  const once=(AppState.timetable.oneOff||[]).filter(e=>e.date===date&&e.status!=='cancelled').map(e=>({...e,source:'oneOff'}));
  const tasks=(AppState.tasks||[]).filter(t=>t.date===date&&t.startTime&&t.endTime&&t.status!=='cancelled'&&!t.done).map(t=>({...t,id:'task-'+t.id,title:t.title,kind:'task',source:'task'}));
  return [...base,...once,...tasks].sort((a,b)=>V7_timeMinutes(a.startTime)-V7_timeMinutes(b.startTime));
}
function V7_eventConflicts(date,start,end,ignoreId=''){
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(start||''))||!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(end||'')))return 'Enter valid 24-hour times (HH:MM).';const s=V7_timeMinutes(start),e=V7_timeMinutes(end);if(e<=s)return 'End time must be after start time.';
  for(const ev of V7_getEvents(date)){
    if(ev.id===ignoreId||ev.recurringId===ignoreId)continue;
    const es=V7_timeMinutes(ev.startTime),ee=V7_timeMinutes(ev.endTime);
    if(s<ee&&e>es)return `Overlaps ${ev.title} (${ev.startTime}–${ev.endTime}).`;
  }
  return '';
}
function V7_openSystemTab(tab){
  V7_systemTab=tab||'faith';
  document.querySelectorAll('.sys-tab').forEach(b=>b.classList.toggle('on',b.dataset.sys===V7_systemTab));
  const secondary=document.getElementById('v7-secondary-tool');
  if(secondary) secondary.value=['timetable','phone','habits','reviews','settings'].includes(V7_systemTab)?V7_systemTab:'';
  document.querySelectorAll('.sys-panel').forEach(p=>p.hidden=p.dataset.panel!==V7_systemTab);
  V7_renderSystemTab();
}
let V7_systemTab='faith';
let V7_timerInterval=null;
let V7_focusInterval=null;
function V7_renderSystemTab(){
  switch(V7_systemTab){case'faith':V7_renderFaith();break;case'academics':V7_renderAcademics();break;case'timetable':V7_renderTimetable();break;case'fitness':V7_renderFitness();break;case'phone':V7_renderPhone();break;case'personal':V7_renderPersonal();break;case'habits':V7_renderHabits();break;case'reviews':V7_renderSystemsReview();break;case'settings':V7_renderSettings();break;}
}
function V7_systemsRender(){V7_openSystemTab(V7_systemTab);}
function V7_renderFaith(){
  const d=V7_today(), log=V7_getFaith(d), items=[['morningPrayer','Morning prayer'],['eveningPrayer','Evening prayer'],['scripture','Scripture reading'],['spiritualBook','Spiritual book reading'],['church','Church / church commitment'],['fasting','Optional fasting commitment'],['reflection','Personal reflection and gratitude']];
  const el=document.getElementById('faith-checklist');if(!el)return;
  el.innerHTML=items.map(([id,label])=>`<label class="v7-check"><input type="checkbox" ${log[id]?'checked':''} onchange="V7_setFaith('${id}',this.checked)"><span>${label}</span></label>`).join('')+
    (AppState.faith.customCommitments||[]).map(c=>{const weekly=c.frequency==='weekly',scheduled=c.frequency==='daily'||weekly||(c.weekdays||[]).includes(V7_parseDate(d).getDay());return `<div class="v7-custom-faith ${scheduled||weekly?'':'is-unscheduled'}"><label class="v7-check"><input type="checkbox" ${!!log['custom_'+c.id]?'checked':''} ${scheduled||weekly?'':'disabled'} onchange="V7_setFaith('custom_${c.id}',this.checked)"><span>${escapeHtml(c.name)} <small>${weekly?'Weekly commitment':scheduled?'Scheduled today':'Not scheduled today'}</small></span><button type="button" class="v7-inline" onclick="V7_removeCustomFaith('${c.id}')" aria-label="Retire commitment">×</button></label></div>`}).join('');
  const done=items.filter(([id])=>log[id]).length;document.getElementById('faith-summary').textContent=`${done} of ${items.length} standard commitments recorded today. This is a personal log, not a measure of faith.`;
  document.getElementById('faith-custom-name').value='';
}
function V7_setFaith(id,value){const l=V7_getFaith();l[id]=!!value;V7_save();V7_renderFaith();V7_renderDashboard();}
function V7_applyFaithRoutine(kind){const l=V7_getFaith();if(kind==='short'){l.morningPrayer=true;l.eveningPrayer=true;}else{l.morningPrayer=true;l.eveningPrayer=true;l.scripture=true;l.spiritualBook=true;l.reflection=true;}V7_save();V7_renderFaith();V7_renderDashboard();App_toast(kind==='short'?'Short routine recorded':'Full routine recorded');}
function V7_addCustomFaith(){const input=document.getElementById('faith-custom-name'),name=(input?.value||'').trim(),frequency=document.getElementById('faith-custom-frequency').value,weekdays=[...document.querySelectorAll('#faith-custom-days input:checked')].map(x=>Number(x.value));if(!name)return App_toast('Enter a commitment name');if(frequency==='custom'&&!weekdays.length)return App_toast('Choose at least one weekday');AppState.faith.customCommitments.push({id:V7_uuid('faith'),name,frequency,weekdays:frequency==='custom'?weekdays:[],active:true});V7_save();V7_renderFaith();App_toast('Commitment added');}
function V7_removeCustomFaith(id){if(!confirm('Retire this commitment? Its previous daily logs will be kept.'))return;AppState.faith.customCommitments=AppState.faith.customCommitments.filter(x=>x.id!==id);V7_save();V7_renderFaith();}
function V7_renderAcademics(){
  const select=document.getElementById('study-v7-course');if(!select)return;
  const courses=AppState.academic.courses;
  const old=select.value;select.innerHTML=courses.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');if(courses.some(c=>c.id===old))select.value=old;
  const date=V7_today(),mins=(AppState.academic.sessions||[]).filter(s=>s.date===date).reduce((n,s)=>n+Number(s.durationMinutes||0),0);
  document.getElementById('v7-study-today').textContent=`${Math.floor(mins/60)}h ${mins%60}m / ${(Number(AppState.profile.studyTargetMinutes??180)/60).toFixed(Number(AppState.profile.studyTargetMinutes??180)%60?1:0)}h target`;
  const weekStart=V7_currentWeek(),weekEnd=V7_parseDate(weekStart);weekEnd.setDate(weekEnd.getDate()+6);const endKey=Utils_dateKey(weekEnd);
  const wmins=(AppState.academic.sessions||[]).filter(s=>s.date>=weekStart&&s.date<=endKey).reduce((n,s)=>n+Number(s.durationMinutes||0),0);
  document.getElementById('v7-study-week').textContent=`${(wmins/60).toFixed(1)} focused hours this week`;
  const active=AppState.academic.activeSession;const timer=document.getElementById('v7-study-timer');if(timer)timer.textContent=active?V7_formatElapsed(Date.now()-new Date(active.startedAt).getTime()):'00:00:00';
  const sessionBtn=document.getElementById('v7-study-toggle');if(sessionBtn)sessionBtn.textContent=active?'End study session':'Start study session';
  const sessions=(AppState.academic.sessions||[]).slice().sort((a,b)=>String(b.startedAt).localeCompare(String(a.startedAt))).slice(0,12);
  document.getElementById('v7-study-history').innerHTML=sessions.length?sessions.map(s=>`<div class="v7-list-row"><div><strong>${escapeHtml(V7_getCourse(s.courseId)?.name||s.courseId||'Independent study')}</strong><div class="v7-muted">${escapeHtml(s.topic||'No topic')} · ${s.durationMinutes||0} min · ${escapeHtml(s.method||'Study')}</div>${s.output?`<div class="v7-muted">Output: ${escapeHtml(s.output)}</div>`:''}</div><span>${escapeHtml(s.date||'')}</span></div>`).join(''):'<p class="v7-empty">No independent study sessions logged yet.</p>';
  document.getElementById('v7-course-list').innerHTML=courses.map(c=>`<details class="v7-course"><summary><span><strong>${escapeHtml(c.name)}</strong><small>${c.kind==='technical'?'Problem-solving focus':c.kind==='practical'?'Practical focus':'Concepts and active recall'} · ${(AppState.academic.sessions.filter(s=>s.courseId===c.id&&s.date>=V7_currentWeek()&&s.date<=V7_weekEnd()).reduce((n,s)=>n+Number(s.durationMinutes||0),0)/60).toFixed(1)}h this week</small></span><span class="v7-mastery">${Number(c.mastery||0)}/5</span></summary><div class="v7-form-grid"><label>Credit hours<input class="finput" type="number" min="0" step="0.5" value="${escapeHtml(c.credits||'')}" onchange="V7_updateCourse('${c.id}','credits',this.value)"></label><label>Mastery / 5<input class="finput" type="number" min="0" max="5" value="${Number(c.mastery||0)}" onchange="V7_updateCourse('${c.id}','mastery',this.value)"></label></div><label>Topics / weak areas<textarea class="finput" rows="2" placeholder="One topic per line" onchange="V7_updateCourse('${c.id}','topicsText',this.value)">${escapeHtml((c.topics||[]).join('\n'))}</textarea></label><label>Practice questions / problem sets<textarea class="finput" rows="2" placeholder="One question or problem set per line" onchange="V7_updateCourse('${c.id}','practiceText',this.value)">${escapeHtml((c.practiceQuestions||[]).join('\n'))}</textarea></label><label>Practical exercises / lab work<textarea class="finput" rows="2" placeholder="One lab or practical task per line" onchange="V7_updateCourse('${c.id}','practicalsText',this.value)">${escapeHtml((c.practicals||[]).join('\n'))}</textarea></label><label>Course notes<textarea class="finput" rows="2" placeholder="What you learned, next action..." onchange="V7_updateCourse('${c.id}','notes',this.value)">${escapeHtml(c.notes||'')}</textarea></label></details>`).join('');
  V7_renderAllocation();
  const resourceHost=document.getElementById('v7-resource-list');if(resourceHost)resourceHost.innerHTML=courses.flatMap(c=>(c.resources||[]).map(r=>`<div class="v7-list-row"><div><strong>${escapeHtml(r.title)}</strong><small>${escapeHtml(c.short)}${r.url?' · '+escapeHtml(r.url):''}</small></div><button class="v7-inline" onclick="V7_removeResource('${c.id}','${r.id}')">Remove</button></div>`)).join('')||'<p class="v7-empty">No resource references saved.</p>';
  const taskSelect=document.getElementById('v7-task-course');taskSelect.innerHTML='<option value="">General task</option>'+courses.map(c=>`<option value="${c.id}">${escapeHtml(c.short)}</option>`).join('');
  const tasks=AppState.academic.courses.flatMap(c=>(c.assignments||[]).map(a=>({...a,courseName:c.short,courseId:c.id}))).sort((a,b)=>String(a.dueDate||'9999').localeCompare(String(b.dueDate||'9999')));
  document.getElementById('v7-assignments').innerHTML=tasks.length?tasks.map(a=>`<div class="v7-list-row"><label class="v7-check"><input type="checkbox" ${a.done?'checked':''} onchange="V7_toggleAssignment('${a.courseId}','${a.id}',this.checked)"><span><strong>${escapeHtml(a.title)}</strong><small>${escapeHtml(a.courseName)} · ${escapeHtml(a.dueDate||'No deadline')}</small></span></label><button class="v7-inline" onclick="V7_removeAssignment('${a.courseId}','${a.id}')">Remove</button></div>`).join(''):'<p class="v7-empty">No assignments or practical tasks added.</p>';
}
function V7_renderAllocation(){const host=document.getElementById('v7-allocation');if(!host)return;const a=AppState.academic.weeklyAllocation||{};host.innerHTML=AppState.academic.courses.map(c=>`<label class="v7-allocation-row"><span>${escapeHtml(c.short)}</span><input class="finput" type="number" min="0" max="1260" step="15" value="${Number(a[c.id]||0)}" onchange="V7_setAllocation('${c.id}',this.value)"><small>min/wk</small></label>`).join('');const total=Object.values(a).reduce((n,x)=>n+Number(x||0),0);const totalEl=document.getElementById('v7-allocation-total');if(totalEl)totalEl.textContent=`${(total/60).toFixed(1)} suggested hours/week`;}
function V7_setAllocation(id,val){AppState.academic.weeklyAllocation=AppState.academic.weeklyAllocation||{};AppState.academic.weeklyAllocation[id]=Math.max(0,Math.min(1260,Math.round((Number(val)||0)/15)*15));V7_save();V7_renderAllocation();}
function V7_formatElapsed(ms){const sec=Math.max(0,Math.floor(ms/1000)),h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;return [h,m,s].map(n=>String(n).padStart(2,'0')).join(':');}
function V7_toggleStudy(){
  const active=AppState.academic.activeSession;
  if(active){const end=Date.now(),started=new Date(active.startedAt).getTime(),elapsed=Math.max(1,Math.floor((end-started)/60000));let mins=elapsed;if(elapsed>240){const corrected=prompt(`Timer elapsed ${elapsed} minutes. If it was left running, enter actual focused minutes (1–240).`, '60');if(corrected===null)return;mins=Math.round(Number(corrected));if(!Number.isFinite(mins)||mins<1||mins>240)return App_toast('Enter actual focused minutes from 1 to 240');}const session={...active,id:active.id||V7_uuid('study'),endedAt:new Date(end).toISOString(),durationMinutes:mins,date:active.date||V7_today()};AppState.academic.sessions.push(session);const rec=Storage_loadDay(session.date);rec.studySessions=Array.isArray(rec.studySessions)?rec.studySessions:[];if(!rec.studySessions.some(x=>x.sessionId===session.id)){rec.studySessions.push({sessionId:session.id,courseId:session.courseId,hours:mins/60,task:session.topic||session.output||'Independent study',topic:session.topic,method:session.method,output:session.output,mastery:session.mastery,notes:session.notes,startedAt:session.startedAt,endedAt:session.endedAt,durationMinutes:mins});Storage_saveDay(session.date,{studySessions:rec.studySessions});}AppState.academic.activeSession=null;V7_save();if(V7_timerInterval){clearInterval(V7_timerInterval);V7_timerInterval=null;}App_toast(`Saved ${mins} focused minutes`);
  }else{const courseId=document.getElementById('study-v7-course').value,topic=document.getElementById('v7-study-topic').value.trim(),method=document.getElementById('v7-study-method').value,output=document.getElementById('v7-study-output').value.trim(),mastery=Number(document.getElementById('v7-study-mastery').value||0),notes=document.getElementById('v7-study-notes').value.trim();AppState.academic.activeSession={id:V7_uuid('study'),courseId,topic,method,output,mastery,notes,startedAt:new Date().toISOString(),date:V7_today()};V7_save();if(V7_timerInterval)clearInterval(V7_timerInterval);V7_timerInterval=setInterval(()=>{if(V7_systemTab==='academics')V7_renderAcademics();},1000);App_toast('Study session started. Breaks should be logged outside the timer.');}
  V7_renderAcademics();V7_renderDashboard();
}
function V7_logManualStudy(){if(AppState.academic.activeSession)return App_toast('End the active timer before adding a manual session');const courseId=document.getElementById('study-v7-course').value,minutes=Math.round(Number(document.getElementById('v7-study-minutes').value)||0),topic=document.getElementById('v7-study-topic').value.trim(),method=document.getElementById('v7-study-method').value,output=document.getElementById('v7-study-output').value.trim(),mastery=Number(document.getElementById('v7-study-mastery').value||0),notes=document.getElementById('v7-study-notes').value.trim();if(minutes<1||minutes>1440)return App_toast('Enter focused minutes from 1 to 1440');const now=new Date(),id=V7_uuid('study'),session={id,courseId,topic,method,output,mastery,notes,startedAt:new Date(now.getTime()-minutes*60000).toISOString(),endedAt:now.toISOString(),date:V7_today(),durationMinutes:minutes,manual:true};AppState.academic.sessions.push(session);const rec=Storage_loadDay(session.date);rec.studySessions=rec.studySessions||[];rec.studySessions.push({sessionId:id,courseId,hours:minutes/60,task:topic||output||'Independent study',topic,method,output,mastery,notes,durationMinutes:minutes,startedAt:session.startedAt,endedAt:session.endedAt});Storage_saveDay(session.date,{studySessions:rec.studySessions});V7_save();V7_renderAcademics();V7_renderDashboard();App_toast(`Logged ${minutes} focused minutes`);}
function V7_updateCourse(id,key,val){const c=V7_getCourse(id);if(!c)return;if(key==='topicsText')c.topics=String(val).split('\n').map(x=>x.trim()).filter(Boolean);else if(key==='practiceText')c.practiceQuestions=String(val).split('\n').map(x=>x.trim()).filter(Boolean);else if(key==='practicalsText')c.practicals=String(val).split('\n').map(x=>x.trim()).filter(Boolean);else if(key==='mastery')c.mastery=clamp(Number(val)||0,0,5);else if(key==='credits')c.credits=String(val);else c[key]=val;V7_save();if(key==='mastery')V7_renderAcademics();}
function V7_addAssignment(){const title=document.getElementById('v7-task-title').value.trim(),courseId=document.getElementById('v7-task-course').value,dueDate=document.getElementById('v7-task-due').value;if(!title)return App_toast('Enter a task title');const c=V7_getCourse(courseId);if(!c)return App_toast('Choose a course');c.assignments=c.assignments||[];c.assignments.push({id:V7_uuid('assignment'),title,dueDate,done:false,createdAt:new Date().toISOString()});document.getElementById('v7-task-title').value='';V7_save();V7_renderAcademics();}
function V7_toggleAssignment(courseId,id,done){const c=V7_getCourse(courseId),a=c?.assignments?.find(x=>x.id===id);if(a){a.done=!!done;a.completedAt=done?new Date().toISOString():null;V7_save();V7_renderAcademics();V7_renderDashboard();}}
function V7_removeAssignment(courseId,id){const c=V7_getCourse(courseId);if(c){c.assignments=(c.assignments||[]).filter(a=>a.id!==id);V7_save();V7_renderAcademics();}}
function V7_removeResource(courseId,id){const c=V7_getCourse(courseId);if(c){c.resources=(c.resources||[]).filter(r=>r.id!==id);V7_save();V7_renderAcademics();}}
function V7_addResource(){const courseId=document.getElementById('v7-resource-course').value,title=document.getElementById('v7-resource-title').value.trim(),url=document.getElementById('v7-resource-url').value.trim();const c=V7_getCourse(courseId);if(!c||!title)return App_toast('Add a course and resource title');c.resources=c.resources||[];c.resources.push({id:V7_uuid('resource'),title,url,createdAt:new Date().toISOString()});V7_save();document.getElementById('v7-resource-title').value='';document.getElementById('v7-resource-url').value='';V7_renderAcademics();App_toast('Resource saved');}
function V7_renderTimetable(){
  const dateInput=document.getElementById('v7-agenda-date');if(!dateInput)return;if(!dateInput.value)dateInput.value=V7_today();const date=dateInput.value;
  const events=V7_getEvents(date),all=AppState.timetable.recurring||[];
  document.getElementById('v7-agenda-title').textContent=V7_shortDate(date)+' · '+V7_dayName(V7_parseDate(date).getDay());
  document.getElementById('v7-agenda-events').innerHTML=events.length?events.map(e=>`<div class="v7-event"><div class="v7-event-time">${escapeHtml(e.startTime)}–${escapeHtml(e.endTime)}</div><div class="v7-event-main"><strong>${escapeHtml(e.title)}</strong><small>${escapeHtml(e.location||'Personal block')} · ${escapeHtml(e.kind||'event')}</small>${e.kind==='class'&&e.source==='recurring'?`<button class="v7-inline" onclick="V7_cancelOccurrence('${date}','${e.recurringId}')">Cancel this class</button><button class="v7-inline" onclick="V7_editOccurrence('${date}','${e.recurringId}')">Edit occurrence</button><button class="v7-inline" onclick="V7_editRecurring('${e.recurringId}')">Edit recurring class</button>`:e.source==='oneOff'?`<button class="v7-inline" onclick="V7_cancelOneOff('${e.id}')">Cancel event</button><button class="v7-inline" onclick="V7_editOneOff('${e.id}')">Edit</button>`:e.source==='task'?`<button class="v7-inline" onclick="V7_markTaskDone('${e.id.replace('task-','')}')">Mark done</button><button class="v7-inline" onclick="V7_rescheduleTask('${e.id.replace('task-','')}')">Reschedule</button><button class="v7-inline" onclick="V7_cancelTask('${e.id.replace('task-','')}')">Cancel</button>`:''}</div></div>`).join(''):'<p class="v7-empty">No scheduled events. Keep some time open for recovery or choose a task.</p>';
  const free=[];let cursor=8*60;for(const e of events){const s=V7_timeMinutes(e.startTime),end=V7_timeMinutes(e.endTime);if(s>cursor)free.push(`${V7_minTime(cursor)}–${V7_minTime(s)} (${Math.round((s-cursor)/60*10)/10}h free)`);cursor=Math.max(cursor,end);}if(cursor<20*60)free.push(`${V7_minTime(cursor)}–20:00 (${Math.round((20*60-cursor)/60*10)/10}h free)`);
  document.getElementById('v7-free-time').textContent=free.length?free.join(' · '):'No gaps detected in the 08:00–20:00 window.';
  const weekStart=V7_parseDate(date);weekStart.setDate(weekStart.getDate()-((weekStart.getDay()+6)%7));
  document.getElementById('v7-week-grid').innerHTML=Array.from({length:7},(_,i)=>{const d=new Date(weekStart);d.setDate(d.getDate()+i);const k=Utils_dateKey(d),ev=V7_getEvents(k);return `<div class="v7-weekday"><strong>${V7_dayName(d.getDay())}</strong><small>${V7_shortDate(k)}</small>${ev.map(e=>`<button class="v7-week-event" onclick="V7_setAgendaDate('${k}')"><b>${escapeHtml(e.startTime)}</b> ${escapeHtml(e.title)}</button>`).join('')||'<small class="v7-muted">No events</small>'}</div>`}).join('');
  const recurring=document.getElementById('v7-recurring-list');recurring.innerHTML=all.map(e=>{const ex=AppState.timetable.exceptions[date+':'+e.id];return `<div class="v7-list-row"><div><strong>${escapeHtml(V7_dayName(e.dayOfWeek))} · ${escapeHtml(e.title)}</strong><div class="v7-muted">${escapeHtml(e.startTime)}–${escapeHtml(e.endTime)} · ${escapeHtml(e.location||'')}</div></div><span><button class="v7-inline" onclick="V7_editRecurring('${e.id}')">Edit</button>${ex?`<button class="v7-inline" onclick="V7_restoreOccurrence('${date}','${e.id}')">Reset occurrence</button>`:''}</span></div>`}).join('');
}
function V7_minTime(n){return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}
function V7_setAgendaDate(date){document.getElementById('v7-agenda-date').value=date;V7_renderTimetable();}
function V7_restoreOccurrence(date,id){delete AppState.timetable.exceptions[date+':'+id];V7_save();V7_renderTimetable();V7_renderDashboard();App_toast('Recurring class restored for this date');}
function V7_cancelOccurrence(date,id){const master=AppState.timetable.recurring.find(e=>e.id===id);AppState.timetable.exceptions[date+':'+id]={status:'cancelled'};V7_save();V7_renderTimetable();V7_renderDashboard();App_toast('Only this class occurrence was cancelled. The recurring class remains.');if(master&&confirm('The time is now free. Add an optional flexible block for study, gym, an assignment, recovery, or leave it free?')){const choice=prompt('Enter a task or type recovery. Leave blank to keep the time free.','Independent study');if(choice&&choice.trim().toLowerCase()!=='recovery'){AppState.tasks.push({id:V7_uuid('task'),title:choice.trim(),date:date,startTime:master.startTime,endTime:master.endTime,priority:'normal',status:'scheduled',done:false,createdAt:new Date().toISOString()});V7_save();V7_renderTimetable();V7_renderDashboard();}else if(choice&&choice.trim())App_toast('Recovery time left open by choice.');}}
function V7_editOccurrence(date,id){const master=AppState.timetable.recurring.find(e=>e.id===id);if(!master)return;const old=AppState.timetable.exceptions[date+':'+id]||{};const title=prompt('Class title',old.title||master.title);if(title===null)return;const startTime=prompt('Start time (24-hour HH:MM)',old.startTime||master.startTime);if(startTime===null)return;const endTime=prompt('End time (24-hour HH:MM)',old.endTime||master.endTime);if(endTime===null)return;const conflict=V7_eventConflicts(date,startTime,endTime,id);if(conflict)return App_toast(conflict);if(V7_timeMinutes(endTime)<=V7_timeMinutes(startTime))return App_toast('End time must be after start time');AppState.timetable.exceptions[date+':'+id]={...old,title,startTime,endTime,status:'edited'};V7_save();V7_renderTimetable();V7_renderDashboard();}
function V7_editRecurring(id){const e=AppState.timetable.recurring.find(x=>x.id===id);if(!e)return;const title=prompt('Recurring class name',e.title);if(title===null)return;const dayRaw=prompt('Day of week: 0=Sunday, 1=Monday ... 6=Saturday',String(e.dayOfWeek));if(dayRaw===null)return;const dayOfWeek=Number(dayRaw);if(!Number.isInteger(dayOfWeek)||dayOfWeek<0||dayOfWeek>6)return App_toast('Enter a weekday number from 0 to 6');const startTime=prompt('Start time (24-hour HH:MM)',e.startTime);if(startTime===null)return;const endTime=prompt('End time (24-hour HH:MM)',e.endTime);if(endTime===null)return;const location=prompt('Location',e.location||'');if(location===null)return;if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)||V7_timeMinutes(endTime)<=V7_timeMinutes(startTime))return App_toast('Enter valid 24-hour times');const a=V7_timeMinutes(startTime),b=V7_timeMinutes(endTime),conflict=AppState.timetable.recurring.find(x=>x.id!==id&&x.active!==false&&Number(x.dayOfWeek)===dayOfWeek&&a<V7_timeMinutes(x.endTime)&&b>V7_timeMinutes(x.startTime));if(conflict)return App_toast('Overlaps another recurring class: '+conflict.title);const onceConflict=AppState.timetable.oneOff.find(x=>x.status!=='cancelled'&&V7_parseDate(x.date).getDay()===dayOfWeek&&a<V7_timeMinutes(x.endTime)&&b>V7_timeMinutes(x.startTime));if(onceConflict)return App_toast('Overlaps one-off event on '+onceConflict.date+': '+onceConflict.title);const taskConflict=AppState.tasks.find(x=>x.status!=='cancelled'&&!x.done&&x.startTime&&x.endTime&&V7_parseDate(x.date).getDay()===dayOfWeek&&a<V7_timeMinutes(x.endTime)&&b>V7_timeMinutes(x.startTime));if(taskConflict)return App_toast('Overlaps personal block on '+taskConflict.date+': '+taskConflict.title);e.title=title.trim()||e.title;e.dayOfWeek=dayOfWeek;e.startTime=startTime;e.endTime=endTime;e.location=location.trim();V7_save();V7_renderTimetable();V7_renderDashboard();}
function V7_addClass(){const title=document.getElementById('v7-class-title').value.trim(),date=document.getElementById('v7-class-date').value,startTime=document.getElementById('v7-class-start').value,endTime=document.getElementById('v7-class-end').value,location=document.getElementById('v7-class-location').value.trim();if(!title||!date||!startTime||!endTime)return App_toast('Fill in event title, date and times');const conflict=V7_eventConflicts(date,startTime,endTime);if(conflict)return App_toast(conflict);const event={id:V7_uuid('event'),title,date,startTime,endTime,location,kind:'class',status:'scheduled'};AppState.timetable.oneOff.push(event);V7_save();V7_setAgendaDate(date);document.getElementById('v7-class-title').value='';App_toast('One-off class added');}
function V7_cancelOneOff(id){const e=AppState.timetable.oneOff.find(x=>x.id===id);if(e){e.status='cancelled';V7_save();V7_renderTimetable();V7_renderDashboard();}}
function V7_editOneOff(id){const e=AppState.timetable.oneOff.find(x=>x.id===id);if(!e)return;const title=prompt('Event name',e.title);if(title===null)return;const startTime=prompt('Start time',e.startTime);if(startTime===null)return;const endTime=prompt('End time',e.endTime);if(endTime===null)return;const conflict=V7_eventConflicts(e.date,startTime,endTime,id);if(conflict)return App_toast(conflict);e.title=title;e.startTime=startTime;e.endTime=endTime;V7_save();V7_renderTimetable();}
function V7_rescheduleTask(id){const t=AppState.tasks.find(x=>x.id===id);if(!t)return;const date=prompt('New date YYYY-MM-DD',t.date||V7_today());if(date===null)return;if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return App_toast('Use YYYY-MM-DD');const startTime=prompt('New start time HH:MM',t.startTime||'14:00');if(startTime===null)return;const endTime=prompt('New end time HH:MM',t.endTime||'15:00');if(endTime===null)return;const conflict=V7_eventConflicts(date,startTime,endTime,'task-'+id);if(conflict)return App_toast(conflict);t.date=date;t.startTime=startTime;t.endTime=endTime;t.status='scheduled';t.done=false;V7_save();V7_renderTimetable();V7_renderDashboard();}
function V7_cancelTask(id){const t=AppState.tasks.find(x=>x.id===id);if(t){t.status='cancelled';V7_save();V7_renderTimetable();V7_renderDashboard();}}
function V7_markTaskDone(id){const t=AppState.tasks.find(x=>x.id===id);if(t){t.done=true;t.completedAt=new Date().toISOString();V7_save();V7_renderTimetable();V7_renderDashboard();App_toast('Task completed');}}
function V7_addTimeBlock(){const title=document.getElementById('v7-block-title').value.trim(),date=document.getElementById('v7-block-date').value,startTime=document.getElementById('v7-block-start').value,endTime=document.getElementById('v7-block-end').value,priority=document.getElementById('v7-block-priority').value;if(!title||!date||!startTime||!endTime)return App_toast('Fill in task, date and times');const conflict=V7_eventConflicts(date,startTime,endTime);if(conflict)return App_toast(conflict);AppState.tasks.push({id:V7_uuid('task'),title,date,startTime,endTime,priority,status:'scheduled',done:false,createdAt:new Date().toISOString()});V7_save();V7_setAgendaDate(date);document.getElementById('v7-block-title').value='';App_toast('Time block scheduled');}
function V7_renderFitness(){
  const dayHost=document.getElementById('v7-training-days');if(dayHost){const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];dayHost.innerHTML=days.map(d=>`<label><input type="checkbox" value="${d}" ${(AppState.profile.trainingDays||[]).includes(d)?'checked':''}> ${d.slice(0,3)}</label>`).join('');}
  const workouts=AppState.fitness.workouts||[],today=V7_today(),start=V7_currentWeek(),end=V7_parseDate(start);end.setDate(end.getDate()+6);const endKey=Utils_dateKey(end);const week=workouts.filter(w=>w.date>=start&&w.date<=endKey&&w.status==='completed');
  const gymTarget=Number(AppState.profile.gymTarget??4);document.getElementById('v7-gym-week').textContent=`${week.length} / ${gymTarget} sessions this week`;
  document.getElementById('v7-gym-bar').style.width=gymTarget>0?Math.min(100,week.length/gymTarget*100)+'%':'0%';
  document.getElementById('v7-workout-history').innerHTML=workouts.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,12).map(w=>`<div class="v7-workout"><div class="v7-list-row"><div><strong>${escapeHtml(w.template||'Workout')} · ${escapeHtml(w.date)}</strong><div class="v7-muted">${Number(w.durationMinutes||0)} min · ${escapeHtml(w.status||'completed')}</div></div><span><button class="v7-inline" onclick="V7_setWorkoutStatus('${w.id}','rescheduled')">Reschedule</button><button class="v7-inline" onclick="V7_setWorkoutStatus('${w.id}','skipped')">Skip</button></span></div>${(w.exercises||[]).map(e=>`<div class="v7-exercise">${escapeHtml(e.name)} · ${e.sets}×${escapeHtml(e.reps)}${e.weight!==''?` · ${escapeHtml(e.weight)} kg`:''}${e.restSeconds?` · rest ${escapeHtml(e.restSeconds)}s`:''}</div>`).join('')}${w.notes?`<p class="v7-muted">${escapeHtml(w.notes)}</p>`:''}</div>`).join('')||'<p class="v7-empty">No workouts logged yet. Rest days are valid and are not counted as missed sessions.</p>';
  const byTemplate={};workouts.filter(w=>w.status==='completed').sort((a,b)=>String(a.date).localeCompare(String(b.date))).forEach(w=>{byTemplate[w.template]=byTemplate[w.template]||[];byTemplate[w.template].push(w);});const progressHost=document.getElementById('v7-progressive-overload');if(progressHost){const rows=Object.entries(byTemplate).filter(([k,v])=>v.length>=2).map(([name,arr])=>{const prev=arr[arr.length-2],last=arr[arr.length-1],volume=w=>{let n=0,valid=false;for(const e of w.exercises){const reps=String(e.reps||'').trim(),weight=String(e.weight||'').trim();if(/^\d+(?:\.\d+)?$/.test(reps)&&/^\d+(?:\.\d+)?$/.test(weight)){n+=(Number(e.sets)||0)*Number(reps)*Number(weight);valid=true;}}return valid?n:null;},a=volume(prev),b=volume(last);return `<div class="v7-list-row"><div><strong>${escapeHtml(name)}</strong><small>${escapeHtml(prev.date)} → ${escapeHtml(last.date)}</small></div><span>${a===null||b===null?'Enter exact reps and weight to compare':`${a.toFixed(0)} → ${b.toFixed(0)} kg-reps`}</span></div>`;});progressHost.innerHTML=rows.join('')||'<p class="v7-empty">Log the same template twice to compare recorded exercises. Exact numeric reps and weight are needed for kg-rep volume.</p>'; }const weekSets=week.reduce((n,w)=>n+(w.exercises||[]).reduce((a,e)=>a+(Number(e.sets)||0),0),0);const setsEl=document.getElementById('v7-gym-volume');if(setsEl)setsEl.textContent=`${weekSets} sets recorded this week`;
  V7_renderNutrition();const metrics=AppState.fitness.bodyMetrics||[];const trendHost=document.getElementById('v7-body-trend'),weights=metrics.filter(m=>Number(m.weightKg)>0).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));if(trendHost)trendHost.textContent=weights.length>=2?`Recorded weight: ${weights[0].weightKg} kg (${weights[0].date}) → ${weights[weights.length-1].weightKg} kg (${weights[weights.length-1].date}); change ${(Number(weights[weights.length-1].weightKg)-Number(weights[0].weightKg)>0?'+':'')+(Number(weights[weights.length-1].weightKg)-Number(weights[0].weightKg)).toFixed(1)} kg.`:weights.length===1?`Latest recorded weight: ${weights[0].weightKg} kg on ${weights[0].date}. Add another measurement to compare.`:'No body-weight trend yet; weight logging is optional.';document.getElementById('v7-body-history').innerHTML=metrics.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,8).map(m=>`<div class="v7-list-row"><strong>${escapeHtml(m.date)}</strong><span>${m.weightKg!==''?escapeHtml(m.weightKg)+' kg':'Weight not entered'}${m.waistCm?` · Waist ${escapeHtml(m.waistCm)} cm`:''}${V7_safeExternalUrl(m.photoRef)?` · <a href="${escapeHtml(V7_safeExternalUrl(m.photoRef))}" target="_blank" rel="noopener noreferrer">Photo reference</a>`:''}</span></div>`).join('')||'<p class="v7-empty">Body measurements are optional. Add a measurement when useful.</p>';
}
function V7_saveTrainingDays(){const days=[...document.querySelectorAll('#v7-training-days input:checked')].map(x=>x.value);if(days.length!==Number(AppState.profile.gymTarget??4))return App_toast(`Choose exactly ${AppState.profile.gymTarget} training days, or update the weekly target in Settings.`);AppState.profile.trainingDays=days;V7_save();App_toast('Training days saved');}
function V7_loadWorkoutTemplate(){const template=document.getElementById('v7-workout-template').value,items=AppState.fitness.templates[template]||[];if(!items.length)return App_toast('Choose a built-in split template');document.getElementById('v7-workout-exercises').value=items.map(e=>[e.name,e.sets,e.reps,e.weight||'',e.restSeconds||''].join(' | ')).join('\n');}
function V7_addWorkout(){const template=document.getElementById('v7-workout-template').value,date=document.getElementById('v7-workout-date').value||V7_today(),durationMinutes=Math.max(0,Math.round(Number(document.getElementById('v7-workout-duration').value)||0)),raw=document.getElementById('v7-workout-exercises').value,notes=document.getElementById('v7-workout-notes').value.trim();const exercises=raw.split('\n').map(line=>line.trim()).filter(Boolean).map(line=>{const [name,sets,reps,weight,restSeconds]=line.split('|').map(x=>x.trim());return {name:name||'Exercise',sets:Math.max(0,Number(sets)||0),reps:reps||'',weight:weight||'',restSeconds:restSeconds||'',notes:''};});if(!exercises.length)return App_toast('Add at least one exercise line');AppState.fitness.workouts.push({id:V7_uuid('workout'),template,date,durationMinutes,exercises,notes,status:'completed',createdAt:new Date().toISOString()});const day=Storage_loadDay(date);day.habits.workout=true;Storage_saveDay(date,{habits:day.habits});V7_save();document.getElementById('v7-workout-exercises').value='';document.getElementById('v7-workout-notes').value='';V7_renderFitness();V7_renderDashboard();App_toast('Workout saved');}
function V7_setWorkoutStatus(id,status){const w=AppState.fitness.workouts.find(x=>x.id===id);if(!w)return;let reason='';if(status!=='completed'){const response=prompt(status==='rescheduled'?'Optional rescheduling note':'Optional reason for skipping',w.reason||'');reason=response===null?(w.reason||''):response;}w.status=status;w.reason=reason;const otherCompleted=AppState.fitness.workouts.some(x=>x.id!==id&&x.date===w.date&&x.status==='completed');if(status!=='completed'&&!otherCompleted){const rec=Storage_loadDay(w.date);rec.habits.workout=false;Storage_saveDay(w.date,{habits:rec.habits});}else if(status==='completed'){const rec=Storage_loadDay(w.date);rec.habits.workout=true;Storage_saveDay(w.date,{habits:rec.habits});}V7_save();V7_renderFitness();V7_renderDashboard();}
function V7_addBodyMetric(){const date=document.getElementById('v7-body-date').value||V7_today(),weightKg=document.getElementById('v7-body-weight').value,waistCm=document.getElementById('v7-body-waist').value,notes=document.getElementById('v7-body-notes').value.trim(),photoRef=document.getElementById('v7-body-photo').value.trim();if(weightKg===''&&waistCm==='')return App_toast('Enter weight or a measurement');if((weightKg!==''&&Number(weightKg)<=0)||(waistCm!==''&&Number(waistCm)<=0))return App_toast('Measurements must be greater than zero');AppState.fitness.bodyMetrics.push({id:V7_uuid('body'),date,weightKg:weightKg===''?'':Number(weightKg),waistCm:waistCm===''?'':Number(waistCm),notes,photoRef});V7_save();V7_renderFitness();App_toast('Measurement saved');}
function V7_renderNutrition(){const host=document.getElementById('v7-nutrition-history');if(!host)return;host.innerHTML=AppState.fitness.nutrition.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,8).map(n=>`<div class="v7-list-row"><div><strong>${escapeHtml(n.date)}</strong><small>${n.proteinGrams===null?'Protein not entered':escapeHtml(n.proteinGrams)+'g protein'} · ${n.waterLitres===null?'Water not entered':escapeHtml(n.waterLitres)+'L water'}${n.meal?' · '+escapeHtml(n.meal):''}</small></div></div>`).join('')||'<p class="v7-empty">No nutrition entries saved.</p>'; }
function V7_addNutrition(){const date=V7_today(),proteinGrams=document.getElementById('v7-protein-grams').value,waterLitres=document.getElementById('v7-water-litres').value,meal=document.getElementById('v7-meal-note').value.trim();if(proteinGrams===''&&waterLitres===''&&!meal)return App_toast('Enter protein, water or a meal note');if((proteinGrams!==''&&Number(proteinGrams)<0)||(waterLitres!==''&&Number(waterLitres)<0))return App_toast('Nutrition values cannot be negative');AppState.fitness.nutrition.push({id:V7_uuid('nutrition'),date,proteinGrams:proteinGrams===''?null:Number(proteinGrams),waterLitres:waterLitres===''?null:Number(waterLitres),meal,createdAt:new Date().toISOString()});V7_save();V7_renderNutrition();App_toast('Nutrition entry saved');}
function V7_renderPhone(){
  const active=AppState.phone.activeFocus,el=document.getElementById('v7-focus-timer');if(el)el.textContent=active?V7_formatElapsed(Date.now()-new Date(active.startedAt).getTime()):'00:00:00';const btn=document.getElementById('v7-focus-toggle');if(btn)btn.textContent=active?'End phone-free session':'Start phone-free session';
  const logs=(AppState.phone.screenLogs||[]).filter(x=>x.date===V7_today()),mins=logs.reduce((n,x)=>n+Number(x.minutes||0),0),legacy=Storage_loadDay(V7_today()).screenHours;document.getElementById('v7-phone-today').textContent=logs.length?`${(mins/60).toFixed(1)} manually recorded hours today`:legacy>0?`${legacy}h from the legacy daily tracker; source was not separately tagged`:'No phone-use data recorded today';
  const sessions=(AppState.phone.sessions||[]).slice().sort((a,b)=>String(b.startedAt).localeCompare(String(a.startedAt))).slice(0,10);document.getElementById('v7-focus-history').innerHTML=sessions.map(s=>`<div class="v7-list-row"><div><strong>${escapeHtml(s.label||'Phone-free focus')}</strong><small>${escapeHtml(s.date||'')}</small></div><span>${s.durationMinutes} min</span></div>`).join('')||'<p class="v7-empty">No focus sessions yet.</p>';
  const triggers=AppState.phone.distractionLogs.slice().sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,8);const triggerHost=document.getElementById('v7-distraction-history');if(triggerHost)triggerHost.innerHTML=triggers.map(t=>`<div class="v7-list-row"><div><strong>${escapeHtml(t.trigger)}</strong><small>${escapeHtml(t.date)} · ${escapeHtml(t.replacement||'No replacement entered')}</small></div></div>`).join('')||'<p class="v7-empty">No scrolling triggers recorded.</p>';
  const rule=AppState.phone.rules;document.getElementById('v7-phone-cutoff').value=rule.eveningCutoff||AppState.profile.phoneCutoff||'21:30';document.getElementById('v7-social-limit').value=rule.socialMediaLimitMinutes??'';document.getElementById('v7-phone-target').value=AppState.profile.phoneTargetMinutes??'';const morning=document.getElementById('v7-phone-morning-rule'),outside=document.getElementById('v7-phone-study-rule'),blocklist=document.getElementById('v7-phone-blocklist');if(morning)morning.checked=!!rule.morningPhoneFree;if(outside)outside.checked=!!rule.phoneOutsideStudy;if(blocklist)blocklist.value=(rule.blocklist||[]).join('\n');
  const day=Storage_loadDay(V7_today()),todayLog=logs[0];document.getElementById('v7-screen-hours').value=todayLog?String((Number(todayLog.minutes||0)/60).toFixed(1)):(day.screenHours>0?day.screenHours:'');
}
function V7_toggleFocus(){if(AppState.phone.activeFocus){const a=AppState.phone.activeFocus,end=Date.now(),elapsed=Math.max(1,Math.floor((end-new Date(a.startedAt).getTime())/60000));let mins=elapsed;if(elapsed>240){const corrected=prompt(`Focus timer elapsed ${elapsed} minutes. Enter actual phone-free minutes (1–240).`,'60');if(corrected===null)return;mins=Math.round(Number(corrected));if(!Number.isFinite(mins)||mins<1||mins>240)return App_toast('Enter actual focused minutes from 1 to 240');}AppState.phone.sessions.push({id:a.id,startedAt:a.startedAt,endedAt:new Date(end).toISOString(),date:a.date,durationMinutes:mins,label:a.label||'Phone-free focus'});AppState.phone.activeFocus=null;if(V7_focusInterval){clearInterval(V7_focusInterval);V7_focusInterval=null;}V7_save();App_toast(`Logged ${mins} phone-free minutes`);}else{AppState.phone.activeFocus={id:V7_uuid('focus'),startedAt:new Date().toISOString(),date:V7_today(),label:document.getElementById('v7-focus-label').value.trim()||'Phone-free focus'};V7_save();V7_focusInterval=setInterval(()=>{if(V7_systemTab==='phone')V7_renderPhone();},1000);App_toast('Focus started. Birtat cannot block other Android apps.');}V7_renderPhone();V7_renderDashboard();}
function V7_logDistraction(){const trigger=document.getElementById('v7-distraction-trigger').value,detail=document.getElementById('v7-distraction-detail').value.trim(),replacement=document.getElementById('v7-distraction-replacement').value;if(!trigger)return App_toast('Choose a scrolling trigger');AppState.phone.distractionLogs.push({id:V7_uuid('trigger'),date:V7_today(),trigger,detail,replacement,createdAt:new Date().toISOString()});V7_save();document.getElementById('v7-distraction-detail').value='';V7_renderPhone();App_toast('Trigger recorded');}
function V7_logScreenTime(){const raw=document.getElementById('v7-screen-hours').value;if(raw.trim()==='')return App_toast('Enter screen time, including 0 if appropriate');const hours=Number(raw);if(!Number.isFinite(hours)||hours<0||hours>24)return App_toast('Enter screen time from 0 to 24 hours');const date=V7_today(),minutes=Math.round(hours*60);AppState.phone.screenLogs=AppState.phone.screenLogs.filter(x=>x.date!==date);AppState.phone.screenLogs.push({id:V7_uuid('screen'),date,minutes,source:'manual',createdAt:new Date().toISOString()});Storage_saveDay(date,{screenHours:Math.round(hours)});V7_save();V7_renderPhone();V7_renderDashboard();App_toast('Manual screen-time entry saved');}
function V7_savePhoneRules(){const cutoff=document.getElementById('v7-phone-cutoff').value||'21:30',limit=document.getElementById('v7-social-limit').value,target=document.getElementById('v7-phone-target').value;AppState.phone.rules.eveningCutoff=cutoff;AppState.phone.rules.socialMediaLimitMinutes=limit===''?null:Math.max(0,Number(limit));AppState.phone.rules.morningPhoneFree=document.getElementById('v7-phone-morning-rule').checked;AppState.phone.rules.phoneOutsideStudy=document.getElementById('v7-phone-study-rule').checked;AppState.phone.rules.blocklist=document.getElementById('v7-phone-blocklist').value.split('\n').map(x=>x.trim()).filter(Boolean);AppState.profile.phoneCutoff=cutoff;AppState.profile.phoneTargetMinutes=target===''?null:Math.max(0,Number(target));V7_save();App_toast('Phone rules saved');}
function V7_renderPersonal(){
  const readingSelect=document.getElementById('v7-reading-book');if(readingSelect){const previous=readingSelect.value;readingSelect.innerHTML='<option value="">General reading</option>'+AppState.personal.books.map(b=>`<option value="${b.id}">${escapeHtml(b.title)}</option>`).join('');if(AppState.personal.books.some(b=>b.id===previous))readingSelect.value=previous;}
  document.getElementById('v7-book-list').innerHTML=AppState.personal.books.map(b=>`<div class="v7-list-row"><div><strong>${escapeHtml(b.title)}</strong><small>${escapeHtml(b.author||'Author not entered')} · ${escapeHtml(b.status||'reading')}${b.totalPages?` · ${b.currentPage||0}/${b.totalPages} pages`:''}</small></div><button class="v7-inline" onclick="V7_updateBook('${b.id}')">Update</button></div>`).join('')||'<p class="v7-empty">Add a book when you start reading.</p>';
  document.getElementById('v7-goal-list').innerHTML=AppState.personal.goals.map(g=>`<div class="v7-list-row"><div><strong>${escapeHtml(g.title)}</strong><small>${escapeHtml(g.status||'active')}${g.deadline?' · due '+escapeHtml(g.deadline):''}</small>${g.nextAction?`<div class="v7-muted">Next: ${escapeHtml(g.nextAction)}</div>`:''}</div><button class="v7-inline" onclick="V7_updateGoal('${g.id}')">Update</button></div>`).join('')||'<p class="v7-empty">No future-skill goals yet.</p>';
  document.getElementById('v7-family-list').innerHTML=AppState.personal.familyCommitments.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))).map(f=>`<div class="v7-list-row"><div><strong>${escapeHtml(f.title)}</strong><small>${escapeHtml(f.date||'Flexible')} ${f.done?'· completed':''}</small></div><label class="v7-check"><input type="checkbox" ${f.done?'checked':''} onchange="V7_toggleFamily('${f.id}',this.checked)"><span>Done</span></label></div>`).join('')||'<p class="v7-empty">Add family time or important commitments when useful.</p>';
  document.getElementById('v7-reading-history').innerHTML=AppState.personal.readingSessions.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,8).map(r=>`<div class="v7-list-row"><div><strong>${escapeHtml(r.bookTitle||'Reading')}</strong><small>${escapeHtml(r.date)} · ${r.minutes} min${r.pages?` · page ${r.pages}`:''}</small>${r.note?`<div class="v7-muted">${escapeHtml(r.note)}</div>`:''}</div></div>`).join('')||'<p class="v7-empty">Reading sessions appear here.</p>';
}
function V7_addBook(){const title=document.getElementById('v7-book-title').value.trim(),author=document.getElementById('v7-book-author').value.trim(),totalPages=Number(document.getElementById('v7-book-pages').value)||0;if(!title)return App_toast('Enter a book title');AppState.personal.books.push({id:V7_uuid('book'),title,author,totalPages,currentPage:0,status:'reading',notes:'',createdAt:new Date().toISOString()});V7_save();V7_renderPersonal();}
function V7_updateBook(id){const b=AppState.personal.books.find(x=>x.id===id);if(!b)return;const page=prompt('Current page',String(b.currentPage||0));if(page===null)return;const status=prompt('Status: reading, paused, finished',b.status||'reading');if(status===null)return;b.currentPage=Math.max(0,Number(page)||0);b.status=status;b.updatedAt=new Date().toISOString();V7_save();V7_renderPersonal();}
function V7_logReading(){const bookId=document.getElementById('v7-reading-book').value,minutes=Math.max(0,Math.round(Number(document.getElementById('v7-reading-minutes').value)||0)),pages=document.getElementById('v7-reading-pages').value,note=document.getElementById('v7-reading-note').value.trim();if(minutes<1)return App_toast('Enter reading minutes');const b=AppState.personal.books.find(x=>x.id===bookId);AppState.personal.readingSessions.push({id:V7_uuid('reading'),date:V7_today(),bookId:bookId||'',bookTitle:b?.title||'General reading',minutes,pages:pages===''?'':Number(pages),note,createdAt:new Date().toISOString()});if(b&&pages!=='')b.currentPage=Math.max(b.currentPage||0,Number(pages)||0);V7_save();V7_renderPersonal();App_toast('Reading session saved');}
function V7_addGoal(){const title=document.getElementById('v7-goal-title').value.trim(),nextAction=document.getElementById('v7-goal-next').value.trim(),deadline=document.getElementById('v7-goal-deadline').value;if(!title)return App_toast('Enter a goal outcome');AppState.personal.goals.push({id:V7_uuid('goal'),title,nextAction,deadline,status:'active',createdAt:new Date().toISOString()});V7_save();V7_renderPersonal();}
function V7_updateGoal(id){const g=AppState.personal.goals.find(x=>x.id===id);if(!g)return;const next=prompt('Next action',g.nextAction||'');if(next===null)return;const status=prompt('Status: active, paused, completed',g.status||'active');if(status===null)return;g.nextAction=next;g.status=status;V7_save();V7_renderPersonal();}
function V7_addFamily(){const title=document.getElementById('v7-family-title').value.trim(),date=document.getElementById('v7-family-date').value;if(!title)return App_toast('Enter a commitment');AppState.personal.familyCommitments.push({id:V7_uuid('family'),title,date,done:false});V7_save();V7_renderPersonal();}
function V7_toggleFamily(id,done){const f=AppState.personal.familyCommitments.find(x=>x.id===id);if(f){f.done=!!done;V7_save();V7_renderPersonal();}}
function V7_renderSettings(){const p=AppState.profile;const backupButton=document.getElementById('v7-prebackup-btn');if(backupButton)backupButton.hidden=!localStorage.getItem('birtat-v4-pre-v7-backup');document.getElementById('v7-setting-review-day').value=String(p.weeklyReviewDay??0);document.getElementById('v7-setting-name').value=p.name||'Dagim';document.getElementById('v7-setting-wake').value=p.wakeTime||'06:00';document.getElementById('v7-setting-bed').value=p.bedtime||'22:00';document.getElementById('v7-setting-study').value=p.studyTargetMinutes??180;document.getElementById('v7-setting-gym').value=p.gymTarget??4;document.getElementById('v7-setting-phone').value=p.phoneTargetMinutes??'';document.getElementById('v7-setting-cutoff').value=p.phoneCutoff||'21:30';document.getElementById('v7-setting-zone').value=p.timeZone||'local';}
function V7_downloadPreMigrationBackup(){const raw=localStorage.getItem('birtat-v4-pre-v7-backup');if(!raw)return App_toast('No pre-V7 snapshot is available on this device');const blob=new Blob([raw],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='birtat-pre-v7-backup.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function V7_saveSettings(){const p=AppState.profile;p.name=document.getElementById('v7-setting-name').value.trim()||'Dagim';p.wakeTime=document.getElementById('v7-setting-wake').value||'06:00';p.bedtime=document.getElementById('v7-setting-bed').value||'22:00';p.studyTargetMinutes=Math.max(0,Number(document.getElementById('v7-setting-study').value)||0);p.gymTarget=Math.max(0,Number(document.getElementById('v7-setting-gym').value)||0);const phone=document.getElementById('v7-setting-phone').value;p.phoneTargetMinutes=phone===''?null:Math.max(0,Number(phone));p.phoneCutoff=document.getElementById('v7-setting-cutoff').value||'21:30';const requestedZone=document.getElementById('v7-setting-zone').value.trim()||Intl.DateTimeFormat().resolvedOptions().timeZone;try{new Intl.DateTimeFormat('en-US',{timeZone:requestedZone}).format(new Date());p.timeZone=requestedZone;}catch(e){p.timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone;document.getElementById('v7-setting-zone').value=p.timeZone;return App_toast('Invalid time zone. Device time zone restored.');}p.weeklyReviewDay=clamp(Number(document.getElementById('v7-setting-review-day').value)||0,0,6);AppState.phone.rules.eveningCutoff=p.phoneCutoff;Today_viewDate=Utils_today();const zoneToday=V7_parseDate(V7_today());Cal_year=zoneToday.getFullYear();Cal_month=zoneToday.getMonth();V7_save();V7_renderDashboard();App_toast('Personal settings saved');}
function V7_renderDashboard(){
  const root=document.getElementById('v7-dashboard');if(!root)return;const heroName=document.querySelector('.hero-name');if(heroName)heroName.textContent=(AppState.profile.name||'Dagim')+' ✦';const date=V7_today(),events=V7_getEvents(date),day=Storage_loadDay(date),faith=V7_getFaith(date),mins=(AppState.academic.sessions||[]).filter(s=>s.date===date).reduce((n,s)=>n+Number(s.durationMinutes||0),0),start=V7_currentWeek(),end=V7_parseDate(start);end.setDate(end.getDate()+6);const endKey=Utils_dateKey(end),weekWorkouts=AppState.fitness.workouts.filter(w=>w.date>=start&&w.date<=endKey&&w.status==='completed'),todayScreen=AppState.phone.screenLogs.filter(x=>x.date===date).reduce((n,x)=>n+Number(x.minutes||0),0),legacyScreen=Number(day.screenHours||0),target=Number(AppState.profile.studyTargetMinutes??180),doneAssignments=AppState.academic.courses.flatMap(c=>c.assignments||[]).filter(a=>a.done).length,openAssignments=AppState.academic.courses.flatMap(c=>c.assignments||[]).filter(a=>!a.done).length;
  const priorityHtml=[['✝️','Faith',Object.values(faith).filter(Boolean).length+' commitments recorded'],['🎓','Academics',`${Math.floor(mins/60)}h ${mins%60}m / ${Math.floor(target/60)}h focused study`],['🏋️','Physique',`${weekWorkouts.length} / ${AppState.profile.gymTarget} workouts this week`],['👪','Family & future',`${AppState.personal.readingSessions.filter(r=>r.date===date).length} reading sessions · ${AppState.personal.familyCommitments.filter(f=>f.date===date&&!f.done).length} family commitments today`]];
  document.getElementById('v7-priorities').innerHTML=priorityHtml.map(([icon,name,summary])=>`<div class="v7-priority"><span>${icon}</span><div><strong>${name}</strong><small>${escapeHtml(summary)}</small></div></div>`).join('');
  document.getElementById('v7-plan-advice').textContent=(events.length>=5?'Heavy schedule: protect essential faith practice, meals, sleep and recovery. Move low-priority work rather than pushing everything late.':'Keep the next action clear and leave some unallocated time for recovery or unexpected changes.')+` Sleep target: ${AppState.profile.bedtime||'22:00'} · wake ${AppState.profile.wakeTime||'06:00'}.`;
  const classEvents=events.filter(e=>e.kind==='class'||/class|lecture|lab|workshop|ceed|biochemistry|electromagnetic|bio-fluid|inclusiveness|electronics|data structures/i.test(e.title));
  const classHost=document.getElementById('v7-home-classes');
  if(classHost) classHost.innerHTML=classEvents.length?classEvents.map(e=>`<div class="v7-home-event"><span class="v7-home-event-time">${escapeHtml(e.startTime)}<small>${escapeHtml(e.endTime)}</small></span><span class="v7-home-event-line"></span><span class="v7-home-event-main"><strong>${escapeHtml(e.title)}</strong><small>${escapeHtml(e.location||'Class / scheduled session')}</small></span></div>`).join(''):'<div class="v7-home-empty"><span>☀️</span><strong>No classes scheduled today</strong><small>Use the open space for focused study or recovery.</small></div>';
  const gymHost=document.getElementById('v7-home-gym');
  if(gymHost){
    const dayName=V7_dayName(V7_parseDate(date).getDay()),trainingDays=(AppState.profile.trainingDays||[]).slice().sort((a,b)=>['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].indexOf(a)-['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].indexOf(b));
    const planned=trainingDays.includes(dayName),completed=AppState.fitness.workouts.some(w=>w.date===date&&w.status==='completed');
    const split=['Upper A','Lower A','Upper B','Lower B'];
    const splitName=planned?split[Math.max(0,trainingDays.indexOf(dayName))%split.length]:'Rest & recovery';
    gymHost.innerHTML=completed?`<div class="v7-gym-status is-done"><span class="v7-gym-mark">✓</span><div><strong>Workout completed</strong><small>Great work. Recovery is part of progress.</small></div></div>`:planned?`<div class="v7-gym-status is-training"><span class="v7-gym-mark">✦</span><div><strong>${escapeHtml(splitName)} day</strong><small>Today is one of your planned ${AppState.profile.gymTarget||4} weekly sessions.</small></div></div><button class="v7-gym-cta" onclick="App_nav('systems');V7_openSystemTab('fitness')">Open today's workout <span>→</span></button>`:`<div class="v7-gym-status is-rest"><span class="v7-gym-mark">☾</span><div><strong>Rest & recovery day</strong><small>No gym session planned today. Eat well, hydrate, and recover.</small></div></div>`;
  }
  const hasMorning=events.some(e=>V7_timeMinutes(e.startTime)<12*60),hasAfternoon=events.some(e=>V7_timeMinutes(e.startTime)>=12*60);document.getElementById('v7-day-mode').textContent=hasMorning?'Morning classes':hasAfternoon?'Afternoon classes':'A lighter day';
  const next=events.find(e=>V7_timeMinutes(e.endTime)>V7_timeMinutes(V7_nowTime()));document.getElementById('v7-next-task').textContent=next?`${next.title} · ${next.startTime}–${next.endTime}`:'Your schedule is clear';
  document.getElementById('v7-study-progress').textContent=`${mins} / ${target} focused minutes`;document.getElementById('v7-study-progress-bar').style.width=Math.min(100,mins/Math.max(1,target)*100)+'%';document.getElementById('v7-gym-progress').textContent=`${weekWorkouts.length} / ${AppState.profile.gymTarget} sessions`;document.getElementById('v7-phone-progress').textContent=todayScreen?`${(todayScreen/60).toFixed(1)} h manually logged`:legacyScreen?`${legacyScreen} h legacy tracker entry`:'Not recorded';document.getElementById('v7-task-progress').textContent=`${doneAssignments} completed · ${openAssignments} open academic tasks`;
  const review=AppState.dailyReviews[date],weeklyDay=Number(AppState.profile.weeklyReviewDay??0);document.getElementById('v7-review-status').textContent=review?.savedAt?'Evening review saved':V7_parseDate(date).getDay()===weeklyDay?'Evening review not recorded · weekly review due today':'Evening review not recorded';
}
function V7_saveDailyReview(){const date=V7_today();AppState.dailyReviews[date]={faith:document.getElementById('v7-review-faith').value,study:document.getElementById('v7-review-study').value,physique:document.getElementById('v7-review-physique').value,phone:document.getElementById('v7-review-phone').value,accomplishment:document.getElementById('v7-review-win').value,obstacle:document.getElementById('v7-review-obstacle').value,adjustment:document.getElementById('v7-review-adjustment').value,savedAt:new Date().toISOString()};V7_save();V7_renderDashboard();App_toast('Evening review saved');}
function V7_renderDailyReview(){const r=AppState.dailyReviews[V7_today()]||{};[['faith','v7-review-faith'],['study','v7-review-study'],['physique','v7-review-physique'],['phone','v7-review-phone'],['accomplishment','v7-review-win'],['obstacle','v7-review-obstacle'],['adjustment','v7-review-adjustment']].forEach(([k,id])=>{const e=document.getElementById(id);if(e)e.value=r[k]||'';});}
function V7_renderWeeklyReview(){const start=V7_currentWeek(),key=start;const end=V7_parseDate(start);end.setDate(end.getDate()+6);const endKey=Utils_dateKey(end),sessions=AppState.academic.sessions.filter(s=>s.date>=start&&s.date<=endKey),mins=sessions.reduce((n,s)=>n+Number(s.durationMinutes||0),0),workouts=AppState.fitness.workouts.filter(w=>w.date>=start&&w.date<=endKey&&w.status==='completed').length,phone=AppState.phone.screenLogs.filter(x=>x.date>=start&&x.date<=endKey),phoneMins=phone.reduce((n,x)=>n+Number(x.minutes||0),0),reading=AppState.personal.readingSessions.filter(r=>r.date>=start&&r.date<=endKey).reduce((n,r)=>n+Number(r.minutes||0),0),faithDays=Object.entries(AppState.faith.logs).filter(([d,l])=>d>=start&&d<=endKey&&Object.values(l||{}).some(Boolean)).length,assignments=AppState.academic.courses.flatMap(c=>c.assignments||[]).filter(a=>a.completedAt&&a.completedAt.slice(0,10)>=start&&a.completedAt.slice(0,10)<=endKey).length,family=AppState.personal.familyCommitments.filter(f=>f.date>=start&&f.date<=endKey&&f.done).length,sleepRecords=Object.entries(AppState.days).filter(([d,r])=>d>=start&&d<=endKey&&Number(r.sleepHours)>0),sleepAvg=sleepRecords.length?sleepRecords.reduce((n,[d,r])=>n+Number(r.sleepHours),0)/sleepRecords.length:null,reviews=AppState.weeklyReviews[key]||{};
  const zoneToday=V7_parseDate(V7_today()),monthStart=Utils_dateKey(new Date(zoneToday.getFullYear(),zoneToday.getMonth(),1,12)),monthStudy=AppState.academic.sessions.filter(s=>s.date>=monthStart&&s.date<=V7_today()).reduce((n,s)=>n+Number(s.durationMinutes||0),0),monthGym=AppState.fitness.workouts.filter(w=>w.date>=monthStart&&w.date<=V7_today()&&w.status==='completed').length,monthRead=AppState.personal.readingSessions.filter(r=>r.date>=monthStart&&r.date<=V7_today()).reduce((n,r)=>n+Number(r.minutes||0),0);
  document.getElementById('v7-weekly-evidence').innerHTML=`<div class="v7-metric-grid"><div><strong>${(mins/60).toFixed(1)}h</strong><small>Independent study</small></div><div><strong>${workouts}/${AppState.profile.gymTarget}</strong><small>Gym sessions</small></div><div><strong>${phone.length?(phoneMins/60).toFixed(1)+'h':'—'}</strong><small>Manual screen time</small></div><div><strong>${reading}m</strong><small>Reading</small></div><div><strong>${faithDays}/7</strong><small>Days with faith records</small></div><div><strong>${assignments}</strong><small>Academic tasks completed</small></div><div><strong>${family}</strong><small>Family commitments done</small></div><div><strong>${sleepAvg===null?'—':sleepAvg.toFixed(1)+'h'}</strong><small>Average recorded sleep</small></div></div><p class="v7-muted">Month to date (${monthStart} to ${V7_today()}): ${(monthStudy/60).toFixed(1)}h study · ${monthGym} gym sessions · ${monthRead}m reading.</p><p class="v7-muted">Data window: ${start} to ${endKey}. Phone-use totals are manual entries only. Sleep and screen time are shown as missing when not entered. Faith count means days with a record, not a rating of faith.</p>`;
  document.getElementById('v7-weekly-priority').value=reviews.priority||'';document.getElementById('v7-weekly-notes').value=reviews.notes||'';document.getElementById('v7-weekly-course').value=reviews.courseFocus||'';document.getElementById('v7-weekly-status').textContent=`Review day: ${V7_dayName(Number(AppState.profile.weeklyReviewDay??0))} · ${reviews.savedAt?'Review saved':'Review not saved'}`;
}
function V7_saveWeeklyReview(){const key=V7_currentWeek();AppState.weeklyReviews[key]={priority:document.getElementById('v7-weekly-priority').value,notes:document.getElementById('v7-weekly-notes').value,courseFocus:document.getElementById('v7-weekly-course').value,savedAt:new Date().toISOString()};V7_save();V7_renderWeeklyReview();App_toast('Weekly review saved');}
function V7_addQuickTask(){const title=prompt('What is the next concrete task?');if(!title||!title.trim())return;AppState.tasks.push({id:V7_uuid('task'),title:title.trim(),date:V7_today(),priority:'normal',status:'open',done:false,createdAt:new Date().toISOString()});V7_save();V7_renderDashboard();App_toast('Task added');}
function V7_initInputs(){['v7-agenda-date','v7-class-date','v7-block-date','v7-workout-date','v7-body-date'].forEach(id=>{const e=document.getElementById(id);if(e&&!e.value)e.value=V7_today();});const s=document.getElementById('v7-reading-book');if(s)s.innerHTML='<option value="">General reading</option>'+AppState.personal.books.map(b=>`<option value="${b.id}">${escapeHtml(b.title)}</option>`).join('');const r=document.getElementById('v7-resource-course');if(r)r.innerHTML=AppState.academic.courses.map(c=>`<option value="${c.id}">${escapeHtml(c.short)}</option>`).join('');V7_renderDailyReview();V7_renderWeeklyReview();V7_renderDashboard();}

function V7_habitScheduled(h,date){const d=V7_parseDate(date),dow=d.getDay();if(date<(h.startDate||'0000-01-01')||(h.endDate&&date>h.endDate))return false;if(h.retiredAt&&date>=h.retiredAt)return false;if(h.retired&&!h.retiredAt)return false;if((h.pausePeriods||[]).some(p=>date>=p.start&&(!p.end||date<p.end)))return false;if(h.paused&&!(h.pausePeriods||[]).length)return false;if(h.frequency==='daily')return true;if(h.frequency==='weekly')return false;return (h.weekdays||[]).includes(dow);}
function V7_habitStreak(h){if(h.frequency==='weekly')return null;let streak=0,cursor=V7_parseDate(V7_today());if(V7_habitScheduled(h,V7_today())&&V7_habitStatus(h.id,V7_today())==='unrecorded')cursor.setDate(cursor.getDate()-1);const start=V7_parseDate(h.startDate||V7_today());for(let d=new Date(cursor);d>=start;d.setDate(d.getDate()-1)){const key=Utils_dateKey(d);if(!V7_habitScheduled(h,key))continue;const status=V7_habitStatus(h.id,key);if(status==='done')streak++;else break;}return streak;}
function V7_habitStatus(h,date=V7_today()){const id=typeof h==='string'?h:h?.id;return id?AppState.habitLogs?.[date]?.[id]||'unrecorded':'unrecorded';}
function V7_setBuiltInHabit(id){const date=V7_today(),rec=Storage_loadDay(date),habits={...rec.habits,[id]:!rec.habits[id]};Storage_saveDay(date,{habits});V7_renderHabits();V7_renderDashboard();}
function V7_setHabitStatus(id,status){const date=V7_today();AppState.habitLogs=AppState.habitLogs||{};AppState.habitLogs[date]=AppState.habitLogs[date]||{};AppState.habitLogs[date][id]=status;V7_save();V7_renderHabits();V7_renderDashboard();}
function V7_addHabit(){const name=document.getElementById('v7-habit-name').value.trim();if(!name)return App_toast('Enter a habit name');const frequency=document.getElementById('v7-habit-frequency').value,target=clamp(Number(document.getElementById('v7-habit-target').value)||1,1,7),weekdays=[...document.querySelectorAll('#v7-habit-weekdays input:checked')].map(x=>Number(x.value)),startDate=document.getElementById('v7-habit-start').value||V7_today(),endDate=document.getElementById('v7-habit-end').value||'';if(frequency==='custom'&&!weekdays.length)return App_toast('Choose at least one weekday');if(endDate&&endDate<startDate)return App_toast('End date must be after start date');AppState.customHabits.push({id:V7_uuid('habit'),name,category:document.getElementById('v7-habit-category').value,frequency,target,weekdays:frequency==='custom'?weekdays:[],startDate,endDate,paused:false,retired:false,createdAt:new Date().toISOString()});document.getElementById('v7-habit-name').value='';V7_save();V7_renderHabits();App_toast('Habit created');}
function V7_renderHabits(){const today=V7_today(),builtins=HABITS.map(h=>({id:h.id,name:HABIT_META[h.id]?.label||h.id,category:PILLARS[h.pillar]?.label||'Existing',builtin:true}));const custom=(AppState.customHabits||[]).filter(h=>!h.retired);const list=document.getElementById('v7-habit-today');if(!list)return;const html=[];for(const h of builtins){const rec=Storage_loadDay(today),done=!!rec.habits[h.id];html.push(`<div class="v7-habit-row"><div><strong>${escapeHtml(h.name)}</strong><small>Existing habit · ${escapeHtml(h.category)}</small></div><span class="v7-status ${done?'done':'unrecorded'}">${done?'Done':'Not marked'}</span><button class="v7-inline" onclick="V7_setBuiltInHabit('${h.id}')">${done?'Undo':'Complete'}</button></div>`);}for(const h of custom){const scheduled=V7_habitScheduled(h,today),weeklyGoal=h.frequency==='weekly',available=scheduled||weeklyGoal,status=V7_habitStatus(h.id,today);html.push(`<div class="v7-habit-row ${!available?'is-unscheduled':''}"><div><strong>${escapeHtml(h.name)}</strong><small>${escapeHtml(h.category)} · ${weeklyGoal?`Weekly target: ${h.target} times`:(scheduled?'Scheduled today':'Not scheduled today')}</small></div>${available?`<select class="finput v7-status-select" value="${status}" onchange="V7_setHabitStatus('${h.id}',this.value)"><option value="unrecorded" ${status==='unrecorded'?'selected':''}>Unrecorded</option><option value="done" ${status==='done'?'selected':''}>Done</option><option value="missed" ${status==='missed'?'selected':''}>Missed</option></select>`:`<span class="v7-status">Unscheduled</span>`}<button class="v7-inline" onclick="V7_editHabit('${h.id}')">Edit</button></div>`);}list.innerHTML=html.join('')||'<p class="v7-empty">No habits found.</p>';
  const history=document.getElementById('v7-habit-history');history.innerHTML=custom.map(h=>{let scheduled=0,done=0,missed=0;const end=V7_parseDate(today),start=V7_parseDate(h.startDate||today);for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){const k=Utils_dateKey(d);if(V7_habitScheduled(h,k)){scheduled++;const st=V7_habitStatus(h.id,k);if(st==='done')done++;if(st==='missed')missed++;}}const weeklyDone=Object.entries(AppState.habitLogs||{}).filter(([date,logs])=>date>=V7_currentWeek()&&date<=today&&logs[h.id]==='done').length,allDone=Object.entries(AppState.habitLogs||{}).filter(([date,logs])=>date>=h.startDate&&date<=today&&logs[h.id]==='done').length,streak=V7_habitStreak(h);const rate=h.frequency==='weekly'?Math.min(100,Math.round(weeklyDone/Math.max(1,h.target)*100)):(scheduled?Math.round(done/scheduled*100):0);return `<div class="v7-habit-history-row"><div><strong>${escapeHtml(h.name)}</strong><small>${h.frequency==='weekly'?`${weeklyDone}/${h.target} this week · ${allDone} total done`:`${done} done · ${missed} missed · ${Math.max(0,scheduled-done-missed)} unrecorded scheduled occurrences · ${streak} current streak`}</small></div><div class="v7-rate"><span>${rate}%</span><div class="pbar"><div class="pfill" style="width:${rate}%"></div></div></div><button class="v7-inline" onclick="V7_editHabit('${h.id}')">Manage</button></div>`;}).join('')||'<p class="v7-empty">Create a custom habit to start tracking scheduled occurrences separately from missed and unrecorded days.</p>';
}
function V7_editHabit(id){const h=AppState.customHabits.find(x=>x.id===id);if(!h)return;const action=prompt('Type: pause, resume, retire, rename',h.paused?'resume':'pause');if(!action)return;const a=action.trim().toLowerCase();if(a==='pause'){h.pausePeriods=h.pausePeriods||[];if(!h.paused){h.pausePeriods.push({start:V7_today(),end:null});h.paused=true;}}else if(a==='resume'){if(h.paused){const open=(h.pausePeriods||[]).slice().reverse().find(p=>!p.end);if(open)open.end=V7_today();}h.paused=false;}else if(a==='retire'){if(!confirm('Retire this habit and keep its history?'))return;h.retired=true;h.retiredAt=V7_today();}else if(a==='rename'){const n=prompt('New habit name',h.name);if(n===null)return;if(n.trim())h.name=n.trim();}else if(a==='schedule'){const frequency=prompt('Frequency: daily, weekly, custom',h.frequency||'daily');if(frequency===null)return;if(!['daily','weekly','custom'].includes(frequency))return App_toast('Use daily, weekly or custom');h.frequency=frequency;if(frequency==='weekly'){const t=prompt('Target occurrences per week',String(h.target||3));if(t===null)return;h.target=clamp(Number(t)||1,1,7);}if(frequency==='custom'){const days=prompt('Weekdays as numbers: Sun=0, Mon=1, ... Sat=6', (h.weekdays||[]).join(','));if(days===null)return;h.weekdays=days.split(',').map(x=>Number(x.trim())).filter(x=>Number.isInteger(x)&&x>=0&&x<=6);if(!h.weekdays.length)return App_toast('Choose at least one valid weekday');}const st=prompt('Start date YYYY-MM-DD',h.startDate||V7_today());if(st===null)return;if(!/^\d{4}-\d{2}-\d{2}$/.test(st))return App_toast('Use YYYY-MM-DD');h.startDate=st;const en=prompt('End date YYYY-MM-DD, or blank for none',h.endDate||'');if(en===null)return;if(en&&(!/^\d{4}-\d{2}-\d{2}$/.test(en)||en<st))return App_toast('Enter a valid end date');h.endDate=en;}else return App_toast('Use pause, resume, retire, rename or schedule');V7_save();V7_renderHabits();}
function V7_renderSystemsReview(){V7_renderDailyReview();V7_renderWeeklyReview();}


/* ─── Startup ────────────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  Storage_load();
  V7_migrateState();
  Today_viewDate=Utils_today();const zoneToday=V7_parseDate(V7_today());Cal_year=zoneToday.getFullYear();Cal_month=zoneToday.getMonth();
  V7_initInputs();
  if(AppState.academic.activeSession) V7_timerInterval=setInterval(()=>{if(V7_systemTab==='academics')V7_renderAcademics();},1000);
  if(AppState.phone.activeFocus) V7_focusInterval=setInterval(()=>{if(V7_systemTab==='phone')V7_renderPhone();},1000);
  App_registerRipple();
  App_registerKeyboard();
  App_registerReviewAutoSave();
  App_registerPWA();
  App_nav('home');
  App_handleDeepLink();
});
