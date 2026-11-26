// Tiny, dependency-free Markdown renderer for model output.
// Handles headings, bullet/numbered lists, bold, italics, inline code and
// paragraphs. It builds React elements (no innerHTML), so it is XSS-safe.

const INLINE_PATTERN = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\s][^*]*\*)/g

function renderInline(text, keyPrefix) {
  return text.split(INLINE_PATTERN).filter(Boolean).map((part, index) => {
    const key = `${keyPrefix}-${index}`
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      return <strong key={key}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={key}>{part.slice(1, -1)}</code>
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={key}>{part.slice(1, -1)}</em>
    }
    return part
  })
}

// A line like "QUICK MAP:" or "**Removed content**" on its own acts as a heading.
function asHeading(line) {
  const hashes = line.match(/^(#{1,6})\s+(.*)$/)
  if (hashes) return { level: Math.min(hashes[1].length, 4), text: hashes[2].replace(/[:#\s]+$/, '') }
  const bold = line.match(/^\*\*([^*]+)\*\*:?$/)
  if (bold) return { level: 3, text: bold[1].replace(/:$/, '') }
  const numberedCaps = line.match(/^(?:\d+[.)]\s*)?([A-Z][A-Z &/-]{3,}):?$/)
  if (numberedCaps) return { level: 3, text: numberedCaps[1] }
  return null
}

export default function Markdown({ text, className = '' }) {
  const lines = (text ?? '').replace(/\r\n/g, '\n').split('\n')
  const blocks = []
  let list = null
  let paragraph = []

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: 'p', text: paragraph.join(' ') })
    paragraph = []
  }
  const flushList = () => {
    if (list) blocks.push(list)
    list = null
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      flushParagraph()
      flushList()
      continue
    }

    const heading = asHeading(line)
    if (heading) {
      flushParagraph()
      flushList()
      blocks.push({ type: 'h', ...heading })
      continue
    }

    const bullet = line.match(/^[-*•]\s+(.*)$/)
    const numbered = line.match(/^(\d+)[.)]\s+(.*)$/)
    if (bullet || numbered) {
      flushParagraph()
      const type = bullet ? 'ul' : 'ol'
      if (!list || list.type !== type) {
        flushList()
        list = { type, items: [] }
      }
      list.items.push(bullet ? bullet[1] : numbered[2])
      continue
    }

    // An indented continuation line belongs to the previous list item.
    if (list && /^\s{2,}/.test(rawLine)) {
      list.items[list.items.length - 1] += ` ${line}`
      continue
    }

    flushList()
    paragraph.push(line)
  }
  flushParagraph()
  flushList()

  return (
    <div className={`markdown ${className}`}>
      {blocks.map((block, index) => {
        const key = `b${index}`
        if (block.type === 'h') {
          const Tag = `h${block.level + 1}`
          return <Tag key={key}>{renderInline(block.text, key)}</Tag>
        }
        if (block.type === 'ul' || block.type === 'ol') {
          const Tag = block.type
          return (
            <Tag key={key}>
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-${itemIndex}`}>{renderInline(item, `${key}-${itemIndex}`)}</li>
              ))}
            </Tag>
          )
        }
        return <p key={key}>{renderInline(block.text, key)}</p>
      })}
    </div>
  )
}
