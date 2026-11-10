// Tagwerk – Daten, Zeitrechnung und Tagesplanung (keine UI in dieser Datei)

const KEY = 'tagwerk:v1';

/* ---------- Zeit-Helfer ---------- */
export const pad = (n) => String(n).padStart(2, '0');
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseDay = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (k, n) => { const d = parseDay(k); d.setDate(d.getDate() + n); return dayKey(d); };
export const minutesOf = (d = new Date()) => d.getHours() * 60 + d.getMinutes();
export const fmtTime = (m) => { m = Math.round(m); return `${pad(Math.floor(m / 60) % 24)}:${pad(((m % 60) + 60) % 60)}`; };
export const parseTime = (s) => { if (!s) return null; const [h, m] = s.split(':').map(Number); return h * 60 + m; };
export const fmtDur = (m) => {
  m = Math.max(0, Math.round(m));
  if (m < 60) return `${m} Min`;
  return m % 60 ? `${Math.floor(m / 60)} h ${pad(m % 60)}` : `${m / 60} h`;
};
const ceil5 = (m) => Math.ceil(m / 5) * 5;

const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const WDL = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MON = ['Jan', 'Feb', 'März', 'Apr', 'Mai', 'Juni', 'Juli', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
export const weekdayShort = (k) => WD[parseDay(k).getDay()];
export const weekdayLong = (k) => WDL[parseDay(k).getDay()];
export const dateShort = (k) => { const d = parseDay(k); return `${d.getDate()}. ${MON[d.getMonth()]}`; };
export function dayLabel(k, today = dayKey()) {
  if (k === today) return 'Heute';
  if (k === addDays(today, 1)) return 'Morgen';
  if (k === addDays(today, -1)) return 'Gestern';
  return weekdayLong(k);
}

/* ---------- Zustand ---------- */
const fresh = () => ({
  v: 1,
  tasks: [],
  routines: [],
  settings: { dayStart: 7 * 60, dayEnd: 22 * 60, theme: 'auto', onboarded: false, hintDismissed: false },
  focus: null,
  closed: {},
});

export let state = fresh();
const listeners = new Set();
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw);
      state = { ...fresh(), ...data, settings: { ...fresh().settings, ...(data.settings || {}) } };
    }
  } catch (e) { console.warn('Laden fehlgeschlagen', e); }
  housekeeping();
  return state;
}

let storageOk = true;
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); storageOk = true; }
  catch (e) { storageOk = false; console.warn('Speichern fehlgeschlagen', e); }
}
export const isStorageOk = () => storageOk;

/** Zustand ändern, speichern, UI benachrichtigen. */
export function commit(fn, opts = {}) {
  if (fn) fn(state);
  save();
  listeners.forEach((l) => l(opts));
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------- Abfragen ---------- */
export const byId = (id) => state.tasks.find((t) => t.id === id);
export const tasksOf = (day) => state.tasks.filter((t) => t.day === day && !t.gone).sort((a, b) => a.order - b.order);
export const inbox = () => state.tasks.filter((t) => t.day == null && !t.done && !t.gone)
  .sort((a, b) => (b.important - a.important) || (b.moved - a.moved) || (a.created - b.created));
/** Offene Aufgaben aus vergangenen Tagen (ohne Routinen – die verfallen). */
export const leftovers = (today = dayKey()) => state.tasks
  .filter((t) => t.day && t.day < today && !t.done && !t.gone && !t.routineId)
  .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.order - b.order));

/* ---------- Änderungen ---------- */
function topOrder(day) { const o = state.tasks.filter((t) => t.day === day).map((t) => t.order); return o.length ? Math.min(...o) - 1 : 0; }
function endOrder(day) { const o = state.tasks.filter((t) => t.day === day).map((t) => t.order); return o.length ? Math.max(...o) + 1 : 0; }

