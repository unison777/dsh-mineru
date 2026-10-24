/**
 * Host half of the MinerU bundle.
 *
 * Two contributions:
 * - the embedded `mineru` skill, so any session can load the MinerU workflow on
 *   demand without a copy under `$DSH_HOME/skills`;
 * - one authenticated JSON endpoint under `/api/mineru/state`, which the
 *   settings page uses to read version facts, save the API key into the
 *   `mcp-mineru` row's `env.MINERU_API_KEY`, and apply the Node / mineru-mcp
 *   paths detected on this machine.
 *
 * Writing through `ctx.configEditor.edit` keeps one source of truth: the
 * profile patch is updated, the Loader reconciles the row, and `dsh-mcp-client`
 * reconnects in place. The full key never leaves the Host; clients only receive
 * a masked hint.
 *
 * @module @unison777/dsh-mineru
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isPortable, resolveEnvironment } from './environment.js'

/** Loader entry id the bundle inserts for the MCP connection. */
const MCP_ENTRY_ID = 'mcp-mineru'
/** Exact Fetch route consumed by the settings page. */
const ROUTE_PATH = '/api/mineru/state'
/** Primary tool used as the connection probe. */
const PRIMARY_TOOL = 'mcp__mineru__mineru_parse'
/** Upper bound accepted for a pasted key. */
const MAX_KEY_LENGTH = 200
/** Minimum accepted length; MinerU keys are `sk-` plus a long token. */
const MIN_KEY_LENGTH = 10

/** Skill file shipped beside this module. */
const SKILL_URL = new URL('./skill/SKILL.md', import.meta.url)

/** This package's manifest, read once for the version row. */
const PACKAGE_VERSION = (() => {
  try {
    const manifest = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
    return typeof manifest.version === 'string' ? manifest.version : 'unknown'
  } catch {
    return 'unknown'
  }
})()

/** Used when the skill frontmatter cannot be read. */
const FALLBACK_DESCRIPTION =
  'MinerU 文档解析：用 mcp__mineru__* 工具把 PDF、图片和 Office 文档解析成 Markdown（OCR、表格、公式），支持批量、长文档切片和落盘。'

/**
 * Split a SKILL.md document into its frontmatter fields and body.
 * Only flat `key: value` frontmatter is supported, which is all a skill needs.
 *
 * @param source - raw file contents.
 * @returns the description and the instruction body.
 */
function parseSkillDocument(source) {
  const text = source.replace(/^\uFEFF/, '')
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text)
  if (match === null) return { description: FALLBACK_DESCRIPTION, content: text.trim() }
  const meta = {}
  for (const line of match[1].split(/\r?\n/)) {
    const entry = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line)
    if (entry === null) continue
    meta[entry[1]] = entry[2].replace(/^["']/, '').replace(/["']$/, '').trim()
  }
  return {
    description: meta.description !== undefined && meta.description !== '' ? meta.description : FALLBACK_DESCRIPTION,
    content: match[2].trim(),
  }
}

/**
 * Build a JSON response with no caching.
 *
 * @param payload - JSON-serializable body.
 * @param status - HTTP status code.
 * @returns the Fetch response.
 */
function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

/**
 * Failure envelope understood by the settings page.
 *
 * @param code - stable machine-readable code.
 * @param message - operator-facing detail.
 * @returns the Fetch response.
 */
function failure(code, message, details) {
  const error = { code, message }
  if (details !== undefined) error.details = details
  return jsonResponse({ ok: false, error })
}

/**
 * Resolve the `mcp-mineru` Loader entry.
 *
 * @param ctx - Host plugin context.
 * @returns the unique entry, or undefined when the row is absent or duplicated.
 */
function mcpEntry(ctx) {
  const editor = ctx.get('configEditor')
  if (editor === undefined || editor === null) return undefined
  try {
    return editor.entries().find((entry) => entry.options?.id === MCP_ENTRY_ID)
  } catch {
    return undefined
  }
}

/**
 * Read a row's current raw config.
 *
 * @param entry - Loader entry resolved by {@link mcpEntry}.
 * @returns the config object, never undefined.
 */
function configOf(entry) {
  const config = entry?.options?.config
  return config !== null && typeof config === 'object' && !Array.isArray(config) ? config : {}
}

/**
 * Mask a stored key for display: first three characters and the last four.
 *
 * @param key - stored secret text.
 * @returns the masked hint, or an empty string when no key is stored.
 */
function maskKey(key) {
  const text = typeof key === 'string' ? key.trim() : ''
  if (text === '') return ''
  if (text.length <= 8) return '••••'
  return `${text.slice(0, 3)}…${text.slice(-4)}`
}

/**
 * Find the mineru-mcp manifest by walking up from the served entry file.
 *
 * @param config - the `mcp-mineru` row config.
 * @returns the installed mineru-mcp version, or `unknown`.
 */
