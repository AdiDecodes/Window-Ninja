import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(size, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));

function roundedRectSDF(px, py, cx, cy, hw, hh, r) {
  const dx = Math.abs(px - cx) - (hw - r);
  const dy = Math.abs(py - cy) - (hh - r);
  const ox = Math.max(dx, 0);
  const oy = Math.max(dy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(dx, dy), 0) - r;
}

function blend(dst, i, r, g, b, a) {
  const srcA = a;
  const dstA = dst[i + 3] / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA === 0) return;
  dst[i] = Math.round((r * srcA + dst[i] * dstA * (1 - srcA)) / outA);
  dst[i + 1] = Math.round((g * srcA + dst[i + 1] * dstA * (1 - srcA)) / outA);
  dst[i + 2] = Math.round((b * srcA + dst[i + 2] * dstA * (1 - srcA)) / outA);
  dst[i + 3] = Math.round(outA * 255);
}

function draw(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const S = size;

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = (x + 0.5) / S;
      const v = (y + 0.5) / S;
      const i = (y * S + x) * 4;

      const bgDist = roundedRectSDF(u, v, 0.5, 0.5, 0.44, 0.44, 0.18);
      const bgAlpha = clamp01(0.5 - bgDist * S);
      if (bgAlpha <= 0) continue;

      // dark navy body with subtle vertical shade
      const shade = 1 - v * 0.25;
      blend(rgba, i, Math.round(15 * shade), Math.round(23 * shade), Math.round(42 * shade), bgAlpha);

      // red headband
      const bandDist = Math.abs(v - 0.4) - 0.07;
      if (bandDist < 0) {
        const bandAlpha = clamp01(-bandDist * S) * bgAlpha;
        blend(rgba, i, 239, 68, 68, bandAlpha);
      }

      // headband tails on the left
      const tailDist = Math.max(
        Math.abs(u - 0.16) - 0.1,
        Math.abs(v - 0.52) - 0.035,
      );
      if (tailDist < 0 && u < 0.34) {
        blend(rgba, i, 220, 38, 38, clamp01(-tailDist * S) * bgAlpha);
      }

      // eye slits
      const eye = (cx) => Math.max(Math.abs(u - cx) - 0.115, Math.abs(v - 0.62) - 0.035);
      const eyeDist = Math.min(eye(0.34), eye(0.66));
      if (eyeDist < 0) {
        blend(rgba, i, 248, 250, 252, clamp01(-eyeDist * S) * bgAlpha);
      }
    }
  }
  return rgba;
}

mkdirSync('public/icon', { recursive: true });
for (const size of [16, 32, 48, 128]) {
  writeFileSync(`public/icon/${size}.png`, encodePNG(size, draw(size)));
  console.log(`wrote public/icon/${size}.png`);
}
