import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { Braces, CalendarDays, Check, Copy, Edit3, FileQuestion, HardDrive, Save, Star, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { formatBytes, readNodeText, saveNodeText, textExtensions } from '../lib/knowledge'
import type { KnowledgeNode } from '../types'

interface Props {
  node?: KnowledgeNode
  favorite: boolean
  onToggleFavorite: () => void
  revision: number
  onSaved: () => void
}

const imageTypes = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'])
const mediaTypes = new Set(['mp3', 'wav', 'ogg', 'mp4', 'webm'])

export function Preview({ node, favorite, onToggleFavorite, revision, onSaved }: Props) {
  const [content, setContent] = useState('')
  const [loadedModified, setLoadedModified] = useState<number>()
  const [objectUrl, setObjectUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  useEffect(() => {
    let alive = true
    // Loading a different file intentionally resets the previous file's view state.
    /* eslint-disable react-hooks/set-state-in-effect */
    setSaveMessage('')
    if (!editing) {
      setContent('')
      if (node) void readNodeText(node).then((result) => {
        if (alive) { setContent(result.content); setLoadedModified(result.modified ?? node.modified) }
      })
    }
    if (node?.sourceUrl && (imageTypes.has(node.extension ?? '') || mediaTypes.has(node.extension ?? '') || node.extension === 'pdf')) {
      setObjectUrl(`${node.sourceUrl}&v=${encodeURIComponent(node.modified ?? revision)}`)
      return () => { alive = false }
    }
    setObjectUrl('')
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => { alive = false }
  }, [node, revision, editing])

  const markdown = useMemo(() => DOMPurify.sanitize(marked.parse(content) as string), [content])

  if (!node) return (
    <section className="empty-preview">
      <div className="empty-orbit"><div className="empty-core" /><span /><span /><span /></div>
      <p className="eyebrow">KNOWLEDGE NEBULA</p>
      <h2>让散落的知识重新形成星系</h2>
      <p>从左侧选择文件。系统会自动发现知识库中的新增、修改和删除，并保持页面同步。</p>
    </section>
  )

  const ext = node.extension ?? ''
  const canEdit = textExtensions.has(ext) && (node.size ?? 0) <= 2_000_000

  const copyContent = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  const beginEditing = () => {
    setDraft(content)
    setSaveMessage('')
    setEditing(true)
  }

  const cancelEditing = () => {
    if (draft !== content && !window.confirm('放弃尚未保存的修改吗？')) return
    setEditing(false)
    setDraft('')
    setSaveMessage('')
  }

  const save = async () => {
    setSaving(true)
    setSaveMessage('')
    try {
      const result = await saveNodeText(node, draft, loadedModified)
      setContent(draft)
      setLoadedModified(result.modified)
      setEditing(false)
      setSaveMessage('已保存')
      onSaved()
      window.setTimeout(() => setSaveMessage(''), 1800)
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className="preview-shell">
      <header className="preview-header">
        <div>
          <div className="breadcrumbs">{node.path.split('/').slice(0, -1).join('  /  ') || '知识库'}</div>
          <h1>{node.name}</h1>
          <div className="file-meta">
            <span><HardDrive size={13} />{formatBytes(node.size)}</span>
            <span><CalendarDays size={13} />{node.modified ? new Date(node.modified).toLocaleString('zh-CN') : '未知时间'}</span>
            <span><Braces size={13} />{ext.toUpperCase() || 'FILE'}</span>
          </div>
        </div>
        <div className="preview-actions">
          {saveMessage && <span className={`save-status ${saveMessage === '已保存' ? 'success' : 'error'}`}>{saveMessage === '已保存' && <Check size={13} />}{saveMessage}</span>}
          {editing ? <>
            <button className="editor-button secondary" onClick={cancelEditing} disabled={saving}><X size={15} />取消</button>
            <button className="editor-button" onClick={() => void save()} disabled={saving || draft === content}><Save size={15} />{saving ? '保存中…' : '保存'}</button>
          </> : <>
            {canEdit && <button className="editor-button" onClick={beginEditing}><Edit3 size={15} />编辑</button>}
            {content && <button className="icon-action" onClick={() => void copyContent()} title="复制内容"><Copy size={17} />{copied && <span className="action-tip">已复制</span>}</button>}
            <button className={`icon-action ${favorite ? 'favorite' : ''}`} onClick={onToggleFavorite} title="收藏"><Star size={17} fill={favorite ? 'currentColor' : 'none'} /></button>
          </>}
        </div>
      </header>
      <div className="preview-content">
        {editing ? <div className="editor-shell"><textarea className="text-editor" value={draft} onChange={(event) => setDraft(event.target.value)} spellCheck={false} autoFocus /><div className="editor-footer"><span>UTF-8 · {new Blob([draft]).size.toLocaleString('zh-CN')} 字节</span><span>保存时会检查外部修改，避免覆盖新内容</span></div></div>
          : ['md', 'mdx'].includes(ext) ? <div className="markdown-body" dangerouslySetInnerHTML={{ __html: markdown }} />
          : ext === 'json' ? <pre className="code-preview"><code>{(() => { try { return JSON.stringify(JSON.parse(content), null, 2) } catch { return content } })()}</code></pre>
          : imageTypes.has(ext) && objectUrl ? <div className="image-preview"><img src={objectUrl} alt={node.name} /></div>
          : ext === 'pdf' && objectUrl ? <iframe className="pdf-preview" src={objectUrl} title={node.name} />
          : ['mp3', 'wav', 'ogg'].includes(ext) && objectUrl ? <audio className="media-preview" src={objectUrl} controls />
          : ['mp4', 'webm'].includes(ext) && objectUrl ? <video className="video-preview" src={objectUrl} controls />
          : content ? <pre className="text-preview"><code>{content}</code></pre>
          : <div className="unsupported"><FileQuestion size={42} /><h3>暂不支持直接预览</h3><p>该文件仍会保留在目录树中，可以通过系统应用打开。</p></div>}
      </div>
    </article>
  )
}
