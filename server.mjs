import { accessSync, constants as fsConstants, createReadStream, existsSync, promises as fs, statSync } from 'node:fs'
import { createServer } from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const distRoot = path.join(here, 'dist')
const defaultConfigDir = process.platform === 'win32'
  ? path.join(process.env.APPDATA || os.homedir(), 'Knowledge-Nebula')
  : path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'knowledge-nebula')
const configPath = path.resolve(process.env.KNOWLEDGE_CONFIG_PATH || path.join(defaultConfigDir, 'config.json'))
const host = process.env.HOST || '127.0.0.1'
const port = Number(process.env.PORT || 8765)
const maxTextBytes = 2_000_000
const maxRequestBytes = 2_100_000
const scanIntervalMs = Math.max(500, Number(process.env.SCAN_INTERVAL_MS || 1200))
const ignoredNames = new Set(['.git', 'node_modules', 'Thumbs.db', 'desktop.ini', '.knowledge-nebula-tmp'])
const textExtensions = new Set([
  '.md', '.mdx', '.txt', '.json', '.yaml', '.yml', '.toml', '.xml', '.csv', '.log',
  '.js', '.jsx', '.ts', '.tsx', '.css', '.scss', '.html', '.py', '.java', '.kt', '.go',
  '.rs', '.c', '.cpp', '.h', '.sh', '.ps1', '.sql',
])

let knowledgeRoot = ''

const mimeTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp', '.pdf': 'application/pdf',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
}

function sendJson(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  })
  res.end(body)
}

function configured() {
  return Boolean(knowledgeRoot)
}

function rootAvailable() {
  if (!configured() || !existsSync(knowledgeRoot)) return false
  try {
    accessSync(knowledgeRoot, fsConstants.R_OK)
    return statSync(knowledgeRoot).isDirectory()
  } catch {
    return false
  }
}

function normalizeConfiguredRoot(value) {
  const input = typeof value === 'string' ? value.trim() : ''
  if (!input) return ''
  if (!path.isAbsolute(input)) {
    throw Object.assign(new Error('知识库路径必须是绝对路径'), { statusCode: 400 })
  }
  return path.resolve(input)
}

async function validateKnowledgeRoot(value) {
  const normalized = normalizeConfiguredRoot(value)
  if (!normalized) return ''
  let stat
  try {
    stat = await fs.stat(normalized)
  } catch {
    throw Object.assign(new Error('知识库目录不存在或无法访问'), { statusCode: 400 })
  }
  if (!stat.isDirectory()) {
    throw Object.assign(new Error('知识库路径必须指向文件夹'), { statusCode: 400 })
  }
  await fs.access(normalized, fsConstants.R_OK)
  return fs.realpath(normalized)
}

async function loadConfiguration() {
  let savedRoot = ''
  try {
    const saved = JSON.parse(await fs.readFile(configPath, 'utf8'))
    savedRoot = typeof saved?.knowledgeRoot === 'string' ? saved.knowledgeRoot : ''
  } catch (error) {
    if (error?.code !== 'ENOENT') console.error('读取配置失败，将使用未配置状态')
  }
  const candidate = savedRoot || process.env.KNOWLEDGE_ROOT || ''
  try {
    knowledgeRoot = normalizeConfiguredRoot(candidate)
  } catch {
    knowledgeRoot = ''
  }
}

