import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { Braces, CalendarDays, Copy, FileQuestion, HardDrive, Star } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { formatBytes, readNodeText } from '../lib/knowledge'
import type { KnowledgeNode } from '../types'

interface Props {
  node?: KnowledgeNode
  favorite: boolean
  onToggleFavorite: () => void
}

const imageTypes = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'])
const mediaTypes = new Set(['mp3', 'wav', 'ogg', 'mp4', 'webm'])

export function Preview({ node, favorite, onToggleFavorite }: Props) {
  const [content, setContent] = useState('')
  const [objectUrl, setObjectUrl] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    setContent('')
    if (node) readNodeText(node).then((text) => alive && setContent(text))
    if (node?.file && (imageTypes.has(node.extension ?? '') || mediaTypes.has(node.extension ?? '') || node.extension === 'pdf')) {
      const url = URL.createObjectURL(node.file)
      setObjectUrl(url)
      return () => { alive = false; URL.revokeObjectURL(url) }
    }
    setObjectUrl('')
    return () => { alive = false }
  }, [node])

  const markdown = useMemo(() => DOMPurify.sanitize(marked.parse(content) as string), [content])

  if (!node) return (
    <section className="empty-preview">
      <div className="empty-orbit"><div className="empty-core" /><span /><span /><span /></div>
      <p className="eyebrow">KNOWLEDGE NEBULA</p>
      <h2>让散落的知识重新形成星系</h2>
      <p>从左侧选择文件，或载入你的本地知识库文件夹。所有内容只在当前浏览器中读取，不会上传。</p>
    </section>
  )

  const ext = node.extension ?? ''
  const copyContent = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  return (
    <article className="preview-shell">
      <header className="preview-header">
        <div>
          <div className="breadcrumbs">{node.path.split('/').slice(0, -1).join('  /  ') || '知识库'}</div>
          <h1>{node.name}</h1>
          <div className="file-meta">
            <span><HardDrive size={13} />{formatBytes(node.size)}</span>
            <span><CalendarDays size={13} />{node.modified ? new Date(node.modified).toLocaleDateString('zh-CN') : '演示文件'}</span>
            <span><Braces size={13} />{ext.toUpperCase() || 'FILE'}</span>
          </div>
        </div>
        <div className="preview-actions">
          {content && <button className="icon-action" onClick={copyContent} title="复制内容"><Copy size={17} />{copied && <span className="action-tip">已复制</span>}</button>}
          <button className={`icon-action ${favorite ? 'favorite' : ''}`} onClick={onToggleFavorite} title="收藏"><Star size={17} fill={favorite ? 'currentColor' : 'none'} /></button>
        </div>
      </header>
      <div className="preview-content">
        {['md', 'mdx'].includes(ext) ? <div className="markdown-body" dangerouslySetInnerHTML={{ __html: markdown }} />
          : ext === 'json' ? <pre className="code-preview"><code>{(() => { try { return JSON.stringify(JSON.parse(content), null, 2) } catch { return content } })()}</code></pre>
          : imageTypes.has(ext) && objectUrl ? <div className="image-preview"><img src={objectUrl} alt={node.name} /></div>
          : ext === 'pdf' && objectUrl ? <iframe className="pdf-preview" src={objectUrl} title={node.name} />
          : ['mp3', 'wav', 'ogg'].includes(ext) && objectUrl ? <audio className="media-preview" src={objectUrl} controls />
          : ['mp4', 'webm'].includes(ext) && objectUrl ? <video className="video-preview" src={objectUrl} controls />
          : content ? <pre className="text-preview"><code>{content}</code></pre>
          : <div className="unsupported"><FileQuestion size={42} /><h3>暂不支持直接预览</h3><p>该文件仍会保留在目录树中，你可以通过系统应用打开。</p></div>}
      </div>
    </article>
  )
}
