// news-image-20261126 — "THE WORLD IN ONE DAY"
// Sums up Thursday 26 November 2026 in one drawn newspaper front page.
// Node 22, standard library only. Writes /output/entry.png (or
// $MAKEFUN_OUTPUT_DIR/entry.png). Deterministic: fixed palette, fixed
// layout, no clock, no randomness — two runs write identical bytes.

import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

// ---------------------------------------------------------------- PNG ----
// Minimal deterministic PNG writer: 8-bit RGB, filter 0 on every row.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}

function encodePNG(width: number, height: number, rgb: Buffer): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0; // filter: none
    rgb.copy(raw, y * (1 + width * 3) + 1, y * width * 3, (y + 1) * width * 3);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------- canvas ----
// A plain RGB framebuffer with small vector-drawing helpers.

const W = 1024;
const H = 1024;
const PAPER: [number, number, number] = [246, 241, 229];
const INK: [number, number, number] = [20, 20, 20];
const RED: [number, number, number] = [166, 30, 34];
const BLUE: [number, number, number] = [29, 78, 121];
const SKY: [number, number, number] = [178, 205, 224];
const SEA: [number, number, number] = [43, 96, 138];
const GOLD: [number, number, number] = [176, 132, 32];
const GREY: [number, number, number] = [110, 110, 108];
const LIGHT: [number, number, number] = [226, 220, 205];
const ORANGE: [number, number, number] = [214, 110, 32];
const TAN: [number, number, number] = [198, 172, 120];

type RGB = [number, number, number];

class Canvas {
  buf: Buffer;
  constructor() {
    this.buf = Buffer.alloc(W * H * 3);
    for (let i = 0; i < W * H; i++) {
      this.buf[i * 3] = PAPER[0];
      this.buf[i * 3 + 1] = PAPER[1];
      this.buf[i * 3 + 2] = PAPER[2];
    }
  }
  px(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 3;
    this.buf[i] = c[0];
    this.buf[i + 1] = c[1];
    this.buf[i + 2] = c[2];
  }
  rect(x: number, y: number, w: number, h: number, c: RGB): void {
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) this.px(xx, yy, c);
  }
  frame(x: number, y: number, w: number, h: number, c: RGB, t = 2): void {
    this.rect(x, y, w, t, c);
    this.rect(x, y + h - t, w, t, c);
    this.rect(x, y, t, h, c);
    this.rect(x + w - t, y, t, h, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: RGB, t = 1): void {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    for (;;) {
      for (let a = 0; a < t; a++)
        for (let b = 0; b < t; b++) this.px(x + a, y + b, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }
  circle(cx: number, cy: number, r: number, c: RGB): void {
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++)
        if (x * x + y * y <= r * r) this.px(cx + x, cy + y, c);
  }
  ring(cx: number, cy: number, r: number, c: RGB, t = 2): void {
    for (let a = 0; a < 360; a++) {
      const rad = (a * Math.PI) / 180;
      for (let k = 0; k < t; k++)
        this.px(Math.round(cx + (r - k) * Math.cos(rad)), Math.round(cy + (r - k) * Math.sin(rad)), c);
    }
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
    for (let y = -ry; y <= ry; y++) {
      const span = Math.floor((rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry)))) || 0);
      for (let x = -span; x <= span; x++) this.px(cx + x, cy + y, c);
    }
  }
  // Scanline fill of a simple polygon (points in order).
  poly(pts: [number, number][], c: RGB): void {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of pts) {
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[(i + 1) % pts.length];
        if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
          xs.push(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0));
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2)
        for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) this.px(x, y, c);
    }
  }
}

// -------------------------------------------------------------- font -----
// Hand-built 5x7 bitmap capitals, digits and punctuation. All-caps paper.

const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "01100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "01100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  "+": ["00000", "00000", "00100", "01110", "00100", "00000", "00000"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  '"': ["01010", "01010", "01010", "00000", "00000", "00000", "00000"],
  "°": ["01100", "10010", "01100", "00000", "00000", "00000", "00000"],
  "•": ["00000", "00000", "01100", "01100", "00000", "00000", "00000"],
};

const ADV = 6; // glyph advance in font units (5 + 1 spacing)

function textWidth(s: string, scale: number): number {
  return s.length * ADV * scale - scale;
}

