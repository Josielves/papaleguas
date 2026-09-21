import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const outputDir = path.join(root, 'assets')
const mark = await readFile(path.join(root, 'branding', 'papaleguas-mark.svg'))

await mkdir(outputDir, { recursive: true })

async function resizedMark(size) {
  return sharp(mark)
    .resize(size, size, {
      fit: 'contain',
      withoutEnlargement: false,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha()
    .png()
    .toBuffer()
}

async function squareCanvas(size, background, overlay, overlaySize) {
  const icon = await resizedMark(overlaySize)
  const offset = Math.round((size - overlaySize) / 2)
  return sharp({
    create: { width: size, height: size, channels: 4, background },
  })
    .composite([{ input: icon, left: offset, top: offset }])
    .png()
    .toBuffer()
}

const dark = { r: 11, g: 17, b: 32, alpha: 1 }
const transparent = { r: 0, g: 0, b: 0, alpha: 0 }

await sharp(await squareCanvas(1024, dark, mark, 760)).toFile(path.join(outputDir, 'icon-only.png'))
await sharp(await squareCanvas(1024, transparent, mark, 620)).toFile(path.join(outputDir, 'icon-foreground.png'))
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: dark } })
  .png()
  .toFile(path.join(outputDir, 'icon-background.png'))

const splashLogo = await resizedMark(900)
const wordmark = Buffer.from(`
  <svg width="1600" height="320" xmlns="http://www.w3.org/2000/svg">
    <text x="800" y="190" text-anchor="middle" fill="#f4f1ea"
      font-family="Arial, sans-serif" font-size="190" font-weight="700">Papaleguas</text>
    <rect x="515" y="250" width="570" height="12" rx="6" fill="#f5a623"/>
  </svg>
`)

for (const filename of ['splash.png', 'splash-dark.png']) {
  await sharp({ create: { width: 2732, height: 2732, channels: 4, background: dark } })
    .composite([
      { input: splashLogo, left: 916, top: 560 },
      { input: wordmark, left: 566, top: 1480 },
    ])
    .png()
    .toFile(path.join(outputDir, filename))
}

console.log(`Assets oficiais gerados em ${outputDir}`)
