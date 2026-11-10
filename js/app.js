// Tagwerk – Oberfläche

import * as S from './store.js';
import { fmtTime, fmtDur, minutesOf, dayKey, addDays, dayLabel, weekdayShort, weekdayLong, dateShort } from './store.js';
import { renderSky, buildStars } from './sky.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const root = document.documentElement;
const app = $('#app'), view = $('#view'), layer = $('#layer'), sky = $('#sky');

/* ---------- Icons ---------- */
const P = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  tune: '<path d="M4 7h9M19 7h1M4 17h1M11 17h9"/><circle cx="16" cy="7" r="2.6"/><circle cx="8" cy="17" r="2.6"/>',
  chevL: '<path d="M15 5l-7 7 7 7"/>',
  chevR: '<path d="M9 5l7 7-7 7"/>',
  chevD: '<path d="M5 9l7 7 7-7"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  star: '<path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z"/>',
  repeat: '<path d="M4 11V9.5a3 3 0 013-3h11M15 3.5l3 3-3 3M20 13v1.5a3 3 0 01-3 3H6M9 20.5l-3-3 3-3"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M8 3v4M16 3v4"/>',
  trash: '<path d="M5 7h14M10 7V4.5h4V7M7 7l1 12.5h8L17 7"/>',
  play: '<path d="M8 5.5v13l11-6.5z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  inbox: '<path d="M4 13l2.5-7.5h11L20 13v5.5H4V13zM4 13h4.5a3.5 3.5 0 007 0H20"/>',
  horizon: '<path d="M3 17.5h18M6.5 17.5a5.5 5.5 0 0111 0M12 6v2.2M5 10.2l1.6 1.6M19 10.2l-1.6 1.6"/>',
  top: '<path d="M5 4.5h14M12 20V9.5M7 14l5-5 5 5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  arrowR: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowL: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  warn: '<path d="M12 4.5l8.5 15h-17zM12 10.5v4M12 17.2v.3"/>',
  redo: '<path d="M16 5l5 5-5 5M21 10H10a5.5 5.5 0 000 11h3"/>',
  save: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
  flag: '<path d="M6 21V4.5M6 4.5h11.5l-2.6 4 2.6 4H6"/>',
  list: '<path d="M9.5 7h10M9.5 12h10M9.5 17h10M5 7h.01M5 12h.01M5 17h.01"/>',
  note: '<path d="M6 4h9l4 4v12H6zM9.5 12h6M9.5 16h4"/>',
  back: '<path d="M8 5L3 10l5 5M3 10h11a5.5 5.5 0 010 11h-3"/>',
  bottom: '<path d="M5 19.5h14M12 4v10.5M7 10l5 5 5-5"/>',
  open: '<path d="M12 15.5V4.5M7 9l5-5 5 5M5 20h14"/>',
};
const icon = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n]}</svg>`;

/* ---------- UI-Zustand ---------- */
const ui = { tab: 'day', day: dayKey(), today: dayKey(), doneOpen: false, barSel: 6 };
let lastHtml = null;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

/* ---------- Kleines Feedback ---------- */
let hapticLabel;
function haptic() {
  try {
    if (navigator.vibrate) { navigator.vibrate(8); return; }
    if (!hapticLabel) {
      hapticLabel = document.createElement('label');
      hapticLabel.setAttribute('aria-hidden', 'true');
      hapticLabel.style.display = 'none';
      const i = document.createElement('input');
      i.type = 'checkbox'; i.setAttribute('switch', '');
      hapticLabel.appendChild(i);
      document.body.appendChild(hapticLabel);
    }
    hapticLabel.click();
  } catch { /* egal */ }
}

let toastTimer;
function toast(msg, undo) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button type="button">Rückgängig</button>' : ''}`;
  el.style.paddingRight = undo ? '' : '18px';
  el.classList.add('open');
  if (undo) el.querySelector('button').onclick = () => { undo(); el.classList.remove('open'); };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('open'), undo ? 5200 : 2600);
}

let audioCtx;
function armAudio() { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch { /* kein Ton */ } }
function chime() {
  if (!audioCtx || audioCtx.state !== 'running') return;
  [[660, 0], [880, 0.18], [1320, 0.36]].forEach(([f, at]) => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    const t = audioCtx.currentTime + at;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    o.connect(g).connect(audioCtx.destination); o.start(t); o.stop(t + 1);
  });
}

/* ---------- Tags an Aufgaben ---------- */
const REPEAT = { daily: 'Täglich', weekdays: 'Werktags', weekly: 'Wöchentlich' };
function tagsHtml(t, { time = true } = {}) {
  let h = '';
  if (t.important) h += `<span class="tag star">${icon('star')}Wichtig</span>`;
  const due = S.dueInfo(t, ui.today);
  if (due) h += `<span class="tag ${due.warn ? 'moved' : ''}">${icon('flag')}${due.label}</span>`;
  if (time && t.fixed != null) h += `<span class="tag">${icon('clock')}${fmtTime(t.fixed)} fest</span>`;
  if (t.steps?.length) h += `<span class="tag">${icon('list')}${t.steps.filter((x) => x.done).length}/${t.steps.length}</span>`;
  const rep = S.repeatOf(t);
  if (rep) h += `<span class="tag">${icon('repeat')}${REPEAT[rep]}</span>`;
  if (t.moved > 0) h += `<span class="tag moved">${icon('redo')}${t.moved}× verschoben</span>`;
  if (t.note) h += `<span class="tag" aria-label="hat Notiz">${icon('note')}</span>`;
  return h;
}

function stepsHtml(t, act = 'data-act="step"') {
  if (!t.steps?.length) return '';
  return `<ul class="steps">${t.steps.map((x, i) => `<li class="${x.done ? 'd' : ''}"><button ${act} data-id="${t.id}" data-i="${i}"><i>${icon('check')}</i><span>${esc(x.t)}</span></button></li>`).join('')}</ul>`;
}

/* ============================================================
   Hauptansicht
   ============================================================ */
function headline(plan, now) {
  const { dayStart, dayEnd } = S.state.settings;
  const nm = minutesOf(now);
  if (ui.tab === 'inbox') {
    const n = S.inbox().length + S.leftovers(ui.today).length;
    return { h: 'Eingang', sub: n ? `${plural(n, 'Aufgabe wartet', 'Aufgaben warten')} auf einen Tag` : 'Alles hat seinen Tag' };
  }
  const open = plan.items.length;
  const done = S.tasksOf(ui.day).filter((t) => t.done).length;
  if (ui.day < ui.today) return { h: dayLabel(ui.day, ui.today), sub: `${done ? `${done} erledigt` : 'Nichts erledigt'}${open ? `<span class="dot">·</span>${open} offen geblieben` : ''}` };
  if (ui.day > ui.today) {
    if (!open) return { h: 'Noch frei', sub: 'Für diesen Tag ist nichts geplant' };
    if (plan.slack < 0) return { h: plural(open, 'Aufgabe', 'Aufgaben'), sub: `${fmtDur(-plan.slack)} mehr, als der Tag hergibt`, warn: true };
    return { h: plural(open, 'Aufgabe', 'Aufgaben'), sub: `${fmtDur(plan.planned)} geplant<span class="dot">·</span>fertig gegen ${fmtTime(plan.end)}` };
  }
  if (S.state.closed[ui.today] && !open) return { h: 'Feierabend', sub: done ? `${done} erledigt – Tag abgeschlossen` : 'Tag abgeschlossen' };
  if (!open && !done) return { h: nm < dayStart ? 'Guten Morgen' : nm >= dayEnd ? 'Gute Nacht' : 'Freier Himmel', sub: 'Noch nichts geplant' };
  if (!open) return { h: '<em>Tagwerk</em> vollbracht', sub: `${done} erledigt – der Rest gehört dir` };
  if (nm >= dayEnd) return { h: 'Die Sonne ist unten', sub: `${open} noch offen – schließ den Tag ab` };
  const h = `Noch ${plural(open, 'Aufgabe', 'Aufgaben')}`;
  if (plan.slack < 0) return { h, sub: `${fmtDur(-plan.slack)} mehr, als dein Tag hergibt`, warn: true };
  return { h, sub: `fertig gegen ${fmtTime(plan.end)}<span class="dot">·</span>${fmtDur(plan.slack)} Luft` };
}

function nowCard(it, plan, now) {
  const t = it.task;
  const nm = minutesOf(now);
  const f = S.state.focus;
  let label = 'Jetzt';
  if (it.running) label = f.pausedAt ? 'Pausiert' : 'Läuft';
  else if (!plan.isToday) label = `Zuerst · ${fmtTime(it.start)}`;
  else if (it.missed) label = `Überfällig · war ${fmtTime(t.fixed)}`;
  else if (it.start > nm + 5) label = `Als Nächstes · ${fmtTime(it.start)}`;
  const canAct = ui.day <= ui.today;
  const meta = `<span>${fmtDur(t.dur)}${plan.isToday && !it.running ? ` · bis ${fmtTime(it.end)}` : ''}</span>${tagsHtml(t, { time: !it.missed })}`;
  let actions = '';
  if (it.running) actions = `<span class="now-timer" id="nowTimer">${clockText(S.focusRemaining())}</span><button class="btn-dark" data-act="focus">Fokus</button>`;
  else if (plan.isToday) actions = `<button class="btn-dark" data-act="start" data-id="${t.id}">${icon('play', 'fill')}Starten</button>`;
  const check = canAct ? `<button class="check" data-act="done" data-id="${t.id}" aria-label="Erledigt: ${esc(t.title)}">${icon('check')}</button>` : '';
  return `<article class="now ${it.running && !f.pausedAt ? 'running' : ''}" data-id="${t.id}" style="view-transition-name:t-${t.id}">
    <div class="eyebrow"><i></i>${label}</div>
    <button class="now-main" data-act="edit" data-id="${t.id}"><h2>${esc(t.title)}</h2><div class="meta">${meta}</div></button>
    ${canAct ? stepsHtml(t) : ''}
    ${actions || check ? `<div class="now-actions">${actions}${check}</div>` : ''}
  </article>`;
}

function rowHtml(it) {
  const t = it.task;
  const canAct = ui.day <= ui.today;
  const drag = !it.fixed && !it.running ? 'data-drag' : '';
  const extra = it.fixed ? `<span class="tag ${it.conflict ? 'moved' : ''}">${icon(it.conflict ? 'warn' : 'clock')}${it.conflict ? 'überschneidet sich' : 'Termin'}</span>` : '';
  return `<li class="row ${it.late ? 'late' : ''}" data-id="${t.id}" ${drag} style="view-transition-name:t-${t.id}">
    <div class="when"><b>${fmtTime(it.start)}</b><span>${fmtDur(t.dur)}</span></div>
    <div class="cardrow">
      <button class="body" data-act="edit" data-id="${t.id}"><span class="title">${esc(t.title)}</span><span class="tags">${tagsHtml(t, { time: !it.fixed })}${extra}</span></button>
      ${canAct ? `<button class="check" data-act="done" data-id="${t.id}" aria-label="Erledigt: ${esc(t.title)}">${icon('check')}</button>` : ''}
    </div></li>`;
}