export function addTask(data) {
  const t = {
    id: uid(), title: data.title.trim(), dur: data.dur || 30, day: data.day ?? null,
    fixed: data.fixed ?? null, important: !!data.important, done: false, doneAt: null, doneDay: null,
    order: 0, moved: 0, created: Date.now(), routineId: null,
  };
  t.order = t.important ? topOrder(t.day) : endOrder(t.day);
  commit((s) => {
    s.tasks.push(t);
    if (data.repeat) attachRoutine(t, data.repeat);
  });
  return t;
}

function attachRoutine(t, repeat) {
  if (!t.day) t.day = dayKey();
  const r = { id: uid(), title: t.title, dur: t.dur, fixed: t.fixed, important: t.important, repeat, weekday: parseDay(t.day).getDay(), start: t.day };
  state.routines.push(r);
  t.routineId = r.id;
}

export function updateTask(id, patch) {
  commit((s) => {
    const t = s.tasks.find((x) => x.id === id);
    if (!t) return;
    const { repeat, ...rest } = patch;
    if ('day' in rest && rest.day !== t.day) { t.order = endOrder(rest.day); }
    Object.assign(t, rest);
    if (repeat !== undefined) {
      const r = t.routineId && s.routines.find((x) => x.id === t.routineId);
      if (r && !repeat) {
        // Serie beenden: künftige, unerledigte Kopien entfernen
        s.routines = s.routines.filter((x) => x.id !== r.id);
        s.tasks = s.tasks.filter((x) => x.routineId !== r.id || x.id === t.id || x.done);
        s.tasks.forEach((x) => { if (x.routineId === r.id) x.routineId = null; });
      } else if (!r && repeat) {
        attachRoutine(t, repeat);
      } else if (r) {
        r.repeat = repeat;
      }
    }
    const r = t.routineId && s.routines.find((x) => x.id === t.routineId);
    if (r) { r.title = t.title; r.dur = t.dur; r.fixed = t.fixed; r.important = t.important; }
  });
}

export const repeatOf = (t) => (t.routineId && state.routines.find((r) => r.id === t.routineId)?.repeat) || null;

export function setDone(id, done, now = new Date()) {
  commit((s) => {
    const t = s.tasks.find((x) => x.id === id);
    if (!t) return;
    t.done = done;
    t.doneAt = done ? now.getTime() : null;
    t.doneDay = done ? dayKey(now) : null;
    if (done && t.day !== dayKey(now)) {
      if (t.routineId && t.day) leaveGap(s, t);
      t.day = dayKey(now); // erledigt zählt für den Tag, an dem es passiert ist
    }
    if (s.focus && s.focus.taskId === id) s.focus = null;
  });
}

export function removeTask(id) {
  commit((s) => {
    const t = s.tasks.find((x) => x.id === id);
    if (!t) return;
    if (s.focus && s.focus.taskId === id) s.focus = null;
    if (t.routineId) t.gone = true; // Platzhalter, damit die Routine heute nicht neu entsteht
    else s.tasks = s.tasks.filter((x) => x.id !== id);
  });
}

export function restoreTask(snapshot) {
  commit((s) => {
    const i = s.tasks.findIndex((x) => x.id === snapshot.id);
    if (i >= 0) s.tasks[i] = snapshot; else s.tasks.push(snapshot);
  });
}

/** Aufgabe auf einen anderen Tag legen. counts=true zählt es als „verschoben“. */
export function moveTask(id, day, { counts = false, top = false } = {}) {
  commit((s) => {
    const t = s.tasks.find((x) => x.id === id);
    if (!t) return;
    if (s.focus && s.focus.taskId === id) s.focus = null;
    if (counts) t.moved = (t.moved || 0) + 1;
    if (t.routineId && t.day !== day) { leaveGap(s, t); t.routineId = null; } // verschobene Routine-Kopie wird eine normale Aufgabe
    t.order = top ? topOrder(day) : endOrder(day);
    t.day = day;
  });
}

