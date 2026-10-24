/**
 * Runtime discovery for the MinerU bundle.
 *
 * `dsh-mcp-client` spawns `mineru-mcp` as a separate Node process, so the MCP
 * row needs a Node executable and the path to `mineru-mcp/dist/index.js`.
 * Both are machine-specific. This module finds them without asking the user:
 *
 * - Node: MINERU_NODE, the Host's own node (when it is node), the Node runtime
 *   shipped under $DSH_HOME/dsh-runtimes, or `node` on PATH. Each candidate is
 *   verified with `--version`.
 * - mineru-mcp: MINERU_MCP_ENTRY, or the copy installed as this package's
 *   dependency (resolved from this module).
 *
 * The caller decides whether to write the resolved pair into the profile row.
 *
 * @module @unison777/dsh-mineru/environment
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Chain of specifiers to resolve this bundle's own dependencies from.
 *
 * pnpm installs a package under `node_modules/.pnpm/<id>/node_modules/<name>`
 * and exposes it through a junction at `node_modules/<name>`. Node's ESM loader
 * keeps that junction path in `import.meta.url`, and `require.resolve` walking
 * up from it looks at `<profile>/node_modules` — where the dependency is not.
 * Resolving from the real path reaches `.pnpm/<id>/node_modules`, where it is.
 * Both are tried so the module also works from a plain `link:` checkout.
 */
function dependencyResolvers() {
  const resolvers = []
  const seen = new Set()
  const add = (url) => {
    if (url === undefined || seen.has(url)) return
    seen.add(url)
    try {
      resolvers.push(createRequire(url))
    } catch {
      // A URL Node cannot turn into a require target adds nothing.
    }
  }
  add(import.meta.url)
  try {
    add(new URL(`file://${realpathSync.native(fileURLToPath(import.meta.url)).replace(/\\/g, '/')}`).href)
  } catch {
    // Non-Windows hosts and unusual layouts fall back to the plain URL.
  }
  return resolvers
}

/** Resolve packages relative to this bundle, not the Host's working directory. */
const dependencyRequires = dependencyResolvers()

/** Harness home used to find the bundled Node runtime. */
export function dshHome() {
  const configured = process.env.DSH_HOME
  return typeof configured === 'string' && configured.trim() !== ''
    ? configured.trim()
    : join(homedir(), '.dsh')
}

/** Node candidates in preference order. Duplicates are harmless. */
export function nodeCandidates() {
  const candidates = []
  const configured = process.env.MINERU_NODE
  if (typeof configured === 'string' && configured.trim() !== '') {
    candidates.push({ command: configured.trim(), source: 'env' })
  }
  if (/^node(\.exe)?$/i.test(basename(process.execPath))) {
    candidates.push({ command: process.execPath, source: 'host' })
  }
  const root = join(dshHome(), 'dsh-runtimes')
  try {
    const runtimes = readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.endsWith('.previous'))
      .sort((left, right) => left.name.localeCompare(right.name))
    for (const runtime of runtimes) {
      for (const name of ['node.exe', 'node']) {
        const candidate = join(root, runtime.name, 'dependencies', 'node', 'bin', name)
        if (existsSync(candidate)) candidates.push({ command: candidate, source: 'dsh-runtime' })
      }
    }
  } catch {
    // A deployment without a bundled runtime falls through to PATH.
  }
  candidates.push({ command: 'node', source: 'path' })
  return candidates
}

/** Whether a Node executable runs and reports a version. */
export function nodeWorks(command) {
  try {
    const result = spawnSync(command, ['--version'], {
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true,
    })
    return result.status === 0 && /^v\d+\./m.test(String(result.stdout ?? ''))
  } catch {
    return false
  }
}

