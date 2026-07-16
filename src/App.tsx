import { BookOpen, Code2, Command, Files, FolderOpen, Library, Menu, Search, Sparkles, Star, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { FileTree } from './components/FileTree'
import { Preview } from './components/Preview'
import { demoTree, flattenFiles, readDirectory, searchKnowledge } from './lib/knowledge'
import type { KnowledgeNode, SearchHit } from './types'

function App() {
  const [root, setRoot] = useState<KnowledgeNode>(demoTree)
  const [selected, setSelected] = useState<KnowledgeNode | undefined>(() => flattenFiles(demoTree)[0])
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set(JSON.parse(localStorage.getItem('nebula-favorites') ?? '[]')))
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const searchRef = useRef<HTMLInputElement>(null)
  const files = useMemo(() => flattenFiles(root), [root])

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      if (!query.trim()) { setHits([]); setSearching(false); return }
      setSearching(true)
      setHits(await searchKnowledge(root, query))
      setSearching(false)
    }, 180)
    return () => window.clearTimeout(timer)
  }, [query, root])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); searchRef.current?.focus()
      }
      if (event.key === 'Escape') setQuery('')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const openDirectory = async () => {
    try {
      const picker = (window as unknown as { showDirectoryPicker?: (options?: object) => Promise<unknown> }).showDirectoryPicker
      if (!picker) { alert('当前浏览器不支持文件夹访问，请使用最新版 Chrome、Edge 或桌面版 Codex 浏览器。'); return }
      const handle = await picker({ mode: 'read' }) as { name: string }
      const nextRoot = await readDirectory(handle)
      setRoot(nextRoot)
      setSelected(flattenFiles(nextRoot)[0])
      setQuery('')
    } catch (error) {
      if ((error as Error).name !== 'AbortError') console.error(error)
    }
  }

  const toggleFavorite = () => {
    if (!selected) return
    setFavorites((current) => {
      const next = new Set(current)
      next.has(selected.id) ? next.delete(selected.id) : next.add(selected.id)
      localStorage.setItem('nebula-favorites', JSON.stringify([...next]))
      return next
    })
  }

  const selectNode = (node: KnowledgeNode) => {
    setSelected(node)
    if (window.innerWidth < 800) setSidebarOpen(false)
  }

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" /><div className="noise" />
      <header className="topbar glass-panel">
        <button className="mobile-menu" onClick={() => setSidebarOpen((value) => !value)}><Menu size={19} /></button>
        <div className="brand"><div className="brand-mark"><Sparkles size={18} /></div><div><strong>Knowledge Nebula</strong><span>本地知识星云</span></div></div>
        <div className="global-search">
          <Search size={17} />
          <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索文件名、路径与正文内容…" />
          {query ? <button onClick={() => setQuery('')}><X size={15} /></button> : <kbd><Command size={11} />K</kbd>}
        </div>
        <div className="top-actions"><a href="https://github.com/YXX168/Knowledge-Nebula" target="_blank" title="GitHub"><Code2 size={18} /></a><button className="primary-button" onClick={openDirectory}><FolderOpen size={16} />打开知识库</button></div>
      </header>

      <section className="workspace">
        <aside className={`sidebar glass-panel ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-summary">
            <div className="library-icon"><Library size={19} /></div>
            <div><span>当前知识库</span><strong>{root.name}</strong></div>
            <span className="online-dot" />
          </div>
          <div className="stats-row">
            <div><Files size={14} /><strong>{files.length}</strong><span>文件</span></div>
            <div><Star size={14} /><strong>{favorites.size}</strong><span>收藏</span></div>
            <div><BookOpen size={14} /><strong>{new Set(files.map((file) => file.extension)).size}</strong><span>类型</span></div>
          </div>
          <div className="section-label"><span>文件结构</span><span>{files.length}</span></div>
          <FileTree root={root} selectedId={selected?.id} onSelect={selectNode} />
          <div className="privacy-note"><span className="privacy-pulse" /><div><strong>本地安全模式</strong><p>文件不会离开你的设备</p></div></div>
        </aside>

        <section className="content-panel glass-panel">
          {query ? (
            <div className="search-results">
              <div className="results-heading"><div><span className="eyebrow">DEEP SEARCH</span><h1>搜索 “{query}”</h1></div><span>{searching ? '正在穿越星云…' : `${hits.length} 个结果`}</span></div>
              <div className="result-list">
                {!searching && hits.length === 0 && <div className="no-results"><Search size={36} /><h3>没有找到相关内容</h3><p>换一个关键词，或检查文件是否为可索引文本格式。</p></div>}
                {hits.map((hit, index) => <button className="result-card" key={hit.node.id} style={{ '--delay': `${index * 35}ms` } as React.CSSProperties} onClick={() => { selectNode(hit.node); setQuery('') }}><div className="result-icon"><Files size={18} /></div><div><strong>{hit.node.name}</strong><span>{hit.node.path}</span><p>{hit.excerpt}</p></div><span className="result-score">{hit.score}</span></button>)}
              </div>
            </div>
          ) : <Preview node={selected} favorite={selected ? favorites.has(selected.id) : false} onToggleFavorite={toggleFavorite} />}
        </section>
      </section>
    </main>
  )
}

export default App