function blockRow(b) {
  return `<li class="blk"><div class="when"><b>${fmtTime(b.start)}</b><span>–${fmtTime(b.end)}</span></div>
    <div class="blk-body"><span>${esc(b.name)}</span><button data-act="skip-block" data-id="${b.id}">${ui.day === ui.today ? 'Heute frei' : 'Frei'}</button></div></li>`;
}

function banner({ title, text, btn, act, warn, x }) {
  return `<div class="banner ${warn ? 'warn' : ''}"><div class="txt"><b>${title}</b>${text ? `<span>${text}</span>` : ''}</div>
    ${btn ? `<button class="btn-s" data-act="${act}">${btn}</button>` : ''}${x ? `<button class="x" data-act="${x}" aria-label="Ausblenden">${icon('x')}</button>` : ''}</div>`;
}

function dayView(plan, now) {
  const { dayEnd } = S.state.settings;
  const today = ui.today, day = ui.day, isToday = day === today;
  const nm = minutesOf(now);
  const done = S.tasksOf(day).filter((t) => t.done).sort((a, b) => b.doneAt - a.doneAt);
  const left = isToday ? S.leftovers(today) : [];
  const inboxN = S.inbox().length;
  const closed = !!S.state.closed[today];
  const risk = isToday ? S.dueRisk(today) : [];
  let h = '';

  if (isIOS && !isStandalone() && !S.state.settings.hintDismissed) {
    h += banner({ title: 'Als App installieren', text: 'Teilen-Symbol antippen, dann „Zum Home-Bildschirm“.', x: 'dismiss-hint' });
  }
  // höchstens ein Hinweis auf einmal – der jeweils wichtigste
  const closeTime = isToday && !closed && nm >= dayEnd - 120 && (plan.items.length || done.length || left.length);
  let note = '';
  if (isToday && closed && !plan.items.length) {
    note = banner({ title: 'Tag abgeschlossen', text: 'Gut gemacht. Morgen geht die Sonne wieder auf.', btn: 'Morgen', act: 'goto-tomorrow' });
  } else if (closeTime) {
    note = banner({ title: 'Zeit für den Tagesabschluss', text: 'Kurz zurückblicken, Offenes bewusst entscheiden.', btn: 'Abschließen', act: 'close-day' });
  } else if (isToday && risk.length) {
    note = banner({
      title: risk.length === 1 ? `Frist: ${esc(risk[0].title)}` : `${risk.length} Fristen laufen ab`,
      text: risk.length === 1 ? `${S.dueInfo(risk[0], today).label} – und noch nicht eingeplant.` : 'Heute oder morgen fällig und noch nicht eingeplant.',
      btn: 'Einplanen', act: 'decide-due', warn: true,
    });
  } else if (left.length) {
    note = banner({ title: `${plural(left.length, 'Aufgabe ist', 'Aufgaben sind')} liegen geblieben`, text: 'Heute, später oder streichen?', btn: 'Entscheiden', act: 'decide-left', warn: true });
  } else if (plan.late.length) {
    note = banner({
      title: isToday ? 'Das wird heute eng' : 'Dieser Tag ist zu voll',
      text: `${plural(plan.late.length, 'Aufgabe passt', 'Aufgaben passen')} nicht mehr vor ${fmtTime(dayEnd)}.`,
      btn: 'Entscheiden', act: 'decide-late', warn: true,
    });
  } else if (isToday && !closed && inboxN && !S.state.planned[today] && plan.items.length) {
    note = banner({ title: 'Kurz den Tag planen?', text: `${plural(inboxN, 'Aufgabe wartet', 'Aufgaben warten')} im Eingang. Was davon schaffst du heute?`, btn: 'Planen', act: 'plan', x: 'skip-plan' });
  } else if (isToday && !S.state.settings.blockHint && !S.state.blocks.length && S.state.tasks.length >= 3) {
    note = banner({ title: 'Feste Zeiten wie Arbeit oder Uni?', text: 'Trag sie einmal ein – Tagwerk plant dann drumherum.', btn: 'Eintragen', act: 'blocks', x: 'dismiss-blockhint' });
  }
  h += note;

  if (day < today) {
    if (plan.items.length) {
      h += `<div class="section-h"><span class="eyebrow">Offen geblieben · ${plan.items.length}</span></div>` + plan.items.map((it) => inboxRow(it.task)).join('');
    } else if (!done.length) h += `<div class="empty"><h3>Ein stiller Tag</h3><p>An diesem Tag wurde nichts abgehakt.</p></div>`;
  } else if (!plan.items.length) {
    if (done.length && isToday) {
      h += `<div class="empty"><h3>Alles erledigt.</h3><p>Nichts mehr offen für heute. Wenn du magst, hol dir noch etwas aus dem Eingang.</p>
        <div class="stack">${inboxN ? `<button class="btn ghost" data-act="plan">${icon('inbox')}Aus dem Eingang planen · ${inboxN}</button>` : ''}</div></div>`;
    } else {
      h += `<div class="empty"><h3>${isToday ? 'Was steht heute an?' : `Was steht ${day === addDays(today, 1) ? 'morgen' : `am ${weekdayLong(day)}`} an?`}</h3>
        <p>Tippe auf die Sonne und schreib auf, was zu tun ist. Die Uhrzeiten rechnet Tagwerk für dich aus.</p>
        <div class="stack"><button class="btn sun" data-act="add">${icon('plus')}Erste Aufgabe</button>
        ${inboxN ? `<button class="btn ghost" data-act="plan">${icon('inbox')}Aus dem Eingang planen · ${inboxN}</button>` : ''}</div></div>`;
    }
  } else {
    const first = plan.items[0];
    const entries = [
      ...plan.items.slice(1).map((it) => ({ start: it.start, end: it.end, it })),
      ...plan.blocks.map((b) => ({ start: b.start, end: b.end, b })),
    ].sort((a, b) => a.start - b.start);
    const before = entries.filter((e) => e.b && e.start <= first.start);
    if (before.length) h += `<ul class="list pre">${before.map((e) => blockRow(e.b)).join('')}</ul>`;
    h += nowCard(first, plan, now);
    const after = entries.filter((e) => !before.includes(e));
    if (after.length) {
      h += '<ol class="list" id="list">';
      let prevEnd = Math.max(first.end, ...before.map((e) => e.end));
      let divided = first.late;
      for (const e of after) {
        if (e.it?.late && !divided) { h += `<li class="dayend">Tagesende ${fmtTime(dayEnd)}</li>`; divided = true; }
        else if (e.start - prevEnd >= 15 && !divided) h += `<li class="gap">${fmtDur(e.start - prevEnd)} Luft</li>`;
        h += e.b ? blockRow(e.b) : rowHtml(e.it);
        prevEnd = Math.max(prevEnd, e.end);
      }
      h += '</ol>';
    }
  }

  if (done.length) {
    h += `<button class="done-h ${ui.doneOpen ? 'open' : ''}" data-act="toggle-done"><span class="eyebrow">Erledigt · ${done.length}</span>${icon('chevD')}</button>`;
    if (ui.doneOpen) {
      h += '<ul class="done-list">' + done.map((t) => `<li class="is-done" style="view-transition-name:t-${t.id}">
        <button class="check" data-act="undone" data-id="${t.id}" aria-label="Wieder öffnen: ${esc(t.title)}">${icon('check')}</button>
        <span class="title">${esc(t.title)}</span><time>${fmtTime(minutesOf(new Date(t.doneAt)))}</time></li>`).join('') + '</ul>';
    }
  }

  if (day >= today && plan.items.length) {
    h += '<div class="foot">';
    if (inboxN) h += `<button class="btn text" data-act="plan">${icon('inbox')}Aus dem Eingang planen · ${inboxN}</button>`;
    if (isToday && !closed && nm < dayEnd - 120) h += `<button class="btn text" data-act="close-day">Tag jetzt abschließen</button>`;
    h += '</div>';
  }
  return h;
}

function inboxRow(t) {
  return `<div class="inbox-row" data-id="${t.id}" style="view-transition-name:t-${t.id}">
      <button class="body" data-act="edit" data-id="${t.id}"><span class="title">${esc(t.title)}</span><span class="tags"><span class="tag">${fmtDur(t.dur)}</span>${tagsHtml(t)}</span></button>
      <button class="to-today" data-act="to-today" data-id="${t.id}">Heute${icon('arrowR')}</button></div>`;
}

function inboxView() {
  const today = ui.today;
  const left = S.leftovers(today);
  const items = S.inbox();
  let h = '';
  if (!left.length && !items.length) {
    return `<div class="empty"><h3>Der Eingang ist leer.</h3><p>Hier landet alles, was noch keinen Tag hat. Schreib es auf, sobald es dir einfällt – entscheiden kannst du später.</p>
      <div class="stack"><button class="btn sun" data-act="add">${icon('plus')}Etwas notieren</button></div></div>`;
  }
  if (items.length + left.length > 1) {
    h += banner({ title: 'In einem Rutsch verteilen', text: 'Karte für Karte: heute oder später?', btn: 'Tag planen', act: 'plan-today' });
  }
  const row = inboxRow;
  if (left.length) {
    h += `<div class="section-h"><span class="eyebrow">Liegen geblieben · ${left.length}</span></div>` + left.map(row).join('');
  }
  if (items.length) {
    h += `<div class="section-h"><span class="eyebrow">Ohne Tag · ${items.length}</span></div>` + items.map(row).join('');
  }
  return h;
}

