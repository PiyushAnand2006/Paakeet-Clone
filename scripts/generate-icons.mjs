/**
 * Generates the app's icons (green rounded square with a white ring and dot, matching the
 * sidebar logo) as PNG and Windows .ico files for electron-builder. Same rasteriser math as
 * src/main/tray-icon.ts, which renders the runtime tray icon.
 *
 * Usage: node scripts/generate-icons.mjs   (writes build/icon.png and build/icon.ico)
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// ---------- PNG encoding ----------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(data) {
  let c = 0xffffffff
  for (const byte of data) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  Buffer.from(data).copy(out, 8)
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), Buffer.from(data)])), 8 + data.length)
  return out
}

function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 6
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', new Uint8Array(0))
  ])
}

// ---------- rasteriser ----------

function roundedRectCoverage(x, y, size, radius) {
  const nx = Math.min(x, size - x)
  const ny = Math.min(y, size - y)
  if (size / 2 - Math.max(nx, ny) >= radius) return 1
  if (nx <= size / 2 - radius || ny <= size / 2 - radius) {
    return Math.max(0, Math.min(1, size / 2 - Math.min(nx, ny) + 0.5))
  }
  const dx = nx - (size / 2 - radius)
  const dy = ny - (size / 2 - radius)
  return Math.max(0, Math.min(1, radius - Math.hypot(dx, dy) + 0.5))
}

function circleCoverage(x, y, cx, cy, r) {
  return Math.max(0, Math.min(1, r - Math.hypot(x - cx, y - cy) + 0.5))
}

const GREEN = [22, 163, 74]

function raster(size) {
  const s = size * 4
  const rgba = new Uint8Array(size * size * 4)
  const scale = s / 32
  const radius = 9 * scale
  const ringCx = 14.5 * scale
  const ringCy = 17 * scale
  const ringR = 7.5 * scale
  const ringW = 1.3 * scale
  const dotCx = 23 * scale
  const dotCy = 11 * scale
  const dotR = 2.2 * scale
  const row = size * 4
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let green = 0
      let white = 0
      for (let sy = 0; sy < 4; sy++) {
        for (let sx = 0; sx < 4; sx++) {
          const px = x * 4 + sx + 0.5
          const py = y * 4 + sy + 0.5
          green += roundedRectCoverage(px, py, s, radius)
          const inRing = Math.abs(Math.hypot(px - ringCx, py - ringCy) - ringR) <= ringW ? 1 : 0
          white += Math.max(inRing, circleCoverage(px, py, dotCx, dotCy, dotR))
        }
      }
      green /= 16
      white = Math.min(1, white / 16)
      const i = y * row + x * 4
      rgba[i] = Math.round(GREEN[0] * (1 - white) + 255 * white)
      rgba[i + 1] = Math.round(GREEN[1] * (1 - white) + 255 * white)
      rgba[i + 2] = Math.round(GREEN[2] * (1 - white) + 255 * white)
      rgba[i + 3] = Math.round(255 * Math.min(1, green + white * 0.85))
    }
  }
  return rgba
}

// ---------- ICO (PNG-compressed entries, valid for all sizes on Vista+) ----------

function encodeIco(sizes) {
  const pngs = sizes.map((size) => ({ size, png: encodePng(size, size, raster(size)) }))
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(pngs.length, 4)
  const entries = Buffer.alloc(16 * pngs.length)
  let offset = 6 + 16 * pngs.length
  pngs.forEach(({ size, png }, i) => {
    const e = i * 16
    entries.writeUInt8(size >= 256 ? 0 : size, e) // width
    entries.writeUInt8(size >= 256 ? 0 : size, e + 1) // height
    entries.writeUInt8(0, e + 2) // palette
    entries.writeUInt8(0, e + 3) // reserved
    entries.writeUInt16LE(1, e + 4) // planes
    entries.writeUInt16LE(32, e + 6) // bpp
    entries.writeUInt32LE(png.length, e + 8)
    entries.writeUInt32LE(offset, e + 12)
    offset += png.length
  })
  return Buffer.concat([header, entries, ...pngs.map((p) => p.png)])
}

mkdirSync(join(root, 'build'), { recursive: true })
writeFileSync(join(root, 'build', 'icon.png'), encodePng(256, 256, raster(256)))
writeFileSync(join(root, 'build', 'icon.ico'), encodeIco([16, 32, 48, 256]))
console.log('Wrote build/icon.png and build/icon.ico')