function drawText(cv: Canvas, x: number, y: number, s: string, scale: number, c: RGB): void {
  let cx = x;
  for (const ch of s) {
    const g = FONT[ch] ?? FONT["?"];
    for (let r = 0; r < 7; r++)
      for (let col = 0; col < 5; col++)
        if (g[r][col] === "1") cv.rect(cx + col * scale, y + r * scale, scale, scale, c);
    cx += ADV * scale;
  }
}

function drawTextC(cv: Canvas, cx: number, y: number, s: string, scale: number, c: RGB): void {
  drawText(cv, Math.round(cx - textWidth(s, scale) / 2), y, s, scale, c);
}

// Greedy word wrap to a pixel width; returns the lines.
function wrap(s: string, maxW: number, scale: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (textWidth(t, scale) <= maxW || !cur) cur = t;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawPara(cv: Canvas, x: number, y: number, s: string, maxW: number, scale: number, c: RGB, lh: number): number {
  const lines = wrap(s, maxW, scale);
  lines.forEach((ln, i) => drawText(cv, x, y + i * lh, ln, scale, c));
  return lines.length;
}

// ------------------------------------------------------- illustrations ---
// Small original vector scenes, one per story. All coordinates fixed.

function drawLeadArt(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.frame(x, y, w, h, INK, 2);
  cv.rect(x + 2, y + 2, w - 4, Math.floor(h * 0.55), SKY); // sky
  cv.rect(x + 2, y + 2 + Math.floor(h * 0.55), w - 4, h - 4 - Math.floor(h * 0.55), SEA); // sea
  // sun
  cv.circle(x + w - 52, y + 34, 16, GOLD);
  // distant coastline
  cv.poly(
    [
      [x + 2, y + Math.floor(h * 0.55)],
      [x + 90, y + Math.floor(h * 0.42)],
      [x + 170, y + Math.floor(h * 0.55)],
    ],
    TAN,
  );
  // tanker: hull, deck, containers, funnel
  const hx = x + 40;
  const hy = y + Math.floor(h * 0.62);
  cv.poly(
    [
      [hx, hy],
      [hx + w - 110, hy],
      [hx + w - 130, hy + 34],
      [hx + 14, hy + 34],
    ],
    INK,
  );
  cv.rect(hx + 24, hy - 22, 34, 22, RED);
  cv.rect(hx + 66, hy - 22, 34, 22, GOLD);
  cv.rect(hx + 108, hy - 22, 34, 22, BLUE);
  cv.rect(hx + 150, hy - 22, 34, 22, [90, 120, 90]);
  cv.rect(hx + w - 96, hy - 34, 16, 34, INK); // funnel
  cv.rect(hx + w - 96, hy - 40, 16, 6, RED);
  // waves
  for (let i = 0; i < 5; i++) {
    const wy = y + Math.floor(h * 0.55) + 34 + i * 16;
    for (let wx = x + 12; wx < x + w - 30; wx += 46)
      cv.line(wx, wy, wx + 22, wy, [200, 220, 235], 2);
  }
  // drone above the ship, with dashed flight path
  const dx = x + Math.floor(w * 0.52);
  const dy = y + 44;
  for (let i = 0; i < 7; i++) cv.line(dx - 120 + i * 18, dy + 52 + i * 5, dx - 112 + i * 18, dy + 52 + i * 5, RED, 2);
  cv.rect(dx - 16, dy - 6, 32, 12, INK); // body
  cv.line(dx - 26, dy - 10, dx - 2, dy - 2, INK, 2);
  cv.line(dx + 2, dy - 2, dx + 26, dy - 10, INK, 2);
  cv.line(dx - 26, dy + 10, dx - 2, dy + 2, INK, 2);
  cv.line(dx + 2, dy + 2, dx + 26, dy + 10, INK, 2);
  cv.ellipse(dx - 30, dy - 12, 12, 3, INK); // rotors
  cv.ellipse(dx + 30, dy - 12, 12, 3, INK);
  cv.ellipse(dx - 30, dy + 12, 12, 3, INK);
  cv.ellipse(dx + 30, dy + 12, 12, 3, INK);
  cv.circle(dx, dy, 4, RED);
}

function drawHormuzArt(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.frame(x, y, w, h, INK, 2);
  cv.rect(x + 2, y + 2, w - 4, h - 4, SEA);
  // two shores hemming a narrow strait
  cv.poly(
    [
      [x + 2, y + 2],
      [x + 86, y + 2],
      [x + 66, y + h - 2],
      [x + 2, y + h - 2],
    ],
    TAN,
  );
  cv.poly(
    [
      [x + w - 2, y + 2],
      [x + w - 78, y + 2],
      [x + w - 96, y + h - 2],
      [x + w - 2, y + h - 2],
    ],
    TAN,
  );
  // small ship in the channel
  const sx = x + 118;
  const sy = y + 46;
  cv.poly(
    [
      [sx, sy],
      [sx + 52, sy],
      [sx + 44, sy + 12],
      [sx + 8, sy + 12],
    ],
    INK,
  );
  cv.rect(sx + 12, sy - 8, 12, 8, RED);
  cv.rect(sx + 28, sy - 8, 12, 8, GOLD);
  // warning triangle
  const tx = x + w - 52;
  const ty = y + 12;
  cv.poly(
    [
      [tx + 16, ty],
      [tx + 32, ty + 28],
      [tx, ty + 28],
    ],
    GOLD,
  );
  drawText(cv, tx + 13, ty + 12, "!", 1, INK);
}

function drawTariffArt(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.frame(x, y, w, h, INK, 2);
  cv.rect(x + 2, y + 2, w - 4, h - 4, [255, 255, 255]);
  const base = y + h - 22;
  const bars: [string, number, RGB][] = [
    ["CHN 20%", 22, RED],
    ["IND 25%", 28, BLUE],
    ["VNM 35%", 36, GOLD],
  ];
  bars.forEach(([label, bh, c], i) => {
    const bx = x + 30 + i * 92;
    cv.rect(bx, base - bh, 52, bh, c);
    drawText(cv, bx + 2, base - bh - 14, label.split(" ")[1], 1, INK);
    drawText(cv, bx + 8, base + 6, label.split(" ")[0], 1, INK);
  });
  cv.line(x + 14, base, x + w - 14, base, INK, 2);
}

function drawEcbArt(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.frame(x, y, w, h, INK, 2);
  cv.rect(x + 2, y + 2, w - 4, h - 4, LIGHT);
  // bank temple
  const bx = x + 26;
  const by = y + 14;
  cv.poly(
    [
      [bx, by + 16],
      [bx + 52, by],
      [bx + 104, by + 16],
    ],
    INK,
  );
  for (let i = 0; i < 3; i++) cv.rect(bx + 8 + i * 36, by + 22, 10, 30, INK);
  cv.rect(bx, by + 52, 104, 5, INK);
  cv.rect(bx - 4, by + 57, 112, 5, INK);
  // coin with E
  const cx = x + w - 66;
  const cy = y + 42;
  cv.circle(cx, cy, 24, GOLD);
  cv.ring(cx, cy, 24, INK, 2);
  drawText(cv, cx - 8, cy - 10, "E", 3, INK);
}

function drawCairoArt(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.frame(x, y, w, h, INK, 2);
  cv.rect(x + 2, y + 2, w - 4, h - 4, SKY);
  // road
  cv.poly(
    [
      [x + 2, y + h - 26],
      [x + w - 2, y + h - 44],
      [x + w - 2, y + h - 2],
      [x + 2, y + h - 2],
    ],
    GREY,
  );
  for (let i = 0; i < 6; i++) cv.line(x + 16 + i * 48, y + h - 22 - i * 3, x + 36 + i * 48, y + h - 25 - i * 3, [255, 255, 255], 2);
  // tanker truck
  const tx = x + 66;
  const ty = y + 34;
  cv.ellipse(tx + 34, ty + 8, 46, 14, [200, 200, 200]); // tank
  cv.ring(tx + 34, ty + 8, 14, INK, 1);
  cv.rect(tx + 84, ty - 4, 26, 24, RED); // cab
  cv.rect(tx + 92, ty, 12, 8, SKY);
  cv.circle(tx + 22, ty + 26, 7, INK);
  cv.circle(tx + 62, ty + 26, 7, INK);
  cv.circle(tx + 96, ty + 26, 7, INK);
  // flame above the tank
  cv.poly(
    [
      [tx + 22, ty - 6],
      [tx + 30, ty - 30],
      [tx + 38, ty - 12],
      [tx + 46, ty - 34],
      [tx + 54, ty - 10],
      [tx + 62, ty - 26],
      [tx + 66, ty - 6],
    ],
    ORANGE,
  );
  cv.poly(
    [
      [tx + 32, ty - 6],
      [tx + 38, ty - 20],
      [tx + 44, ty - 8],
      [tx + 50, ty - 18],
      [tx + 54, ty - 6],
    ],
    GOLD,
  );
}

function drawParadeArt(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.frame(x, y, w, h, INK, 2);
  cv.rect(x + 2, y + 2, w - 4, h - 4, SKY);
  // storm cloud
  cv.ellipse(x + 52, y + 18, 34, 12, GREY);
  cv.ellipse(x + 84, y + 14, 26, 11, GREY);
  cv.ellipse(x + 112, y + 20, 24, 10, GREY);
  // rain
  for (let i = 0; i < 5; i++) cv.line(x + 30 + i * 22, y + 32, x + 26 + i * 22, y + 44, BLUE, 2);
  // balloon
  const bx = x + 176;
  const by = y + 44;
  cv.ellipse(bx, by, 52, 30, RED);
  cv.ellipse(bx - 14, by - 6, 16, 10, [220, 120, 120]);
  cv.line(bx - 40, by + 22, bx - 8, by + 26, INK, 2);
  cv.line(bx + 40, by + 22, bx + 8, by + 26, INK, 2);
  cv.line(bx - 6, by + 28, bx - 10, by + 34, INK, 2);
  cv.line(bx + 6, by + 28, bx + 10, by + 34, INK, 2);
  // street
  cv.rect(x + 2, y + h - 10, w - 4, 8, GREY);
}

function drawMigrationArt(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.frame(x, y, w, h, INK, 2);
  cv.rect(x + 2, y + 2, w - 4, h - 4, [255, 255, 255]);
  // axes
  cv.line(x + 26, y + 12, x + 26, y + h - 20, INK, 2);
  cv.line(x + 26, y + h - 20, x + w - 16, y + h - 20, INK, 2);
  // falling line with dots
  const pts: [number, number][] = [
    [x + 40, y + 16],
    [x + 90, y + 24],
    [x + 140, y + 30],
    [x + 190, y + 44],
    [x + 240, y + 56],
  ];
  for (let i = 0; i + 1 < pts.length; i++) cv.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], RED, 3);
  for (const [px, py] of pts) cv.circle(px, py, 4, INK);
  // down arrow at the end
  cv.poly(
    [
      [x + 240, y + 56],
      [x + 228, y + 48],
      [x + 252, y + 48],
    ],
    RED,
  );
  drawText(cv, x + 196, y + h - 16, "77,000", 1, RED);
}

