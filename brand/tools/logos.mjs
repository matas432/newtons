import fs from 'fs'
import opentype from 'opentype.js'

const OUT = 'brand/logo'
fs.mkdirSync(OUT, { recursive: true })

export const C = {
  pino: '#1F4D45', // verde profundo: confianza, naturaleza, salud sin frialdad clínica
  ambar: '#E39B3A', // acento cálido: la manzana, la luz de la mañana
  salvia: '#DCE8E1',
  crema: '#F7F4EE',
  tinta: '#17232E',
  white: '#FFFFFF',
}

const font = (p) => {
  const b = fs.readFileSync('node_modules/@fontsource/' + p)
  return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
}
const FONTS = {
  fraunces: font('fraunces/files/fraunces-latin-600-normal.woff'),
  manrope: font('manrope/files/manrope-latin-700-normal.woff'),
  outfit: font('outfit/files/outfit-latin-500-normal.woff'),
}

// ------------------------------------------------------------ símbolos (caja 100×100)

const APPLE = 'M50 30 C60 19 88 19 92 46 C96 71 79 94 64 92 C58 91 55 88 50 88 C45 88 42 91 36 92 C21 94 4 71 8 46 C12 19 40 19 50 30 Z'
const LEAF = 'M52 27 C51 15 59 6 73 5 C74 18 65 27 52 27 Z'

export const symbols = {
  // A · Manzana: dos mitades separadas por un hueco — la droguería y la casa; el
  // asesoramiento cruza de una a otra. La hoja: lo natural, el crecimiento.
  apple: (fg = C.pino, accent = C.ambar, id = 'm') => `
    <defs>
      <clipPath id="${id}L"><rect x="0" y="0" width="48.2" height="100"/></clipPath>
      <clipPath id="${id}R"><rect x="51.8" y="0" width="48.2" height="100"/></clipPath>
    </defs>
    <path d="${APPLE}" fill="${fg}" clip-path="url(#${id}L)"/>
    <path d="${APPLE}" fill="${accent}" clip-path="url(#${id}R)"/>
    <path d="${LEAF}" fill="${fg}"/>`,

  // B · Ritmos: cuatro hojas alrededor de un centro — los cuatro ritmos
  // (Río, Terreno, Cultivo, Cosecha). Una, en ámbar: el ciclo en curso.
  rhythms: (fg = C.pino, accent = C.ambar) => {
    const leaf = 'M50 45 C33 39 29 14 46 5 C58 13 61 36 50 45 Z'
    return [45, 135, 225, 315]
      .map((deg, i) => `<path d="${leaf}" transform="rotate(${deg} 50 50)" fill="${i === 0 ? accent : fg}"/>`)
      .join('')
  },

  // C · Brote: una N trazada de un solo gesto, sin levantar el lápiz —
  // continuidad— que termina en una hoja: lo que crece después.
  sprout: (fg = C.pino, accent = C.ambar) => `
    <path d="M24 80 V26 L74 76 V40" stroke="${fg}" stroke-width="13" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M74 40 C72 24 80 12 95 10 C97 26 88 38 74 40 Z" fill="${accent}"/>`,
}

// ------------------------------------------------------------ logotipos

const words = {
  apple: { font: FONTS.fraunces, text: 'Newtons', size: 64, tracking: -0.5 },
  rhythms: { font: FONTS.manrope, text: 'newtons', size: 62, tracking: -1.5 },
  sprout: { font: FONTS.outfit, text: 'newtons', size: 66, tracking: -1 },
}

function wordPath(key, x, baseline, color) {
  const { font, text, size, tracking } = words[key]
  let cursor = x
  const parts = []
  for (const ch of text) {
    const glyph = font.charToGlyph(ch)
    parts.push(glyph.getPath(cursor, baseline, size).toPathData(2))
    cursor += (glyph.advanceWidth / font.unitsPerEm) * size + tracking
  }
  return { d: parts.join(' '), width: cursor - x - tracking }
}

/** Logotipo horizontal: símbolo + palabra. Devuelve SVG con viewBox ajustado. */
export function lockup(key, { fg = C.pino, accent = C.ambar, text = C.tinta, bg = null } = {}) {
  const sym = 72, pad = 16, gapX = 18
  const baseline = pad + sym * 0.74
  const w = wordPath(key, pad + sym + gapX, baseline, text)
  const W = Math.ceil(pad + sym + gapX + w.width + pad), H = sym + pad * 2
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * 2}" height="${H * 2}">
  ${bg ? `<rect width="${W}" height="${H}" fill="${bg}"/>` : ''}
  <g transform="translate(${pad} ${pad}) scale(${sym / 100})">${symbols[key](fg, accent, key + Math.random().toString(36).slice(2, 6))}</g>
  <path d="${w.d}" fill="${text}"/>
</svg>`
}

/** Solo símbolo (favicon, icono de app). */
export function mark(key, { fg = C.pino, accent = C.ambar, bg = null, radius = 22, size = 100 } = {}) {
  const inner = bg ? 0.66 : 1
  const off = (100 - 100 * inner) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">
  ${bg ? `<rect width="100" height="100" rx="${radius}" fill="${bg}"/>` : ''}
  <g transform="translate(${off} ${off}) scale(${inner})">${symbols[key](fg, accent, key + 'mk' + Math.random().toString(36).slice(2, 6))}</g>
</svg>`
}

// ------------------------------------------------------------ exportar archivos

for (const key of Object.keys(symbols)) {
  const dir = `${OUT}/${key}`
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(`${dir}/newtons-${key}-color.svg`, lockup(key))
  fs.writeFileSync(`${dir}/newtons-${key}-negative.svg`, lockup(key, { fg: C.white, accent: C.ambar, text: C.white, bg: C.pino }))
  fs.writeFileSync(`${dir}/newtons-${key}-mono.svg`, lockup(key, { fg: C.tinta, accent: C.tinta, text: C.tinta }))
  fs.writeFileSync(`${dir}/newtons-${key}-symbol.svg`, mark(key))
  fs.writeFileSync(`${dir}/newtons-${key}-app-icon.svg`, mark(key, { bg: C.crema, size: 512 }))
}
console.log('ok')
