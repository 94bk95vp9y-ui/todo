// Tagwerk – der Himmel: Farben nach Tageszeit, Sonnenbogen mit Aufgaben

import { fmtTime, minutesOf } from './store.js';

const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rgb = (c, a = 1) => (a === 1 ? `rgb(${c.map(Math.round).join(' ')})` : `rgb(${c.map(Math.round).join(' ')} / ${a})`);
const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const contrast = (a, b) => { const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05); };

// p = Fortschritt des eigenen Tages: 0 = Tagesbeginn (Sonnenaufgang), 1 = Tagesende (Sonnenuntergang)
const KEYS = [
  { p: -0.12, top: '#0A0F2C', mid: '#191C4C', bot: '#35296A', sun: '#FFB45A' },
  { p: 0.0, top: '#30327C', mid: '#D56F98', bot: '#FFC08A', sun: '#FF9D4D' },
  { p: 0.13, top: '#2A68D0', mid: '#74B2F0', bot: '#FFE4BF', sun: '#FFD25E' },
  { p: 0.45, top: '#1C5CC8', mid: '#5FA9F2', bot: '#CFE9FF', sun: '#FFE27A' },
  { p: 0.72, top: '#2A5DBF', mid: '#82B2E8', bot: '#FFDFAA', sun: '#FFD25E' },
  { p: 0.9, top: '#3A3899', mid: '#EC6F87', bot: '#FFB160', sun: '#FF9440' },
  { p: 1.0, top: '#1C1B5C', mid: '#8A3D8C', bot: '#EC7257', sun: '#FF7A3A' },
  { p: 1.12, top: '#0A0F2C', mid: '#191C4C', bot: '#35296A', sun: '#FFB45A' },
].map((k) => ({ p: k.p, top: hex(k.top), mid: hex(k.mid), bot: hex(k.bot), sun: hex(k.sun) }));

function palette(p) {
  if (p <= KEYS[0].p) return KEYS[0];
  if (p >= KEYS[KEYS.length - 1].p) return KEYS[KEYS.length - 1];
  let i = 0;
  while (KEYS[i + 1].p < p) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  let t = (p - a.p) / (b.p - a.p);
  t = t * t * (3 - 2 * t);
  return { top: mix(a.top, b.top, t), mid: mix(a.mid, b.mid, t), bot: mix(a.bot, b.bot, t), sun: mix(a.sun, b.sun, t) };
}