function render(opts = {}) {
  const now = new Date();
  const today = dayKey(now);
  if (today !== ui.today) {
    if (ui.day === ui.today) ui.day = today;
    ui.today = today;
    S.housekeeping(now);
  }
  if (ui.day >= today) S.materialize(ui.day);

  const skyDay = ui.tab === 'inbox' ? today : ui.day;
  const plan = S.schedule(ui.day, now);
  const skyPlan = skyDay === ui.day ? plan : S.schedule(skyDay, now);
  const mode = skyDay === today ? 'today' : skyDay > today ? 'future' : 'past';
  const doneMinutes = S.tasksOf(skyDay).filter((t) => t.done && t.doneAt).map((t) => minutesOf(new Date(t.doneAt)));
  const { isNight } = renderSky({ now, settings: S.state.settings, mode, plan: mode === 'past' ? null : skyPlan, doneMinutes });

  const theme = S.state.settings.theme === 'auto' ? (isNight ? 'dark' : 'light') : S.state.settings.theme;
  if (root.dataset.theme !== theme) root.dataset.theme = theme;

  const hl = headline(plan, now);
  const hEl = $('#headline'), sEl = $('#subline');
  if (hEl.innerHTML !== hl.h) hEl.innerHTML = hl.h;
  if (sEl.innerHTML !== hl.sub) sEl.innerHTML = hl.sub;
  sEl.classList.toggle('warn', !!hl.warn);

  $('#dayLabel').innerHTML = `${dayLabel(ui.day, today)} <small>· ${weekdayShort(ui.day)} ${dateShort(ui.day)}</small>${icon('chevD')}`;
  $('#todayBtn').hidden = ui.day === today || ui.tab !== 'day';
  $('#prevDay').disabled = ui.day <= addDays(today, -14);
  $('#nextDay').disabled = ui.day >= addDays(today, 60);

  app.dataset.tab = ui.tab;
  $('#tabDay').classList.toggle('on', ui.tab === 'day');
  $('#tabInbox').classList.toggle('on', ui.tab === 'inbox');
  const tabLbl = ui.day === today ? 'Heute' : Math.abs((S.parseDay(ui.day) - S.parseDay(today)) / 864e5) < 1.5 ? dayLabel(ui.day, today) : `${weekdayShort(ui.day)} ${S.parseDay(ui.day).getDate()}.`;
  if ($('#tabDayLbl').textContent !== tabLbl) $('#tabDayLbl').textContent = tabLbl;
  const n = S.inbox().length + S.leftovers(today).length;
  const badge = $('#inboxBadge');
  badge.hidden = !n; badge.textContent = n;

  const html = ui.tab === 'inbox' ? inboxView() : dayView(plan, now);
  if (html !== lastHtml) {
    const apply = () => { view.innerHTML = html; lastHtml = html; };
    if (opts.animate && document.startViewTransition && !reduceMotion && !dragging) {
      try {
        const vt = document.startViewTransition(apply);
        vt.ready?.catch(() => {}); vt.finished?.catch(() => {}); vt.updateCallbackDone?.catch(() => {});
      } catch { apply(); }
    } else apply();
  }
}

/* ============================================================
   Ebenen: Blätter, Dialoge, Vollbild
   ============================================================ */
const stack = [];
function mount(el, { backdrop = true, high = false, dismiss = true, onClose } = {}) {
  let bd = null;
  if (backdrop) { bd = document.createElement('div'); bd.className = 'backdrop' + (high ? ' high' : ''); layer.appendChild(bd); }
  layer.appendChild(el);
  void el.offsetWidth;
  bd?.classList.add('open'); el.classList.add('open');
  const h = {
    el, closed: false,
    close(silent) {
      if (h.closed) return;
      h.closed = true;
      el.classList.remove('open'); bd?.classList.remove('open');
      stack.splice(stack.indexOf(h), 1);
      app.classList.toggle('modal', stack.length > 0);
      root.style.overflow = stack.length ? 'hidden' : '';
      setTimeout(() => { el.remove(); bd?.remove(); }, 440);
      if (!silent) onClose?.();
    },
  };
  if (bd && dismiss) bd.addEventListener('click', () => h.close());
  stack.push(h);
  $('#toast').classList.remove('open');
  app.classList.add('modal');
  root.style.overflow = 'hidden';
  return h;
}

/* ---------- Texteingabe verstehen: „Sport 45 min um 18:00“ ---------- */
function parseSmart(text) {
  let title = ` ${text} `;
  const out = {};
  // Frist: „bis Freitag“, „bis morgen“, „bis 15.11.“
  let m = title.match(/\sbis\s+(heute|morgen|übermorgen|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|mo|di|mi|do|fr|sa|so|\d{1,2}\.\d{1,2}\.?)(?=\s)/i);
  if (m) {
    const w = m[1].toLowerCase(), today = dayKey();
    let due = null;
    if (w === 'heute') due = today;
    else if (w === 'morgen') due = addDays(today, 1);
    else if (w === 'übermorgen') due = addDays(today, 2);
    else if (/^\d/.test(w)) {
      const [d, mo] = w.split('.').map(Number);
      const y = new Date().getFullYear();
      if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) { due = dayKey(new Date(y, mo - 1, d)); if (due < today) due = dayKey(new Date(y + 1, mo - 1, d)); }
    } else {
      const wd = ['so', 'mo', 'di', 'mi', 'do', 'fr', 'sa'].indexOf(w.slice(0, 2));
      const diff = (wd - new Date().getDay() + 7) % 7 || 7;
      due = addDays(today, diff);
    }
    if (due) { out.due = due; title = title.replace(m[0], ' '); }
  }
  m = title.match(/\s(?:um\s+)?(\d{1,2})[:.](\d{2})(?:\s*uhr)?(?=\s)/i) || title.match(/\sum\s+(\d{1,2})(?:\s*uhr)?(?=\s)/i) || title.match(/\s(\d{1,2})\s*uhr(?=\s)/i);
  if (m && +m[1] < 24 && +(m[2] || 0) < 60) { out.fixed = +m[1] * 60 + +(m[2] || 0); title = title.replace(m[0], ' '); }
  m = title.match(/\s(\d+(?:[.,]\d+)?)\s*(minuten|min|m|stunden|stunde|std|h)\.?(?=\s)/i);
  if (m) {
    const v = parseFloat(m[1].replace(',', '.'));
    const mins = Math.round(m[2][0].toLowerCase() === 'm' ? v : v * 60);
    if (mins >= 1 && mins <= 720) { out.dur = mins; title = title.replace(m[0], ' '); }
  }
  m = title.match(/\s(heute|morgen)\s*$/i);
  if (m) { out.day = m[1].toLowerCase() === 'heute' ? dayKey() : addDays(dayKey(), 1); title = title.replace(m[0], ' '); }
  if (/!\s*$/.test(title)) { out.important = true; title = title.replace(/\s*!+\s*$/, ' '); }
  out.title = title.replace(/\s+/g, ' ').trim();
  return out;
}

/* ---------- Aufgabe anlegen / bearbeiten ---------- */
const DURS = [10, 15, 30, 45, 60, 90, 120, 180];
const TIP = 'Tipp: „Sport 45 min um 18:00“ oder „Bericht bis Freitag“.';

/** Kleine Auswahl in der Bildschirmmitte. */
function choose({ count, title, text, options }) {
  const el = document.createElement('div');
  el.className = 'dialog';
  el.setAttribute('role', 'alertdialog');
  el.innerHTML = `${count ? `<div class="count">${count}</div>` : ''}<h3>${title}</h3>${text ? `<p>${text}</p>` : '<p></p>'}
    ${options.map((o, i) => `<button class="btn ${o.cls || 'ghost'}" data-i="${i}">${o.label}</button>`).join('')}`;
  const d = mount(el, { high: true });
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]');
    if (!b) return;
    d.close();
    options[+b.dataset.i].run?.();
  });
  return d;
}

