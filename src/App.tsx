import { BookOpen, Code2, Command, Files, FolderCog, Library, Menu, RefreshCw, Search, Settings, ShieldCheck, Sparkles, Star, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FileTree } from './components/FileTree'
import { Preview } from './components/Preview'
import { demoTree, findNodeByPath, flattenFiles, loadKnowledge, loadKnowledgeConfig, saveKnowledgeConfig, searchKnowledge } from './lib/knowledge'
import type { KnowledgeConfig, KnowledgeNode, SearchHit } from './types'

function App() {
  const [root, setRoot] = useState<KnowledgeNode>(demoTree)
  const [selected, setSelected] = useState<KnowledgeNode>()
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('nebula-favorites') ?? '[]') as string[]) }
    catch { return new Set() }
  })
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loadingLibrary, setLoadingLibrary] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [liveConnected, setLiveConnected] = useState(false)
  const [revision, setRevision] = useState(0)
  const [configuration, setConfiguration] = useState<KnowledgeConfig>()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsPath, setSettingsPath] = useState('')
  const [settingsError, setSettingsError] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)
  const selectedPathRef = useRef<string | undefined>(undefined)
  const searchRef = useRef<HTMLInputElement>(null)
  const files = useMemo(() => flattenFiles(root), [root])

  useEffect(() => { selectedPathRef.current = selected?.path }, [selected])

  const loadLibrary = useCallback(async (quiet = false) => {
    if (!quiet) setLoadingLibrary(true)
    setLoadError('')
    try {
      const nextRoot = await loadKnowledge()
      const nextFiles = flattenFiles(nextRoot)
      const nextSelected = findNodeByPath(nextRoot, selectedPathRef.current) ?? nextFiles[0]
      setRoot(nextRoot)
      setSelected(nextSelected)
      setRevision((value) => value + 1)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '知识库加载失败')
    } finally {
      if (!quiet) setLoadingLibrary(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const bootstrap = async () => {
      try {
        const nextConfiguration = await loadKnowledgeConfig()
        if (cancelled) return
        setConfiguration(nextConfiguration)
        setSettingsPath(nextConfiguration.knowledgeRoot)
        if (!nextConfiguration.available) {
          setLoadingLibrary(false)
          setSettingsOpen(true)
          return
        }
        await loadLibrary()
      } catch (error) {
        if (cancelled) return
        setLoadingLibrary(false)
        setLoadError(error instanceof Error ? error.message : '初始化失败')
        setSettingsOpen(true)
      }
    }
    void bootstrap()
    return () => { cancelled = true }
  }, [loadLibrary])

  useEffect(() => {
    let refreshTimer = 0
    const events = new EventSource('/api/events')
    events.addEventListener('ready', () => setLiveConnected(true))
    events.addEventListener('change', (event) => {
      setLiveConnected(true)
      window.clearTimeout(refreshTimer)
      refreshTimer = window.setTimeout(() => {
        let reason: string | undefined
        try { reason = (JSON.parse((event as MessageEvent<string>).data) as { reason?: string }).reason }
        catch { /* Ignore malformed optional event metadata. */ }
        if (reason === 'configuration') {
          void loadKnowledgeConfig().then((nextConfiguration) => {
            setConfiguration(nextConfiguration)
            setSettingsPath(nextConfiguration.knowledgeRoot)
            if (nextConfiguration.available) void loadLibrary(true)
            else {
              setRoot(demoTree)
              setSelected(undefined)
              setLoadError('')
            }
          })
          return
        }
        void loadLibrary(true)
      }, 180)
    })
    events.onerror = () => setLiveConnected(false)
    return () => { window.clearTimeout(refreshTimer); events.close() }
  }, [loadLibrary])

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(async () => {
      if (!query.trim()) { setHits([]); setSearching(false); return }
      setSearching(true)
      const results = await searchKnowledge(root, query)
      if (!cancelled) { setHits(results); setSearching(false) }
    }, 180)
    return () => { cancelled = true; window.clearTimeout(timer) }
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

  const toggleFavorite = () => {
    if (!selected) return
    setFavorites((current) => {
      const next = new Set(current)
      if (next.has(selected.id)) next.delete(selected.id)
      else next.add(selected.id)
      localStorage.setItem('nebula-favorites', JSON.stringify([...next]))
      return next
    })
  }

  const selectNode = (node: KnowledgeNode) => {
    setSelected(node)
    if (window.innerWidth < 800) setSidebarOpen(false)
  }

  const openSettings = () => {
    setSettingsPath(configuration?.knowledgeRoot ?? '')
    setSettingsError('')
    setSettingsOpen(true)
  }

  const applyKnowledgePath = async (knowledgeRoot: string) => {
    setSavingSettings(true)
    setSettingsError('')
    try {
      const nextConfiguration = await saveKnowledgeConfig(knowledgeRoot)
      setConfiguration(nextConfiguration)
      setSettingsPath(nextConfiguration.knowledgeRoot)
      setSelected(undefined)
      setQuery('')
      if (nextConfiguration.available) {
        await loadLibrary()
        setSettingsOpen(false)
      } else {
        setRoot(demoTree)
        setLoadingLibrary(false)
        if (!nextConfiguration.configured) setSettingsOpen(false)
      }
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : '知识库配置保存失败')
    } finally {
      setSavingSettings(false)
    }
  }

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" /><div className="noise" />
      <header className="topbar glass-panel">
        <button className="mobile-menu" onClick={() => setSidebarOpen((value) => !value)} aria-label="切换侧边栏"><Menu size={19} /></button>
        <div className="brand"><div className="brand-mark"><Sparkles size={18} /></div><div><strong>Knowledge Nebula</strong><span>本地知识星云</span></div></div>
        <div className="global-search">
          <Search size={17} />
          <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索文件名、路径与正文内容…" />
          {query ? <button onClick={() => setQuery('')} aria-label="清空搜索"><X size={15} /></button> : <kbd><Command size={11} />K</kbd>}
        </div>
        <div className="top-actions"><a href="https://github.com/YXX168/Knowledge-Nebula" target="_blank" rel="noreferrer" title="GitHub"><Code2 size={18} /></a><button className="icon-action" onClick={openSettings} title="知识库设置" aria-label="知识库设置"><Settings size={18} /></button><button className="primary-button" onClick={() => void loadLibrary()} disabled={loadingLibrary || !configuration?.available}><RefreshCw size={16} className={loadingLibrary ? 'spin' : ''} />刷新知识库</button></div>
      </header>

      <section className="workspace">
        <aside className={`sidebar glass-panel ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-summary">
            <div className="library-icon"><Library size={19} /></div>
            <div><span>当前知识库</span><strong>{root.name}</strong></div>
            <span className={`online-dot ${liveConnected ? '' : 'offline'}`} title={liveConnected ? '实时同步已连接' : '正在重连实时同步'} />
          </div>
          <div className="stats-row">
            <div><Files size={14} /><strong>{files.length}</strong><span>文件</span></div>
            <div><Star size={14} /><strong>{favorites.size}</strong><span>收藏</span></div>
            <div><BookOpen size={14} /><strong>{new Set(files.map((file) => file.extension)).size}</strong><span>类型</span></div>
          </div>
          <div className="section-label"><span>文件结构</span><span>{files.length}</span></div>
          <FileTree root={root} selectedId={selected?.id} onSelect={selectNode} />
          <div className={`privacy-note ${loadError || (configuration?.configured && !configuration.available) ? 'error' : ''}`}><span className="privacy-pulse" /><div><strong>{loadError ? '知识库连接异常' : !configuration?.configured ? '尚未设置知识库' : !configuration.available ? '知识库目录不可用' : liveConnected ? '实时同步与安全编辑已开启' : '知识库已连接，实时同步重连中'}</strong><p>{loadError || (!configuration?.configured ? '请在设置中选择本机目录' : !configuration.available ? '请检查目录后重新设置' : '本机目录 · 内容不会上传')}</p></div></div>
        </aside>

        <section className="content-panel glass-panel">
          {query ? (
            <div className="search-results">
              <div className="results-heading"><div><span className="eyebrow">DEEP SEARCH</span><h1>搜索“{query}”</h1></div><span>{searching ? '正在搜索…' : `${hits.length} 个结果`}</span></div>
              <div className="result-list">
                {!searching && hits.length === 0 && <div className="no-results"><Search size={36} /><h3>没有找到相关内容</h3><p>换一个关键词，或检查文件是否为可索引的文本格式。</p></div>}
                {hits.map((hit, index) => <button className="result-card" key={hit.node.id} style={{ '--delay': `${index * 35}ms` } as React.CSSProperties} onClick={() => { selectNode(hit.node); setQuery('') }}><div className="result-icon"><Files size={18} /></div><div><strong>{hit.node.name}</strong><span>{hit.node.path}</span><p>{hit.excerpt}</p></div><span className="result-score">{hit.score}</span></button>)}
              </div>
            </div>
          ) : <Preview node={selected} favorite={selected ? favorites.has(selected.id) : false} onToggleFavorite={toggleFavorite} revision={revision} onSaved={() => void loadLibrary(true)} />}
        </section>
      </section>
      {settingsOpen && <div className="settings-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false) }}>
        <section className="settings-dialog glass-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
          <div className="settings-heading"><div className="settings-mark"><FolderCog size={21} /></div><div><span>KNOWLEDGE SOURCE</span><h2 id="settings-title">知识库路径</h2></div><button onClick={() => setSettingsOpen(false)} aria-label="关闭设置"><X size={18} /></button></div>
          <p className="settings-description">选择此设备上需要浏览和编辑的知识库文件夹。路径只保存在当前用户的系统配置目录，不会写入项目或上传网络。</p>
          <form onSubmit={(event) => { event.preventDefault(); void applyKnowledgePath(settingsPath) }}>
            <label htmlFor="knowledge-root">本机绝对路径</label>
            <div className="path-input"><Library size={17} /><input id="knowledge-root" autoFocus value={settingsPath} onChange={(event) => setSettingsPath(event.target.value)} placeholder="请输入知识库的绝对路径" spellCheck={false} /></div>
            <div className="settings-security"><ShieldCheck size={15} /><span>仅允许访问该目录内部，符号链接和路径越界会被拒绝。</span></div>
            {settingsError && <div className="settings-error">{settingsError}</div>}
            <div className="settings-actions"><button type="button" className="text-button danger" onClick={() => void applyKnowledgePath('')} disabled={savingSettings || !configuration?.configured}>清除配置</button><div><button type="button" className="text-button" onClick={() => setSettingsOpen(false)}>取消</button><button type="submit" className="primary-button" disabled={savingSettings || !settingsPath.trim()}>{savingSettings ? '正在验证…' : '保存并加载'}</button></div></div>
          </form>
        </section>
      </div>}
    </main>
  )
}

export default App
