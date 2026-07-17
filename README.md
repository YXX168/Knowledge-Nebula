# Knowledge Nebula · 知识星云

> 本地优先、自托管的知识库浏览与编辑工作台。

Knowledge Nebula 将本机文件夹变成一座可搜索、可预览、可安全编辑并实时同步的知识星云。知识文件始终留在自己的设备或服务器上，项目不会内置任何个人路径，也不依赖第三方云端服务。

[![CI](https://github.com/YXX168/Knowledge-Nebula/actions/workflows/ci.yml/badge.svg)](https://github.com/YXX168/Knowledge-Nebula/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-7c8cff.svg)](LICENSE)
[![Docker Compose](https://img.shields.io/badge/Docker%20Compose-supported-2496ed.svg)](#docker-compose-推荐)

## 主要功能

- 路径可配置：在网页设置中验证、更换或清除知识库目录
- 深度搜索：联合搜索文件名、相对路径和文本正文
- 丰富预览：Markdown、代码、JSON、图片、PDF、音频和视频
- 安全编辑：外部修改冲突检测、原子保存、文件类型和大小限制
- 实时同步：自动发现新增、修改和删除，并通过 SSE 刷新页面
- 本地优先：默认仅监听本机，阻止路径越界和符号链接逃逸
- 多端适配：桌面端与移动端响应式星云界面
- 便捷部署：支持 Node.js 本地运行和 Docker Compose 自托管

## Docker Compose（推荐）

需要 Docker Engine 和 Docker Compose v2。

```bash
cp .env.example .env
docker compose up -d --build
```

默认把项目内的 `knowledge` 目录挂载为知识库，并在 `http://127.0.0.1:8765` 提供服务。可以直接把文件放入该目录，也可以在 `.env` 中把 `KNOWLEDGE_DIR` 改为任意现有目录：

```env
KNOWLEDGE_DIR=./knowledge
KNOWLEDGE_NEBULA_PORT=8765
SCAN_INTERVAL_MS=1200
```

常用命令：

```bash
docker compose logs -f
docker compose restart
docker compose down
docker compose up -d --build
```

Compose 会把宿主机目录映射为容器内的 `/knowledge`，并使用命名卷持久化应用配置。知识库以读写方式挂载，以便使用在线编辑功能。Linux 上请确保宿主机目录允许容器用户（UID 1000）读取和写入。

> 服务本身包含文件读取和编辑能力。默认端口仅建议在本机或可信内网使用；对公网开放前请配置 HTTPS、身份验证和访问控制。

## Node.js 本地运行

环境要求：Node.js 20 或更高版本、npm。

```bash
npm ci
npm run build
npm start
```

打开 `http://127.0.0.1:8765`，首次进入时在设置窗口填写知识库的绝对路径。Linux/macOS 也可以执行：

```bash
bash 启动服务.sh
```

## 配置

知识库路径默认保存在当前用户的应用配置目录，不会写入项目或浏览器存储：

- Windows：`%APPDATA%/Knowledge-Nebula/config.json`
- Linux：`$XDG_CONFIG_HOME/knowledge-nebula/config.json`，未设置时使用用户配置目录
- macOS：用户配置目录下的 `.config/knowledge-nebula/config.json`

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | 服务监听地址 |
| `PORT` | `8765` | 服务端口 |
| `SCAN_INTERVAL_MS` | `1200` | 文件变化扫描间隔，最小 500 ms |
| `KNOWLEDGE_ROOT` | 空 | 未保存配置时的可选初始目录 |
| `KNOWLEDGE_CONFIG_PATH` | 用户配置目录 | 自定义配置文件位置 |

## 安全与隐私

- 仓库不包含个人知识库路径、服务地址或凭据。
- 知识内容不会上传到第三方服务。
- 健康检查、启动日志和一般错误不会返回完整知识库路径。
- 服务拒绝知识库外路径、符号链接逃逸和不支持的编辑类型。
- 不要在没有鉴权和 HTTPS 的情况下直接暴露到公网。

## 开发与检查

```bash
npm test
npm run lint
npm run build
docker compose config
docker build -t knowledge-nebula:test .
```

## 技术栈

React · TypeScript · Vite · Node.js · Docker

## License

[MIT](LICENSE)