// ------------------------------------------------------------ layout -----
// Newspaper front page: masthead, lead story, six stories in two rows of
// three, and an "ALSO" strip of the day's other headlines.

interface Story {
  kicker: string;
  head: string[];
  body: string;
  art: (cv: Canvas, x: number, y: number, w: number, h: number) => void;
}

const ROW_A: Story[] = [
  {
    kicker: "GULF - TRADE",
    head: ["IRAN TIGHTENS", "HORMUZ TRANSIT"],
    body: "UNCONFIRMED MINE-STRIKE CLAIMS ON TANKERS. HOUTHI ATTACKS STEP UP; OIL EDGES HIGHER.",
    art: drawHormuzArt,
  },
  {
    kicker: "TRADE - USA",
    head: ["US TARIFF PLAN", "HITS 14 PARTNERS"],
    body: "CHINA UP TO 20%, INDIA 25%, VIETNAM 35%. THE LEVIES ARE PROPOSED, NOT YET IN FORCE.",
    art: drawTariffArt,
  },
  {
    kicker: "EUROPE - MONEY",
    head: ["SPAIN'S DE COS", "TO LEAD THE ECB"],
    body: "EUROZONE LEADERS PICK PABLO HERNANDEZ DE COS TO SUCCEED CHRISTINE LAGARDE.",
    art: drawEcbArt,
  },
];