/** Platzhalter, damit eine Routine am ursprünglichen Tag nicht doppelt entsteht. */
function leaveGap(s, t) {
  if (!t.day) return;
  s.tasks.push({ id: uid(), title: t.title, dur: t.dur, day: t.day, fixed: null, important: false, done: false, doneAt: null, doneDay: null, order: 0, moved: 0, created: Date.now(), routineId: t.routineId, gone: true });
}

export function makeNext(id) {
  commit((s) => { const t = s.tasks.find((x) => x.id === id); if (t) t.order = topOrder(t.day); });
}

export function reorder(day, ids) {
  commit((s) => { ids.forEach((id, i) => { const t = s.tasks.find((x) => x.id === id); if (t) t.order = i; }); });
}

/* ---------- Routinen ---------- */
function routineApplies(r, day) {
  if (day < r.start) return false;
  const wd = parseDay(day).getDay();
  if (r.repeat === 'daily') return true;
  if (r.repeat === 'weekdays') return wd >= 1 && wd <= 5;
  if (r.repeat === 'weekly') return wd === r.weekday;
  return false;
}

/** Legt für einen Tag die fälligen Routine-Aufgaben an (falls noch nicht vorhanden). */
export function materialize(day) {
  let changed = false;
  for (const r of state.routines) {
    if (!routineApplies(r, day)) continue;
    if (state.tasks.some((t) => t.routineId === r.id && t.day === day)) continue;
    state.tasks.push({
      id: uid(), title: r.title, dur: r.dur, day, fixed: r.fixed, important: r.important, done: false,
      doneAt: null, doneDay: null, order: endOrder(day), moved: 0, created: Date.now(), routineId: r.id,
    });
    changed = true;
  }
  if (changed) save();
  return changed;
}

/** Aufräumen beim Start und beim Tageswechsel. */
export function housekeeping(now = new Date()) {
  const today = dayKey(now);
  const cutoff = addDays(today, -120);
  state.tasks = state.tasks.filter((t) => {
    if (t.routineId && !t.done && t.day && t.day < today) return false; // verpasste Routine verfällt
    if (t.gone && t.day < today) return false;
    if (t.done && t.doneDay && t.doneDay < cutoff) return false;
    return true;
  });
  for (const k of Object.keys(state.closed)) if (k < cutoff) delete state.closed[k];
  if (state.focus && !state.tasks.some((t) => t.id === state.focus.taskId && !t.done)) state.focus = null;
  materialize(today);
  materialize(addDays(today, 1));
  save();
}

/* ---------- Fokus-Timer ---------- */
export function startFocus(id, minutes = null) {
  commit((s) => {
    if (s.focus && s.focus.taskId === id) return;
    const t = s.tasks.find((x) => x.id === id);
    if (!t) return;
    if (t.day !== dayKey()) { t.day = dayKey(); }
    s.focus = { taskId: id, startedAt: Date.now(), pausedAt: null, paused: 0, extra: 0, minutes };
  });
}
export function stopFocus() { commit((s) => { s.focus = null; }); }
export function toggleFocusPause() {
  commit((s) => {
    const f = s.focus; if (!f) return;
    if (f.pausedAt) { f.paused += Date.now() - f.pausedAt; f.pausedAt = null; } else { f.pausedAt = Date.now(); }
  });
}
export function extendFocus(min) { commit((s) => { if (s.focus) s.focus.extra += min; }); }
/** Verbleibende Sekunden (kann negativ sein = überzogen). */
export function focusRemaining(now = Date.now()) {
  const f = state.focus; if (!f) return 0;
  const t = byId(f.taskId); if (!t) return 0;
  const elapsed = ((f.pausedAt || now) - f.startedAt - f.paused) / 1000;
  return ((f.minutes ?? t.dur) + f.extra) * 60 - elapsed;
}
export function focusTotal() { const f = state.focus; const t = f && byId(f.taskId); return t ? ((f.minutes ?? t.dur) + f.extra) * 60 : 0; }

