import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const outputDir = path.join(root, 'assets')
const mobileDir = path.join(root, 'mobile', 'assets')
const mark = await readFile(path.join(root, 'branding', 'papaleguas-blue-roadrunner.png'))

await Promise.all([
  mkdir(outputDir, { recursive: true }),
  mkdir(mobileDir, { recursive: true }),
])

async function resizedMark(size) {
  return sharp(mark)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(size, size, {
      fit: 'contain',
      withoutEnlargement: false,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha()
    .png()
    .toBuffer()
}

async function squareCanvas(size, background, overlaySize) {
  const icon = await resizedMark(overlaySize)
  const offset = Math.round((size - overlaySize) / 2)
  return sharp({
    create: { width: size, height: size, channels: 4, background },
  })
    .composite([{ input: icon, left: offset, top: offset }])
    .png()
    .toBuffer()
}

async function whiteSilhouette(size, overlaySize) {
  const offset = Math.round((size - overlaySize) / 2)
  const { data, info } = await sharp(await resizedMark(overlaySize))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  for (let index = 0; index < data.length; index += info.channels) {
    data[index] = 255
    data[index + 1] = 255
    data[index + 2] = 255
  }

  const whiteBird = await sharp(data, { raw: info }).png().toBuffer()
  return sharp({
    create: { width: size, height: size, channels: 4, background: transparent },
  })
    .composite([{ input: whiteBird, left: offset, top: offset }])
    .png()
    .toBuffer()
}

const light = { r: 248, g: 250, b: 252, alpha: 1 }
const transparent = { r: 0, g: 0, b: 0, alpha: 0 }

const icon = await squareCanvas(1024, light, 860)
const foreground = await squareCanvas(1024, transparent, 700)
const background = await sharp({
  create: { width: 1024, height: 1024, channels: 4, background: light },
}).png().toBuffer()
const splash = await squareCanvas(1024, transparent, 760)
const notification = await whiteSilhouette(96, 72)

await Promise.all([
  sharp(icon).toFile(path.join(outputDir, 'icon-only.png')),
  sharp(foreground).toFile(path.join(outputDir, 'icon-foreground.png')),
  sharp(background).toFile(path.join(outputDir, 'icon-background.png')),
  sharp(await squareCanvas(2732, light, 1280)).toFile(path.join(outputDir, 'splash.png')),
  sharp(await squareCanvas(2732, light, 1280)).toFile(path.join(outputDir, 'splash-dark.png')),
  sharp(icon).toFile(path.join(mobileDir, 'icon.png')),
  sharp(foreground).toFile(path.join(mobileDir, 'android-icon-foreground.png')),
  sharp(background).toFile(path.join(mobileDir, 'android-icon-background.png')),
  sharp(notification).toFile(path.join(mobileDir, 'android-icon-monochrome.png')),
  sharp(notification).toFile(path.join(mobileDir, 'notification-icon.png')),
  sharp(splash).toFile(path.join(mobileDir, 'splash-icon.png')),
  sharp(icon).resize(96, 96).toFile(path.join(mobileDir, 'favicon.png')),
])

console.log(`Assets oficiais gerados em ${outputDir} e ${mobileDir}`)