function mcpVersion(config) {
  const args = Array.isArray(config.args) ? config.args : []
  const entryFile = args.find((value) => typeof value === 'string' && value.toLowerCase().includes('mineru-mcp'))
  if (entryFile === undefined) return 'unknown'
  let directory = dirname(entryFile)
  for (let depth = 0; depth < 4; depth += 1) {
    try {
      const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
      if (manifest?.name === 'mineru-mcp') return typeof manifest.version === 'string' ? manifest.version : 'unknown'
    } catch {
      // Keep walking up; the dist directory has no manifest.
    }
    const parent = dirname(directory)
    if (parent === directory) break
    directory = parent
  }
  return 'unknown'
}

/**
 * Collect the facts the settings page renders. The key itself is never included.
 *
 * @param ctx - Host plugin context.
 * @returns the status payload.
 */
function readStatus(ctx) {
  const entry = mcpEntry(ctx)
  const config = configOf(entry)
  const env = config.env !== null && typeof config.env === 'object' ? config.env : {}
  const key = typeof env.MINERU_API_KEY === 'string' ? env.MINERU_API_KEY.trim() : ''
  const tools = ctx.get('tools')
  let connected = false
  try {
    connected = tools !== undefined && tools.get(PRIMARY_TOOL) !== undefined
  } catch {
    connected = false
  }
  const environment = resolveEnvironment(config)
  const editor = ctx.get('configEditor')
  return {
    pluginVersion: PACKAGE_VERSION,
    mcpVersion: mcpVersion(config),
    connected,
    keyConfigured: key !== '',
    maskedKey: maskKey(key),
    environment,
    canConfigure:
      environment.ready !== true &&
      editor !== undefined &&
      entry !== undefined &&
      environment.detectedReady === true,
    canEdit: editor !== undefined,
    entryAvailable: entry !== undefined,
  }
}

/**
 * Validate a submitted key.
 *
 * @param value - raw request field.
 * @returns the trimmed key, or a failure response.
 */
function normalizeKey(value) {
  if (value === undefined || value === null) return { key: '' }
  if (typeof value !== 'string') return { error: failure('mineru/invalid-key', 'API key must be a string') }
  const key = value.trim()
  if (key === '') return { key: '' }
  if (key.length < MIN_KEY_LENGTH || key.length > MAX_KEY_LENGTH || /\s/.test(key)) {
    return { error: failure('mineru/invalid-key', 'API key length or characters look wrong') }
  }
  return { key }
}

/**
 * Persist one key or clear the stored one, then return fresh status.
 *
 * @param ctx - Host plugin context.
 * @param rawKey - submitted key text; empty clears it.
 * @returns the status payload on success, or a failure response.
 */
async function saveKey(ctx, rawKey) {
  const normalized = normalizeKey(rawKey)
  if (normalized.error !== undefined) return normalized.error
  const editor = ctx.get('configEditor')
  if (editor === undefined || editor === null) {
    return failure('mineru/config-editor-missing', 'config-editor is not mounted in this profile')
  }
  const entry = mcpEntry(ctx)
  if (entry === undefined) {
    return failure('mineru/mcp-entry-missing', `Loader entry ${MCP_ENTRY_ID} is unavailable`)
  }
  try {
    await editor.edit(entry, (current) => {
      const base = current !== null && typeof current === 'object' && !Array.isArray(current) ? current : {}
      const env = base.env !== null && typeof base.env === 'object' && !Array.isArray(base.env) ? { ...base.env } : {}
      env.MINERU_API_KEY = normalized.key
      return { ...base, env }
    })
  } catch (error) {
    return failure('mineru/save-failed', error instanceof Error ? error.message : String(error))
  }
  return readStatus(ctx)
}

/**
 * Write the detected Node / mineru-mcp pair into the `mcp-mineru` row.
 *
 * @param ctx - Host plugin context.
 * @returns the refreshed status, or a failure response.
 */
async function configureEnvironment(ctx) {
  const editor = ctx.get('configEditor')
  if (editor === undefined || editor === null) {
    return failure('mineru/config-editor-missing', 'config-editor is not mounted in this profile')
  }
  const entry = mcpEntry(ctx)
  if (entry === undefined) {
    return failure('mineru/mcp-entry-missing', `Loader entry ${MCP_ENTRY_ID} is unavailable`)
  }
  const environment = resolveEnvironment(configOf(entry))
  if (environment.ready === true) return readStatus(ctx)
  if (environment.detectedReady !== true) {
    return failure(
      'mineru/environment-not-ready',
      `runtime not detected: ${environment.reason ?? 'unknown'}`,
      { reason: environment.reason ?? 'unknown' },
    )
  }
  try {
    await editor.edit(entry, (current) => {
      const base = current !== null && typeof current === 'object' && !Array.isArray(current) ? current : {}
      const args = Array.isArray(base.args) ? [...base.args] : []
      if (args.length === 0) args.push('')
      args[0] = environment.entry
      return { ...base, command: environment.node, args }
    })
  } catch (error) {
    return failure('mineru/configure-failed', error instanceof Error ? error.message : String(error))
  }
  return readStatus(ctx)
}