function openTaskSheet(task) {
  const editing = !!task;
  const today = dayKey(), tomorrow = addDays(today, 1);
  const blank = () => ({ title: '', dur: 30, day: ui.tab === 'inbox' ? null : (ui.day >= today ? ui.day : today), fixed: null, important: false, repeat: null, due: null });
  let f = editing
    ? { title: task.title, dur: task.dur, day: task.day, fixed: task.fixed, important: task.important, repeat: S.repeatOf(task), due: task.due || null, note: task.note || '', steps: (task.steps || []).map((x) => ({ ...x })) }
    : blank();
  let base = { ...f };
  let manual = {};
  const el = document.createElement('form');
  el.className = 'sheet' + (editing ? '' : ' top');
  el.noValidate = true;
  el.setAttribute('aria-label', editing ? 'Aufgabe bearbeiten' : 'Neue Aufgabe');
  const dayPlan = editing && task.day && !task.done ? S.schedule(task.day) : null;
  const canOrder = dayPlan && task.fixed == null && dayPlan.items.filter((i) => !i.fixed).length > 1;

  el.innerHTML = `<div class="grabber"></div>
    <input class="title-in" name="title" type="text" enterkeyhint="done" autocomplete="off" autocapitalize="sentences" placeholder="Was ist zu tun?" value="${esc(f.title)}">
    ${editing ? '' : `<p class="hint" id="hint">${TIP}</p>`}
    <div class="dyn"></div>
    ${editing ? `<div class="field"><div class="lbl">Schritte</div><ul class="step-edit"></ul>
        <input class="line-in" name="step" type="text" enterkeyhint="next" autocomplete="off" placeholder="Kleinen Schritt hinzufügen …"></div>
      <div class="field"><div class="lbl">Notiz</div><textarea class="line-in" name="note" rows="2" placeholder="Details, Links, Gedanken …">${esc(f.note)}</textarea></div>
      <div class="quick">
        ${task.done ? '' : `<button type="button" class="btn sun" data-a="start">${icon('play', 'fill')}Starten</button>`}
        ${canOrder ? `<button type="button" class="btn ghost" data-a="next" aria-label="Als Nächstes">${icon('top')}Zuerst</button><button type="button" class="btn ghost" data-a="last" aria-label="Ans Ende">${icon('bottom')}Zuletzt</button>` : ''}
        <button type="button" class="btn danger icon-only" data-a="del" aria-label="Löschen">${icon('trash')}</button></div>` : ''}
    <div class="sheet-actions"><button class="btn ${editing ? '' : 'sun'} wide" type="submit">${editing ? 'Fertig' : 'Hinzufügen'}</button></div>`;

  const dyn = $('.dyn', el), input = $('.title-in', el);
  function draw() {
    const otherDay = f.day && f.day !== today && f.day !== tomorrow;
    const keep = $('.chips', dyn)?.scrollLeft;
    dyn.innerHTML = `
      <div class="field"><div class="lbl split"><span>Dauer</span>
        <span class="stepper"><button type="button" data-step="-1" aria-label="Kürzer">−</button><b>${fmtDur(f.dur)}</b><button type="button" data-step="1" aria-label="Länger">+</button></span></div>
        <div class="chips">${DURS.map((d) => `<button type="button" class="chip ${d === f.dur ? 'on' : ''}" data-dur="${d}">${fmtDur(d)}</button>`).join('')}</div></div>
      <div class="field"><div class="lbl">Wann</div><div class="chips">
        <button type="button" class="chip ${f.day === today ? 'on' : ''}" data-day="${today}">Heute</button>
        <button type="button" class="chip ${f.day === tomorrow ? 'on' : ''}" data-day="${tomorrow}">Morgen</button>
        <button type="button" class="chip ${f.day == null ? 'on' : ''}" data-day="">Später</button>
        <label class="chip ${otherDay ? 'on' : ''}">${icon('cal')}<span>${otherDay ? `${weekdayShort(f.day)} ${dateShort(f.day)}` : 'Datum'}</span><input type="date" name="date" min="${today}" value="${otherDay ? f.day : ''}" aria-label="Datum wählen"></label>
      </div></div>
      <div class="field"><div class="chips">
        <label class="chip ${f.fixed != null ? 'on' : ''}">${icon('clock')}<span>${f.fixed != null ? fmtTime(f.fixed) : 'Uhrzeit'}</span><input type="time" name="time" value="${f.fixed != null ? fmtTime(f.fixed) : ''}" aria-label="Feste Uhrzeit">${f.fixed != null ? `<button type="button" class="clr" data-clr="fixed" aria-label="Uhrzeit entfernen">${icon('x')}</button>` : ''}</label>
        <label class="chip ${f.due ? 'on' : ''}">${icon('flag')}<span>${f.due ? `bis ${weekdayShort(f.due)} ${dateShort(f.due)}` : 'Frist'}</span><input type="date" name="due" min="${today}" value="${f.due || ''}" aria-label="Frist wählen">${f.due ? `<button type="button" class="clr" data-clr="due" aria-label="Frist entfernen">${icon('x')}</button>` : ''}</label>
        <button type="button" class="chip star ${f.important ? 'on' : ''}" data-imp>${icon('star')}Wichtig</button>
        <button type="button" class="chip ${f.repeat ? 'on' : ''}" data-rep>${icon('repeat')}${f.repeat ? (f.repeat === 'weekly' && f.day ? `Jeden ${weekdayShort(f.day)}` : REPEAT[f.repeat]) : 'Einmalig'}</button>
      </div></div>`;
    const row = $('.chips', dyn), on = $('.chip.on', row);
    if (keep != null) row.scrollLeft = keep;
    if (on && (on.offsetLeft + on.offsetWidth > row.scrollLeft + row.clientWidth - 18 || on.offsetLeft < row.scrollLeft + 18)) row.scrollLeft = on.offsetLeft - row.clientWidth / 2 + on.offsetWidth / 2;
  }
  draw();

  const stepList = $('.step-edit', el);
  const drawSteps = () => {
    if (!stepList) return;
    stepList.innerHTML = f.steps.map((x, i) => `<li class="${x.done ? 'd' : ''}"><button type="button" class="sbox" data-si="${i}" aria-label="Schritt abhaken">${icon('check')}</button><span>${esc(x.t)}</span><button type="button" class="sdel" data-sd="${i}" aria-label="Schritt entfernen">${icon('x')}</button></li>`).join('');
  };
  drawSteps();
  const takeStep = () => {
    const i = $('[name=step]', el);
    if (!i) return;
    const v = i.value.trim();
    if (v) { f.steps.push({ t: v, done: false }); i.value = ''; drawSteps(); }
  };

  const applyParsed = () => {
    if (editing) return;
    const p = parseSmart(input.value);
    const got = [];
    for (const k of ['dur', 'fixed', 'day', 'important', 'due']) {
      if (manual[k]) continue;
      f[k] = k in p ? p[k] : base[k];
    }
    if ('dur' in p) got.push(fmtDur(p.dur));
    if ('fixed' in p) got.push(`${fmtTime(p.fixed)} Uhr`);
    if ('day' in p) got.push(dayLabel(p.day));
    if ('due' in p) got.push(`Frist ${weekdayShort(p.due)} ${dateShort(p.due)}`);
    if (p.important) got.push('wichtig');
    $('#hint', el).textContent = got.length ? `Erkannt: ${got.join(' · ')}` : TIP;
    draw();
  };
  input.addEventListener('input', applyParsed);

  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if ('si' in b.dataset) { f.steps[+b.dataset.si].done = !f.steps[+b.dataset.si].done; haptic(); drawSteps(); return; }
    if ('sd' in b.dataset) { f.steps.splice(+b.dataset.sd, 1); drawSteps(); return; }
    if (!dyn.contains(b)) return;
    if ('dur' in b.dataset) { f.dur = +b.dataset.dur; manual.dur = true; }
    else if ('step' in b.dataset) {
      const dir = +b.dataset.step;
      const size = (dir > 0 ? f.dur >= 60 : f.dur > 60) ? 15 : 5;
      f.dur = Math.max(5, Math.min(720, f.dur + dir * size)); manual.dur = true;
    }
    else if ('day' in b.dataset) { f.day = b.dataset.day || null; manual.day = true; if (!f.day) f.repeat = null; }
    else if ('imp' in b.dataset) { f.important = !f.important; manual.important = true; }
    else if ('clr' in b.dataset) { f[b.dataset.clr] = null; manual[b.dataset.clr] = true; e.preventDefault(); }
    else if ('rep' in b.dataset) {
      const seq = [null, 'daily', 'weekdays', 'weekly'];
      f.repeat = seq[(seq.indexOf(f.repeat) + 1) % seq.length];
      if (f.repeat && !f.day) f.day = today;
    } else return;
    haptic();
    draw();
  });
  // Uhrzeit/Datum: Wert direkt übernehmen, aber erst nach dem Schließen des Rads neu zeichnen
  dyn.addEventListener('focusin', (e) => {
    const i = e.target;
    if (i.name === 'time' && !i.value) {
      const next = Math.min(23 * 60, Math.ceil((minutesOf() + 1) / 60) * 60);
      i.value = fmtTime(next); f.fixed = next; manual.fixed = true;
      i.closest('.chip').classList.add('on'); i.previousElementSibling.textContent = i.value;
    }
  });
  dyn.addEventListener('input', (e) => {
    const i = e.target;
    if (i.name === 'time') {
      f.fixed = i.value ? S.parseTime(i.value) : null; manual.fixed = true;
      i.closest('.chip').classList.toggle('on', !!i.value); i.previousElementSibling.textContent = i.value || 'Uhrzeit';
    }
    if (i.name === 'date' && i.value) {
      f.day = i.value < today ? today : i.value; manual.day = true;
      i.closest('.chip').classList.add('on'); i.previousElementSibling.textContent = `${weekdayShort(f.day)} ${dateShort(f.day)}`;
    }
    if (i.name === 'due') {
      f.due = i.value || null; manual.due = true;
      i.closest('.chip').classList.toggle('on', !!f.due); i.previousElementSibling.textContent = f.due ? `bis ${weekdayShort(f.due)} ${dateShort(f.due)}` : 'Frist';
    }
  });
  dyn.addEventListener('focusout', (e) => { if (['time', 'date', 'due'].includes(e.target.name)) setTimeout(draw, 0); });
  // Felder weiter unten im Blatt über die Tastatur holen
  el.addEventListener('focusin', (e) => { if (['step', 'note'].includes(e.target.name)) setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 320); });

  let handled = false;
  const addOne = () => {
    const raw = input.value.trim();
    const p = parseSmart(raw);
    const title = p.title || raw;
    if (!title) return false;
    S.addTask({ ...f, title });
    haptic();
    const where = f.day == null ? 'im Eingang' : f.day === today ? 'für heute' : `für ${f.day === tomorrow ? 'morgen' : weekdayLong(f.day)}`;
    const plan = f.day ? S.schedule(f.day) : null;
    toast(plan && plan.slack < 0 ? `Notiert – ${dayLabel(f.day)} ist jetzt ${fmtDur(-plan.slack)} zu voll` : `Notiert ${where}`);
    return true;
  };
  const finish = () => {
    if (handled) return true;
    if (editing) {
      handled = true;
      takeStep();
      saveEdit(task.id, { ...f, title: input.value.trim() || task.title, note: $('[name=note]', el).value.trim() });
      return true;
    }
    if (!addOne()) { input.focus(); return false; }
    handled = true;
    return true;
  };
  const sheet = mount(el, { onClose: () => { if (editing) finish(); } });
  el.addEventListener('submit', (e) => { e.preventDefault(); if (finish()) sheet.close(true); });
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.isComposing) return;
    if (e.target.name === 'step') { e.preventDefault(); takeStep(); return; }
    if (e.target === input && !editing) {
      // Enter notiert und lässt das Blatt offen – praktisch, um mehrere Dinge hintereinander loszuwerden
      e.preventDefault();
      if (!input.value.trim()) { sheet.close(true); return; }
      if (!addOne()) return;
      const day = manual.day ? f.day : blank().day;
      f = { ...blank(), day }; base = { ...f }; manual = manual.day ? { day: true } : {};
      input.value = '';
      $('#hint', el).textContent = 'Notiert. Gleich die nächste – oder leer bestätigen zum Schließen.';
      draw();
    }
  });
  el.addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (!a) return;
    if (a === 'del') {
      handled = true;
      sheet.close(true);
      const kill = () => { const snap = structuredClone(S.byId(task.id)); S.removeTask(task.id); toast('Gelöscht', () => S.restoreTask(snap)); };
      if (task.routineId && S.repeatOf(task)) {
        choose({ title: 'Wiederholende Aufgabe', text: `„${esc(task.title)}“ kommt regelmäßig wieder.`, options: [
          { label: 'Nur dieses Mal löschen', run: kill },
          { label: 'Ganze Serie beenden', cls: 'danger', run: () => { S.removeRoutine(task.routineId); toast('Serie beendet'); } },
          { label: 'Abbrechen', cls: 'text' },
        ] });
      } else kill();
    }
    if (a === 'next') { finish(); S.makeNext(task.id); sheet.close(true); toast('Kommt als Nächstes dran'); }
    if (a === 'last') { finish(); S.makeLast(task.id); sheet.close(true); toast('Ans Ende gestellt'); }
    if (a === 'start') {
      finish(); sheet.close(true);
      armAudio();
      if (S.byId(task.id)?.day !== today) S.moveTask(task.id, today, { top: true });
      S.startFocus(task.id);
      ui.tab = 'day'; ui.day = today; render();
      openFocus();
    }
  });
  if (!editing) input.focus();
}

function saveEdit(id, f) {
  const task = S.byId(id);
  if (!task) return;
  const patch = {};
  for (const k of ['title', 'dur', 'fixed', 'important', 'due', 'note']) if (f[k] !== (task[k] ?? (k === 'note' ? '' : null))) patch[k] = f[k];
  if (JSON.stringify(f.steps) !== JSON.stringify(task.steps || [])) patch.steps = f.steps;
  if (f.repeat !== S.repeatOf(task)) patch.repeat = f.repeat;
  if (Object.keys(patch).length) S.updateTask(id, patch);
  if (f.day !== task.day) {
    const today = dayKey();
    const later = task.day != null && task.day <= today && !task.done && (f.day == null || f.day > today);
    if (later) postpone(id, f.day);
    else S.moveTask(id, f.day);
  }
}

