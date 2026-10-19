/**
 * Browser half of the MinerU bundle.
 *
 * Registers one `settings.section` page with the only two things a user needs:
 * a masked API-key field (written by the Host into the `mcp-mineru` row) and
 * the version facts of the plugin, the MCP server, and the connection.
 *
 * The page talks to the Host through the authenticated `/api` bridge only;
 * the stored key itself never reaches the page.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-mineru',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const STYLE_ID = '@local/dsh-mineru/settings.css'
    const ENDPOINT = 'api/mineru/state'

    const CSS = [
      '.dshMinu_section{display:flex;flex-direction:column;width:100%;}',
      '.dshMinu_lead{padding:4px 0 16px;border-bottom:.5px solid var(--dsw-alias-border-l2);}',
      '.dshMinu_leadTitle{font-size:16px;line-height:24px;font-weight:600;color:var(--dsw-alias-label-primary);}',
      '.dshMinu_leadText{margin-top:4px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);}',
      '.dshMinu_row{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;padding:16px 0;border-bottom:.5px solid var(--dsw-alias-border-l2);}',
      '.dshMinu_row:last-child{border-bottom:none;}',
      '.dshMinu_main{min-width:0;flex:1;}',
      '.dshMinu_title{font-size:14px;line-height:20px;color:var(--dsw-alias-label-primary);}',
      '.dshMinu_desc{margin-top:4px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);}',
      '.dshMinu_field{margin-top:10px;display:flex;align-items:center;gap:8px;}',
      '.dshMinu_input{flex:1;min-width:0;font:inherit;font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);border:.5px solid var(--dsw-alias-border-l2);border-radius:6px;padding:5px 10px;}',
      '.dshMinu_input:focus{outline:none;border-color:var(--dsw-alias-brand-primary);}',
      '.dshMinu_input:disabled{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);}',
      '.dshMinu_btn{flex:none;font:inherit;font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border:.5px solid var(--dsw-alias-border-l2);border-radius:6px;padding:4px 12px;cursor:pointer;}',
      '.dshMinu_btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-1);}',
      '.dshMinu_btn:disabled{color:var(--dsw-alias-label-secondary);cursor:default;opacity:.6;}',
      '.dshMinu_btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px;}',
      '.dshMinu_quiet{flex:none;font:inherit;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);background:transparent;border:none;padding:4px 0;cursor:pointer;}',
      '.dshMinu_quiet:hover{color:var(--dsw-alias-label-primary);}',
      '.dshMinu_notice{margin-top:8px;font-size:12px;line-height:18px;color:var(--dsw-alias-state-success-primary);}',
      '.dshMinu_error{margin-top:8px;font-size:12px;line-height:18px;color:var(--dsw-alias-state-error-primary);}',
      '.dshMinu_facts{margin-top:8px;display:flex;flex-direction:column;gap:6px;}',
      '.dshMinu_fact{display:flex;align-items:baseline;justify-content:space-between;gap:16px;font-size:12px;line-height:18px;}',
      '.dshMinu_factKey{color:var(--dsw-alias-label-secondary);}',
      '.dshMinu_factValue{color:var(--dsw-alias-label-primary);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;}',
      '.dshMinu_badge{display:inline-flex;align-items:center;padding:0 6px;border:.5px solid currentColor;border-radius:999px;font-size:12px;line-height:16px;}',
      '.dshMinu_ok{color:var(--dsw-alias-state-success-primary);}',
      '.dshMinu_off{color:var(--dsw-alias-state-warn-primary);}',
      '.dshMinu_link{margin-top:8px;display:inline-block;font-size:12px;line-height:18px;color:var(--dsw-alias-brand-primary);text-decoration:none;}',
      '.dshMinu_link:hover{text-decoration:underline;}',
    ].join('')

    const CONTENT = {
      zh: {
        nav: 'MinerU 文档解析',
        leadTitle: 'MinerU 文档解析',
        leadText: '通过 mineru-mcp 把 PDF、扫描件、图片和 Office 文档解析成 Markdown，保留表格、公式与页码。',
        key: {
          title: 'API Key',
          desc: '密钥只保存在本机 profile 配置里，页面不回显明文；保存后 MCP 连接会自动重连。',
          configured: '当前密钥',
          missing: '尚未配置密钥',
          placeholder: '粘贴 sk- 开头的 API Key',
          placeholderConfigured: '已配置，输入新值可替换',
          save: '保存',
          saving: '保存中…',
          clear: '清除',
          confirmClear: '确认清除',
          clearHint: '清除后 MinerU 工具仍会列出，但调用会返回鉴权错误。',
          noEditor: '当前 profile 未加载 config-editor，暂时只能手动改配置。',
        },
        version: {
          title: '版本信息',
          refresh: '刷新',
          plugin: '插件',
          mcp: 'mineru-mcp',
          connection: 'MCP 连接',
          connected: '已连接',
          disconnected: '未连接',
          loading: '读取中…',
        },
        link: '在 mineru.net 获取 API Key',
        saved: '已保存，MCP 连接已使用新密钥。',
        cleared: '已清除密钥。',
        errors: {
          unauthorized: '页面登录状态已失效，请刷新页面后重试。',
          missing: '保存接口不可用：Host 半还没加载。请重启 DeepSeek Harness 后再试。',
          invalidKey: 'Key 格式看起来不对：请粘贴完整的 sk- 密钥，不要带空格。',
          noEditor: '当前 profile 未加载 config-editor，无法写入配置。',
          noEntry: '找不到 mcp-mineru 配置行，请确认插件仍启用。',
          saveFailed: '写入配置失败：',
          statusFailed: '读取插件状态失败。',
          generic: '操作失败，请稍后重试。',
        },
      },
      en: {
        nav: 'MinerU',
        leadTitle: 'MinerU document parsing',
        leadText: 'Parse PDFs, scans, images, and Office files into Markdown through mineru-mcp, keeping tables, formulas, and page numbers.',
        key: {
          title: 'API key',
          desc: 'The key stays in this machine’s profile config and is never echoed back; saving reconnects the MCP server.',
          configured: 'Stored key',
          missing: 'No key configured',
          placeholder: 'Paste the sk- API key',
          placeholderConfigured: 'Configured — type a new value to replace',
          save: 'Save',
          saving: 'Saving…',
          clear: 'Clear',
          confirmClear: 'Confirm clear',
          clearHint: 'Clearing keeps the MinerU tools listed, but calls fail authentication.',
          noEditor: 'This profile has no config-editor, so the key cannot be written here.',
        },
        version: {
          title: 'Versions',
          refresh: 'Refresh',
          plugin: 'Plugin',
          mcp: 'mineru-mcp',
          connection: 'MCP connection',
          connected: 'Connected',
          disconnected: 'Disconnected',
          loading: 'Loading…',
        },
        link: 'Get an API key at mineru.net',
        saved: 'Saved. The MCP connection now uses the new key.',
        cleared: 'Key cleared.',
        errors: {
          unauthorized: 'This page is no longer signed in. Reload the page and retry.',
          missing: 'Save endpoint unavailable: the Host half is not loaded yet. Restart DeepSeek Harness and retry.',
          invalidKey: 'That does not look like a key: paste the complete sk- value without spaces.',
          noEditor: 'This profile has no config-editor, so configuration cannot be written.',
          noEntry: 'The mcp-mineru row is missing; check the plugin is still enabled.',
          saveFailed: 'Writing configuration failed: ',
          statusFailed: 'Reading plugin status failed.',
          generic: 'The operation failed. Try again.',
        },
      },
    }

    /**
     * Active locale id from a locale snapshot.
     *
     * @param snapshot - current locale snapshot.
     * @returns the BCP 47 id, or an empty string.
     */
    function localeId(snapshot) {
      if (snapshot === undefined || snapshot === null || typeof snapshot !== 'object') return ''
      const value = snapshot.active ?? snapshot.id ?? snapshot.locale
      return typeof value === 'string' ? value : ''
    }

    /**
     * Pick the dictionary for a locale id, falling back to the browser language.
     *
     * @param snapshot - current locale snapshot.
     * @returns the matching content dictionary.
     */
    function contentOf(snapshot) {
      const id = localeId(snapshot).toLowerCase()
      if (id.startsWith('zh')) return CONTENT.zh
      if (id !== '') return CONTENT.en
      const browser = typeof navigator !== 'undefined' && typeof navigator.language === 'string'
        ? navigator.language.toLowerCase()
        : ''
      return browser.startsWith('zh') ? CONTENT.zh : CONTENT.en
    }

    /**
     * Insert the page stylesheet once; the disposer removes it with the plugin.
     *
     * @returns cleanup for the inserted style element.
     */
    function installStyles() {
      if (typeof document === 'undefined') return () => {}
      if (document.querySelector(`style[data-plugin-css="${STYLE_ID}"]`) !== null) return () => {}
      const tag = document.createElement('style')
      tag.dataset.plugin = '@local/dsh-mineru'
      tag.dataset.pluginCss = STYLE_ID
      tag.textContent = CSS
      document.head.appendChild(tag)
      return () => {
        tag.remove()
      }
    }

    /**
     * Call the Host settings endpoint.
     *
     * @param action - `status` or `save`.
     * @param apiKey - submitted key for `save`; omit for `status`.
     * @returns the value envelope from the Host.
     */
    async function request(action, apiKey) {
      const url = new URL(ENDPOINT, document.baseURI)
      const body = apiKey === undefined ? { action } : { action, apiKey }
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (response.status === 401 || response.status === 403) {
        const error = new Error(`HTTP ${response.status}`)
        error.code = 'http/unauthorized'
        throw error
      }
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`)
        error.code = response.status === 404 ? 'http/missing' : `http/${response.status}`
        throw error
      }
      const payload = await response.json()
      if (payload === null || typeof payload !== 'object' || payload.ok !== true) {
        const error = new Error(payload?.error?.message ?? 'request failed')
        error.code = payload?.error?.code ?? 'mineru/failed'
        throw error
      }
      return payload.value
    }

    /**
     * Translate a Host or transport failure into page copy.
     *
     * @param error - caught failure.
     * @param text - active dictionary.
     * @returns the display text.
     */
    function messageFor(error, text) {
      const code = error !== null && typeof error === 'object' ? error.code : undefined
      const errors = text.errors
      if (code === 'http/unauthorized') return errors.unauthorized
      if (code === 'http/missing') return errors.missing
      if (code === 'mineru/invalid-key') return errors.invalidKey
      if (code === 'mineru/config-editor-missing') return errors.noEditor
      if (code === 'mineru/mcp-entry-missing') return errors.noEntry
      if (code === 'mineru/status-failed') return errors.statusFailed
      if (code === 'mineru/save-failed') {
        return `${errors.saveFailed}${error instanceof Error ? error.message : String(error)}`
      }
      return errors.generic
    }

    /** One titled row of the settings page. */
    function Row(props) {
      const children = props.children === undefined
        ? []
        : Array.isArray(props.children) ? props.children : [props.children]
      return h(
        'div',
        { className: 'dshMinu_row' },
        h(
          'div',
          { className: 'dshMinu_main' },
          h('div', { className: 'dshMinu_title' }, props.title),
          ...children,
        ),
        props.side === undefined ? null : props.side,
      )
    }

    /** A wrapped paragraph of secondary copy. */
    function Desc(text) {
      return h('div', { className: 'dshMinu_desc' }, text)
    }

    /**
     * One label/value line inside the version block.
     *
     * @param props - label, value, and optional emphasis className.
     * @returns the fact row element.
     */
    function Fact(props) {
      const value = props.badge === true
        ? h('span', { className: `dshMinu_badge ${props.valueClass ?? ''}` }, props.value)
        : h('span', { className: 'dshMinu_factValue' }, props.value)
      return h(
        'div',
        { className: 'dshMinu_fact' },
        h('span', { className: 'dshMinu_factKey' }, props.label),
        value,
      )
    }

    /**
     * Build the section component bound to the Client locale service.
     *
     * @param ctx - browser plugin context.
     * @returns the settings section component.
     */
    function createSection(ctx) {
      return function MinerUSection() {
        const [snapshot, setSnapshot] = React.useState(() => ctx.locale.getSnapshot())
        const [status, setStatus] = React.useState(null)
        const [error, setError] = React.useState('')
        const [notice, setNotice] = React.useState('')
        const [draft, setDraft] = React.useState('')
        const [busy, setBusy] = React.useState(false)
        const [confirmClear, setConfirmClear] = React.useState(false)
        const [refreshTick, setRefreshTick] = React.useState(0)

        const text = contentOf(snapshot)

        React.useEffect(
          () => ctx.locale.subscribe(() => setSnapshot(ctx.locale.getSnapshot())),
          [],
        )

        React.useEffect(() => {
          let alive = true
          request('status').then(
            (value) => {
              if (alive) setStatus(value)
            },
            (failure) => {
              if (alive) setError(messageFor(failure, contentOf(ctx.locale.getSnapshot())))
            },
          )
          return () => {
            alive = false
          }
        }, [])

        React.useEffect(() => {
          if (!confirmClear) return undefined
          const timer = setTimeout(() => setConfirmClear(false), 4000)
          return () => clearTimeout(timer)
        }, [confirmClear])

        React.useEffect(() => {
          if (notice === '') return undefined
          const timer = setTimeout(() => setNotice(''), 3200)
          return () => clearTimeout(timer)
        }, [notice])

        const run = async (action, apiKey) => {
          if (busy) return
          setBusy(true)
          setError('')
          setNotice('')
          try {
            const value = await request(action, apiKey)
            setStatus(value)
            return true
          } catch (failure) {
            setError(messageFor(failure, text))
            return false
          } finally {
            setBusy(false)
          }
        }

        const save = async () => {
          if (draft.trim() === '') return
          if (await run('save', draft)) {
            setDraft('')
            setNotice(text.saved)
            setRefreshTick((value) => value + 1)
          }
        }

        const clear = async () => {
          if (!confirmClear) {
            setConfirmClear(true)
            return
          }
          setConfirmClear(false)
          if (await run('save', '')) {
            setNotice(text.cleared)
            setRefreshTick((value) => value + 1)
          }
        }

        React.useEffect(() => {
          if (refreshTick === 0) return undefined
          const timer = setTimeout(() => {
            request('status').then(
              (value) => setStatus(value),
              (failure) => setError(messageFor(failure, contentOf(ctx.locale.getSnapshot()))),
            )
          }, 1600)
          return () => clearTimeout(timer)
        }, [refreshTick])

        const editDisabled = busy || status === null || status.canEdit !== true
        const keyHint = status === null
          ? text.version.loading
          : status.keyConfigured
            ? `${text.key.configured}: ${status.maskedKey}`
            : text.key.missing
        const connection = status === null
          ? text.version.loading
          : status.connected ? text.version.connected : text.version.disconnected

        return h(
          'div',
          { className: 'dshMinu_section' },
          h(
            'div',
            { className: 'dshMinu_lead' },
            h('div', { className: 'dshMinu_leadTitle' }, text.leadTitle),
            h('div', { className: 'dshMinu_leadText' }, text.leadText),
          ),
          h(
            Row,
            { title: text.key.title },
            Desc(text.key.desc),
            h(
              'div',
              { className: 'dshMinu_field' },
              h('input', {
                className: 'dshMinu_input',
                type: 'password',
                value: draft,
                placeholder: status !== null && status.keyConfigured ? text.key.placeholderConfigured : text.key.placeholder,
                autoComplete: 'off',
                spellCheck: false,
                disabled: editDisabled,
                onChange: (event) => setDraft(event.target.value),
                onKeyDown: (event) => {
                  if (event.key === 'Enter') save()
                },
              }),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dshMinu_btn',
                  disabled: editDisabled || draft.trim() === '',
                  onClick: save,
                },
                busy ? text.key.saving : text.key.save,
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dshMinu_quiet',
                  disabled: editDisabled || status === null || !status.keyConfigured,
                  onClick: clear,
                },
                confirmClear ? text.key.confirmClear : text.key.clear,
              ),
            ),
            h('div', { className: 'dshMinu_desc' }, keyHint),
            status !== null && status.canEdit !== true ? h('div', { className: 'dshMinu_error' }, text.key.noEditor) : null,
            notice === '' ? null : h('div', { className: 'dshMinu_notice' }, notice),
            error === '' ? null : h('div', { className: 'dshMinu_error' }, error),
            h(
              'a',
              { className: 'dshMinu_link', href: 'https://mineru.net', target: '_blank', rel: 'noopener noreferrer' },
              text.link,
            ),
          ),
          h(
            Row,
            {
              title: text.version.title,
              side: h(
                'button',
                {
                  type: 'button',
                  className: 'dshMinu_quiet',
                  disabled: busy,
                  onClick: () => {
                    setNotice('')
                    run('status')
                  },
                },
                text.version.refresh,
              ),
            },
            h(
              'div',
              { className: 'dshMinu_facts' },
              h(Fact, { label: text.version.plugin, value: status === null ? text.version.loading : status.pluginVersion }),
              h(Fact, { label: text.version.mcp, value: status === null ? text.version.loading : status.mcpVersion }),
              h(Fact, {
                label: text.version.connection,
                value: connection,
                badge: true,
                valueClass: status === null ? '' : status.connected ? 'dshMinu_ok' : 'dshMinu_off',
              }),
            ),
          ),
        )
      }
    }

    return {
      inject: ['slots', 'locale'],
      /**
       * Mount the settings page.
       *
       * @param ctx - browser plugin context.
       */
      apply(ctx) {
        ctx.effect(installStyles, 'mineru: settings styles')
        ctx.effect(
          () =>
            ctx.slots.inject('settings.section', () =>
              ctx.slots.register(
                {
                  name: 'settings.section',
                  id: 'mineru',
                  order: 30,
                  label: () => contentOf(ctx.locale.getSnapshot()).nav,
                },
                createSection(ctx),
              ),
            ),
          'mineru: settings section',
        )
      },
    }
  },
})
