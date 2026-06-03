# Agnes AI Gateway 本地控制台

一个**零依赖**的轻量级 Node.js Web 控制台，调用 [Agnes AI Gateway](https://apihub.agnes-ai.com) 提供的视频/图像生成能力，专为国内网络环境优化（自带视频反向代理，绕过 `storage.googleapis.com` 访问限制）。

- **视频生成**：调用 `agnes-video-v2.0`，支持文生视频、图生视频、多图视频、关键帧动画
- **图像生成**：调用 `agnes-image-2.1-flash`，支持文生图、图生图、构图保留、高密度优化

## ✨ 特性

- 🚀 **零依赖**：纯 Node.js 标准库，无需 `npm install`
- 🎬 **完整视频工作流**：异步任务提交 → 3 秒轮询 → 自动重试 → 视频播放/下载
- 🎨 **完整图像工作流**：同步生成 → 即时预览 → 一键下载
- 🖼️ **本地图片支持**：粘贴/拖拽/选择本地图片，自动转 Base64 上送
- 🌏 **国内网络友好**：内置 `/video-proxy` 反向代理，破解 GCS 视频被墙问题
- 🔑 **API Key 持久化**：自动保存到 `key.txt` + `localStorage` 双重存储
- 🔁 **智能重试**：轮询区分服务端临时错误（最多 10 次）与网络错误（最多 5 次）

## 📦 项目结构

| 文件 | 作用 |
|------|------|
| `server.js` | 基于 `http` 标准库的本地反向代理 + 静态服务 |
| `index.html` | 单页 Dashboard（CSS / JS 全内联，无框架） |
| `start.bat` | Windows 一键启动脚本 |
| `key.txt` | 本地 API Key 持久化文件（**已加入 .gitignore**） |
| `AI Gateway, Free AI API & AI Applications.md` | Agnes API 官方文档备份 |

## 🚀 快速开始

### 前置条件

- 安装 Node.js ≥ 14（无需任何 npm 包）
- 已获取 [Agnes AI Gateway API Key](https://apihub.agnes-ai.com)

### 启动

```bash
# 克隆仓库
git clone https://github.com/zhting/agnesAI.git
cd agnesAI

# 启动服务
node server.js
#  ─ 或 Windows 用户直接双击 start.bat
```

服务监听 `http://127.0.0.1:3000`，浏览器打开即可。

### 配置 API Key

启动后在页面右上角输入框填写 API Key，系统自动保存到本地 `key.txt`，下次启动自动回填。

## 🎬 视频生成使用说明

| 模式 | 必填字段 | 说明 |
|------|----------|------|
| **文本生成视频** | Prompt | 纯文字描述即可生成视频 |
| **图片生成视频** | Prompt + 参考图 | 让一张静态图动起来 |
| **多图视频** | Prompt + 多张参考图 | 融合多张图的元素生成视频 |
| **关键帧动画** | Prompt + 2 张及以上图 | 首张为起始帧，末张为结束帧，中间自动过渡 |

**高级参数**：宽 / 高 / 帧数 / 帧率 / 推理步数 / 随机种子 / 负向提示词。

> ⚠️ `num_frames` 必须满足 `8n + 1` 的格式（如 81、121、161、241、441），且 ≤ 441。

任务提交后页面以 3 秒为间隔轮询进度，完成后自动播放并提供下载按钮。

## 🎨 图像生成使用说明

| 模式 | 说明 |
|------|------|
| **文本生成图像** | 纯文字描述生成图像 |
| **图像生成图像** | 基于原图 + Prompt 做风格化/重绘 |
| **结构/构图保留** | 严格沿用原图构图，重绘内容 |
| **高信息密度优化** | 增强细节，适合电商主图、海报 |

支持常用尺寸预设（1:1 / 3:4 / 4:3）或自定义宽高。

## 🖼️ 本地图片上传方式

任意"参考图片 URL"输入框均支持三种方式注入本地图片（自动转 Base64）：

1. 点击右侧 📁 按钮选择文件
2. **直接在输入框内 Ctrl+V 粘贴**（图片或截图）
3. **直接拖拽图片文件到输入框**

> Base64 数据会去掉 `data:image/xxx;base64,` 前缀后只发送纯 base64 部分，避免上游 Python `b64decode` 误报 "Incorrect padding"。

## 🛠️ 架构说明

### 服务端 `server.js`

单文件 HTTP 服务，4 条路由：

| 路由 | 说明 |
|------|------|
| `GET /` 或 `/index.html` | 返回前端页面 |
| `GET / POST /api/key` | 读 / 写本地 `key.txt` |
| `GET /video-proxy?url=...` | HTTPS 反向代理 `storage.googleapis.com` 上的视频（绕墙） |
| `* /v1/*` | 反向代理至 `https://apihub.agnes-ai.com/v1/*`，自动注入 `Authorization: Bearer {key}` |

`/v1/*` 代理特点：
- 优先读取请求头 `X-Api-Key`，缺失时回退本地 `key.txt`
- 自动剥离 `?_t=...` 防缓存参数避免上游路由异常
- 上游非 2xx 时统一包装成 `{error: {message}}` JSON 返回

### 前端 `index.html`

- 无任何框架的单页应用，所有 CSS / JS 内联
- 一级页签：视频 ↔ 图像
- 二级页签：根据模式动态显示 / 隐藏参考图字段
- 轮询：`3s` 间隔；服务端临时错误（如 `division by zero`）重试 10 次；网络错误重试 5 次
- 视频播放走 `/video-proxy` 中转，避免直接访问 GCS 被墙

## 🔒 安全提示

- 不要把 `key.txt`、`.env` 等含密文件提交到公共仓库。本仓库已通过 `.gitignore` 排除 `key.txt`
- 服务仅监听 `127.0.0.1`，默认只在本机可访问
- 若需局域网共享，请将 `server.js` 中 `server.listen(PORT, '127.0.0.1', ...)` 的地址改为 `'0.0.0.0'`，并自行评估暴露风险

## 📚 参考

- [Agnes AI 官方接口文档](https://apihub.agnes-ai.com)
- 仓库内置文档：`AI Gateway, Free AI API & AI Applications.md`

## 📜 License

MIT
