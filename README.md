# @unison777/dsh-mineru

MinerU 文档解析插件（DeepSeek Harness bundle）。把 `mineru-mcp` 通过
`@deepseek-ai/dsh-mcp-client` 接进 DSH，并补上配置层做不到的东西：

- **开箱即用**：`mineru-mcp` 是本包依赖，安装时由 pnpm 一起装好；Host 半会自动探测
  Node 运行时和 `mineru-mcp` 的入口，写进 `mcp-mineru` 行。用户通常只需要填 API Key。
- **设置页**（`设置 → MinerU 文档解析`）：运行环境状态（附「一键配置」）、一个不回显
  明文的 API Key 输入框、插件 / mineru-mcp / MCP 连接三项版本信息，以及 MinerU 官网、
  API Key、使用文档链接。
- **mineru skill**：随插件注册进 skill 目录（`ctx.skills.register`），模型遇到
  PDF/扫描件/Office 文档时按需加载，不用往 `~/.dsh/skills` 拷一份。

模型看到的工具是 `mcp__mineru__*` 共 8 个，名称与参数完全由 MCP 服务器决定。

> **隐私提示**：MinerU 是云端解析，文件会上传到 mineru.net。涉密材料请勿使用。

## 首次使用

1. 安装 bundle（见下）；
2. 打开 `设置 → MinerU 文档解析`：
   - 「运行环境」应为 **已就绪**；如果不是，点 **一键配置**；
3. 在 `mineru.net` 申请 API Key，粘贴到 **API Key** 输入框并保存；
4. 回到对话，让模型解析 PDF / 扫描件 / Office 文档。

正常情况下，安装完成后用户只需要第 3 步；运行环境由插件自动处理。

## 安装

在 DSH 插件页的安装输入框里填地址，一键装好：

```
github:unison777/dsh-mineru
```

想锁定版本就在后面加 tag，例如 `github:unison777/dsh-mineru#v0.3.2`；不加则跟踪 `main`。

装完确认：

1. `cordis_inspect_query` → `Config.listConfigs` / `Tool.listTools` 里出现 `mcp__mineru__*`；
2. `Slots.listSubTree` 的 `settings.section` 占用者里出现 `mineru`；
3. 设置页的「运行环境」为已就绪。

如果前两项都正常但「运行环境」显示未就绪、原因为 `no-entry`，说明插件没能定位
`mineru-mcp`：在设置页点 **一键配置** 即可，或手动设 `MINERU_MCP_ENTRY`。

> **装不上时先看网络**：`install_bundle` 在跑 pnpm 之前会先做一次 `git ls-remote`
> 探测仓库（默认 5 秒超时）。如果本机把 `github.com` 指到了 `127.0.0.1`
> （例如 Steam++ 之类加速工具的 hosts 段），这一步会一直挂住或报
> `failedAt: "spec-host"`。先放行 GitHub 再装。

## 结构

| 文件 | 作用 |
|---|---|
| `package.json` | bundle manifest：`dsh.bundle.patch`、`dsh.client`、依赖与展示元数据 |
| `cordis.patch.yml` | 插入 `mcp-mineru`（MCP 连接）与 `mineru`（本包 host 半）两行 |
| `index.js` | host 半：注册内嵌 skill；`/api/mineru/state` 提供状态、密钥保存、运行环境写入 |
| `environment.js` | 运行环境探测：Node 候选 + `mineru-mcp` 入口解析 |
| `client.js` | browser 半：注册 `settings.section` 设置页 |
| `skill/SKILL.md` | skill 正文（frontmatter 的 description 进 skill 目录） |
| `locale/{zh,en}.json` | 插件管理器/设置里的标题与描述 |
| `icon.svg` | 插件卡片图标 |

## 设置页与写入

页面通过同源 `POST /api/mineru/state` 与 Host 通信（经 `/api` 的浏览器登录态校验），
支持三种动作：

- `status`：版本、连接状态、运行环境、密钥掩码；
- `save`：把 `env.MINERU_API_KEY` 写进 profile 的 `mcp-mineru` 行；
- `configure`：把探测到的 `command` / `args` 写进同一行。

写入统一走 `ctx.configEditor.edit()`，Loader 重新加载该行，`dsh-mcp-client` 原地重连，
**不需要重启**。完整密钥只留在 Host，页面只看到 `sk-…abcd` 这类掩码。

设置页在 `connection` 服务就绪时注册接口；`config-editor` 缺失时只读并提示。

## 运行环境与依赖

- `mineru-mcp` 声明在 `dependencies`，安装时由 pnpm 自动装好（含依赖约 19 MB，
  无原生编译）。本地 `link:` 安装不会自动装它的依赖，此时请用下面的环境变量或
  profile 覆盖行指向已有的 `mineru-mcp`。
- Host 半按以下顺序探测 Node，并用 `--version` 实测：
  1. `MINERU_NODE`；
  2. Host 自身是 node 时的 `process.execPath`；
  3. `$DSH_HOME/dsh-runtimes/*/dependencies/node/bin/node(.exe)`（排除 `.previous`）；
  4. PATH 里的 `node`。
- `mineru-mcp` 入口按以下顺序探测：
  1. `MINERU_MCP_ENTRY`；
  2. 本包依赖 `mineru-mcp`：先按 `import.meta.url` 解析，再按
     `realpathSync.native` 得到的真实路径解析（pnpm 的 junction 只有后者能看到
     `.pnpm/<id>/node_modules`）。
  3. 仍未找到时，退回到包旁边常见的依赖布局。
- 只有当前行仍是可移植默认值（`command: node`、`args: ['']`）时，激活后才会自动写入；
  用户自定义过的路径不会被覆盖。自动探测失败时，设置页给「一键配置」按钮和失败原因。
- 自动/一键配置会把 `mcp-mineru` 行整体写入 profile 覆盖（包括执行时的环境变量值）；
  之后的 key 以设置页为准。

| 环境变量 | 默认 | 用途 |
|---|---|---|
| `MINERU_NODE` | 自动探测 | 覆盖 Node 可执行文件 |
| `MINERU_MCP_ENTRY` | 自动探测 | 覆盖 `mineru-mcp/dist/index.js` 路径 |
| `MINERU_API_KEY` | 空 | MinerU API Key（也可在设置页填写） |

升级 `mineru-mcp` 后路径不变；换目录时删掉 profile 里的覆盖行，让插件重新探测即可。

## 兼容性

- 目标运行时：DSH `0.2.x`（`0.2.1-rc.3` 上验证）；`engines.node` 为 `>=24`。
- 不声明 `peerDependencies`：DSH 安装时会逐个校验 `@deepseek-ai/dsh-*` 的 peer 范围，
  写死后小版本升级就会被判为不兼容；本插件只依赖公开的 Host 服务
  （`skills` / `connection` / `configEditor` / `tools`），不绑定具体版本。

## 许可

MIT
