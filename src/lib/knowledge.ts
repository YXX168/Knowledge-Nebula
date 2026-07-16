import type { KnowledgeNode, SearchHit } from '../types'

export const textExtensions = new Set([
  'md', 'mdx', 'txt', 'json', 'yaml', 'yml', 'toml', 'xml', 'csv', 'log',
  'js', 'jsx', 'ts', 'tsx', 'css', 'scss', 'html', 'py', 'java', 'kt', 'go',
  'rs', 'c', 'cpp', 'h', 'sh', 'ps1', 'sql',
])

const demo = (path: string, content: string): KnowledgeNode => {
  const name = path.split('/').at(-1) ?? path
  return {
    id: `demo:${path}`,
    name,
    path,
    kind: 'file',
    extension: name.split('.').at(-1)?.toLowerCase(),
    size: new Blob([content]).size,
    modified: Date.now(),
    demoContent: content,
  }
}

export const demoTree: KnowledgeNode = {
  id: 'demo-root',
  name: '我的知识星云',
  path: '我的知识星云',
  kind: 'folder',
  children: [
    {
      id: 'demo-ai', name: 'AI 与工程', path: 'AI 与工程', kind: 'folder', children: [
        demo('AI 与工程/提示词设计.md', `# 提示词设计笔记\n\n> 好提示词不是咒语，而是一份清晰的协作协议。\n\n## 核心结构\n\n1. **目标**：明确最终交付物\n2. **上下文**：提供必要背景\n3. **约束**：说明边界与偏好\n4. **验收**：定义完成标准\n\n## 实践原则\n\n- 先说结果，再展开过程\n- 用具体例子消除歧义\n- 复杂任务拆成可验证阶段\n\n\`\`\`ts\nconst prompt = { goal, context, constraints, acceptance }\n\`\`\``),
        demo('AI 与工程/项目灵感.md', '# 项目灵感\n\n- 本地知识库关系图谱\n- 自动生成每日知识摘要\n- 基于标签的探索式阅读\n- 离线语义检索'),
        demo('AI 与工程/config.json', '{\n  "theme": "nebula",\n  "localFirst": true,\n  "search": { "fuzzy": true, "content": true }\n}'),
      ],
    },
    {
      id: 'demo-life', name: '生活与成长', path: '生活与成长', kind: 'folder', children: [
        demo('生活与成长/2026 年目标.md', '# 2026 年目标\n\n## 健康\n\n保持稳定训练和睡眠节律。\n\n## 创作\n\n每周完成一篇有价值的输出。\n\n## 学习\n\n建立真正能被检索和复用的知识系统。'),
        demo('生活与成长/待读清单.txt', '《设计心理学》\n《人月神话》\n《黑客与画家》\n《思考，快与慢》'),
      ],
    },
    {
      id: 'demo-archive', name: '资料归档', path: '资料归档', kind: 'folder', children: [
        demo('资料归档/快捷键.md', '# 快捷键\n\n- `Ctrl / ⌘ + K`：聚焦搜索\n- `Esc`：清空搜索\n- `↑ / ↓`：浏览搜索结果'),
      ],
    },
  ],
}

export async function readDirectory(handle: any): Promise<KnowledgeNode> {
  const walk = async (dir: any, parentPath = ''): Promise<KnowledgeNode> => {
    const path = parentPath ? `${parentPath}/${dir.name}` : dir.name
    const children: KnowledgeNode[] = []
    for await (const entry of dir.values()) {
      if (entry.name.startsWith('.')) continue
      if (entry.kind === 'directory') {
        children.push(await walk(entry, path))
      } else {
        const file = await entry.getFile()
        children.push({
          id: `${path}/${entry.name}`,
          name: entry.name,
          path: `${path}/${entry.name}`,
          kind: 'file',
          extension: entry.name.split('.').at(-1)?.toLowerCase(),
          size: file.size,
          modified: file.lastModified,
          file,
        })
      }
    }
    children.sort((a, b) => a.kind === b.kind ? a.name.localeCompare(b.name, 'zh-CN') : a.kind === 'folder' ? -1 : 1)
    return { id: path, name: dir.name, path, kind: 'folder', children }
  }
  return walk(handle)
}

export function flattenFiles(root: KnowledgeNode): KnowledgeNode[] {
  if (root.kind === 'file') return [root]
  return (root.children ?? []).flatMap(flattenFiles)
}

export async function readNodeText(node: KnowledgeNode): Promise<string> {
  if (node.demoContent !== undefined) return node.demoContent
  if (!node.file || !textExtensions.has(node.extension ?? '') || node.file.size > 2_000_000) return ''
  return node.file.text()
}

export async function searchKnowledge(root: KnowledgeNode, query: string): Promise<SearchHit[]> {
  const normalized = query.trim().toLocaleLowerCase()
  if (!normalized) return []
  const terms = normalized.split(/\s+/).filter(Boolean)
  const files = flattenFiles(root)
  const hits = await Promise.all(files.map(async (node): Promise<SearchHit | null> => {
    const name = node.name.toLocaleLowerCase()
    const path = node.path.toLocaleLowerCase()
    const content = (await readNodeText(node)).toLocaleLowerCase()
    if (!terms.every((term) => name.includes(term) || path.includes(term) || content.includes(term))) return null
    const firstIndex = Math.min(...terms.map((term) => content.indexOf(term)).filter((index) => index >= 0))
    const start = Number.isFinite(firstIndex) ? Math.max(0, firstIndex - 45) : 0
    const excerpt = content ? content.slice(start, start + 150).replace(/\s+/g, ' ') : node.path
    const score = terms.reduce((total, term) => total + (name.includes(term) ? 20 : 0) + (path.includes(term) ? 8 : 0) + (content.includes(term) ? 3 : 0), 0)
    return { node, excerpt, score }
  }))
  return hits.filter((hit): hit is SearchHit => Boolean(hit)).sort((a, b) => b.score - a.score).slice(0, 80)
}

export function formatBytes(bytes = 0): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}