const whereLabel = (day) => (day == null ? 'in den Eingang' : `auf ${day === addDays(dayKey(), 1) ? 'morgen' : `${weekdayLong(day)}`}`);
function postpone(id, day) {
  const t = S.byId(id);
  if (!t) return;
  if ((t.moved || 0) >= 2) return honesty(t, day);
  const snap = structuredClone(t);
  S.moveTask(id, day, { counts: true });
  toast(t.due && day && day > t.due ? 'Verschoben – liegt jetzt nach der Frist' : `Verschoben ${whereLabel(day)}`, () => S.restoreTask(snap));
}

/* ---------- Der ehrliche Moment: schon mehrfach verschoben ---------- */
function honesty(t, day) {
  const el = document.createElement('div');
  el.className = 'dialog';
  el.setAttribute('role', 'alertdialog');
  el.innerHTML = `<div class="count">${t.moved}×</div><h3>schon verschoben</h3>
    <p>„${esc(t.title)}“ schiebst du vor dir her. Was ist ehrlich?</p>
    <button class="btn sun" data-a="start">${icon('play', 'fill')}Jetzt 10 Minuten anfangen</button>
    <button class="btn ghost" data-a="move">Trotzdem verschieben</button>
    <button class="btn text" data-a="drop">Streichen – ist okay</button>`;
  const d = mount(el, { high: true });
  el.addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (!a) return;
    d.close();
    if (a === 'start') {
      armAudio();
      S.moveTask(t.id, dayKey(), { top: true });
      S.startFocus(t.id, 10);
      ui.tab = 'day'; ui.day = dayKey();
      render();
      openFocus();
    }
    if (a === 'move') { S.moveTask(t.id, day, { counts: true }); toast(`Verschoben ${whereLabel(day)}`); }
    if (a === 'drop') { S.removeTask(t.id); toast('Gestrichen. Ein Ding weniger.'); }
  });
}

/* ============================================================
   Entscheiden: Kartenstapel für Planen, Liegengebliebenes, Tagesabschluss
   ============================================================ */
function capacityHtml(day) {
  const p = S.schedule(day);
  const over = p.planned > p.available;
  const pct = p.available ? Math.min(100, (p.planned / p.available) * 100) : (p.planned ? 100 : 0);
  const right = over
    ? `<span class="over">${icon('warn')}${fmtDur(p.planned - p.available)} zu viel</span>`
    : `<span>${fmtDur(p.planned)} von ${fmtDur(p.available)}</span>`;
  return `<div class="cap-txt"><span>${dayLabel(day)} verplant</span>${right}</div><div class="cap-bar ${over ? 'over' : ''}"><i style="width:${pct}%"></i></div>`;
}

function openDeck(cfg) {
  const el = document.createElement('div');
  el.className = 'flow';
  el.setAttribute('role', 'dialog');
  const queue = cfg.tasks.map((t) => t.id);
  let idx = 0;
  let phase = cfg.intro ? 'intro' : queue.length ? 'cards' : 'outro';
  let busy = false;
  let outro = null;
  const history = [];
  el.innerHTML = `<div class="flow-h"><button class="icon-btn" data-a="close" aria-label="Schließen">${icon('x')}</button><div><h2>${cfg.title}</h2><p class="cnt"></p></div>
      <span class="spacer"></span><button class="icon-btn" data-a="undo" aria-label="Letzte Entscheidung zurücknehmen" hidden>${icon('back')}</button></div>
    <div class="cap" ${cfg.capDay ? '' : 'hidden'}></div><div class="stage"></div><div class="foot-slot"></div>`;
  const stage = $('.stage', el), foot = $('.foot-slot', el), cnt = $('.cnt', el), cap = $('.cap', el);

  const cardHtml = (id, pos) => {
    const t = S.byId(id);
    if (!t) return '';
    const from = t.day ? (t.day < ui.today ? `Von ${dayLabel(t.day, ui.today).toLowerCase() === 'gestern' ? 'gestern' : weekdayLong(t.day)}` : dayLabel(t.day, ui.today)) : 'Aus dem Eingang';
    return `<div class="dcard" data-pos="${pos}" data-id="${id}"><span class="stamp l">${cfg.left.label}</span><span class="stamp r">${cfg.right.label}</span>
      <div class="from">${from}</div><h3>${esc(t.title)}</h3><div class="tags"><span class="tag">${icon('clock')}${fmtDur(t.dur)}</span>${tagsHtml(t)}</div></div>`;
  };

  function draw() {
    if (cfg.capDay) cap.innerHTML = capacityHtml(cfg.capDay);
    $('[data-a=undo]', el).hidden = !history.length || phase === 'intro';
    if (phase === 'intro') {
      cnt.textContent = '';
      stage.innerHTML = `<div class="panel">${cfg.intro.html}</div>`;
      foot.innerHTML = `<div class="flow-foot"><button class="btn main" data-a="go">${queue.length ? 'Weiter' : 'Abschließen'}</button></div>`;
    } else if (phase === 'cards') {
      cnt.textContent = `${idx + 1} von ${queue.length}`;
      stage.innerHTML = [2, 1, 0].map((p) => (queue[idx + p] ? cardHtml(queue[idx + p], p) : '')).join('');
      foot.innerHTML = `<div class="choices"><button class="btn left" data-a="left">${icon('arrowL')}${cfg.left.label}</button>
        <button class="btn right" data-a="right">${cfg.right.label}${icon('arrowR')}</button>
        <button class="btn del" data-a="del">${icon('trash')}Streichen</button></div>`;
      bindCard();
    } else {
      cnt.textContent = '';
      cap.hidden = true;
      outro = cfg.outro();
      stage.innerHTML = `<div class="panel">${outro.html}</div>`;
      foot.innerHTML = `<div class="flow-foot">${outro.buttons.map((b, i) => `<button class="btn ${b.main ? 'main' : 'sec'}" data-a="out" data-i="${i}">${b.label}</button>`).join('')}</div>`;
    }
  }

  function decide(dir, fromX = 0) {
    if (busy || phase !== 'cards') return;
    const card = $('.dcard[data-pos="0"]', stage);
    const t = S.byId(queue[idx]);
    if (!card || !t) return;
    busy = true;
    haptic();
    card.classList.remove('drag');
    const tx = dir === 'right' ? 460 : dir === 'left' ? -460 : 0;
    card.style.transform = dir === 'del' ? 'translateY(120px) scale(.7)' : `translate(${tx}px, ${fromX ? 30 : 60}px) rotate(${tx / 22}deg)`;
    card.style.opacity = '0';
    history.push(JSON.stringify({ tasks: S.state.tasks, slips: S.state.slips }));
    if (dir === 'del') S.removeTask(t.id); else cfg[dir].run(t);
    idx++;
    setTimeout(() => { busy = false; if (idx >= queue.length) phase = 'outro'; draw(); }, 260);
  }

  function bindCard() {
    const card = $('.dcard[data-pos="0"]', stage);
    if (!card) return;
    let x0 = 0, y0 = 0, dx = 0, on = false;
    const sl = $('.stamp.l', card), sr = $('.stamp.r', card);
    card.addEventListener('pointerdown', (e) => { if (busy) return; on = true; x0 = e.clientX; y0 = e.clientY; dx = 0; card.setPointerCapture(e.pointerId); card.classList.add('drag'); });
    card.addEventListener('pointermove', (e) => {
      if (!on) return;
      dx = e.clientX - x0;
      card.style.transform = `translate(${dx}px, ${(e.clientY - y0) * 0.25}px) rotate(${dx / 18}deg)`;
      sr.style.opacity = Math.max(0, Math.min(1, dx / 80)); sl.style.opacity = Math.max(0, Math.min(1, -dx / 80));
    });
    const up = () => {
      if (!on) return;
      on = false; card.classList.remove('drag');
      if (Math.abs(dx) > 84) decide(dx > 0 ? 'right' : 'left', dx);
      else { card.style.transform = ''; sr.style.opacity = sl.style.opacity = 0; }
    };
    card.addEventListener('pointerup', up);
    card.addEventListener('pointercancel', up);
  }

  const flow = mount(el, { backdrop: false, onClose: () => cfg.onClose?.() });
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    const a = b.dataset.a;
    if (a === 'close') flow.close();
    else if (a === 'undo') {
      if (busy || !history.length) return;
      const snap = JSON.parse(history.pop());
      S.commit((st) => { st.tasks = snap.tasks; st.slips = snap.slips; });
      idx--; phase = 'cards'; cap.hidden = !cfg.capDay; haptic(); draw();
    }
    else if (a === 'go') { phase = queue.length ? 'cards' : 'outro'; draw(); }
    else if (a === 'out') { const btn = outro.buttons[+b.dataset.i]; flow.close(); btn.run?.(); }
    else decide(a);
  });
  draw();
  return flow;
}

function openPlan(day, { onlyLeft = false } = {}) {
  const today = dayKey();
  if (day < today) day = today;
  const lbl = dayLabel(day, today);
  const tasks = [...S.leftovers(today), ...(onlyLeft ? [] : S.inbox())];
  if (!tasks.length) { toast('Nichts zu verteilen'); return; }
  if (!onlyLeft && day === today) S.commit((st) => { st.planned[today] = true; }, { animate: false });
  openDeck({
    title: onlyLeft ? 'Liegen geblieben' : `${lbl} planen`,
    tasks, capDay: day,
    right: { label: lbl, run: (t) => S.moveTask(t.id, day, { counts: !!t.day }) },
    left: { label: 'Später', run: (t) => { if (t.day) S.moveTask(t.id, null, { counts: true }); } },
    outro: () => {
      const p = S.schedule(day);
      const n = p.items.length;
      if (!n) return { html: '<h3>Nichts eingeplant.</h3><p>Auch gut. Der Eingang läuft nicht weg.</p>', buttons: [{ label: 'Schließen', main: true }] };
      return {
        html: `<h3>${day === today ? 'Dein Tag steht.' : `${lbl} steht.`}</h3><p>${plural(n, 'Aufgabe', 'Aufgaben')} · ${fmtDur(p.planned)} · fertig gegen ${fmtTime(p.end)}</p>
          ${p.slack < 0 ? `<p><b>Achtung:</b> Das sind ${fmtDur(-p.slack)} mehr, als der Tag hergibt. Lieber noch etwas streichen.</p>` : ''}`,
        buttons: [{ label: day === today ? 'Los geht’s' : 'Passt', main: true, run: () => { ui.tab = 'day'; ui.day = day; render(); scrollTo({ top: 0 }); } }],
      };
    },
  });
}

