import { useCallback, useEffect, useRef, useState } from 'react'
import {
  checkHealth,
  uploadDocument,
  askQuestion,
  compareDocuments,
  createStudyPack,
} from './api.js'
import Markdown from './Markdown.jsx'
import StudyPack from './StudyPack.jsx'

const MAX_FILE_MB = 50

// ---------------------------------------------------------------------------
// Backend connection indicator — polls GET /health every 15s
// ---------------------------------------------------------------------------
function ConnectionStatus() {
  const [status, setStatus] = useState('checking') // checking | online | offline

  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const data = await checkHealth()
        if (!cancelled) setStatus(data?.status === 'healthy' ? 'online' : 'offline')
      } catch {
        if (!cancelled) setStatus('offline')
      }
    }

    poll()
    const interval = setInterval(poll, 15000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const labels = {
    checking: 'Checking backend…',
    online: 'Backend online',
    offline: 'Backend unreachable',
  }

  return (
    <div className={`status-pill status-pill--${status}`}>
      <span className="status-dot" />
      {labels[status]}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Drag-and-drop / click-to-browse PDF upload zone
// ---------------------------------------------------------------------------
function UploadPanel({ onIndexed }) {
  const [file, setFile] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [progress, setProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const inputRef = useRef(null)

  const validateAndSetFile = useCallback((candidate) => {
    setError('')
    setResult(null)
    if (!candidate) return

    const isPdf =
      candidate.type === 'application/pdf' || candidate.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      setError('Only PDF files are supported. Choose a file that ends in .pdf.')
      setFile(null)
      return
    }
    if (candidate.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`That file is larger than ${MAX_FILE_MB}MB. Choose a smaller PDF.`)
      setFile(null)
      return
    }
    setFile(candidate)
  }, [])

  function handleDrop(event) {
    event.preventDefault()
    setIsDragging(false)
    const dropped = event.dataTransfer.files?.[0]
    validateAndSetFile(dropped)
  }

  function handleBrowse(event) {
    validateAndSetFile(event.target.files?.[0])
  }

  async function handleUpload() {
    if (!file) return
    setIsUploading(true)
    setError('')
    setProgress(0)
    try {
      const data = await uploadDocument(file, setProgress)
      setResult(data)
      onIndexed(data)
    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  function reset() {
    setFile(null)
    setResult(null)
    setError('')
    setProgress(0)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <section className="panel upload-panel">
      <h2 className="panel-title">
        <span className="panel-eyebrow">01 · Ingest</span>
        Upload a PDF
      </h2>
      <p className="panel-copy">
        Your document is chunked, embedded, and stored in the vector index so the model can
        ground its answers in the actual text.
      </p>

      <div
        className={`dropzone ${isDragging ? 'dropzone--active' : ''} ${file ? 'dropzone--has-file' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
        }}
        aria-label="Drop a PDF here or click to browse"
      >
        <span className="dropzone-corner dropzone-corner--tl" />
        <span className="dropzone-corner dropzone-corner--tr" />
        <span className="dropzone-corner dropzone-corner--bl" />
        <span className="dropzone-corner dropzone-corner--br" />

        {isUploading && <span className="scan-beam" />}

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={handleBrowse}
          className="visually-hidden"
        />

        {!file && (
          <>
            <svg className="dropzone-icon" viewBox="0 0 48 48" fill="none">
              <path
                d="M24 6v24m0-24 9 9m-9-9-9 9"
                stroke="url(#uploadGrad)"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M8 32v6a4 4 0 0 0 4 4h24a4 4 0 0 0 4-4v-6"
                stroke="url(#uploadGrad)"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="uploadGrad" x1="8" y1="6" x2="40" y2="42">
                  <stop stopColor="#9b8bff" />
                  <stop offset="1" stopColor="#45d9ff" />
                </linearGradient>
              </defs>
            </svg>
            <p className="dropzone-title">Drag &amp; drop a PDF here</p>
            <p className="dropzone-sub">or click to browse your files</p>
            <span className="btn btn--ghost">Choose file</span>
          </>
        )}

        {file && !result && (
          <div className="file-chip" onClick={(e) => e.stopPropagation()}>
            <svg viewBox="0 0 24 24" fill="none" className="file-chip-icon">
              <path
                d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.6" />
            </svg>
            <div className="file-chip-meta">
              <span className="file-chip-name">{file.name}</span>
              <span className="file-chip-size">{(file.size / 1024).toFixed(0)} KB</span>
            </div>
          </div>
        )}

        {result && (
          <div className="file-chip file-chip--done" onClick={(e) => e.stopPropagation()}>
            <span className="check-icon">✓</span>
            <div className="file-chip-meta">
              <span className="file-chip-name">{result.original_filename}</span>
              <span className="file-chip-size">Indexed and ready for questions</span>
            </div>
          </div>
        )}
      </div>

      {isUploading && (
        <div className="progress-track" aria-label={`Upload progress: ${progress}%`}>
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      )}

      {error && <p className="banner banner--error">{error}</p>}

      {!result && (
        <div className="panel-actions">
          <button
            className="btn btn--primary"
            disabled={!file || isUploading}
            onClick={handleUpload}
          >
            {isUploading ? 'Processing…' : 'Process document'}
          </button>
          {file && !isUploading && (
            <button className="btn btn--text" onClick={reset}>
              Remove
            </button>
          )}
        </div>
      )}

      {result && (
        <>
          <p className="banner banner--success">
            PDF processed and stored in the vector index successfully.
          </p>
          <dl className="meta-grid">
            <div className="meta-item">
              <dt>Characters extracted</dt>
              <dd>{result.characters_extracted?.toLocaleString()}</dd>
            </div>
            <div className="meta-item">
              <dt>Chunks created</dt>
              <dd>{result.total_chunks}</dd>
            </div>
            <div className="meta-item">
              <dt>Embedding dimensions</dt>
              <dd>{result.embedding_dimensions}</dd>
            </div>
            <div className="meta-item">
              <dt>Vectors in index</dt>
              <dd>{result.total_vectors_in_index}</dd>
            </div>
          </dl>
          <button className="btn btn--ghost" onClick={reset}>
            Upload another PDF
          </button>
        </>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// One question/answer exchange
// ---------------------------------------------------------------------------
function Exchange({ entry }) {
  const documentNames = [...new Set(
    (entry.sources ?? []).map((source) => source.document_name),
  )]
    .map((name) => name.replace(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_/i,
      '',
    ))
    .sort()
  const pageNumbers = [...new Set(
    (entry.sources ?? [])
      .map((source) => source.page_number)
      .filter((pageNumber) => pageNumber),
  )].sort((a, b) => a - b)
  const sourceReference = documentNames.length && pageNumbers.length
    ? `${documentNames.join(', ')} · Page${pageNumbers.length > 1 ? 's' : ''} ${pageNumbers.join(', ')}`
    : ''

  return (
    <div className="exchange">
      <div className="bubble bubble--question">
        <span className="bubble-label">Query</span>
        <p>{entry.question}</p>
      </div>

      {entry.status === 'loading' && (
        <div className="bubble bubble--answer bubble--loading">
          <span className="bubble-label">Response</span>
          <p className="loading-line">
            <span className="loading-dot" />
            Searching your document and generating a local answer…
          </p>
        </div>
      )}

      {entry.status === 'error' && (
        <div className="bubble bubble--answer bubble--error">
          <span className="bubble-label">Response</span>
          <p>{entry.error}</p>
        </div>
      )}

      {entry.status === 'done' && (
        <div className="bubble bubble--answer">
          <span className="bubble-label">Response</span>
          <Markdown text={entry.answer} className="answer-text" />
          {sourceReference && <p className="answer-source">Source: {sourceReference}</p>}
          {entry.sources?.[0]?.snippet && (
            <p className="evidence-snippet">
              Evidence: “{entry.sources[0].snippet}”
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function isPdfFile(file) {
  return file && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))
}

function PdfPicker({ label, file, onChange }) {
  return (
    <label className={`pdf-picker ${file ? 'has-file' : ''}`}>
      <span className="pdf-picker-label">{label}</span>
      <span className="pdf-picker-name">{file ? file.name : 'Choose a PDF…'}</span>
      <input
        type="file"
        accept=".pdf,application/pdf"
        className="visually-hidden"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
    </label>
  )
}

function LabsPanel() {
  const [compareFiles, setCompareFiles] = useState([null, null])
  const [studyFile, setStudyFile] = useState(null)
  const [result, setResult] = useState(null)
  const [isWorking, setIsWorking] = useState(false)
  const [error, setError] = useState('')

  function pickFile(file, apply) {
    setError('')
    if (file && !isPdfFile(file)) {
      setError('Only PDF files are supported. Choose a file that ends in .pdf.')
      return
    }
    apply(file)
  }

  async function runTool(action) {
    setError('')
    setResult(null)
    setIsWorking(true)
    try {
      if (action === 'compare') {
        const data = await compareDocuments(compareFiles[0], compareFiles[1])
        setResult({
          kind: 'compare',
          title: `${data.first_document}  vs  ${data.second_document}`,
          text: data.result,
        })
      } else {
        const data = await createStudyPack(studyFile)
        setResult({ kind: 'study', title: data.document, pack: data.study_pack, text: data.result })
      }
    } catch (err) {
      setError(err.message || 'The local tool could not complete.')
    } finally {
      setIsWorking(false)
    }
  }

  return (
    <section className="labs panel">
      <div className="labs-heading">
        <div>
          <span className="panel-eyebrow">03 · Labs</span>
          <h2 className="panel-title">Turn documents into decisions</h2>
        </div>
        <span className="labs-badge">Local AI tools</span>
      </div>
      <div className="labs-grid">
        <div className="tool-card">
          <span className="tool-index">A</span>
          <h3>Compare two PDFs</h3>
          <p>Find what changed, disappeared, or stayed consistent.</p>
          <PdfPicker
            label="Document A"
            file={compareFiles[0]}
            onChange={(file) => pickFile(file, (f) => setCompareFiles(([, second]) => [f, second]))}
          />
          <PdfPicker
            label="Document B"
            file={compareFiles[1]}
            onChange={(file) => pickFile(file, (f) => setCompareFiles(([first]) => [first, f]))}
          />
          <button
            className="btn btn--primary"
            disabled={!compareFiles[0] || !compareFiles[1] || isWorking}
            onClick={() => runTool('compare')}
          >
            Compare documents
          </button>
        </div>
        <div className="tool-card">
          <span className="tool-index">B</span>
          <h3>Study mode</h3>
          <p>Generate key ideas, flashcards, and a self-test quiz from one PDF.</p>
          <PdfPicker
            label="Study PDF"
            file={studyFile}
            onChange={(file) => pickFile(file, setStudyFile)}
          />
          <button
            className="btn btn--primary"
            disabled={!studyFile || isWorking}
            onClick={() => runTool('study')}
          >
            Generate study pack
          </button>
        </div>
      </div>
      {isWorking && (
        <p className="banner banner--working">
          <span className="loading-dot" />
          The local model is reading your PDF. This can take a minute or two on CPU…
        </p>
      )}
      {error && <p className="banner banner--error">{error}</p>}
      {result && (
        <div className="tool-result">
          <div className="tool-result-head">
            <span className="panel-eyebrow">{result.kind === 'compare' ? 'Comparison' : 'Study pack'}</span>
            <span className="tool-result-title">{result.title}</span>
          </div>
          {result.kind === 'study' && result.pack ? (
            <StudyPack pack={result.pack} />
          ) : (
            <Markdown text={result.text} className={result.kind === 'compare' ? 'markdown--compare' : ''} />
          )}
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Conversation panel: composer + running thread (kept in memory for session)
// ---------------------------------------------------------------------------
function ConversationPanel({ hasIndexedDoc }) {
  const [question, setQuestion] = useState('')
  const [entries, setEntries] = useState([])
  const [isAsking, setIsAsking] = useState(false)
  const threadEndRef = useRef(null)

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [entries])

  async function handleAsk() {
    const trimmed = question.trim()
    if (!trimmed || isAsking) return

    const id = crypto.randomUUID()
    setEntries((prev) => [...prev, { id, question: trimmed, status: 'loading' }])
    setQuestion('')
    setIsAsking(true)

    try {
      const data = await askQuestion(trimmed, 3)
      setEntries((prev) =>
        prev.map((e) =>
          e.id === id ? { ...e, status: 'done', answer: data.answer, sources: data.sources } : e,
        ),
      )
    } catch (err) {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === id
            ? { ...e, status: 'error', error: err.message || 'Something went wrong.' }
            : e,
        ),
      )
    } finally {
      setIsAsking(false)
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      handleAsk()
    }
  }

  return (
    <section className="panel conversation-panel">
      <h2 className="panel-title">
        <span className="panel-eyebrow">02 · Retrieve</span>
        Ask your document
      </h2>

      <div className="thread">
        {entries.length === 0 && (
          <div className="empty-state">
            <p>No questions yet this session.</p>
            <p className="empty-state-sub">
              {hasIndexedDoc
                ? 'Your document is indexed — ask something specific about its content.'
                : 'Upload a PDF on the left, then ask a question grounded in its content.'}
            </p>
          </div>
        )}
        {entries.map((entry) => (
          <Exchange key={entry.id} entry={entry} />
        ))}
        <div ref={threadEndRef} />
      </div>

      <div className="composer">
        {!hasIndexedDoc && (
          <p className="composer-hint">
            No document uploaded in this session yet — upload a PDF first, or the backend will
            let you know if its index is empty.
          </p>
        )}
        <textarea
          className="composer-input"
          placeholder="Ask something grounded in your document… e.g. What are the block rules for Count Valid A-B-C Block Sequences?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
        />
        <div className="composer-actions">
          <span className="composer-tip">⌘/Ctrl + Enter to send</span>
          <button
            className="btn btn--primary"
            disabled={!question.trim() || isAsking}
            onClick={handleAsk}
          >
            {isAsking ? 'Generating…' : 'Ask Document'}
          </button>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Decorative fixed background — grid + drifting glow, purely atmospheric
// ---------------------------------------------------------------------------
function BackgroundField() {
  return (
    <div className="bg-field" aria-hidden="true">
      <div className="bg-grid" />
      <div className="bg-glow bg-glow--violet" />
      <div className="bg-glow bg-glow--cyan" />
    </div>
  )
}

function LandingDemo() {
  const examples = [
    {
      question: 'What is a deadlock?',
      answer:
        'A deadlock is a state where processes wait on each other forever, so none can continue.',
      source: 'Example PDF · page 7',
    },
    {
      question: 'How does paging work?',
      answer:
        'Paging splits memory into fixed-size frames and each process into pages of the same size.',
      source: 'Example PDF · page 12',
    },
    {
      question: 'What does the scheduler do?',
      answer:
        'The scheduler decides which ready process gets the CPU next, using a policy such as round robin.',
      source: 'Example PDF · page 3',
    },
  ]
  const [selected, setSelected] = useState(null)
  const [question, setQuestion] = useState('')
  const [noMatch, setNoMatch] = useState(false)

  function ask(event) {
    event.preventDefault()
    const query = question.trim().toLowerCase()
    const match = query
      ? examples.find((item) => item.question.toLowerCase().includes(query))
      : null
    setSelected(match || null)
    setNoMatch(Boolean(query) && !match)
  }

  return (
    <div className="landing-demo">
      <div className="landing-demo-top">
        <span><i className="demo-dot" /> <b>Example preview</b></span>
        <span className="demo-badge">Sample data</span>
      </div>
      <div className="chunk-field" aria-hidden="true">
        {Array.from({ length: 48 }, (_, index) => (
          <i className={selected && index % 11 === 0 ? 'chunk-hit' : ''} key={index} />
        ))}
      </div>
      <div className="demo-chips">
        {examples.map((item) => (
          <button
            className={`demo-chip ${selected?.question === item.question ? 'is-selected' : ''}`}
            key={item.question}
            onClick={() => {
              setQuestion(item.question)
              setSelected(item)
              setNoMatch(false)
            }}
          >
            {item.question}
          </button>
        ))}
      </div>
      <form className="demo-ask" onSubmit={ask}>
        <input
          aria-label="Try one of the example questions"
          placeholder="Try an example question, e.g. paging"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
        />
        <button className="btn btn--primary" type="submit">Ask</button>
      </form>
      <div className="demo-answer" aria-live="polite">
        {selected ? (
          <>
            <p>{selected.answer}</p>
            <blockquote><cite>{selected.source}</cite>In the real app, this shows the exact passage from your uploaded PDF.</blockquote>
          </>
        ) : noMatch ? (
          <span className="text-dim">
            This preview only knows the three example questions. To ask about your own
            PDF, <a className="demo-link" href="#workspace">upload it in the workspace</a>.
          </span>
        ) : (
          <span className="text-dim">
            This is a preview with sample answers. Pick a question above to see how cited answers look.
          </span>
        )}
      </div>
    </div>
  )
}

export default function App() {
  const [hasIndexedDoc, setHasIndexedDoc] = useState(false)

  return (
    <div className="app">
      <BackgroundField />

      <div className="site-wrap">
        <nav className="site-nav">
          <a className="site-mark" href="#top"><span />Docuvia</a>
          <div className="site-links">
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <a href="#workspace">Workspace</a>
          </div>
          <ConnectionStatus />
          <a className="btn btn--primary" href="#workspace">Try the demo</a>
        </nav>

        <header className="landing-hero" id="top">
          <div className="landing-copy">
            <div className="landing-pill"><i /> Local AI, running on your machine</div>
            <h1>Ask your PDFs.<br /><span>See the proof.</span></h1>
            <p>Upload your documents and ask anything. Every answer comes with the PDF, the page and the exact passage it was drawn from.</p>
            <div className="landing-cta">
              <a className="btn btn--primary" href="#workspace">Try the demo</a>
              <a className="btn btn--ghost" href="#how">See how it works</a>
            </div>
            <small>If your question is not covered by your documents, it says so instead of guessing.</small>
          </div>
          <LandingDemo />
        </header>

        <div className="tech-marquee" aria-label="Technology stack">
          React + Vite <b>◆</b> FastAPI <b>◆</b> PyMuPDF <b>◆</b> Sentence Transformers <b>◆</b> FAISS <b>◆</b> Ollama
        </div>

        <section className="landing-section" id="how">
          <div className="section-heading">
            <h2>From PDF to cited answer in six steps</h2>
            <p>Only the best-matching passages are sent to the model, which keeps answers grounded and fast.</p>
          </div>
          <div className="pipeline">
            {['Upload', 'Extract', 'Chunk', 'Embed', 'Search', 'Answer'].map((step, index) => (
              <div className="pipeline-step" key={step}><strong>{index + 1}</strong><h3>{step}</h3><p>{['Drag in one or more PDFs.', 'Read text page by page.', 'Split text into overlapping pieces.', 'Turn chunks into vectors.', 'Find the closest passages.', 'Reply with sources.'][index]}</p></div>
            ))}
          </div>
        </section>

        <section className="landing-section" id="features">
          <div className="section-heading">
            <h2>Built for reading, checking and studying</h2>
            <p>Everything you need to trust an answer and learn from it.</p>
          </div>
          <div className="feature-grid">
            <article><h3>Answers with evidence</h3><p>Each reply lists the source PDF, page number and supporting passage.</p><div className="evidence-bars"><i /><i /><i /></div></article>
            <article><h3>Private by design</h3><p>Your files and language model stay on your computer.</p><strong className="private-badge">◉ Nothing leaves your machine</strong></article>
            <article><h3>Compare PDFs</h3><p>Pick two documents and see where they agree and differ.</p><div className="compare-preview"><span>Paper A<br /><b>5-fold validation</b></span><span>Paper B<br /><b>Single split</b></span></div></article>
            <article><h3>Study Mode</h3><p>Turn any PDF into a topic map, flashcards or a quiz.</p><div className="study-preview">What is a page fault?</div></article>
          </div>
        </section>

        <section className="workspace-section" id="workspace">
          <div className="section-heading">
            <span className="panel-eyebrow">Live workspace</span>
            <h2>Upload a PDF and ask your first question</h2>
          </div>
          <main className="layout">
            <UploadPanel onIndexed={() => setHasIndexedDoc(true)} />
            <ConversationPanel hasIndexedDoc={hasIndexedDoc} />
          </main>
          <LabsPanel />
        </section>
      </div>

      <footer className="footer">
        <span>Docuvia, a local AI Document Analyzer</span>
        <span>Local retrieval-augmented generation · vectors never leave your machine</span>
      </footer>
    </div>
  )
}