const ROW_B: Story[] = [
  {
    kicker: "EGYPT",
    head: ["CAIRO TANKER", "FIRE KILLS 31"],
    body: "FUEL TANKER CRASH AND FIRE ON THE RING ROAD INJURES 26. THE DRIVER IS ARRESTED.",
    art: drawCairoArt,
  },
  {
    kicker: "USA - THANKSGIVING",
    head: ["STORM HALTS", "MACY'S PARADE"],
    body: "POSTPONED FOR THE FIRST TIME IN ITS 100-YEAR HISTORY. IT MOVES TO SATURDAY 28 NOVEMBER.",
    art: drawParadeArt,
  },
  {
    kicker: "BRITAIN",
    head: ["UK MIGRATION", "FALLS TO 77,000"],
    body: "NET MIGRATION IN THE YEAR TO JUNE 2026 IS THE LOWEST SINCE 1997.",
    art: drawMigrationArt,
  },
];

const ALSO = [
  "ALSO: GAZA STRIKES KILL 9 - KYIV MALL HIT, 7 HURT - BANGKOK BLAST INJURES 9",
  "BOGOR MINE FLOOD, 13+ DEAD - EBOLA PASSES 12,000 - SPACEX: 1M-MODULE GO-AHEAD",
  "EARTH: 6 DAYS OVER 2°C, A FIRST - IBIZA TANKER SINKS, 1 DEAD",
];