function openDue() {
  const today = dayKey();
  const tasks = S.dueRisk(today);
  if (!tasks.length) return;
  openDeck({
    title: 'Fristen',
    tasks, capDay: today,
    right: { label: 'Heute', run: (t) => S.moveTask(t.id, today, { counts: !!t.day && t.day < today, top: true }) },
    left: { label: 'Nicht heute', run: () => {} },
    outro: () => {
      const rest = S.dueRisk(today).length;
      return { html: rest ? `<h3>${plural(rest, 'Frist bleibt', 'Fristen bleiben')} offen.</h3><p>Du hast dich bewusst dagegen entschieden. Die Erinnerung bleibt stehen, bis es eingeplant, erledigt oder gestrichen ist.</p>` : '<h3>Alle Fristen im Griff.</h3><p>Die fälligen Aufgaben stehen heute ganz oben.</p>',
        buttons: [{ label: 'Weiter', main: true, run: () => { ui.tab = 'day'; ui.day = today; render(); } }] };
    },
  });
}

function openLate() {
  const today = dayKey();
  const day = ui.day < today ? today : ui.day;
  const next = addDays(day, 1);
  const tasks = S.schedule(day).late.filter((i) => !i.running).map((i) => i.task);
  if (!tasks.length) return;
  openDeck({
    title: 'Das passt nicht mehr',
    tasks, capDay: day,
    right: { label: dayLabel(next, today), run: (t) => S.moveTask(t.id, next, { counts: day === today }) },
    left: { label: 'Später', run: (t) => S.moveTask(t.id, null, { counts: day === today }) },
    outro: () => {
      const p = S.schedule(day);
      return p.late.length
        ? { html: `<h3>Immer noch eng.</h3><p>${plural(p.late.length, 'Aufgabe liegt', 'Aufgaben liegen')} weiter hinter dem Tagesende. Kürzere Dauer oder weniger vornehmen.</p>`, buttons: [{ label: 'Verstanden', main: true }] }
        : { html: `<h3>Jetzt ist es machbar.</h3><p>${p.items.length ? `Fertig gegen ${fmtTime(p.end)}.` : 'Der Tag ist frei.'}</p>`, buttons: [{ label: 'Weiter', main: true }] };
    },
  });
}

function openCloseDay() {
  const today = dayKey(), tomorrow = addDays(today, 1);
  const all = S.tasksOf(today);
  const done = all.filter((t) => t.done).length;
  const open = [...all.filter((t) => !t.done && !t.routineId), ...S.leftovers(today)];
  const total = all.length;
  const st = S.stats();
  const verdict = !total ? 'Kein Plan, kein Druck.' : done === total ? 'Alles geschafft. Stark.' : done >= total / 2 ? 'Mehr als die Hälfte. Solide.' : 'Morgen wird besser geplant.';
  openDeck({
    title: 'Tagesabschluss',
    tasks: open,
    intro: { html: `<div class="big">${done}<small> von ${total}</small></div><h3>${verdict}</h3><p>${st.streak > 1 ? `${st.streak} Tage in Folge etwas erledigt.` : ''} ${open.length ? `${plural(open.length, 'Aufgabe ist', 'Aufgaben sind')} noch offen – entscheide bewusst, was damit passiert.` : ''}</p>` },
    right: { label: 'Morgen', run: (t) => S.moveTask(t.id, tomorrow, { counts: true }) },
    left: { label: 'Später', run: (t) => S.moveTask(t.id, null, { counts: true }) },
    outro: () => {
      S.commit((s) => { s.closed[today] = true; if (s.focus) s.focus = null; });
      const p = S.schedule(tomorrow);
      const inboxN = S.inbox().length;
      const buttons = [];
      if (inboxN) buttons.push({ label: `Morgen planen · ${inboxN} im Eingang`, main: true, run: () => { ui.tab = 'day'; ui.day = tomorrow; render(); openPlan(tomorrow); } });
      buttons.push({ label: 'Feierabend', main: !inboxN });
      return {
        html: `<h3>Tag abgeschlossen.</h3><p>${p.items.length ? `Für morgen ${p.items.length === 1 ? 'steht' : 'stehen'} ${plural(p.items.length, 'Aufgabe', 'Aufgaben')} bereit (${fmtDur(p.planned)}).` : 'Für morgen ist noch nichts geplant.'}</p>`,
        buttons,
      };
    },
  });
}

/* ============================================================
   Fokus-Timer
   ============================================================ */
const clockText = (sec) => {
  const neg = sec < 0;
  const s = Math.abs(Math.round(sec));
  return `${neg ? '+' : ''}${S.pad(Math.floor(s / 60))}:${S.pad(s % 60)}`;
};
let focusUI = null, wakeLock = null, chimedKey = null;
const RING = 2 * Math.PI * 120;

async function keepAwake(on) {
  try {
    if (on && navigator.wakeLock && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { /* nicht verfügbar */ }
}

function openFocus() {
  const f = S.state.focus;
  if (focusUI || !f) return;
  const t = S.byId(f.taskId);
  if (!t) return;
  const el = document.createElement('div');
  el.className = 'focus';
  el.setAttribute('role', 'dialog');
  el.innerHTML = `<div class="focus-top"><button class="icon-btn" data-a="min" aria-label="Verkleinern">${icon('chevD')}</button><span class="eyebrow">Fokus</span><button class="icon-btn" data-a="stop" aria-label="Timer beenden">${icon('x')}</button></div>
    <h2>${esc(t.title)}</h2>
    <div class="f-steps">${stepsHtml(t, 'data-a="step"')}</div>
    <div class="ring"><svg viewBox="0 0 260 260"><circle class="track" cx="130" cy="130" r="120"/><circle class="prog" cx="130" cy="130" r="120" stroke-dasharray="${RING.toFixed(1)}" stroke-dashoffset="${RING.toFixed(1)}"/></svg>
      <div class="ring-in"><b id="fTime"></b><span id="fSub"></span></div></div>
    <div class="focus-btns"><button class="btn" data-a="more">+5 Min</button><button class="btn" data-a="pause" id="fPause"></button></div>
    <button class="btn main" data-a="done">${icon('check')}Erledigt</button>`;
  focusUI = mount(el, { backdrop: false, onClose: () => { focusUI = null; keepAwake(false); } });
  el.addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (!a) return;
    if (a === 'step') { const b = e.target.closest('[data-a]'); S.toggleStep(b.dataset.id, +b.dataset.i); haptic(); $('.f-steps', el).innerHTML = stepsHtml(S.byId(b.dataset.id), 'data-a="step"'); return; }
    if (a === 'min') focusUI.close();
    if (a === 'stop') { S.stopFocus(); focusUI?.close(); toast('Timer beendet'); }
    if (a === 'more') { S.extendFocus(5); haptic(); tickSecond(); }
    if (a === 'pause') { armAudio(); S.toggleFocusPause(); haptic(); tickSecond(); }
    if (a === 'done') { const id = S.state.focus?.taskId; focusUI.close(); if (id) complete(id); }
  });
  keepAwake(true);
  tickSecond();
}

function tickSecond() {
  const f = S.state.focus;
  if (!f) { if (focusUI) focusUI.close(); return; }
  const rem = S.focusRemaining();
  const total = S.focusTotal();
  const nt = $('#nowTimer');
  if (nt) nt.textContent = clockText(rem);
  if (rem <= 0 && !f.pausedAt) {
    const key = `${f.taskId}:${f.startedAt}:${f.extra}`;
    if (chimedKey !== key) { chimedKey = key; chime(); haptic(); if (!focusUI && !stack.length) toast('Zeit ist um – fertig geworden?'); }
  }
  if (!focusUI) return;
  const el = focusUI.el;
  $('#fTime', el).textContent = clockText(rem);
  $('#fSub', el).textContent = f.pausedAt ? 'Pausiert' : rem <= 0 ? 'Zeit ist um – fertig geworden?' : `bis ${fmtTime(minutesOf() + Math.ceil(rem / 60))} Uhr`;
  $('#fPause', el).innerHTML = f.pausedAt ? `${icon('play', 'fill')}Weiter` : `${icon('pause')}Pause`;
  const frac = total ? Math.max(0, Math.min(1, 1 - rem / total)) : 1;
  $('.prog', el).style.strokeDashoffset = (RING * (1 - frac)).toFixed(1);
  $('.ring', el).classList.toggle('over', rem <= 0);
}

/* ============================================================
   Rückblick & Einstellungen
   ============================================================ */
const WD_ORDER = [1, 2, 3, 4, 5, 6, 0];
const WD_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
function daysText(days) {
  const d = WD_ORDER.filter((x) => days.includes(x));
  if (d.length === 7) return 'täglich';
  if (d.join() === '1,2,3,4,5') return 'Mo–Fr';
  if (d.join() === '6,0') return 'Sa, So';
  return d.map((x) => WD_SHORT[x]).join(', ');
}

