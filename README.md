# @local/dsh-mineru

MinerU 文档解析插件（DeepSeek Harness bundle）。把本机已安装的 `mineru-mcp` 通过
`@deepseek-ai/dsh-mcp-client` 接进 DSH，并补上两样配置层做不到的东西：

- **设置页**（`设置 → MinerU 文档解析`）：一个不回显明文的 API Key 输入框，加插件 /
  mineru-mcp / MCP 连接的版本信息。不再展示工具清单、流程、限额和示例提示词。
- **mineru skill**：随插件注册进 skill 目录（`ctx.skills.register`），模型遇到
  PDF/扫描件/Office 文档时按需加载，不用往 `~/.dsh/skills` 拷一份。

模型看到的工具仍是 `mcp__mineru__parse` 等 8 个，名称与参数完全由 MCP 服务器决定。

## 结构

| 文件 | 作用 |
|---|---|
| `package.json` | bundle manifest：`dsh.bundle.patch`、`dsh.client`、图标与 `locale/*.json` 展示元数据 |
| `cordis.patch.yml` | 插入 `mcp-mineru`（MCP 连接）与 `mineru`（本包 host 半）两行 |
| `index.js` | host 半：注册内嵌 skill；在 `/api/mineru/state` 提供状态查询与密钥保存 |
| `client.js` | browser 半：注册 `settings.section` 设置页 |
| `skill/SKILL.md` | skill 正文（frontmatter 的 description 进 skill 目录） |
| `locale/{zh,en}.json` | 插件管理器/设置里的标题与描述 |
| `icon.svg` | 插件卡片图标 |

## 设置页与密钥写入

页面只做两件事：读状态、存密钥。两次请求都走同源 `POST /api/mineru/state`
（经 `/api` 的浏览器登录态校验），Host 返回的永远只是掩码提示（如 `sk-…dut`），
完整密钥不进入页面。

保存路径：

1. `ctx.configEditor.edit()` 找到 `mcp-mineru` 行，把 `env.MINERU_API_KEY` 写进
   profile 的 `cordis.patch.yml`；
2. Loader 重新加载该行，`dsh-mcp-client` 用新 key 原地重连；
3. 页面拿到新的状态（连接中/已连接、掩码、版本）。

因此改 key **不需要重启**。清除密钥同样是写空字符串：工具仍会列出，调用会返回 401。

Host 半挂在 `ctx.inject(['connection'], …)` 里：没有 `connection` 服务的组合不会注册
这个路由，插件其余部分照常工作。`config-editor` 缺失时页面只读并给出提示。

## 安装

从 GitHub 安装（把 `<owner>` 换成仓库所属账号）：

```
plugin_manager { action: "install_bundle", target: "github:<owner>/dsh-mineru" }
```

开发时也可以直接指向本地仓库目录：

```
plugin_manager { action: "install_bundle", target: "<本地仓库绝对路径>" }
```

本地目录安装是软链接（junction）。改完 Host 代码后，触发一次 profile 重组合
（例如在插件页把本插件关掉再打开）即可热替换；Browser 半由 client-modules 按文件
签名自动刷新，必要时刷新页面。

装完确认：

1. `cordis_inspect_query` → `Config.listConfigs` / `Tool.listTools` 里出现 `mcp__mineru__*`；
2. `Slots.listSubTree` 的 `settings.section` 占用者里出现 `mineru`；
3. 设置面板里能看到精简后的「MinerU 文档解析」页。

## 依赖与配置

`cordis.patch.yml` 自带的 `mcp-mineru` 行是可移植默认值，不含密钥，也不含固定路径：

| 环境变量 | 默认 | 用途 |
|---|---|---|
| `MINERU_NODE` | `node` | 启动 mineru-mcp 的 Node 可执行文件 |
| `MINERU_MCP_ENTRY` | 空 | `mineru-mcp` 的 `dist/index.js` 绝对路径 |
| `MINERU_API_KEY` | 空 | MinerU API Key（也可在设置页填写） |

最省事的做法是覆盖 profile patch 里的 `mcp-mineru` 行，写上本机的 `command` / `args`
与密钥；设置页保存密钥时也会改写这一行。升级 `mineru-mcp` 后路径不变；换目录时同步
改 profile 的覆盖行。
