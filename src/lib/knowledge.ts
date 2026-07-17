import type { KnowledgeConfig, KnowledgeNode, SearchHit } from '../types'

export const textExtensions = new Set([
  'md', 'mdx', 'txt', 'json', 'yaml', 'yml', 'toml', 'xml', 'csv', 'log',
  'js', 'jsx', 'ts', 'tsx', 'css', 'scss', 'html', 'py', 'java', 'kt', 'go',
  'rs', 'c', 'cpp', 'h', 'sh', 'ps1', 'sql',
])

export const demoTree: KnowledgeNode = {
  id: 'loading-root',
  name: '正在连接知识库',
  path: '正在连接知识库',
  kind: 'folder',
  children: [],
}

export async function loadKnowledge(): Promise<KnowledgeNode> {
  const response = await fetch('/api/tree', { cache: 'no-store' })
  if (!response.ok) {
    const detail = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(detail.error || '知识库加载失败')
  }
  return response.json() as Promise<KnowledgeNode>
}

export async function loadKnowledgeConfig(): Promise<KnowledgeConfig> {
  const response = await fetch('/api/config', { cache: 'no-store' })
  const detail = await response.json().catch(() => ({})) as Partial<KnowledgeConfig> & { error?: string }
  if (!response.ok) throw new Error(detail.error || '知识库配置加载失败')
  return {
    knowledgeRoot: detail.knowledgeRoot ?? '',
    configured: detail.configured === true,
    available: detail.available === true,
  }
}

export async function saveKnowledgeConfig(knowledgeRoot: string): Promise<KnowledgeConfig> {
  const response = await fetch('/api/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ knowledgeRoot }),
  })
  const detail = await response.json().catch(() => ({})) as Partial<KnowledgeConfig> & { error?: string }
  if (!response.ok) throw new Error(detail.error || '知识库配置保存失败')
  return {
    knowledgeRoot: detail.knowledgeRoot ?? '',
    configured: detail.configured === true,
    available: detail.available === true,
  }
}

export function flattenFiles(root: KnowledgeNode): KnowledgeNode[] {
  if (root.kind === 'file') return [root]
  return (root.children ?? []).flatMap(flattenFiles)
}

export function findNodeByPath(root: KnowledgeNode, targetPath?: string): KnowledgeNode | undefined {
  if (!targetPath) return undefined
  if (root.path === targetPath) return root
  for (const child of root.children ?? []) {
    const match = findNodeByPath(child, targetPath)
    if (match) return match
  }
  return undefined
}

export async function readNodeText(node: KnowledgeNode): Promise<{ content: string; modified?: number }> {
  if (!node.sourceUrl || !textExtensions.has(node.extension ?? '') || (node.size ?? 0) > 2_000_000) return { content: '' }
  const response = await fetch(`/api/text?path=${encodeURIComponent(node.path)}`, { cache: 'no-store' })
  if (!response.ok) return { content: '' }
  return response.json() as Promise<{ content: string; modified?: number }>
}

export async function saveNodeText(node: KnowledgeNode, content: string, expectedModified?: number): Promise<{ modified: number; size: number }> {
  const response = await fetch('/api/text', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: node.path, content, expectedModified }),
  })
  const detail = await response.json().catch(() => ({})) as { error?: string; modified?: number; size?: number }
  if (!response.ok) throw new Error(detail.error || '保存失败')
  return { modified: detail.modified ?? Date.now(), size: detail.size ?? new Blob([content]).size }
}

export async function searchKnowledge(root: KnowledgeNode, query: string): Promise<SearchHit[]> {
  const normalized = query.trim().toLocaleLowerCase()
  if (!normalized) return []
  const terms = normalized.split(/\s+/).filter(Boolean)
  const files = flattenFiles(root)
  const hits = await Promise.all(files.map(async (node): Promise<SearchHit | null> => {
    const name = node.name.toLocaleLowerCase()
    const nodePath = node.path.toLocaleLowerCase()
    const content = (await readNodeText(node)).content.toLocaleLowerCase()
    if (!terms.every((term) => name.includes(term) || nodePath.includes(term) || content.includes(term))) return null
    const indexes = terms.map((term) => content.indexOf(term)).filter((index) => index >= 0)
    const firstIndex = indexes.length ? Math.min(...indexes) : 0
    const excerpt = content ? content.slice(Math.max(0, firstIndex - 45), Math.max(0, firstIndex - 45) + 150).replace(/\s+/g, ' ') : node.path
    const score = terms.reduce((total, term) => total + (name.includes(term) ? 20 : 0) + (nodePath.includes(term) ? 8 : 0) + (content.includes(term) ? 3 : 0), 0)
    return { node, excerpt, score }
  }))
  return hits.filter((hit): hit is SearchHit => Boolean(hit)).sort((a, b) => b.score - a.score).slice(0, 80)
}

export function formatBytes(bytes = 0): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}