async function persistConfiguration() {
  await fs.mkdir(path.dirname(configPath), { recursive: true })
  const temporary = `${configPath}.tmp-${process.pid}`
  await fs.writeFile(temporary, `${JSON.stringify({ knowledgeRoot }, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  })
  await fs.rename(temporary, configPath)
}

async function updateKnowledgeRoot(value) {
  knowledgeRoot = await validateKnowledgeRoot(value)
  await persistConfiguration()
  lastSnapshot = ''
  broadcastChange('configuration')
  await pollKnowledgeRoot()
}

function safeKnowledgePath(relativePath = '') {
  if (!configured()) {
    throw Object.assign(new Error('请先设置知识库路径'), { statusCode: 409 })
  }
  const normalized = String(relativePath).replaceAll('\\', '/').replace(/^\/+/, '')
  const absolute = path.resolve(knowledgeRoot, normalized)
  if (absolute !== knowledgeRoot && !absolute.startsWith(`${knowledgeRoot}${path.sep}`)) {
    throw Object.assign(new Error('非法路径'), { statusCode: 400 })
  }
  return { absolute, normalized }
}

async function assertRealPathInsideRoot(absolute) {
  const realRoot = await fs.realpath(knowledgeRoot)
  const realTarget = await fs.realpath(absolute)
  if (realTarget !== realRoot && !realTarget.startsWith(`${realRoot}${path.sep}`)) {
    throw Object.assign(new Error('符号链接指向知识库外部，已拒绝访问'), { statusCode: 403 })
  }
  return realTarget
}

function isIgnored(name) {
  return name.startsWith('.') || ignoredNames.has(name)
}

async function buildTree(absoluteDir = knowledgeRoot, relativeDir = '') {
  const entries = await fs.readdir(absoluteDir, { withFileTypes: true })
  const children = []
  for (const entry of entries) {
    if (isIgnored(entry.name) || entry.isSymbolicLink()) continue
    const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name
    const absolutePath = path.join(absoluteDir, entry.name)
    if (entry.isDirectory()) {
      children.push(await buildTree(absolutePath, relativePath))
    } else if (entry.isFile()) {
      const stat = await fs.stat(absolutePath)
      children.push({
        id: `local:${relativePath}`,
        name: entry.name,
        path: relativePath,
        kind: 'file',
        extension: path.extname(entry.name).slice(1).toLowerCase(),
        size: stat.size,
        modified: stat.mtimeMs,
        sourceUrl: `/api/file?path=${encodeURIComponent(relativePath)}`,
      })
    }
  }
  children.sort((a, b) => a.kind === b.kind ? a.name.localeCompare(b.name, 'zh-CN') : a.kind === 'folder' ? -1 : 1)
  const name = relativeDir ? path.basename(absoluteDir) : path.basename(knowledgeRoot)
  return { id: relativeDir ? `local:${relativeDir}` : 'local-root', name, path: relativeDir || name, kind: 'folder', children }
}

async function readJsonBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > maxRequestBytes) throw Object.assign(new Error('请求内容超过 2MB'), { statusCode: 413 })
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw Object.assign(new Error('请求 JSON 格式无效'), { statusCode: 400 })
  }
}

const eventClients = new Set()
let revision = Date.now()
let lastSnapshot = ''

function broadcastChange(reason = 'filesystem') {
  revision = Date.now()
  const payload = `event: change\ndata: ${JSON.stringify({ revision, reason })}\n\n`
  for (const response of eventClients) response.write(payload)
}

async function snapshotDirectory(absoluteDir = knowledgeRoot, relativeDir = '') {
  const entries = await fs.readdir(absoluteDir, { withFileTypes: true })
  const rows = []
  for (const entry of entries) {
    if (isIgnored(entry.name) || entry.isSymbolicLink()) continue
    const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name
    const absolutePath = path.join(absoluteDir, entry.name)
    if (entry.isDirectory()) {
      rows.push(`d:${relativePath}`)
      rows.push(...await snapshotDirectory(absolutePath, relativePath))
    } else if (entry.isFile()) {
      const stat = await fs.stat(absolutePath)
      rows.push(`f:${relativePath}:${stat.size}:${stat.mtimeMs}`)
    }
  }
  return rows.sort()
}

async function pollKnowledgeRoot() {
  if (!existsSync(knowledgeRoot)) return
  try {
    const snapshot = (await snapshotDirectory()).join('\n')
    if (lastSnapshot && snapshot !== lastSnapshot) broadcastChange()
    lastSnapshot = snapshot
  } catch (error) {
    console.error('扫描知识库失败：', error)
  }
}

async function handleApi(req, res, url) {
  if (url.pathname === '/api/config' && req.method === 'GET') {
    return sendJson(res, 200, {
      knowledgeRoot,
      configured: configured(),
      available: rootAvailable(),
    })
  }
  if (url.pathname === '/api/config' && req.method === 'PUT') {
    const body = await readJsonBody(req)
    await updateKnowledgeRoot(body.knowledgeRoot)
    return sendJson(res, 200, {
      ok: true,
      knowledgeRoot,
      configured: configured(),
      available: rootAvailable(),
      revision,
    })
  }
  if (url.pathname === '/api/health') {
    const available = rootAvailable()
    return sendJson(res, available ? 200 : 503, {
      ok: available,
      configured: configured(),
      available,
      revision,
      mode: 'local-library',
    })
  }
  if (url.pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    res.write(`event: ready\ndata: ${JSON.stringify({ revision })}\n\n`)
    eventClients.add(res)
    const keepAlive = setInterval(() => res.write(': keep-alive\n\n'), 20_000)
    req.on('close', () => { clearInterval(keepAlive); eventClients.delete(res) })
    return
  }
  if (url.pathname === '/api/tree') {
    if (!configured()) return sendJson(res, 409, { error: '请先在设置中配置知识库路径' })
    if (!rootAvailable()) return sendJson(res, 503, { error: '知识库目录当前不可用，请检查设置' })
    return sendJson(res, 200, await buildTree())
  }
  if (url.pathname === '/api/text' && req.method === 'GET') {
    const { absolute } = safeKnowledgePath(url.searchParams.get('path') || '')
    await assertRealPathInsideRoot(absolute)
    const stat = await fs.stat(absolute)
    if (!stat.isFile()) return sendJson(res, 400, { error: '目标不是文件' })
    if (!textExtensions.has(path.extname(absolute).toLowerCase())) return sendJson(res, 415, { error: '该文件类型不支持文本读取' })
    if (stat.size > maxTextBytes) return sendJson(res, 413, { error: '文本文件超过 2MB，暂不建立全文预览' })
    const content = await fs.readFile(absolute, 'utf8')
    return sendJson(res, 200, { content, modified: stat.mtimeMs })
  }
  if (url.pathname === '/api/text' && req.method === 'PUT') {
    const body = await readJsonBody(req)
    const { absolute, normalized } = safeKnowledgePath(body.path || '')
    await assertRealPathInsideRoot(absolute)
    const extension = path.extname(absolute).toLowerCase()
    if (!textExtensions.has(extension)) return sendJson(res, 415, { error: '该文件类型不允许在线编辑' })
    if (typeof body.content !== 'string') return sendJson(res, 400, { error: '缺少文本内容' })
    if (Buffer.byteLength(body.content) > maxTextBytes) return sendJson(res, 413, { error: '保存内容超过 2MB' })
    const stat = await fs.stat(absolute)
    if (!stat.isFile()) return sendJson(res, 400, { error: '目标不是文件' })
    if (Number.isFinite(body.expectedModified) && Math.abs(stat.mtimeMs - body.expectedModified) > 1) {
      return sendJson(res, 409, { error: '文件已被其他程序修改，请刷新后再编辑', modified: stat.mtimeMs })
    }
    const temporary = path.join(path.dirname(absolute), `.${path.basename(absolute)}.knowledge-nebula-tmp-${process.pid}`)
    await fs.writeFile(temporary, body.content, { encoding: 'utf8', mode: stat.mode })
    await fs.rename(temporary, absolute)
    const updated = await fs.stat(absolute)
    broadcastChange('editor')
    return sendJson(res, 200, { ok: true, path: normalized, modified: updated.mtimeMs, size: updated.size })
  }
  if (url.pathname === '/api/file') {
    const { absolute } = safeKnowledgePath(url.searchParams.get('path') || '')
    await assertRealPathInsideRoot(absolute)
    const stat = await fs.stat(absolute)
    if (!stat.isFile()) return sendJson(res, 400, { error: '目标不是文件' })
    const type = mimeTypes[path.extname(absolute).toLowerCase()] || 'application/octet-stream'
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
    if (req.method === 'HEAD') return res.end()
    return createReadStream(absolute).pipe(res)
  }
  return sendJson(res, 404, { error: '接口不存在' })
}

async function serveStatic(req, res, url) {
  let relative = decodeURIComponent(url.pathname)
  if (relative === '/') relative = '/index.html'
  let absolute = path.resolve(distRoot, `.${relative}`)
  if (absolute !== distRoot && !absolute.startsWith(`${distRoot}${path.sep}`)) return sendJson(res, 400, { error: '非法路径' })
  try {
    const stat = await fs.stat(absolute)
    if (stat.isDirectory()) absolute = path.join(absolute, 'index.html')
  } catch {
    absolute = path.join(distRoot, 'index.html')
  }
  const stat = await fs.stat(absolute)
  const type = mimeTypes[path.extname(absolute).toLowerCase()] || 'application/octet-stream'
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size, 'Cache-Control': absolute.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable' })
  if (req.method === 'HEAD') return res.end()
  createReadStream(absolute).pipe(res)
}

const server = createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD', 'PUT'].includes(req.method || '')) return sendJson(res, 405, { error: '不支持该请求方法' })
    const url = new URL(req.url || '/', `http://${req.headers.host || `${host}:${port}`}`)
    if (req.method === 'PUT' && !['/api/text', '/api/config'].includes(url.pathname)) return sendJson(res, 405, { error: '该接口不允许写入' })
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url)
    else if (req.method === 'GET' || req.method === 'HEAD') await serveStatic(req, res, url)
    else sendJson(res, 405, { error: '静态资源只允许读取' })
  } catch (error) {
    console.error(error)
    const explicitStatus = Number(error?.statusCode)
    const status = explicitStatus || (error?.code === 'ENOENT' ? 404 : error?.code === 'EACCES' ? 403 : 500)
    const publicMessage = explicitStatus
      ? error.message
      : status === 404
        ? '文件或目录不存在'
        : status === 403
          ? '没有访问权限'
          : '服务器错误'
    if (!res.headersSent) sendJson(res, status, { error: publicMessage })
    else res.destroy()
  }
})

await loadConfiguration()
await pollKnowledgeRoot()
setInterval(pollKnowledgeRoot, scanIntervalMs).unref()

server.listen(port, host, () => {
  const address = server.address()
  const listeningPort = typeof address === 'object' && address ? address.port : port
  console.log(`Knowledge Nebula：http://${host}:${listeningPort}`)
  console.log(`知识库：${configured() ? rootAvailable() ? '已配置' : '已配置但不可用' : '尚未配置，请在网页设置中选择'}`)
  console.log(`实时扫描间隔：${scanIntervalMs}ms`)
})
