// ascii-art scene engine. Draws a dot-lattice figure plus effect layers from window.SCENE onto <canvas id="c">.
// Every motion is periodic in LOOP seconds (seamless loop); an optional INTRO plays once before the loop.
// render(tt) takes absolute seconds; with window.MANUAL = true the page does not self-animate.
(() => {
const SC = window.SCENE, MAP = SC.figure.map, LAT = SC.lattice;
const [W, H] = SC.size || [1920, 1080], LOOP = SC.loop || 8, INTRO = SC.intro || 0;
let seed = SC.seed || 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const C = SC.colors || {};
const BG = hex(C.bg || '#161616'), BRIGHT = hex(C.bright || '#f2f2f0'), HI = hex(C.highlight || '#ffffff'), DIM = hex(C.dim || '#70706e'), RED = hex(C.red || '#dc143c');
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const TAU = 6.2832;

// figure on the lattice
const F = SC.figure, rows = MAP.split('\n'), S = F.scale || 0.56, P = LAT.px * S, Q = LAT.py * S;
const OX = (F.cx ?? W / 2) - (F.centerCol ?? rows.reduce((m, r) => Math.max(m, r.length), 0) / 2) * P;
const OY = (H - rows.length * Q) / 2 + (F.dy || 0);
const at = (c, r) => [OX + (c + 1) * P, OY + (r + 0.6) * Q];          // map (col,row) -> canvas
const inRegion = (d, g) => Array.isArray(g) ? d.i >= g[0] && d.i <= g[1] && d.j >= g[2] && d.j <= g[3]
  : ((d.i - g.center[0]) / g.radius[0]) ** 2 + ((d.j - g.center[1]) / g.radius[1]) ** 2 <= 1;   // [c0,c1,r0,r1] box or {center,radius} ellipse
const dots = [];
rows.forEach((row, j) => [...row].forEach((ch, i) => {
  if (ch === ' ') return;
  const big = ch === '#' || ch === '@', hi = ch === '@', [x, y] = at(i, j);
  const tn = F.tints && F.tints[i + ',' + j];                         // optional per-cell tint [r,g,b (0-1, max 1), strength, gold]
  const tc = tn ? (big ? BRIGHT : DIM).map((v, k) => Math.round(v + (tn[k] * (big ? 245 : 215) - v) * tn[3])) : null;
  dots.push({ i, j, big, hi, x, y: y + (big ? 0 : LAT.dim_dy * S), r: (big ? LAT.r_big * (hi ? 1.12 : 1) : LAT.r_dim * (F.dimScale || 1)) * S, m: 1 + Math.floor(rnd() * 3), ph: rnd() * TAU, parts: [], brk: null, tc, gold: !!(tn && tn[4]) });
}));

// wind: steady drift plus curl of a few sines
const WD = SC.wind || {}, WDIR = WD.dir || [-1, -0.32], TURB = WD.turb ?? 0.9;
function vel(x, y) {
  const psi = (x, y) => Math.sin(x * 0.0061 + y * 0.0023 + 1.3) * 60 + Math.sin(x * 0.0019 - y * 0.0071 + 4.1) * 70 + Math.sin((x + y) * 0.011 + 2.2) * 22;
  return [WDIR[0] + (psi(x, y + 1) - psi(x, y - 1)) / 2 * TURB, WDIR[1] - (psi(x + 1, y) - psi(x - 1, y)) / 2 * TURB];
}
function windPath(x, y, sp) {                                         // 64 points relative to the start
  const p = []; let px = x, py = y;
  for (let s = 0; s < 64; s++) { p.push(px - x, py - y); const [vx, vy] = vel(px, py); px += vx * sp * (0.3 + s / 40); py += vy * sp * (0.3 + s / 40) * 0.55; }
  return p;
}
const parts = [];                                                     // wind particles from every source
const age = (p, t) => ((t / LOOP) * p.cyc + p.ph) % 1;
function addPart(src, x, y, r, big, red, cyc, color, speed) {
  const p = { src, x, y, r, big, red, color, ph: rnd(), cyc: cyc || (rnd() < 0.7 ? 2 : 1), path: windPath(x, y, speed || 10 + rnd() * 12) };
  parts.push(p); return p;
}

const cv = document.getElementById('c'), g = cv.getContext('2d');
const dpr = window.MANUAL ? 1 : Math.min(2, window.devicePixelRatio || 1);
cv.width = W * dpr; cv.height = H * dpr; g.scale(dpr, dpr);
const col = (c, a) => `rgb(${BG.map((b, k) => Math.round(b + (c[k] - b) * a)).join(',')})`;
function dot(x, y, r, c, a) { if (a <= 0.015) return; g.fillStyle = col(c, Math.min(1, a)); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
const breakA = (d, tt) => d.brk == null ? 1 : 1 - sstep(d.brk, d.brk + 0.8, tt);

// ---------- layers ----------
const L = [];
const make = {
  // bust dots that break away (a hole in the figure): region box/ellipse, ragged edge, timing
  hole(o) {
    const [t0, t1] = o.at || [0.3, 1.8], rag = o.ragged ?? 0.25;
    for (const d of dots) {
      const g2 = Array.isArray(o.region) ? o.region : { center: o.region.center, radius: o.region.radius.map((v) => v * (1 + rag * (rnd() - 0.5))) };
      if (inRegion(d, g2)) d.brk = INTRO ? t0 + (t1 - t0) * rnd() : -9;
    }
    return {};
  },
  // the figure itself: shimmer and a slow light band
  figure(o) {
    const band = o.lightBand !== false;
    const pl = o.pulseAt ? at(o.pulseAt[0], o.pulseAt[1]) : null, pr = (o.pulseR ?? 14) * P;
    const fls = (o.fills || (o.fill ? [o.fill] : [])).map(f => {
      const rot = (f.rot ?? 0) * Math.PI / 180;
      return { c: at(f.at[0], f.at[1]), col: hex(f.color || '#a85868'),
        R: (f.radius ?? 26) * P, str: f.strength ?? 0.55, fq: f.freq ?? 0.32, fl: f.floor ?? 0.55,
        cy: f.cycles ?? 1, pour: !!f.pour, sharp: f.sharp ? 2 : 1,
        py: f.pourFrom != null ? at(0, f.pourFrom)[1] : null,
        el: f.ellipse ? { a: f.ellipse[0] * P, b: f.ellipse[1] * P, cs: Math.cos(rot), sn: Math.sin(rot) } : null };
    });
    const gl = (o.glows || []).map(g => ({ c: at(g.at[0], g.at[1]), r: (g.r ?? 2.2) * P,
      col: hex(g.color || '#e02440'), cy: g.cycles ?? 2, amp: g.amp ?? 0.9, ph: g.phase ?? 0 }));
    return { draw(tt, t, T) {
      const by = OY - 200 + (t / LOOP) * (rows.length * Q + 400);
      const fin = o.instant ? 1 : INTRO ? sstep(0, 1.4, tt) : 1;                          // present from the first frame, or written in during the intro
      for (const d of dots) {
        let a = 1 - (o.shimmer ?? 0.08) * (0.5 + 0.5 * Math.sin(T * d.m + d.ph));          // bright stays near full
        if (band) a += Math.exp(-(((d.y - by) / 70) ** 2)) * (d.big ? 0.1 : 0.45);
        if (pl) { const dd = Math.hypot(d.x - pl[0], d.y - pl[1]);                          // answering the arriving signal
          if (dd < pr) a += (1 - dd / pr) * (0.55 + 0.45 * Math.sin(T * 2 - dd * 0.02)) * (d.big ? 0.45 : 0.85); }
        let colr = d.tc || (d.hi ? HI : d.big ? BRIGHT : DIM);
        for (const fl of fls) {                                                              // the signal floods her with colour
          let q;                                                                             // 0 centre .. 1 edge of the mask
          if (fl.el) { const dx = d.x - fl.c[0], dy = d.y - fl.c[1],                         // ellipse mask: colour only what sits on the feature
              u = dx * fl.el.cs + dy * fl.el.sn, v = -dx * fl.el.sn + dy * fl.el.cs;
            q = Math.hypot(u / fl.el.a, v / fl.el.b); }
          else q = Math.hypot(d.x - fl.c[0], d.y - fl.c[1]) / fl.R;
          if (q >= 1) continue;
          const rim = q < 0.7 ? 1 : 1 - (q - 0.7) / 0.3;
          const prog = fl.pour ? Math.max(0, d.y - (fl.py ?? fl.c[1])) : q * 100;           // pour: one front sweeps down through every mask
          const wv = 0.5 + 0.5 * Math.sin(T * fl.cy - prog * fl.fq);
          const f = rim * fl.str * (fl.cy === 0 ? 1 : (fl.fl + (1 - fl.fl) * Math.pow(wv, fl.sharp)));
          if (f > 0.02) colr = colr.map((v, k) => Math.round(v + (fl.col[k] - v) * Math.min(1, f)));
        }
        let rr = d.r;
        for (const g of gl) { const dd = Math.hypot(d.x - g.c[0], d.y - g.c[1]);            // eyes lit from within
          if (dd < g.r) { const w = Math.pow(0.5 + 0.5 * Math.sin(T * g.cy + g.ph), 3) * g.amp * (1 - dd / g.r);
            colr = colr.map((v, k) => Math.round(v + (g.col[k] - v) * Math.min(1, w)));
            a *= 1 + 0.5 * w; rr = d.r * (1 + 0.35 * w); } }
        for (const p of d.parts) a *= 0.15 + 0.85 * sstep(0.04, 0.45, age(p, t));
        dot(d.x, d.y, rr, colr, a * breakA(d, tt) * fin);
      }
    } };
  },
  // embers: sparks rise off the gold (tinted) cells without dimming them; gold motes plus red streaks
  embers(o) {
    const src = dots.filter((d) => d.gold && d.big && (!o.region || inRegion(d, o.region)));
    const GOLD = hex(o.color || '#e2b04a');
    for (const d of src) if (rnd() < (o.density ?? 0.35)) {
      const red = rnd() < (o.red ?? 0.3);
      addPart(null, d.x + (rnd() - 0.5) * 3, d.y + (rnd() - 0.5) * 3, d.r * (red ? 1 : 0.7), true, red, rnd() < 0.5 ? 1 : 2, red ? null : GOLD, (o.speed ?? 12) * (0.7 + rnd() * 0.6));
    }
    return {};
  },
  // dots of the figure peel off into the wind; more from the windward edge
  dust(o) {
    const [c0, c1] = Array.isArray(o.region) ? o.region : [o.region.center[0] - o.region.radius[0], o.region.center[0] + o.region.radius[0]];
    for (const d of dots) {
      if (!inRegion(d, o.region)) continue;
      const edge = WDIR[0] < 0 ? d.i - c0 : c1 - d.i;
      const w = Math.min(1, Math.max(0, 1 - edge / (c1 - c0 + 1))) ** 1.2;
      const n = rnd() < (0.2 + 0.8 * w) * (o.density ?? 1) ? 1 + Math.floor(rnd() * (1 + 3 * w)) : 0;
      for (let k = 0; k < n; k++) d.parts.push(addPart(d, d.x + (rnd() - 0.5) * 3, d.y + (rnd() - 0.5) * 3, d.r, d.big, rnd() < (o.red ?? 0.035)));
    }
    return {};
  },
  // faint twinkling specks over the empty canvas
  specks(o) {
    const sp = Array.from({ length: o.count ?? 90 }, () => ({ x: rnd() * W, y: rnd() * H, m: 1 + Math.floor(rnd() * 4), ph: rnd() * TAU }));
    return { draw(tt, t, T) { for (const s of sp) dot(s.x, s.y, 1.1, DIM, Math.max(0, Math.sin(T * s.m + s.ph)) ** 6 * 0.5); } };
  },
  // a void: fine stars born at a centre, spiralling outwards and fading (cosmic glow through a hole)
  void(o) {
    const [cx, cy] = at(o.center[0], o.center[1]), R = o.radius ?? 140, n = o.count ?? 500, sp = o.spiral ?? 1.2;
    const st = Array.from({ length: n }, () => ({ a: rnd() * TAU, ph: rnd(), cyc: 1 + Math.floor(rnd() * 2), r: 0.5 + rnd() * 1.1, e: 0.5 + rnd() * 0.7, red: rnd() < (o.red ?? 0) }));
    return { draw(tt, t) {
      const on = INTRO ? sstep(o.at?.[0] ?? 0.5, o.at?.[1] ?? 2.5, tt) : 1;
      for (const s of st) {
        const u = age(s, t), rr = R * Math.pow(u, s.e), a = s.a + sp * u;
        dot(cx + Math.cos(a) * rr * (o.aspect ?? 1), cy + Math.sin(a) * rr, s.r * (1 - 0.4 * u), s.red ? RED : BRIGHT, on * Math.sin(Math.PI * u) ** 1.2 * (0.9 - 0.5 * u));
      }
    } };
  },
  // rose: a radial figure that ignites from a centre outwards (intro), then pulses and carries a
  // light wave outwards, while motes spiral in towards the centre. Dots stay on their cells.
  rose(o) {
    const [cx, cy] = at(o.center[0], o.center[1]);
    const S2 = dots.map((d) => { const dx = d.x - cx, dy = d.y - cy, r = Math.hypot(dx, dy); return { d, r, a: Math.atan2(dy, dx), ph: rnd() * TAU }; });
    const Rn = Math.max(...S2.map((s) => s.r)) || 1;
    const dp = o.pulse ?? { amp: 3, rings: 5 }, wv = o.wave ?? { rings: 3, amp: 0.12 };
    const core = o.core ?? 0.055;
    const sweep = o.sweep ?? 1;
    const on = (rr, tt) => INTRO ? sstep(0, 1, (tt - (o.at?.[0] ?? 0.2) - rr * (INTRO * 0.62)) / 0.9) : 1;
    const mt = Array.from({ length: o.motes ?? 150 }, () => {
      const a0 = rnd() * TAU, r0 = Rn * (0.5 + 0.55 * rnd());
      return { a0, r0, ph: rnd(), cyc: rnd() < 0.65 ? 1 : 2, spin: (rnd() < 0.5 ? -1 : 1) * (1 + Math.floor(rnd() * 2)), red: rnd() < (o.red ?? 0.03), r: 0.7 + rnd() * 0.9 };
    });
    const path = (p, u) => { const rr = p.r0 + (Rn * core * 1.4 - p.r0) * Math.pow(u, 1.15), a = p.a0 + p.spin * TAU * u; return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, rr]; };
    return { draw(tt, t, T) {
      for (const s of S2) {
        const rr = s.r / Rn, on2 = on(rr, tt);
        if (on2 <= 0.02) continue;
        const dr = dp.amp * Math.sin(T * dp.rings - rr * (dp.rings * 5) + s.ph) * (0.2 + rr * 0.8) * sstep(0.03, 0.3, rr);
        const sw = (o.swirl ?? 4) * Math.sin(T * 2 - rr * 6 + s.ph) * sstep(0.05, 0.35, rr);
        const x = s.d.x + Math.cos(s.a) * dr - Math.sin(s.a) * sw;
        const y = s.d.y + Math.sin(s.a) * dr + Math.cos(s.a) * sw;
        const w = Math.sin(T * wv.rings - rr * (wv.rings * 5) + s.ph * 0.6);
        const band = Math.exp(-(((rr - ((t / LOOP) * sweep)) * 3.4) ** 2)) * (1 - rr);
        if (rr < core) { dot(x, y, s.d.r * (1.1 + 0.06 * Math.sin(T * 2 + s.ph)), HI, on2); continue; }
        const a = (s.d.big ? 0.92 : 0.82) + w * (s.d.big ? wv.amp : wv.amp * 1.5) + band * (s.d.big ? 0.45 : 0.8);
        dot(x, y, s.d.r, s.d.big ? BRIGHT : DIM, Math.min(1, a) * on2 * breakA(s.d, tt));
      }
      const born = INTRO ? sstep(INTRO - 1.4, INTRO, tt) : 1;
      for (const p of mt) {
        const u = age(p, t), e = u * u * (3 - 2 * u);
        const [x, y, rr] = path(p, e);
        const a = Math.sin(Math.PI * u) ** 1.2 * (0.35 + 0.65 * (1 - rr / Rn)) * born * 0.9;
        if (p.red) { for (let n = 8; n >= 0; n--) { const un = Math.max(0, e - n * 0.012), [bx, by] = path(p, un); dot(bx, by, Math.max(0.7, p.r * (1 - n / 12)), RED, a * (1 - n / 10) ** 1.4); } continue; }
        dot(x, y, p.r, BRIGHT, a);
      }
    } };
  },
  // tentacles: tapered, lit, suckered stipple tubes rooted in a region, writhing with waves that travel to the tip
  tentacles(o) {
    const pitch = o.pitch ?? 4.4, n = o.count ?? 7, [a0, a1] = o.angles ?? [130, 280], [l0, l1] = o.length ?? [300, 600], [w0, w1] = o.width ?? [14, 30];
    const lx = Math.cos((o.light ?? 225) * TAU / 360), ly = Math.sin((o.light ?? 225) * TAU / 360);
    const roots = dots.filter((d) => inRegion(d, o.root));
    if (!roots.length) throw new Error('tentacles: root region has no figure dots');
    // explicit `items` ({root:[c,r], angle, length, width, curl, writhe, grow}) design the composition; otherwise a random fan
    const T8 = (o.items || Array.from({ length: n }, () => ({}))).map((it, k) => {
      let x, y;
      if (it.root) [x, y] = at(it.root[0], it.root[1]); else { const d = roots[Math.floor(rnd() * roots.length)]; x = d.x + (rnd() - 0.5) * 10; y = d.y + (rnd() - 0.5) * 10; }
      const wr = it.writhe ?? o.writhe ?? 1;
      return { x, y, base: (it.angle ?? (a0 + (a1 - a0) * (n > 1 ? k / (n - 1) : 0.5) + (rnd() - 0.5) * 14)) * TAU / 360,
        len: it.length ?? l0 + (l1 - l0) * rnd(), w: it.width ?? w0 + (w1 - w0) * rnd(), A1: (0.35 + rnd() * 0.3) * wr, A2: (0.15 + rnd() * 0.2) * wr,
        c1: 1, c2: rnd() < 0.5 ? 2 : 1, k1: 3 + rnd() * 3, k2: 6 + rnd() * 5, f1: rnd() * TAU, f2: rnd() * TAU, f3: rnd() * TAU,
        curl: it.curl ?? (rnd() < 0.5 ? -1 : 1) * (0.8 + rnd() * 1.4), g0: it.grow ?? (o.grow?.[0] ?? 0.6) + rnd() * 1.2, id: k, tip: [0, 0] };
    });
    const hash = (a, b, c) => { const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return s - Math.floor(s); };
    function spine(tn, tt, t) {
      const gr = INTRO ? sstep(0, 1, (tt - tn.g0) / (o.grow?.[1] ?? 2.2)) : 1, L2 = tn.len * (0.08 + 0.92 * gr);
      const N = Math.max(2, Math.round(L2 / pitch)), ph = TAU * t / LOOP, pts = [];
      let x = tn.x, y = tn.y;
      for (let i = 0; i <= N; i++) {
        const s = i / N;
        const ang = tn.base + tn.A1 * Math.sin(ph * tn.c1 - tn.k1 * s + tn.f1) * s ** 0.8 + tn.A2 * Math.sin(ph * tn.c2 - tn.k2 * s + tn.f2) * s
          + tn.curl * (1 + (o.coil ?? 0) * Math.sin(ph + tn.f3)) * s ** (o.curlPow ?? 3.2);   // coil: tips curl and uncurl
        pts.push([x, y, ang, s]); x += Math.cos(ang) * pitch; y += Math.sin(ang) * pitch;
      }
      return pts;
    }
    for (const tn of T8) for (let k = 0; k < (o.shed ?? 5); k++) addPart(tn, 0, 0, 1.2, true, rnd() < (o.red ?? 0.04), 2);
    const LR = o.latticeRoot || null, TONES = o.tones === 2, cells = new Map();
    return { draw(tt, t) {
      for (const tn of T8) {
        cells.clear();
        const pts = spine(tn, tt, t);
        for (let i = 0; i < pts.length; i++) {
          const [x, y, ang, s] = pts[i], hw = Math.max(1.2, tn.w * 0.5 * (1 - s) ** 0.85 + 0.6), nx = -Math.sin(ang), ny = Math.cos(ang);
          const nl = nx * lx + ny * ly, m = Math.max(1, Math.round(2 * hw / (pitch * 0.9)));
          const fade = Math.min(1, i / 4) * (o.rootFade ? sstep(0, 0.12, s) : 1);
          for (let j = 0; j <= m; j++) {
            const q = m ? (j / m) * 2 - 1 : 0, face = Math.sqrt(Math.max(0, 1 - q * q));
            const b = Math.min(1, (o.body ?? 0.1) + 0.3 * face + 0.75 * Math.max(0, -q * nl) + (Math.abs(q) > 0.8 ? 0.18 : 0));   // body: base brightness
            const px = x + nx * q * hw, py = y + ny * q * hw;
            if (LR && hash(j, i, tn.id) < 1 - sstep(LR[0], LR[1], s)) {    // near the root: the figure's own lattice dots
              const ci = Math.round((px - OX) / P - 1), cj = Math.round((py - OY) / Q - 0.6), k = ci + ',' + cj, c = cells.get(k);
              const suck = o.suckers !== false && q * nl > 0.3 && q * nl < 0.8 && hw > 16 && s > 0.08 && i % 8 < 2 ? 1 : 0;   // underside bands -> sucker rings
              const ed = Math.abs(q) > 0.86 ? 1 : 0;
              if (c) { c.b += b; c.n++; c.su += suck; c.ed += ed; c.fade = Math.max(c.fade, fade); } else cells.set(k, { ci, cj, b, n: 1, su: suck, ed, fade }); continue;
            }
            if (hash(tn.id, i, j) > 0.35 + 0.65 * b) continue;            // stipple texture, stable as it moves
            if (TONES) dot(px, py, b > 0.5 ? 0.6 + 1.3 * b : 0.7, b > 0.5 ? BRIGHT : DIM, (b > 0.5 ? 0.6 + 0.4 * b : 0.35 + b) * fade);
            else dot(px, py, 0.45 + 1.35 * b, BRIGHT, (0.15 + 0.85 * b) * fade);
          }
          if (o.suckers !== false && hw > 5 && i % 5 === 2 && s > 0.1) {      // a ring of tiny dots on the underside
            const sx = x - nx * hw * 0.55 * Math.sign(nl || 1), sy = y - ny * hw * 0.55 * Math.sign(nl || 1), rr = hw * 0.28;
            for (let k = 0; k < 7; k++) dot(sx + Math.cos(k * 0.9) * rr, sy + Math.sin(k * 0.9) * rr, 0.6, BRIGHT, 0.55 * fade);
          }
        }
        const e = pts[pts.length - 1]; tn.tip = [e[0], e[1]];
        drawCells();                                                    // each tentacle is a solid body over what is behind it
      }
    }, tipAt: (tn) => tn.tip };
    function drawCells() {
      for (const c of cells.values()) {                                 // lattice part: same grid, sizes and tones as the figure
        const av = c.b / c.n, big = av > (o.latticeSplit ?? 0.5), [x, y] = at(c.ci, c.cj);
        g.fillStyle = `rgb(${BG})`; g.fillRect(x - P / 2, y - Q / 2, P, Q);  // occlude the figure / earlier tentacles in this cell
        if (c.ed * 2 > c.n && c.fade > 0.5) { dot(x, y + LAT.dim_dy * S, LAT.r_dim * S, DIM, c.fade); continue; }   // dim outline separates bodies
        if (c.su * 2 >= c.n && c.n > 1) {                             // sucker: a ring, bright rim with a dark centre
          dot(x, y, LAT.r_big * S * 1.05, BRIGHT, c.fade); dot(x, y, LAT.r_big * S * 0.5, BG, 1); continue;
        }
        if (av > (o.highlight ?? 0.78)) { dot(x, y, LAT.r_big * S * 1.15, HI, c.fade); continue; }   // specular edge
        dot(x, y + (big ? 0 : LAT.dim_dy * S), (big ? LAT.r_big : LAT.r_dim) * S, big ? BRIGHT : DIM, c.fade);
      }
    }
  },
  // a ribbon of illuminated script: a tapered band of fine stipple along a designed spline,
  // grown during the intro, swaying on the loop, carrying a travelling light and fraying at the tip
  ribbon(o) {
    const ctrl = o.path.map(([c, r]) => at(c, r)), NS = o.samples || 700;
    const sp = [];
    for (let i = 0; i < ctrl.length - 1; i++) {
      const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
      const n = Math.max(2, Math.round(NS / (ctrl.length - 1)));
      for (let k = 0; k < n; k++) {
        const s = k / n, s2 = s * s, s3 = s2 * s;
        sp.push([0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * s + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * s2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * s3),
                 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * s + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * s2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * s3)]);
      }
    }
    sp.push(ctrl[ctrl.length - 1]);
    const cum = [0];
    for (let i = 1; i < sp.length; i++) cum.push(cum[i - 1] + Math.hypot(sp[i][0] - sp[i - 1][0], sp[i][1] - sp[i - 1][1]));
    const total = cum[cum.length - 1], pitch = o.pitch ?? 4.2;
    const P2 = [];                                     // evenly spaced points: [x, y, nx, ny, u]
    let j = 0;
    for (let s = 0; s <= total; s += pitch) {
      while (j < cum.length - 2 && cum[j + 1] < s) j++;
      const f = (s - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j]);
      const x = sp[j][0] + (sp[j + 1][0] - sp[j][0]) * f, y = sp[j][1] + (sp[j + 1][1] - sp[j][1]) * f;
      const tx = sp[j + 1][0] - sp[j][0], ty = sp[j + 1][1] - sp[j][1], tl = Math.hypot(tx, ty) || 1;
      P2.push([x, y, -ty / tl, tx / tl, s / total]);
    }
    const w0 = o.width?.[0] ?? 46, w1 = o.width?.[1] ?? 10, amp = o.sway ?? 26, lx = Math.cos((o.light ?? 210) * TAU / 360), ly = Math.sin((o.light ?? 210) * TAU / 360);
    const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
    const tip = [P2[0][0], P2[0][1]], TONES = o.tones !== 1;
    const LR = o.latticeRoot || [0.58, 0.66], cells = new Map();
    if (o.shed) for (let k = 0; k < o.shed; k++) addPart({ tip }, 0, 0, 1.2, true, rnd() < (o.red ?? 0.03), 2);
    function drawCells() {
      for (const c of cells.values()) {
        const av = c.b / c.n, [x, y] = at(c.ci, c.cj);
        g.fillStyle = `rgb(${BG})`; g.fillRect(x - P / 2, y - Q / 2, P, Q);      // the band hides what is behind it
        if (av > 0.96) dot(x, y, LAT.r_big * S * 1.12, HI, c.fade);
        else if (av > 0.56) dot(x, y, LAT.r_big * S, BRIGHT, c.fade);
        else dot(x, y + LAT.dim_dy * S, LAT.r_dim * S, DIM, c.fade);
      }
    }
    return { draw(tt, t, T) {
      const g0 = o.grow?.[0] ?? 0.4, gd = o.grow?.[1] ?? 3.2;
      const uMax = INTRO ? sstep(0, 1, (tt - g0) / gd) : 1;
      if (uMax <= 0.001) return;
      const pulseU = (t / LOOP) * (o.pulses ?? 2), snapEnd = LR[1];
      cells.clear();
      const st = [];
      let last = null;
      for (const [x0, y0, nx, ny, u] of P2) {
        if (u > uMax) break;
        const sw = amp * Math.sin(T * (o.swayCycles ?? 1) - u * 7.5 + 0.6) * u ** 1.4;      // the band breathes sideways
        const x = x0 + nx * sw, y = y0 + ny * sw;
        const w = (w0 + (w1 - w0) * u) * (0.35 + 0.65 * sstep(0, 0.06, u)) * (1 + 0.25 * Math.sin(T * 2 - u * 9));
        const pulse = Math.exp(-(((u - pulseU) / 0.05) ** 2)) * (1 - u * 0.3);
        const m = Math.max(2, Math.round(w / pitch)), fade = Math.min(1, (uMax - u) / 0.02) * sstep(0, 0.03, u);
        if (u < snapEnd) {                                                            // the root is the figure's own lattice
          const tf = 1 - 0.75 * sstep(snapEnd - 0.10, snapEnd, u);
          for (let k = 0; k <= m; k++) {
            const q = (k / m) * 2 - 1, lit = Math.max(0, -(nx * lx + ny * ly) * q);
            const b = 0.26 + 0.46 * lit + 0.65 * pulse;
            const px = x + nx * q * w / 2, py = y + ny * q * w / 2;
            const ci = Math.round((px - OX) / P - 1), cj = Math.round((py - OY) / Q - 0.6), key = ci + ',' + cj, c = cells.get(key);
            if (c) { c.b += b; c.n++; c.fade = Math.min(c.fade, fade * tf); } else cells.set(key, { ci, cj, b, n: 1, fade: fade * tf });
          }
          last = [x, y];
          continue;
        }
        st.push([x, y, nx, ny, u, w, pulse, m, fade]);
        last = [x, y];
      }
      drawCells();
      for (const [x, y, nx, ny, u, w, pulse, m, fade0] of st) {
        const fade = fade0 * sstep(snapEnd, snapEnd + 0.05, u);
        for (let k = 0; k <= m; k++) {
          const q = (k / m) * 2 - 1, lit = Math.max(0, -(nx * lx + ny * ly) * q);
          if (Math.abs(q) < 0.80) continue;                                            // only the two edges of the vellum
          const b = 0.30 + 0.55 * lit + 0.60 * pulse;
          const px = x + nx * q * w / 2, py = y + ny * q * w / 2;
          dot(px, py, 1.0 + 0.5 * lit, lit > 0.35 ? BRIGHT : DIM, (0.45 + 0.45 * lit + 0.5 * pulse) * fade);
        }
        const si = Math.round(u * total / pitch);
        for (let k = 1; k < m; k++) {                                                 // faint vellum between the writing
          const q = (k / m) * 2 - 1;
          if (hash(k + 5, si) > 0.45) continue;
          dot(x + nx * q * w / 2, y + ny * q * w / 2, 0.95, DIM, (0.10 + 0.18 * pulse) * fade);
        }
        for (const lq of [-0.58, -0.29, 0, 0.29, 0.58]) {                             // lines of writing
          if ((si + Math.round(lq * 5) + 40) % 9 > 6) continue;
          const b = 0.42 + 0.30 * Math.max(0, -lq * (nx * lx + ny * ly)) + 0.9 * pulse;
          dot(x + nx * lq * w / 2, y + ny * lq * w / 2, 0.85 + 0.6 * Math.min(1, b), b > 0.62 ? BRIGHT : DIM, Math.min(1, 0.35 + 0.7 * b) * fade);
        }
      }
      if (last) { tip[0] = last[0]; tip[1] = last[1]; }
      if (last && uMax < 0.999) dot(last[0], last[1], 2.2, HI, 0.9);       // the leading bead while it unrolls
    } };
  },
  // the writing lifts off the page: short dashes born in a region, riding the wind, fading
  glyphs(o) {
    const src = dots.filter((d) => inRegion(d, o.region) && d.big);
    if (!src.length) return { draw() {} };
    const G = Array.from({ length: o.count ?? 150 }, () => {
      const d = src[Math.floor(rnd() * src.length)];
      const sp = (o.speed ?? 9) * (0.6 + rnd() * 0.8);
      return { x: d.x + (rnd() - 0.5) * 8, y: d.y + (rnd() - 0.5) * 8, ph: rnd(), cyc: rnd() < 0.6 ? 1 : 2,
        red: rnd() < (o.red ?? 0.03), r: 0.85 + rnd() * 0.5, path: windPath(d.x, d.y, sp) };
    });
    return { draw(tt, t, T) {
      for (const p of G) {
        const u = age(p, t), f = (u ** 1.15) * 63, k = Math.floor(f), fr = f - k, k2 = Math.min(63, k + 1);
        const px = (i) => p.x + p.path[2 * i], py = (i) => p.y + p.path[2 * i + 1];
        const a = sstep(0, 0.05, u) * (1 - u) ** 1.1;
        if (a <= 0.01) continue;
        const x = px(k) + (px(k2) - px(k)) * fr, y = py(k) + (py(k2) - py(k)) * fr;
        const dx = px(k2) - px(k), dy = py(k2) - py(k), dl = Math.hypot(dx, dy) || 1, ux = dx / dl, uy = dy / dl;
        for (let n = 0; n < 4; n++) {                                  // a short dash of four dots along the travel
          const o2 = n * 3.1, aa = a * (1 - n * 0.22);
          dot(x + ux * o2, y + uy * o2, p.r * 1.35 * (1 - n * 0.1), p.red ? RED : BRIGHT, aa * (p.red ? 0.9 : 0.85));
        }
      }
    } };
  },
  // the signal: fine stipple rain falling from the sky, converging on a point above the figure
  // and sinking into it (draw this layer BEFORE `figure` so the lattice absorbs the motes);
  // data pulses travel down the fall, rare crimson streaks ride it, the crown answers via figure.pulseAt
  stream(o) {
    const [tx0, ty0] = at(o.to[0], o.to[1]), ty = ty0 + (o.sink ?? 0.4) * Q;   // motes die just past the hairline
    const n = o.count ?? 700, span = o.span ?? 700, sway = o.sway ?? 42;
    const spd = o.speed ?? 1;                                                   // >1: the fall recycles faster (integer cycle counts)
    const gauss = () => (rnd() + rnd() + rnd()) / 3 - 0.5;                      // spawn denser along the column axis
    const ps = Array.from({ length: n }, () => ({ sx: tx0 + gauss() * span, y0: -30 - rnd() * 70,
      ph: rnd(), q: rnd(), cyc: Math.max(1, Math.round((rnd() < 0.72 ? 1 : 2) * spd)), red: rnd() < (o.red ?? 0.03),
      r: 1.05 + rnd() * 1.05, tw: rnd() * TAU, amp: sway * (0.5 + rnd() * 0.8), tn: (o.turns ?? 2.5) + (rnd() - 0.5) * 1.2 }));
    const pt = (p, u, T, sf = 1) => {
      const y = p.y0 + (ty - p.y0) * Math.pow(u, 1.3);                          // the fall accelerates
      const conv = Math.pow(1 - u, 1.5);                                        // ...and narrows toward the crown
      const sw = Math.sin(TAU * p.tn * u + p.tw) * p.amp * (0.25 + 0.75 * u) * Math.sin(Math.PI * Math.min(1, u * 1.06)) ** 0.8;
      const axis = (o.axisSway ?? 16) * Math.sin(T + y * 0.0045);               // the whole column breathes sideways
      return [tx0 + ((p.sx - tx0) * conv + sw + axis) * sf, y];
    };
    return { draw(tt, t, T) {
      const on = INTRO ? sstep(o.at?.[0] ?? 0.2, o.at?.[1] ?? 3.4, tt) : 1;     // a trickle that becomes a pour
      if (on <= 0.01) return;
      const spanF = 0.35 + 0.65 * on;                                           // ...and the pour visibly widens
      const pulseU = ((t / LOOP) * (o.pulses ?? 2)) % 1;
      for (const p of ps) {
        if (p.q > on) continue;
        const u = age(p, t);
        const pulse = Math.exp(-(((u - pulseU) / (o.pulseW ?? 0.07)) ** 2));
        const a = sstep(0, 0.05, u) * (1 - sstep(0.82, 1, u)) * (0.55 + 0.45 * u)
          * (0.78 + 0.22 * Math.sin(T * 2 + p.tw)) * (1 + (o.pulseAmp ?? 0.9) * pulse);
        if (a <= 0.015) continue;
        const r = p.r * (1 - 0.45 * u) * (1 + 0.45 * pulse);
        if (p.red) {
          for (let k = 12; k >= 0; k--) {                                       // a crimson packet with a tapering tail
            const uk = Math.max(0, u - k * 0.008), [bx, by] = pt(p, uk, T, spanF);
            dot(bx, by, Math.max(0.7, r * (1 - k / 14)), RED, a * (1 - k / 13) ** 1.4 * 0.9);
          }
          continue;
        }
        const [x, y] = pt(p, u, T, spanF);
        dot(x, y, r, pulse > 0.3 || p.r > 1.15 ? BRIGHT : DIM, Math.min(1, a) * 1.05);
      }
    } };
  },
  // the signal condenses into a mark: concentric stipple rings assembled out of the falling
  // stream during the intro (each dot rains in and snaps to its ring cell), then breathing on
  // the loop with pulses rippling outward; the pour threads through the ring centre.
  // Assemble like the source logo: bright core, brighter inner rings, dimmer outer rings.
  sigil(o) {
    const [cx, cy] = at(o.at[0], o.at[1]), R = o.radius ?? 140, rings = o.rings ?? 4, pitch = o.pitch ?? 7.5;
    const [a0, stag, dur] = o.assemble || [0.9, 0.5, 0.9];
    const mk = [];
    for (let k = 0; k < rings; k++) {
      const rr = R * (k + 1) / rings, n = Math.max(10, Math.round(TAU * rr / pitch));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + k * 0.35, ex = cx + Math.cos(a) * rr, ey = cy + Math.sin(a) * rr;
        const sx = cx + (rnd() - 0.5) * R * 2.4, sy = -20 - rnd() * 80;
        mk.push({ k, ex, ey, sx, sy,
          mx: (sx + ex) / 2 + (rnd() - 0.5) * 60, my: Math.min(sy, ey) - 40 - rnd() * 80,
          t0: a0 + k * stag + rnd() * 0.25, red: rnd() < (o.red ?? 0.05), r: 1.0 + rnd() * 0.6 });
      }
    }
    return { draw(tt, t, T) {
      for (const m of mk) {
        const u = (tt - m.t0) / dur;
        if (u < 0) continue;                                              // still on its way down with the rain
        let x, y, a;
        if (u < 1) {                                                      // raining in: bezier from the sky to the ring
          const e = 1 - (1 - u) ** 3;
          x = (1 - e) ** 2 * m.sx + 2 * (1 - e) * e * m.mx + e * e * m.ex;
          y = (1 - e) ** 2 * m.sy + 2 * (1 - e) * e * m.my + e * e * m.ey;
          a = Math.min(1, u * 3) * 0.85;
        } else {                                                          // landed: the rings breathe, pulses ripple out
          const br = 1 + 0.02 * Math.sin(T + m.k * 0.7);
          x = cx + (m.ex - cx) * br; y = cy + (m.ey - cy) * br;
          a = (0.95 - 0.14 * m.k) * (0.8 + 0.2 * Math.sin(T * 2 - m.k * 0.8));
        }
        dot(x, y, m.r, m.red ? RED : BRIGHT, a);
      }
      const coreU = (tt - (a0 + rings * stag)) / dur;                     // the crimson seed arrives last
      if (coreU > 0) {
        const e = Math.min(1, coreU), pop = 1 + 0.3 * Math.sin(T * 2) * sstep(0, 1, e);
        dot(cx, cy, 3.4 * pop, RED, Math.min(1, e * 2.5) * (0.7 + 0.3 * Math.sin(T * 2)));
        dot(cx, cy, 5.8 * pop, RED, Math.min(1, e * 2.5) * 0.22);
      }
    } };
  },
  // a reference image as fine stipple (data from build.py): breathes, can fly out of a source region and break the figure
  stipple(o) {
    const [ax, ay] = at(o.at[0], o.at[1]), S2 = o.data.map(([x, y, r, a]) => ({ x: ax + x, y: ay + y, r, a, m: 1 + Math.floor(rnd() * 3), ph: rnd() * TAU }));
    if (o.breakFigure) {
      const grid = new Map(); for (const m of S2) { const k = Math.round(m.x / 12) + ',' + Math.round(m.y / 12); grid.set(k, (grid.get(k) || 0) + m.a); }
      for (const d of dots) { let v = 0; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) v += grid.get((Math.round(d.x / 12) + a) + ',' + (Math.round(d.y / 12) + b)) || 0; if (v > 2.2) d.brk = INTRO ? 0.2 + rnd() * 1.4 : -9; }
    }
    const src = o.from ? dots.filter((d) => inRegion(d, o.from)) : null;
    if (src && INTRO) { const BC = [src.reduce((s, d) => s + d.x, 0) / src.length, src.reduce((s, d) => s + d.y, 0) / src.length];
      const dm = Math.max(...S2.map((m) => Math.hypot(m.x - BC[0], m.y - BC[1])));
      for (const m of S2) { const s = src[Math.floor(rnd() * src.length)]; m.sx = s.x; m.sy = s.y; m.cx = (s.x + m.x) / 2 - 40 - rnd() * 60; m.cy = Math.min(s.y, m.y) - rnd() * 90; m.t0 = 0.6 + 2 * Math.hypot(m.x - BC[0], m.y - BC[1]) / dm + rnd() * 0.5; } }
    const births = src ? Array.from({ length: o.births ?? 260 }, () => { const s = src[Math.floor(rnd() * src.length)], e = S2[Math.floor(rnd() * S2.length)];
      return { sx: s.x, sy: s.y, ex: e.x, ey: e.y, cx: (s.x + e.x) / 2 + (rnd() - 0.5) * 120, cy: Math.min(s.y, e.y) - 40 - rnd() * 140, ph: rnd(), cyc: rnd() < 0.5 ? 1 : 2, r: 0.7 + rnd() * 1.1 }; }) : [];
    const x0 = Math.min(...S2.map((m) => m.x)), x1 = Math.max(...S2.map((m) => m.x));
    for (const m of S2) if (rnd() < (o.shed ?? 0.05) * (WDIR[0] < 0 ? 1.4 - (m.x - x0) / (x1 - x0 + 1) : 0.4 + (m.x - x0) / (x1 - x0 + 1))) addPart(null, m.x, m.y, m.r, m.a > 0.6, rnd() < 0.02, 2);
    return { draw(tt, t, T) {
      for (const d of S2) {
        let x = d.x + 1.1 * Math.sin(T * 2 + d.y * 0.011), y = d.y + 1.8 * Math.sin(T + d.x * 0.013 + d.y * 0.004), sc = 1;
        let a = d.a * (0.8 + 0.2 * Math.sin(T * d.m + d.ph));
        if (d.t0 != null) { const u = Math.min(1, Math.max(0, (tt - d.t0) / 1.1)); if (u <= 0) continue; const e = 1 - (1 - u) ** 3;
          if (u < 1) { x = (1 - e) ** 2 * d.sx + 2 * (1 - e) * e * d.cx + e * e * x; y = (1 - e) ** 2 * d.sy + 2 * (1 - e) * e * d.cy + e * e * y; } a *= Math.min(1, u * 3); sc = 0.6 + 0.4 * e; }
        dot(x, y, d.r * sc, BRIGHT, a);
      }
      const on = INTRO ? sstep(1.5, 3.5, tt) : 1;
      for (const b of births) { const u = age(b, t), e = u * u * (3 - 2 * u);
        dot((1 - e) ** 2 * b.sx + 2 * (1 - e) * e * b.cx + e * e * b.ex, (1 - e) ** 2 * b.sy + 2 * (1 - e) * e * b.cy + e * e * b.ey, b.r, BRIGHT, Math.sin(Math.PI * u) ** 1.5 * 0.85 * on); }
    } };
  },
};
const tentacleLayers = [];
for (const o of SC.layers) { const l = make[o.type](o); l.o = o; L.push(l); if (o.type === 'tentacles') tentacleLayers.push(l); }

