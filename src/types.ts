export type NodeKind = 'folder' | 'file'

export interface KnowledgeNode {
  id: string
  name: string
  path: string
  kind: NodeKind
  extension?: string
  size?: number
  modified?: number
  children?: KnowledgeNode[]
  file?: File
  demoContent?: string
  sourceUrl?: string
}

export interface SearchHit {
  node: KnowledgeNode
  excerpt: string
  score: number
}

export interface KnowledgeConfig {
  knowledgeRoot: string
  configured: boolean
  available: boolean
}
