# Stand_Alone_Pets

<img src="assets/stand-alone-pets-icon.png" alt="Stand_Alone_Pets 图标" width="96" />

[English README](README.md)

Stand_Alone_Pets 是一个独立桌面宠物应用，基于 Electron、React、Vite 和 TypeScript 构建。它可以悬浮在桌面上，支持本地宠物素材包，也可以对接 OpenAI 兼容的大模型聊天接口，让不同宠物通过桌面气泡回复消息。

## 功能

- 无边框透明桌宠窗口
- 右键菜单：聊天、历史记录、设置、隐藏、退出
- 单输入框聊天，宠物回复显示在桌面气泡里
- 历史对话面板
- OpenAI 兼容 API 配置：Base URL、模型、API Key、系统 Prompt
- 自动把当前宠物的名字和描述注入到 Prompt
- 从 `~/.codex/pets` 自动发现本地宠物素材包
- 内置一批 1/1 WGG 宠物素材
- 拖动桌宠时触发移动动画状态
- 支持点击穿透和窗口置顶
- 调试日志会打印大模型请求参数、流式分片和最终返回

## 技术栈

- Electron：桌面应用外壳
- React：渲染进程 UI
- Vite：本地开发和前端构建
- TypeScript：主进程、预加载脚本和前端代码
- Vitest：单元测试
- OpenAI SDK：调用 OpenAI 兼容的 Chat Completions API

## 快速开始

安装依赖：

```bash
npm install
```

开发模式运行：

```bash
npm run dev
```

运行测试：

```bash
npm test
```

运行类型检查：

```bash
npm run typecheck
```

构建渲染进程和 Electron 主进程：

```bash
npm run build
```

本地打包可直接运行的桌面文件：

```bash
npm run dist:mac
npm run dist:win
```

打包产物会输出到 `releases/` 目录。

## GitHub Releases

项目已经包含 GitHub Actions 发布流程。推送版本 tag 后，会自动构建 macOS 和 Windows 安装包，并上传到 GitHub Releases：

```bash
git tag v0.1.0
git push origin v0.1.0
```

工作流会生成：

- macOS `.dmg` 和 `.zip`
- Windows `.exe` 安装包和 `.zip`

macOS 包默认使用 ad-hoc 签名。除非后续在发布流程里配置 Apple Developer ID 签名和公证密钥，否则它不是 notarized 包，首次打开时可能需要右键选择 Open，或在系统设置里允许打开。

## 大模型配置

在应用中右键桌宠，打开设置，然后配置：

- API Key
- Base URL，例如 `https://api.openai.com/v1`
- 模型，例如 `gpt-4.1-mini`
- 系统 Prompt

API Key 会保存在 Electron 的本地用户数据目录里，不会保存在这个仓库中。当 Electron `safeStorage` 可用时，API Key 会先加密再写入磁盘。应用日志只会打印是否已经配置 API Key，不会打印 API Key 本身。

发送给模型的请求会自动带上当前宠物身份：

```text
Current desktop pet identity:
- Name: <pet display name>
- Description: <pet description>
```

## 自定义宠物素材包

应用会从下面的目录发现本地宠物素材包：

```text
${CODEX_HOME:-~/.codex}/pets
```

每个宠物放在独立文件夹中，并包含一个 `pet.json`：

```json
{
  "id": "my-pet",
  "displayName": "My Pet",
  "description": "A short personality description.",
  "spritesheetPath": "spritesheet.png"
}
```

精灵图需要符合当前应用使用的 Codex 桌宠图集格式：8 列、9 行。仓库的 `pets/` 目录也内置了一批 WGG 宠物素材，打包发布时会一起带上。如果没有发现本地或内置宠物素材包，应用会使用内置的 Spark 宠物。

## 项目结构

```text
assets/              应用图标资源
electron/            Electron 主进程、preload 桥接、配置、宠物发现和 LLM 调用
pets/                内置 WGG 宠物素材包
src/                 React 渲染进程 UI 和宠物动画逻辑
tests/               单元测试
```

## 隐私说明

- 不要提交本地设置文件或 API Key。
- 运行时设置会写入 Electron 用户数据目录，不在仓库中。
- LLM 调试日志包含 Prompt、消息、流式分片和最终回复。如果对话里有隐私内容，不要把终端日志提交到仓库。
