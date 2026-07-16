# Knowledge Nebula · 知识星云

一个本地优先、无需上传文件的沉浸式知识库浏览器。选择本地文件夹后，可以通过目录树浏览、预览和全文搜索散落的知识文件。

## 功能

- 本地文件夹结构树，支持多级展开与折叠
- 文件名、路径、正文的联合全文搜索
- Markdown、文本、代码、JSON、图片、PDF、音频和视频预览
- 收藏文件并保存在浏览器本地
- `Ctrl / ⌘ + K` 快速聚焦搜索，`Esc` 清空搜索
- 深色玻璃拟态、星云光效和响应式移动端布局
- 隐私优先：文件只在浏览器本地读取，不会上传服务器
- 内置演示知识库，不选择文件夹也能体验完整界面

## 本地运行

```bash
npm install
npm run dev
```

构建生产版本：

```bash
npm run build
npm run preview
```

## 浏览器支持

文件夹选择使用 File System Access API，推荐最新版 Chrome 或 Edge。Firefox 和 Safari 可以体验演示模式，但暂不支持直接选择本地文件夹。

## 隐私说明

Knowledge Nebula 是纯前端应用。所选文件不会发送到任何服务器，刷新页面后文件访问权限也不会被应用永久持有。

## License

MIT