function drawStoryPanel(cv: Canvas, x: number, y: number, w: number, h: number, s: Story): void {
  cv.frame(x, y, w, h, INK, 2);
  drawText(cv, x + 14, y + 12, s.kicker, 2, RED);
  s.head.forEach((ln, i) => drawText(cv, x + 14, y + 34 + i * 23, ln, 3, INK));
  s.art(cv, x + 12, y + 86, w - 24, 78);
  drawPara(cv, x + 14, y + 176, s.body, w - 28, 2, INK, 15);
}

function draw(): Buffer {
  const cv = new Canvas();
  const M = 28;

  // ---- masthead ----
  cv.rect(M, 18, W - 2 * M, 5, RED);
  cv.rect(M, 27, W - 2 * M, 2, INK);
  drawTextC(cv, W / 2, 40, "THE WORLD IN ONE DAY", 6, INK);
  drawTextC(cv, W / 2, 94, "THURSDAY 26 NOVEMBER 2026", 3, RED);
  cv.rect(M, 122, W - 2 * M, 2, INK);
  cv.rect(M, 127, W - 2 * M, 4, RED);

  // ---- lead story ----
  const leadY = 140;
  const leadH = 264;
  cv.frame(M, leadY, W - 2 * M, leadH, INK, 2);
  drawText(cv, M + 18, leadY + 16, "LEAD - MIDDLE EAST", 2, RED);
  const leadHead = ["TWO ITALIANS KILLED", "IN DRONE ATTACK", "ON KUWAIT"];
  leadHead.forEach((ln, i) => drawText(cv, M + 18, leadY + 44 + i * 36, ln, 4, INK));
  drawPara(
    cv,
    M + 18,
    leadY + 170,
    "TWO ITALIAN TECHNICIANS WERE KILLED IN A DRONE ATTACK ON KUWAIT. ITALY AND KUWAIT BLAME IRAN. IRAN DENIES ANY ROLE.",
    576,
    2,
    INK,
    20,
  );
  drawLeadArt(cv, M + 624, leadY + 16, W - 2 * M - 624 - 16, leadH - 32);

  // ---- story rows ----
  const cols = [M, M + 328, M + 656];
  const pw = 312;
  const ph = 250;
  ROW_A.forEach((s, i) => drawStoryPanel(cv, cols[i], 414, pw, ph, s));
  ROW_B.forEach((s, i) => drawStoryPanel(cv, cols[i], 674, pw, ph, s));

  // ---- also strip ----
  cv.rect(M, 934, W - 2 * M, 2, INK);
  ALSO.forEach((ln, i) => drawText(cv, M, 946 + i * 17, ln, 2, INK));
  drawTextC(cv, W / 2, 1002, "SOURCES: BBC, AL JAZEERA, THE GUARDIAN, THE HINDU", 1, GREY);

  return encodePNG(W, H, cv.buf);
}

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "./out";
mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}/entry.png`, draw());