function openMore(scrollTo) {
  const el = document.createElement('div');
  el.className = 'sheet';
  el.setAttribute('role', 'dialog');
  function draw() {
    const st = S.stats();
    const s = S.state.settings;
    const max = Math.max(1, ...st.days.map((d) => d.done));
    const sel = st.days[ui.barSel];
    const estTxt = st.est == null ? '–' : st.est > 4 ? `+${st.est} %` : st.est < -4 ? `${st.est} %` : '±0';
    const estSub = st.est == null ? 'Schätzung: noch zu wenig Timer-Daten' : st.est > 4 ? 'länger als geschätzt' : st.est < -4 ? 'schneller als geschätzt' : 'Schätzung passt';
    const keep = el.scrollTop;
    el.innerHTML = `<div class="grabber"></div>
      <div class="sheet-h"><h2>Rückblick</h2><button class="icon-btn" data-a="close" aria-label="Schließen">${icon('x')}</button></div>
      <div class="tiles">
        <div class="tile"><b>${st.streak}</b><span>${st.streak === 1 ? 'Tag' : 'Tage'} in Folge aktiv</span></div>
        <div class="tile"><b>${st.rate == null ? '–' : `${st.rate} %`}</b><span>${st.rate == null ? 'erledigt statt verschoben' : `erledigt, ${st.slipped}× verschoben`}</span></div>
        <div class="tile"><b>${estTxt}</b><span>${estSub}</span></div>
      </div>
      <div class="chart" role="group" aria-label="Erledigte Aufgaben der letzten 7 Tage">
        <div class="chart-h"><span>Erledigt pro Tag</span><span><b>${sel.done}</b> · ${dayLabel(sel.day)}${sel.day === dayKey() ? '' : `, ${dateShort(sel.day)}`}</span></div>
        <div class="bars">${st.days.map((d, i) => `<button class="bar-slot ${i === ui.barSel ? 'sel' : ''} ${d.done ? '' : 'zero'}" data-bar="${i}" aria-label="${weekdayLong(d.day)}: ${d.done} erledigt"><i style="height:${Math.round((d.done / max) * 88)}%"></i></button>`).join('')}</div>
        <div class="bar-x">${st.days.map((d, i) => `<span class="${i === ui.barSel ? 'sel' : ''}">${weekdayShort(d.day)}</span>`).join('')}</div>
      </div>
      ${st.stuck.length ? `<div class="group-h">Schiebst du vor dir her</div><div class="mini">${st.stuck.slice(0, 3).map((t) => `<button data-task="${t.id}"><span>${esc(t.title)}</span><b>${t.moved}×</b></button>`).join('')}</div>` : ''}

      <div class="group-h" id="blocksH">Belegte Zeiten</div>
      <div class="mini">${S.state.blocks.map((b) => `<button data-block="${b.id}"><span>${esc(b.name)}<small>${daysText(b.days)} · ${fmtTime(b.start)}–${fmtTime(b.end)}</small></span>${icon('chevR')}</button>`).join('')}
        <button data-block="new" class="add-line">${icon('plus')}<span>Arbeit, Uni, Pause … hinzufügen</span></button></div>

      <div class="group-h">Dein Tag</div>
      <div class="set-row"><span>Beginnt um</span><input type="time" name="dayStart" value="${fmtTime(s.dayStart)}"></div>
      <div class="set-row"><span>Endet um</span><input type="time" name="dayEnd" value="${fmtTime(s.dayEnd)}"></div>
      <div class="set-row"><span>Puffer zwischen Aufgaben</span><div class="seg">${[0, 5, 10, 15].map((k) => `<button data-buffer="${k}" class="${(s.buffer || 0) === k ? 'on' : ''}">${k || 'aus'}</button>`).join('')}</div></div>
      <div class="set-row"><span>Darstellung</span><div class="seg">${[['auto', 'Tageszeit'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([k, l]) => `<button data-theme-set="${k}" class="${s.theme === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>

      <div class="group-h">Daten</div>
      <div class="quick" style="margin-top:0"><button class="btn ghost" data-a="export">${icon('save')}Sichern</button><button class="btn ghost" data-a="import">${icon('open')}Laden</button></div>
      <button class="btn text wide" data-a="reset" style="color:var(--warn)">Alles löschen</button>
      <input type="file" accept="application/json,.json" hidden>
      <p class="fine">Deine Aufgaben liegen nur auf diesem Gerät. Eine Sicherung ab und zu schadet nicht.${S.isStorageOk() ? '' : ' <b>Achtung: Speichern ist gerade nicht möglich.</b>'}</p>`;
    el.scrollTop = keep;
  }
  draw();
  const sheet = mount(el);
  if (scrollTo) setTimeout(() => $(scrollTo, el)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 420);
  el.addEventListener('click', async (e) => {
    const bar = e.target.closest('[data-bar]');
    if (bar) { ui.barSel = +bar.dataset.bar; draw(); return; }
    const th = e.target.closest('[data-theme-set]');
    if (th) { S.commit((s) => { s.settings.theme = th.dataset.themeSet; }); draw(); return; }
    const bf = e.target.closest('[data-buffer]');
    if (bf) { S.commit((s) => { s.settings.buffer = +bf.dataset.buffer; }); draw(); return; }
    const bl = e.target.closest('[data-block]');
    if (bl) { openBlockEditor(S.state.blocks.find((b) => b.id === bl.dataset.block) || null, draw); return; }
    const tk = e.target.closest('[data-task]');
    if (tk) { sheet.close(); const t = S.byId(tk.dataset.task); if (t) setTimeout(() => openTaskSheet(t), 200); return; }
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'close') sheet.close();
    if (a === 'export') exportBackup();
    if (a === 'import') $('input[type=file]', el).click();
    if (a === 'reset' && confirm('Wirklich alle Aufgaben und Einstellungen löschen?')) { S.resetAll(); draw(); toast('Alles gelöscht'); }
  });
  el.addEventListener('change', async (e) => {
    const i = e.target;
    if (i.type === 'file' && i.files[0]) {
      try { S.importData(await i.files[0].text()); draw(); toast('Sicherung geladen'); } catch (err) { toast('Das ist keine Tagwerk-Sicherung'); }
      i.value = '';
    }
    if (i.name === 'dayStart' || i.name === 'dayEnd') {
      const v = S.parseTime(i.value);
      if (v == null) return;
      const s = S.state.settings;
      const start = i.name === 'dayStart' ? v : s.dayStart, end = i.name === 'dayEnd' ? v : s.dayEnd;
      if (end - start < 120) { toast(end < start ? 'Das Tagesende muss vor Mitternacht liegen' : 'Dein Tag braucht mindestens 2 Stunden'); i.value = fmtTime(s[i.name]); return; }
      S.commit((st) => { st.settings.dayStart = start; st.settings.dayEnd = end; });
    }
  });
}

function openBlockEditor(block, onDone) {
  const b = block ? { ...block, days: [...block.days] } : { name: '', start: 9 * 60, end: 17 * 60, days: [1, 2, 3, 4, 5] };
  const el = document.createElement('div');
  el.className = 'dialog form';
  el.setAttribute('role', 'dialog');
  const daysHtml = () => WD_ORDER.map((wd) => `<button type="button" class="daychip ${b.days.includes(wd) ? 'on' : ''}" data-wd="${wd}">${WD_SHORT[wd]}</button>`).join('');
  el.innerHTML = `<h3>Belegte Zeit</h3><p>In dieser Zeit plant Tagwerk nichts ein.</p>
    <input class="line-in" name="name" type="text" autocomplete="off" placeholder="z. B. Arbeit, Uni, Mittagspause" value="${esc(b.name)}">
    <div class="set-row"><span>Von</span><input type="time" name="start" value="${fmtTime(b.start)}"></div>
    <div class="set-row"><span>Bis</span><input type="time" name="end" value="${fmtTime(b.end)}"></div>
    <div class="days">${daysHtml()}</div>
    <button class="btn" data-a="save">Speichern</button>
    ${block ? '<button class="btn text" data-a="del" style="color:var(--warn)">Löschen</button>' : '<button class="btn text" data-a="cancel">Abbrechen</button>'}`;
  const d = mount(el, { high: true });
  el.addEventListener('click', (e) => {
    const wd = e.target.closest('[data-wd]');
    if (wd) { const n = +wd.dataset.wd; b.days = b.days.includes(n) ? b.days.filter((x) => x !== n) : [...b.days, n]; $('.days', el).innerHTML = daysHtml(); return; }
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (!a) return;
    if (a === 'save') {
      const start = S.parseTime($('[name=start]', el).value), end = S.parseTime($('[name=end]', el).value);
      if (start == null || end == null || end - start < 5) { toast('Das Ende muss nach dem Anfang liegen'); return; }
      if (!b.days.length) { toast('Mindestens einen Wochentag wählen'); return; }
      S.saveBlock({ ...b, name: $('[name=name]', el).value.trim() || 'Belegt', start, end });
      S.commit((s) => { s.settings.blockHint = true; }, { animate: false });
    }
    if (a === 'del') S.removeBlock(b.id);
    d.close();
    onDone?.();
  });
}

/* ---------- Wochenübersicht: die nächsten 14 Tage auf einen Blick ---------- */
function openWeek() {
  const today = dayKey();
  const el = document.createElement('div');
  el.className = 'sheet';
  el.setAttribute('role', 'dialog');
  let rows = '';
  for (let i = 0; i < 14; i++) {
    const day = addDays(today, i);
    S.materialize(day);
    const p = S.schedule(day);
    const n = p.items.length;
    const over = n && p.slack < 0;
    const pct = p.available ? Math.min(100, (p.planned / p.available) * 100) : (n ? 100 : 0);
    const dues = S.state.tasks.filter((t) => t.due === day && !t.done && !t.gone).length;
    const info = n ? `${plural(n, 'Aufgabe', 'Aufgaben')} · ${fmtDur(p.planned)}${over ? ` · ${fmtDur(-p.slack)} zu viel` : ''}` : 'frei';
    const titles = p.items.slice(0, 3).map((x) => esc(x.task.title)).join(' · ');
    rows += `<button class="wk ${day === ui.day ? 'cur' : ''}" data-day="${day}">
      <span class="wk-d"><b>${i < 2 ? dayLabel(day, today) : weekdayLong(day)}</b><small>${dateShort(day)}</small></span>
      <span class="wk-m"><span class="wk-bar ${over ? 'over' : ''}"><i style="width:${pct}%"></i></span><small>${over ? icon('warn') : ''}${info}</small>${titles ? `<small class="wk-t">${titles}${n > 3 ? ' …' : ''}</small>` : ''}</span>
      ${dues ? `<span class="wk-due">${icon('flag')}${dues}</span>` : ''}</button>`;
  }
  el.innerHTML = `<div class="grabber"></div><div class="sheet-h"><h2>Die nächsten Tage</h2><button class="icon-btn" data-a="close" aria-label="Schließen">${icon('x')}</button></div>
    <div class="wk-list">${rows}</div><p class="fine">Balken: verplante Zeit im Verhältnis zur freien Zeit des Tages. Fähnchen: Fristen an diesem Tag.</p>`;
  const sheet = mount(el);
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-a=close]')) { sheet.close(); return; }
    const b = e.target.closest('[data-day]');
    if (b) { sheet.close(); ui.tab = 'day'; setDay(b.dataset.day); scrollTo({ top: 0 }); }
  });
}

async function exportBackup() {
  const name = `tagwerk-${dayKey()}.json`;
  const data = S.exportData();
  try {
    const file = new File([data], name, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'Tagwerk-Sicherung' }); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------- Erster Start ---------- */
function openOnboarding() {
  const el = document.createElement('div');
  el.className = 'onb';
  const s = S.state.settings;
  el.innerHTML = `<svg class="logo" viewBox="0 0 150 90" aria-hidden="true"><path d="M10 80A65 65 0 01140 80" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2" stroke-dasharray=".1 8" stroke-linecap="round"/>
      <path d="M10 80A65 65 0 0143 32" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="43" cy="32" r="22" fill="#FFD769" opacity=".35"/><circle cx="43" cy="32" r="11" fill="#FFE9A8"/></svg>
    <h1>Tagwerk</h1>
    <p class="lead">Dein Tag ist ein Sonnenbogen. Was du dir vornimmst, liegt auf dem Bogen – was du schaffst, leuchtet. Wann beginnt und endet dein Tag?</p>
    <div class="times"><div class="set-row"><span>Mein Tag beginnt um</span><input type="time" name="s" value="${fmtTime(s.dayStart)}"></div>
      <div class="set-row"><span>und endet um</span><input type="time" name="e" value="${fmtTime(s.dayEnd)}"></div></div>
    <button class="btn">Los geht’s</button>`;
  const o = mount(el, { backdrop: false });
  $('.btn', el).addEventListener('click', () => {
    const a = S.parseTime($('[name=s]', el).value) ?? s.dayStart, b = S.parseTime($('[name=e]', el).value) ?? s.dayEnd;
    S.commit((st) => { if (b - a >= 120) { st.settings.dayStart = a; st.settings.dayEnd = b; } st.settings.onboarded = true; });
    o.close();
  });
}

/* ============================================================
   Aktionen
   ============================================================ */
function complete(id, host) {
  const t = S.byId(id);
  if (!t || t.done) return;
  const snap = structuredClone(t);
  const focusSnap = S.state.focus ? { ...S.state.focus } : null;
  host?.classList.add('checking');
  haptic();
  setTimeout(() => {
    S.setDone(id, true);
    const openLeft = S.tasksOf(ui.today).filter((x) => !x.done).length;
    const undo = () => S.commit((s) => { const i = s.tasks.findIndex((x) => x.id === id); if (i >= 0) s.tasks[i] = snap; s.focus = focusSnap; });
    if (!openLeft && snap.day === ui.today) {
      sky.classList.add('burst');
      setTimeout(() => sky.classList.remove('burst'), 1700);
      toast('Tagwerk vollbracht.', undo);
    } else toast('Erledigt', undo);
  }, host ? 360 : 0);
}

const actions = {
  done: (id, b) => complete(id, b.closest('.row, .now, .inbox-row')),
  undone: (id) => S.setDone(id, false),
  edit: (id) => { const t = S.byId(id); if (t) openTaskSheet(t); },
  add: () => openTaskSheet(null),
  start: (id) => { armAudio(); S.startFocus(id); openFocus(); },
  focus: () => openFocus(),
  plan: () => openPlan(ui.day),
  'plan-today': () => openPlan(dayKey()),
  'decide-left': () => openPlan(dayKey(), { onlyLeft: true }),
  'decide-late': () => openLate(),
  'decide-due': () => openDue(),
  step: (id, b) => { S.toggleStep(id, +b.dataset.i); haptic(); },
  'skip-plan': () => S.commit((s) => { s.planned[dayKey()] = true; }),
  blocks: () => openMore('#blocksH'),
  'dismiss-blockhint': () => S.commit((s) => { s.settings.blockHint = true; }),
  'skip-block': (id) => {
    const day = ui.day, name = S.state.blocks.find((b) => b.id === id)?.name || 'Belegte Zeit';
    S.skipBlock(day, id);
    toast(`${name}: ${day === dayKey() ? 'heute' : 'an diesem Tag'} frei`, () => S.skipBlock(day, id, false));
  },
  'close-day': () => openCloseDay(),
  'toggle-done': () => { ui.doneOpen = !ui.doneOpen; render(); },
  'goto-tomorrow': () => { ui.day = addDays(dayKey(), 1); render({ animate: true }); scrollTo({ top: 0 }); },
  'dismiss-hint': () => S.commit((s) => { s.settings.hintDismissed = true; }),
  'to-today': (id) => {
    const t = S.byId(id);
    if (!t) return;
    const snap = structuredClone(t);
    S.moveTask(id, dayKey(), { counts: !!t.day });
    haptic();
    toast('Für heute eingeplant', () => S.restoreTask(snap));
  },
};

let suppressClick = false;
view.addEventListener('click', (e) => {
  if (suppressClick) { e.preventDefault(); return; }
  const b = e.target.closest('[data-act]');
  if (!b) return;
  actions[b.dataset.act]?.(b.dataset.id, b);
});

function setDay(day) {
  ui.day = day; ui.doneOpen = false;
  render({ animate: true });
}
$('#prevDay').addEventListener('click', () => setDay(addDays(ui.day, -1)));
$('#nextDay').addEventListener('click', () => setDay(addDays(ui.day, 1)));
$('#todayBtn').addEventListener('click', () => setDay(dayKey()));
$('#dayLabel').addEventListener('click', openWeek);
$('#moreBtn').addEventListener('click', () => openMore());
$('#addBtn').addEventListener('click', () => { haptic(); openTaskSheet(null); });
$('#tabDay').addEventListener('click', () => { if (ui.tab === 'day') ui.day = dayKey(); ui.tab = 'day'; render({ animate: true }); scrollTo({ top: 0 }); });
$('#tabInbox').addEventListener('click', () => { ui.tab = 'inbox'; render({ animate: true }); scrollTo({ top: 0 }); });

// Wischen über den Himmel wechselt den Tag
let swipe = null;
sky.addEventListener('touchstart', (e) => { const t = e.touches[0]; swipe = { x: t.clientX, y: t.clientY }; }, { passive: true });
sky.addEventListener('touchend', (e) => {
  if (!swipe || ui.tab !== 'day') return;
  const t = e.changedTouches[0];
  const dx = t.clientX - swipe.x, dy = t.clientY - swipe.y;
  swipe = null;
  if (Math.abs(dx) > 56 && Math.abs(dy) < 44) {
    const next = addDays(ui.day, dx < 0 ? 1 : -1);
    if (next >= addDays(ui.today, -14) && next <= addDays(ui.today, 60)) setDay(next);
  }
}, { passive: true });

/* ---------- Umsortieren: lange drücken, dann ziehen ---------- */
let dragging = null, press = null;
function cancelPress() { if (press) { clearTimeout(press.timer); press = null; } }
function beginDrag(row, y) {
  const list = row.parentElement;
  const rows = $$('.row[data-drag]', list);
  if (rows.length < 2) return;
  const rects = rows.map((r) => r.getBoundingClientRect());
  const i = rows.indexOf(row);
  dragging = { row, rows, rects, from: i, to: i, y0: y, list, step: rects[i].height + 8 };
  list.classList.add('sorting');
  row.classList.add('dragging');
  haptic();
}
function moveDrag(y) {
  const d = dragging;
  const dy = y - d.y0;
  d.row.style.transform = `translateY(${dy}px)`;
  const mid = d.rects[d.from].top + d.rects[d.from].height / 2 + dy;
  let to = 0;
  d.rects.forEach((r, i) => { if (i !== d.from && r.top + r.height / 2 < mid) to++; });
  if (to !== d.to) { d.to = to; haptic(); }
  d.rows.forEach((r, i) => {
    if (i === d.from) return;
    let shift = 0;
    if (d.from < d.to && i > d.from && i <= d.to) shift = -d.step;
    if (d.from > d.to && i >= d.to && i < d.from) shift = d.step;
    r.style.transform = shift ? `translateY(${shift}px)` : '';
  });
}
function endDrag() {
  const d = dragging;
  dragging = null;
  d.list.classList.remove('sorting');
  const ids = d.rows.map((r) => r.dataset.id);
  const [moved] = ids.splice(d.from, 1);
  ids.splice(d.to, 0, moved);
  // Die Aufgabe in der „Jetzt“-Karte bleibt vorn
  const first = $('.now', view)?.dataset.id;
  const firstTask = first && S.byId(first);
  const order = firstTask && firstTask.fixed == null ? [first, ...ids] : ids;
  suppressClick = true;
  setTimeout(() => { suppressClick = false; }, 350);
  lastHtml = null;
  if (d.from !== d.to) S.commit(() => { order.forEach((id, i) => { const t = S.byId(id); if (t) t.order = i; }); }, { animate: false });
  else render();
}
view.addEventListener('touchstart', (e) => {
  if (e.touches.length > 1 || dragging) return;
  const row = e.target.closest('.row[data-drag]');
  if (!row) return;
  const t = e.touches[0];
  press = { x: t.clientX, y: t.clientY, timer: setTimeout(() => { const p = press; press = null; if (p) beginDrag(row, p.y); }, 380) };
}, { passive: true });
view.addEventListener('touchmove', (e) => {
  const t = e.touches[0];
  if (dragging) { e.preventDefault(); moveDrag(t.clientY); return; }
  if (press && (Math.abs(t.clientY - press.y) > 8 || Math.abs(t.clientX - press.x) > 8)) cancelPress();
}, { passive: false });
const touchDone = () => { cancelPress(); if (dragging) endDrag(); };
view.addEventListener('touchend', touchDone);
view.addEventListener('touchcancel', touchDone);
view.addEventListener('contextmenu', (e) => { if (e.target.closest('.row')) e.preventDefault(); });

/* ---------- Scrollen: Himmel wandert langsamer mit ---------- */
let raf = 0;
const skyInner = $('#skyInner'), ground = $('#ground');
addEventListener('scroll', () => {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    const y = Math.max(0, scrollY);
    skyInner.style.transform = `translate3d(0, ${(-Math.min(y, 500) * 0.22).toFixed(1)}px, 0)`;
    app.classList.toggle('scrolled', y > ground.offsetTop - 70);
  });
}, { passive: true });

/* ---------- Tastatur: sichtbare Höhe mitführen, damit nichts dahinter verschwindet ---------- */
const vv = window.visualViewport;
if (vv) {
  const sync = () => {
    root.style.setProperty('--vvh', `${Math.round(vv.height)}px`);
    root.style.setProperty('--kb', `${Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))}px`);
  };
  vv.addEventListener('resize', sync);
  vv.addEventListener('scroll', sync);
  sync();
}

/* ---------- Start ---------- */
$('#prevDay').innerHTML = icon('chevL');
$('#nextDay').innerHTML = icon('chevR');
$('#moreBtn').innerHTML = icon('tune');
$('#tabDay .ico').innerHTML = icon('horizon');
$('#tabInbox .ico').innerHTML = icon('inbox');
$('#addBtn .ico').innerHTML = icon('plus');
buildStars($('#stars'));

S.load();
S.subscribe((opts) => render({ animate: opts.animate !== false }));
render();
if (!S.state.settings.onboarded) openOnboarding();
if (S.state.focus) tickSecond();

setInterval(tickSecond, 1000);
setInterval(() => { if (!dragging) render(); }, 20000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  render();
  tickSecond();
  if (focusUI) keepAwake(true);
});
addEventListener('pageshow', () => render());

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