/**
 * Fill the portable defaults once, when this machine offers a runtime.
 *
 * Deferred out of activation so the Loader is settled; a failure is logged and
 * leaves the one-click path in the settings page available.
 *
 * @param ctx - Host plugin context.
 */
async function autoConfigure(ctx) {
  try {
    const editor = ctx.get('configEditor')
    if (editor === undefined || editor === null) return
    const entry = mcpEntry(ctx)
    if (entry === undefined) return
    const config = configOf(entry)
    if (!isPortable(config)) return
    const environment = resolveEnvironment(config)
    if (environment.detectedReady !== true) {
      ctx.logger?.warn?.(`mineru: runtime not detected (${environment.reason ?? 'unknown'})`)
      return
    }
    await editor.edit(entry, (current) => {
      const base = current !== null && typeof current === 'object' && !Array.isArray(current) ? current : {}
      const args = Array.isArray(base.args) ? [...base.args] : []
      if (args.length === 0) args.push('')
      args[0] = environment.entry
      return { ...base, command: environment.node, args }
    })
    ctx.logger?.info?.(`mineru: configured MCP runtime from ${environment.nodeSource}/${environment.entrySource}`)
  } catch (error) {
    ctx.logger?.warn?.(`mineru: automatic runtime configuration failed (${String(error)})`)
  }
}

/**
 * Dispatch one settings request.
 *
 * @param ctx - Host plugin context.
 * @param request - Fetch request from the authenticated `/api` bridge.
 * @returns the Fetch response.
 */
async function handleState(ctx, request) {
  if (request.method !== 'POST') {
    return failure('mineru/method-not-allowed', 'Only POST is supported')
  }
  let body
  try {
    body = await request.json()
  } catch {
    return failure('mineru/invalid-body', 'Request body must be JSON')
  }
  if (body === null || typeof body !== 'object') {
    return failure('mineru/invalid-body', 'Request body must be a JSON object')
  }
  try {
    if (body.action === 'status') return jsonResponse({ ok: true, value: readStatus(ctx) })
    if (body.action === 'save') {
      if (typeof body.apiKey !== 'string') {
        return failure('mineru/invalid-key', 'apiKey must be a string')
      }
      const result = await saveKey(ctx, body.apiKey)
      return result instanceof Response ? result : jsonResponse({ ok: true, value: result })
    }
    if (body.action === 'configure') {
      const result = await configureEnvironment(ctx)
      return result instanceof Response ? result : jsonResponse({ ok: true, value: result })
    }
    return failure('mineru/unknown-action', `Unknown action ${String(body.action)}`)
  } catch (error) {
    return failure('mineru/status-failed', error instanceof Error ? error.message : String(error))
  }
}

/** Services this half requires; without a skill registry it stays inactive. */
export const inject = ['skills']

/** Plugin name used in Loader diagnostics. */
export const name = 'mineru'

/**
 * Register the embedded skill and the settings endpoint.
 *
 * @param ctx - Cordis context carrying `ctx.skills`.
 */
export function apply(ctx) {
  let document
  try {
    document = parseSkillDocument(readFileSync(SKILL_URL, 'utf8'))
  } catch (error) {
    ctx.logger?.warn?.(`mineru: skill file unavailable (${String(error)})`)
  }
  if (document !== undefined && document.content !== '') {
    const skill = {
      name: 'mineru',
      description: document.description,
      content: document.content,
      source: '@unison777/dsh-mineru',
    }
    ctx.effect(() => ctx.skills.register(skill), 'mineru: embedded skill')
  } else if (document !== undefined) {
    ctx.logger?.warn?.('mineru: skill file is empty')
  }

  ctx.inject(['connection'], (scope) => {
    scope.effect(
      () =>
        scope.connection.fetch.register({
          path: ROUTE_PATH,
          methods: ['POST'],
          requestBody: 'buffered',
          fetch: (request) => handleState(ctx, request),
        }),
      'mineru: settings endpoint',
    )
  })

  ctx.effect(() => {
    const first = setTimeout(() => {
      void autoConfigure(ctx)
    }, 0)
    const second = setTimeout(() => {
      void autoConfigure(ctx)
    }, 1500)
    return () => {
      clearTimeout(first)
      clearTimeout(second)
    }
  }, 'mineru: runtime detection')
}