/* ---------- Bogen-Geometrie (viewBox 390 × 250) ---------- */
const CX = 195, RX = 160, BY = 160, RY = 130;
const pt = (t) => [CX - RX * Math.cos(Math.PI * t), BY - RY * Math.sin(Math.PI * t)];
function arcPath(t1, t2) {
  t1 = Math.max(0, t1); t2 = Math.min(1, t2);
  if (t2 <= t1) return '';
  const n = Math.max(2, Math.ceil((t2 - t1) / 0.012));
  let d = '';
  for (let i = 0; i <= n; i++) {
    const [x, y] = pt(t1 + ((t2 - t1) * i) / n);
    d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}

const HILL_FAR = 'M0 168C40 159 78 158 118 167S196 180 246 169S338 160 390 167V250H0Z';
const HILL_MID = 'M0 186C46 174 92 178 140 189S236 174 290 178S356 192 390 184V250H0Z';

/**
 * Zeichnet Himmel + Bogen und setzt die Farb-Variablen.
 * mode: 'today' | 'future' | 'past'
 */
export function renderSky({ now, settings, mode, plan, doneMinutes }) {
  const root = document.documentElement;
  const { dayStart, dayEnd } = settings;
  const len = Math.max(60, dayEnd - dayStart);
  const nm = minutesOf(now) + now.getSeconds() / 60;

  // echter Fortschritt (steuert hell/dunkel), angezeigter Fortschritt (steuert den Himmel)
  let pReal;
  if (nm < dayStart) pReal = -(dayStart - nm) / len;
  else pReal = (nm - dayStart) / len;
  const isNight = pReal < -0.02 || pReal > 1.0;
  let p = pReal;
  if (mode === 'future') p = 0.035;
  if (mode === 'past') p = 0.985;

  const pal = palette(p);
  const nightAmt = Math.max(0, Math.min(1, p < 0.5 ? (0.04 - p) / 0.12 : (p - 0.97) / 0.12));
  const dayAmt = Math.max(0, Math.min(1, Math.min((p - 0.03) / 0.1, (0.95 - p) / 0.15)));

  // Schriftfarbe im Bogen: die mit dem besseren Kontrast zum Himmel an dieser Stelle
  const behind = mix(pal.mid, pal.bot, 0.2);
  const darkInk = mix([14, 22, 58], pal.top, 0.15);
  const lightInk = [255, 255, 255];
  const useDark = contrast(darkInk, behind) > contrast(lightInk, behind) * 1.15;
  const ink = useDark ? darkInk : lightInk;

  const set = (k, v) => root.style.setProperty(k, v);
  set('--sky-top', rgb(pal.top));
  set('--sky-mid', rgb(pal.mid));
  set('--sky-bot', rgb(pal.bot));
  set('--sky-ink', rgb(ink));
  set('--sky-ink-2', rgb(ink, useDark ? 0.72 : 0.82));
  set('--sky-shadow', useDark ? 'rgb(255 255 255 / .35)' : 'rgb(10 12 40 / .35)');
  set('--night', nightAmt.toFixed(3));
  set('--cloud', (dayAmt * 0.75).toFixed(3));

  const hillFar = mix(pal.bot, pal.mid, 0.6);
  const hillMid = mix(mix(pal.mid, pal.top, 0.6), [20, 20, 60], 0.12);
  const stroke = rgb(ink, useDark ? 0.38 : 0.5);
  const seg = rgb(ink, useDark ? 0.5 : 0.62);
  const segNow = rgb(ink, 0.95);

  const tOf = (m) => (m - dayStart) / len;
  let body = '';

  // Grundlinie (gepunktet) + bereits vergangener Teil des Tages
  body += `<path d="${arcPath(0, 1)}" fill="none" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="0.1 7"/>`;
  const sunT = mode === 'today' ? Math.max(0, Math.min(1, p)) : mode === 'past' ? 1 : 0;
  const showSun = mode !== 'today' || (p >= -0.01 && p <= 1.01);
  if (mode !== 'future' && sunT > 0.005) {
    body += `<path d="${arcPath(0, sunT)}" fill="none" stroke="url(#trail)" stroke-width="2.6" stroke-linecap="round"/>`;
  }

  // belegte Zeiten als breites, blasses Band
  (plan?.blocks || []).forEach((b) => {
    const d = arcPath(tOf(b.start), tOf(b.end));
    if (d) body += `<path d="${d}" fill="none" stroke="${rgb(ink, useDark ? 0.14 : 0.22)}" stroke-width="15"/>`;
  });

  // geplante Aufgaben als Abschnitte auf dem Bogen
  if (plan) {
    plan.items.forEach((it, i) => {
      let a = tOf(it.start), b = tOf(it.end);
      if (a >= 1) return;
      if (b - a < 0.014) b = a + 0.014;
      const d = arcPath(a + 0.004, Math.min(1, b) - 0.004);
      if (!d) return;
      const cur = i === 0 && mode === 'today';
      body += `<path d="${d}" fill="none" stroke="${cur ? segNow : seg}" stroke-width="${cur ? 8 : 6.5}" stroke-linecap="round"/>`;
    });
  }

  // Erledigtes als leuchtende Perlen
  (doneMinutes || []).forEach((m) => {
    const [x, y] = pt(Math.max(0.01, Math.min(0.99, tOf(m))));
    body += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.6" fill="#FFD766" stroke="#fff" stroke-width="1.6"/>`;
  });

  // Tagesbeginn / Tagesende
  body += `<text x="${pt(0)[0] + 13}" y="${BY - 13}" class="arc-lbl" fill="${rgb(ink, useDark ? 0.62 : 0.8)}">${fmtTime(dayStart)}</text>`;
  body += `<text x="${pt(1)[0] - 13}" y="${BY - 13}" text-anchor="end" class="arc-lbl" fill="${rgb(ink, useDark ? 0.62 : 0.8)}">${fmtTime(dayEnd)}</text>`;

  // Sonne oder Mond
  if (showSun) {
    const [x, y] = pt(sunT);
    body += `<g class="sun" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
      <circle r="46" fill="url(#halo)"/><circle r="22" fill="url(#halo2)"/>
      <circle r="12.5" fill="url(#sunc)"/></g>`;
  } else {
    const nightLen = Math.max(60, 1440 - len);
    const since = nm >= dayEnd ? nm - dayEnd : nm + 1440 - dayEnd;
    const q = Math.max(0.13, Math.min(0.87, since / nightLen));
    const [x, y] = pt(q);
    body += `<g class="moon" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
      <circle r="34" fill="url(#mhalo)"/>
      <circle r="11.5" fill="#FDF6DC" mask="url(#crescent)"/></g>`;
  }

  body += `<path d="${HILL_FAR}" fill="${rgb(hillFar)}"/><path d="${HILL_MID}" fill="${rgb(hillMid)}"/>`;

  const sunC = rgb(pal.sun);
  const defs = `<defs>
    <radialGradient id="halo"><stop offset="0" stop-color="${sunC}" stop-opacity=".55"/><stop offset="1" stop-color="${sunC}" stop-opacity="0"/></radialGradient>
    <radialGradient id="halo2"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <radialGradient id="sunc" cx=".4" cy=".35"><stop offset="0" stop-color="#FFFBE6"/><stop offset="1" stop-color="${sunC}"/></radialGradient>
    <radialGradient id="mhalo"><stop offset="0" stop-color="#FDF6DC" stop-opacity=".28"/><stop offset="1" stop-color="#FDF6DC" stop-opacity="0"/></radialGradient>
    <mask id="crescent"><rect x="-14" y="-14" width="28" height="28" fill="#fff"/><circle cx="6" cy="-4" r="10" fill="#000"/></mask>
    <linearGradient id="trail" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#fff" stop-opacity=".95"/></linearGradient>
  </defs>`;

  const svg = document.getElementById('arc');
  if (svg) svg.innerHTML = defs + body;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', rgb(pal.top));

  return { p: pReal, isNight };
}

/** Sterne einmalig erzeugen. */
export function buildStars(el, n = 46) {
  let s = 7;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  let html = '';
  for (let i = 0; i < n; i++) {
    const size = rnd() < 0.2 ? 2.4 : 1.4;
    html += `<i style="left:${(rnd() * 100).toFixed(1)}%;top:${(rnd() * 78).toFixed(1)}%;width:${size}px;height:${size}px;animation-delay:${(rnd() * 4).toFixed(1)}s"></i>`;
  }
  el.innerHTML = html;
}