function drawParts(tt, t) {
  for (const p of parts) {
    const u = age(p, t);
    let ox = p.x, oy = p.y, alive = 1;
    if (p.src && p.src.tip) { ox = p.src.tip[0]; oy = p.src.tip[1]; alive = INTRO ? sstep(INTRO - 1, INTRO, tt) : 1; }   // tentacle tips
    else if (p.src) alive = breakA(p.src, tt);
    const f = (u ** 1.15) * 63, k = Math.floor(f), fr = f - k, k2 = Math.min(63, k + 1);
    const px = (i) => ox + p.path[2 * i], py = (i) => oy + p.path[2 * i + 1];
    const a = sstep(0, 0.03, u) * (1 - u) ** 0.9 * (p.big ? 1 : 1.4) * alive, r = p.r * (1 - 0.6 * sstep(0, 0.7, u)) + 0.5;
    if (a <= 0.01) continue;
    if (!p.red) { dot(px(k) + (px(k2) - px(k)) * fr, py(k) + (py(k2) - py(k)) * fr, r, p.color || (p.big ? BRIGHT : DIM), a); continue; }
    for (let n = 22; n >= 0; n--) {                                   // crimson streak: head plus fading tail
      const fb = Math.max(0, f - n * 0.8), kb = Math.floor(fb), kb2 = Math.min(63, kb + 1), q = fb - kb;
      dot(px(kb) + (px(kb2) - px(kb)) * q, py(kb) + (py(kb2) - py(kb)) * q, Math.max(0.8, r * (1 - n / 24)), RED, a * (1 - n / 23) ** 1.4);
    }
  }
}

window.LOOP = LOOP; window.INTRO = INTRO;
window.render = function (tt) {
  const t = (((tt - INTRO) % LOOP) + LOOP) % LOOP, T = t / LOOP * TAU;
  g.fillStyle = `rgb(${BG})`; g.fillRect(0, 0, W, H);
  for (const l of L) if (l.draw) l.draw(tt, t, T);
  drawParts(tt, t);
};
if (!window.MANUAL) { const t0 = performance.now(); const f = (now) => { render((now - t0) / 1000); requestAnimationFrame(f); }; requestAnimationFrame(f); }
})();