/* ---------- Tagesplan: rechnet aus Reihenfolge + Dauer echte Uhrzeiten ---------- */
export function schedule(day, now = new Date()) {
  const S = state.settings;
  const today = dayKey(now);
  const isToday = day === today;
  const nm = minutesOf(now);
  const open = tasksOf(day).filter((t) => !t.done);
  const f = isToday && state.focus && open.find((t) => t.id === state.focus.taskId) ? state.focus : null;

  let cursor = S.dayStart;
  if (isToday && (nm >= S.dayStart || f)) cursor = ceil5(nm);
  const start0 = cursor;

  const anchors = [];
  const rest = [];
  for (const t of open) {
    if (f && t.id === f.taskId) continue;
    const missed = t.fixed != null && isToday && t.fixed + t.dur <= nm;
    if (t.fixed != null && !missed) anchors.push(t); else rest.push(t);
  }
  const isMissed = (t) => (t.fixed != null ? 1 : 0);
  rest.sort((a, b) => (isMissed(b) - isMissed(a)) || (a.order - b.order));
  anchors.sort((a, b) => a.fixed - b.fixed);

  const items = [];
  if (f) {
    const t = open.find((x) => x.id === f.taskId);
    const rem = Math.max(60, focusRemaining(now.getTime()));
    const end = ceil5(nm + rem / 60);
    items.push({ task: t, start: nm, end, running: true });
    cursor = end;
  }
  let ai = 0;
  const putAnchor = (a) => {
    items.push({ task: a, start: a.fixed, end: a.fixed + a.dur, fixed: true });
    cursor = Math.max(cursor, a.fixed + a.dur);
    ai++;
  };
  while (rest.length || ai < anchors.length) {
    const a = anchors[ai];
    if (a && a.fixed <= cursor) { putAnchor(a); continue; }
    if (!rest.length) { putAnchor(a); continue; }
    let idx = 0;
    if (a) {
      idx = rest.findIndex((t) => cursor + t.dur <= a.fixed); // passt noch etwas vor den Termin?
      if (idx < 0) { putAnchor(a); continue; }
    }
    const t = rest.splice(idx, 1)[0];
    items.push({ task: t, start: cursor, end: cursor + t.dur, missed: t.fixed != null });
    cursor += t.dur;
  }
  items.sort((a, b) => a.start - b.start);
  for (const it of items) it.late = it.end > S.dayEnd;

  const planned = items.reduce((s, it) => s + (it.running ? it.end - it.start : it.task.dur), 0);
  const end = items.length ? Math.max(...items.map((i) => i.end)) : start0;
  const available = Math.max(0, S.dayEnd - start0);
  return { items, start0, end, planned, available, slack: S.dayEnd - end, late: items.filter((i) => i.late), isToday };
}

/* ---------- Rückblick ---------- */
export function doneOn(day) { return state.tasks.filter((t) => t.done && t.doneDay === day && !t.gone); }
export function stats(now = new Date()) {
  const today = dayKey(now);
  const days = [];
  for (let i = 6; i >= 0; i--) { const k = addDays(today, -i); days.push({ day: k, done: doneOn(k).length }); }
  let streak = 0;
  let k = doneOn(today).length ? today : addDays(today, -1);
  while (doneOn(k).length) { streak++; k = addDays(k, -1); }
  const week = days.reduce((s, d) => s + d.done, 0);
  const open = state.tasks.filter((t) => !t.done && !t.gone);
  const stuck = open.filter((t) => (t.moved || 0) >= 2).length;
  return { days, streak, week, stuck };
}

/* ---------- Sicherung ---------- */
export function exportData() { return JSON.stringify({ app: 'tagwerk', exported: new Date().toISOString(), ...state }, null, 2); }
export function importData(text) {
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.tasks) || !data.settings) throw new Error('Keine gültige Tagwerk-Sicherung');
  const { app, exported, ...rest } = data;
  state = { ...fresh(), ...rest, settings: { ...fresh().settings, ...rest.settings, onboarded: true } };
  housekeeping();
  commit(null);
}
export function resetAll() { state = fresh(); state.settings.onboarded = true; commit(null); }
