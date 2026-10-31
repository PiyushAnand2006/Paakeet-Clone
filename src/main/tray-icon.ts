import { deflateSync } from 'node:zlib'

/**
 * Renders the app's tray/window icon (a green rounded square with a white ring and dot,
 * echoing the sidebar logo) in code and encodes it as a PNG. Doing it at runtime keeps
 * the repo free of binary assets and guarantees the icon always matches the brand token.
 */

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

function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (const byte of data) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  Buffer.from(data).copy(out, 8)
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), Buffer.from(data)])), 8 + data.length)
  return out
}

function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // colour type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0 // filter: none
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

/** Distance-based anti-aliased coverage of a rounded rectangle. */
function roundedRectCoverage(x: number, y: number, size: number, radius: number): number {
  const nx = Math.min(x, size - x)
  const ny = Math.min(y, size - y)
  const inside = size / 2 - Math.max(nx, ny)
  if (inside >= radius) return 1
  const dx = nx - (size / 2 - radius)
  const dy = ny - (size / 2 - radius)
  if (nx <= size / 2 - radius || ny <= size / 2 - radius) {
    // In the straight part of an edge: distance to the border.
    const d = Math.min(nx, ny)
    return Math.max(0, Math.min(1, size / 2 - d + 0.5))
  }
  const dist = Math.hypot(dx, dy)
  return Math.max(0, Math.min(1, radius - dist + 0.5))
}

function circleCoverage(x: number, y: number, cx: number, cy: number, r: number): number {
  const dist = Math.hypot(x - cx, y - cy)
  return Math.max(0, Math.min(1, r - dist + 0.5))
}

const GREEN: [number, number, number] = [22, 163, 74] // hsl(142 76% 36%), the primary token

/** Draws the logo at `size` px with 4× supersampling. */
function raster(size: number): Uint8Array {
  const s = size * 4
  const rgba = new Uint8Array(size * size * 4)
  const scale = s / 32 // geometry authored on a 32-grid
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

export function appIconPng(size = 32): Buffer {
  return encodePng(size, size, raster(size))
}
