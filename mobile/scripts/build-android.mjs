import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDir, '..')
const androidDir = path.join(projectRoot, 'android')
const javaExecutable = process.platform === 'win32' ? 'java.exe' : 'java'
const gradleWrapper = process.platform === 'win32' ? 'gradlew.bat' : './gradlew'

function applyWindowsCppLinkWorkaround() {
  if (process.platform !== 'win32') return
  const cmakeFile = path.join(
    projectRoot,
    'node_modules',
    'expo',
    'node_modules',
    'expo-modules-core',
    'android',
    'CMakeLists.txt',
  )
  if (!existsSync(cmakeFile)) return
  const marker = '# Papaleguas Windows NDK link workaround'
  const current = readFileSync(cmakeFile, 'utf8')
  if (!current.includes(marker)) {
    writeFileSync(
      cmakeFile,
      `${current.trimEnd()}\n\n${marker}\ntarget_link_libraries(expo-modules-core PRIVATE c++_shared)\n`,
    )
  }

  const appCmakeFile = path.join(
    projectRoot,
    'node_modules',
    'react-native',
    'ReactAndroid',
    'cmake-utils',
    'default-app-setup',
    'CMakeLists.txt',
  )
  if (!existsSync(appCmakeFile)) return
  const appMarker = '# Papaleguas Windows app link workaround'
  const appCmake = readFileSync(appCmakeFile, 'utf8')
  if (appCmake.includes(appMarker)) return
  writeFileSync(
    appCmakeFile,
    appCmake.replace(
      'project(appmodules)',
      `project(appmodules)\n\n${appMarker}\nlink_libraries(c++_shared)`,
    ),
  )
}

function installedJdks() {
  const jdkRoot = path.join(os.homedir(), '.jdks')
  if (!existsSync(jdkRoot)) return []
  return readdirSync(jdkRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(jdkRoot, entry.name))
    .sort((left, right) => Number(!left.includes('21')) - Number(!right.includes('21')))
}

function findAndroidSdk() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk'),
  ].filter(Boolean)

  return candidates.find((candidate) => existsSync(candidate)) ?? null
}

function ensureAndroidSdkConfig(sdkPath) {
  const propertiesFile = path.join(androidDir, 'local.properties')
  if (existsSync(propertiesFile)) return

  const escapedPath = sdkPath.replaceAll('\\', '\\\\').replace(':', '\\:')
  writeFileSync(propertiesFile, `sdk.dir=${escapedPath}\n`)
}

function javaMajor(jdkPath) {
  const binary = path.join(jdkPath, 'bin', javaExecutable)
  if (!existsSync(binary)) return null
  const result = spawnSync(binary, ['-version'], { encoding: 'utf8', windowsHide: true })
  const match = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.match(/version "(?:1\.)?(\d+)/)
  return match ? Number(match[1]) : null
}

const candidates = [
  process.env.JAVA_HOME,
  ...installedJdks(),
  process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Android', 'Android Studio', 'jbr'),
].filter(Boolean)

const compatibleJdk = candidates.find((candidate) => {
  const major = javaMajor(candidate)
  return major !== null && major >= 17 && major <= 24
})

if (!compatibleJdk) {
  console.error('JDK compativel nao encontrado. Instale o JDK 21 ou defina JAVA_HOME.')
  process.exit(1)
}

const androidSdk = findAndroidSdk()
if (!androidSdk) {
  console.error('Android SDK nao encontrado. Instale o Android Studio ou defina ANDROID_HOME.')
  process.exit(1)
}

ensureAndroidSdkConfig(androidSdk)

const env = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV || 'production',
  JAVA_HOME: compatibleJdk,
  ANDROID_HOME: androidSdk,
  ANDROID_SDK_ROOT: androidSdk,
  PATH: `${path.join(compatibleJdk, 'bin')}${path.delimiter}${process.env.PATH ?? ''}`,
}

applyWindowsCppLinkWorkaround()
console.log(`Compilando React Native Android com JDK ${javaMajor(compatibleJdk)}: ${compatibleJdk}`)
const architectures = process.env.ANDROID_ABIS || 'arm64-v8a'
const variant = (process.env.ANDROID_VARIANT || 'release').toLowerCase()
if (!['debug', 'release'].includes(variant)) {
  console.error('ANDROID_VARIANT deve ser debug ou release.')
  process.exit(1)
}
const gradleTask = variant === 'release' ? 'assembleRelease' : 'assembleDebug'
console.log(`Arquiteturas do APK: ${architectures}`)
console.log(`Variante do APK: ${variant}`)
const result = spawnSync(gradleWrapper, [gradleTask, `-PreactNativeArchitectures=${architectures}`], {
  cwd: androidDir,
  env,
  shell: process.platform === 'win32',
  stdio: 'inherit',
  windowsHide: true,
})

if (result.error) console.error(result.error.message)
process.exit(result.status ?? 1)