/** mineru-mcp entry candidates in preference order. */
export function entryCandidates() {
  const candidates = []
  const configured = process.env.MINERU_MCP_ENTRY
  if (typeof configured === 'string' && configured.trim() !== '') {
    candidates.push({ entry: configured.trim(), source: 'env' })
  }
  const seen = new Set()
  for (const specifier of ['mineru-mcp', 'mineru-mcp/dist/index.js']) {
    for (const resolver of dependencyRequires) {
      let entry
      try {
        entry = resolver.resolve(specifier)
      } catch {
        // This resolver cannot see the dependency; try the next one.
        continue
      }
      if (seen.has(entry)) continue
      seen.add(entry)
      candidates.push({ entry, source: 'dependency' })
      break
    }
  }
  // The copy sitting beside the resolved package, when resolution found nothing.
  if (candidates.length === 0) {
    for (const guess of siblingEntryGuesses()) {
      if (existsSync(guess)) candidates.push({ entry: guess, source: 'sibling' })
    }
  }
  return candidates
}

/**
 * Conventional dependency layouts next to this bundle, as a last resort.
 *
 * A Host that loads the bundle from a location where neither the junction nor
 * the real path resolves (for example a copied artifact tree) still has the
 * dependency next to it in one of these shapes.
 *
 * @returns candidate `mineru-mcp` entry files, most likely first.
 */
function siblingEntryGuesses() {
  const roots = []
  try {
    roots.push(dirname(fileURLToPath(import.meta.url)))
  } catch {
    // Without a file URL there is nothing to stand beside.
  }
  const guesses = []
  for (const root of roots) {
    guesses.push(join(root, 'node_modules', 'mineru-mcp', 'dist', 'index.js'))
    guesses.push(join(root, '..', 'mineru-mcp', 'dist', 'index.js'))
    guesses.push(join(root, '..', '..', 'mineru-mcp', 'dist', 'index.js'))
  }
  return guesses
}

/** Probe the machine for a usable Node and mineru-mcp pair. */
export function detectEnvironment() {
  let node
  let nodeSource = ''
  for (const candidate of nodeCandidates()) {
    if (nodeWorks(candidate.command)) {
      node = candidate.command
      nodeSource = candidate.source
      break
    }
  }
  let entry
  let entrySource = ''
  for (const candidate of entryCandidates()) {
    if (existsSync(candidate.entry)) {
      entry = candidate.entry
      entrySource = candidate.source
      break
    }
  }
  return {
    node: node ?? '',
    nodeSource,
    entry: entry ?? '',
    entrySource,
    ready: node !== undefined && entry !== undefined,
    reason: node === undefined ? 'no-node' : entry === undefined ? 'no-entry' : null,
  }
}

/**
 * Current command/entry pair from an MCP row config.
 *
 * @param config - the `mcp-mineru` row config.
 * @returns the configured command and first positional argument.
 */
export function currentPair(config) {
  const command = typeof config?.command === 'string' ? config.command : ''
  const args = Array.isArray(config?.args) ? config.args : []
  const entry = typeof args[0] === 'string' ? args[0] : ''
  return { command, entry }
}

/**
 * Whether a row still carries the bundle's portable defaults.
 *
 * @param config - the `mcp-mineru` row config.
 * @returns true when the row has no machine-specific paths yet.
 */
export function isPortable(config) {
  const { command } = currentPair(config)
  const args = Array.isArray(config?.args) ? config.args : []
  return (command === '' || command === 'node') && (args.length === 0 || args[0] === '')
}

/**
 * Describe the active environment and the best detected pair.
 *
 * `ready` is true only when the row's current command/entry work. `detected*`
 * reports what this machine offers, so the caller can offer a one-click fix.
 *
 * @param config - the `mcp-mineru` row config.
 * @returns the environment snapshot.
 */
export function resolveEnvironment(config) {
  const current = currentPair(config)
  const currentReady =
    current.command !== '' &&
    current.entry !== '' &&
    existsSync(current.entry) &&
    nodeWorks(current.command)
  if (currentReady) {
    return {
      ready: true,
      node: current.command,
      nodeSource: 'config',
      entry: current.entry,
      entrySource: 'config',
      detectedReady: true,
      reason: null,
    }
  }
  const detected = detectEnvironment()
  return {
    ready: false,
    node: detected.node,
    nodeSource: detected.nodeSource,
    entry: detected.entry,
    entrySource: detected.entrySource,
    detectedReady: detected.ready,
    reason:
      detected.reason ??
      (isPortable(config) ? 'not-applied' : 'invalid-config'),
  }
}
