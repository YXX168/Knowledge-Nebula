import { useMemo, useState } from 'react'
import { ChevronRight, FileCode2, FileImage, FileJson, FileText, Folder, FolderOpen } from 'lucide-react'
import type { KnowledgeNode } from '../types'

interface Props {
  root: KnowledgeNode
  selectedId?: string
  onSelect: (node: KnowledgeNode) => void
}

function FileGlyph({ extension = '' }: { extension?: string }) {
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension)) return <FileImage size={16} className="tree-icon" />
  if (extension === 'json') return <FileJson size={16} className="tree-icon" />
  if (['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'go', 'rs', 'css', 'html'].includes(extension)) return <FileCode2 size={16} className="tree-icon" />
  return <FileText size={16} className="tree-icon" />
}

function TreeNode({ node, depth, selectedId, onSelect }: { node: KnowledgeNode; depth: number; selectedId?: string; onSelect: (node: KnowledgeNode) => void }) {
  const [open, setOpen] = useState(depth < 2)
  const isFolder = node.kind === 'folder'
  return (
    <div className="tree-branch">
      <button
        className={`tree-row ${selectedId === node.id ? 'is-selected' : ''}`}
        style={{ '--depth': depth } as React.CSSProperties}
        onClick={() => isFolder ? setOpen((value) => !value) : onSelect(node)}
        title={node.path}
      >
        {isFolder ? <ChevronRight className={`tree-chevron ${open ? 'open' : ''}`} size={14} /> : <span className="tree-spacer" />}
        {isFolder
          ? open ? <FolderOpen size={16} className="tree-icon folder" /> : <Folder size={16} className="tree-icon folder" />
          : <FileGlyph extension={node.extension} />}
        <span className="tree-name">{node.name}</span>
        {isFolder && <span className="tree-count">{node.children?.length ?? 0}</span>}
      </button>
      {isFolder && open && <div className="tree-children">{node.children?.map((child) => <TreeNode key={child.id} node={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />)}</div>}
    </div>
  )
}

export function FileTree({ root, selectedId, onSelect }: Props) {
  const key = useMemo(() => root.id, [root.id])
  return <div className="file-tree" key={key}><TreeNode node={root} depth={0} selectedId={selectedId} onSelect={onSelect} /></div>
}
