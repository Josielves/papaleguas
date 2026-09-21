import { existsSync, readdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDir, '..')
const androidDir = path.join(projectRoot, 'android')
const javaExecutable = process.platform === 'win32' ? 'java.exe' : 'java'
const gradleWrapper = process.platform === 'win32' ? 'gradlew.bat' : './gradlew'

function installedJdks() {
  const jdkRoot = path.join(os.homedir(), '.jdks')
  if (!existsSync(jdkRoot)) return []

  return readdirSync(jdkRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(jdkRoot, entry.name))
    .sort((left, right) => {
      const rank = (value) => (value.includes('21') ? 0 : value.includes('17') ? 1 : 2)
      return rank(left) - rank(right)
    })
}

function javaMajor(jdkPath) {
  const binary = path.join(jdkPath, 'bin', javaExecutable)
  if (!existsSync(binary)) return null

  const result = spawnSync(binary, ['-version'], { encoding: 'utf8', windowsHide: true })
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
  const match = output.match(/version "(?:1\.)?(\d+)/)
  return match ? Number(match[1]) : null
}

const candidates = [
  process.env.JAVA_HOME,
  ...installedJdks(),
  process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Android', 'Android Studio', 'jbr'),
].filter(Boolean)

const seen = new Set()
const compatibleJdk = candidates.find((candidate) => {
  const normalized = path.resolve(candidate).toLowerCase()
  if (seen.has(normalized)) return false
  seen.add(normalized)

  const major = javaMajor(candidate)
  return major !== null && major >= 17 && major <= 24
})

if (!compatibleJdk) {
  console.error('JDK compativel nao encontrado. Instale o JDK 21 ou defina JAVA_HOME para um JDK entre 17 e 24.')
  process.exit(1)
}

const major = javaMajor(compatibleJdk)
const env = {
  ...process.env,
  JAVA_HOME: compatibleJdk,
  PATH: `${path.join(compatibleJdk, 'bin')}${path.delimiter}${process.env.PATH ?? ''}`,
}

console.log(`Compilando Android com JDK ${major}: ${compatibleJdk}`)

const result = spawnSync(gradleWrapper, ['assembleDebug'], {
  cwd: androidDir,
  env,
  shell: process.platform === 'win32',
  stdio: 'inherit',
  windowsHide: true,
})

if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}

process.exit(result.status ?? 1)
