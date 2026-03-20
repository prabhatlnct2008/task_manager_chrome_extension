import type { ScheduleBlock, ScheduleChecklistItem } from '../types'
import { generateId } from './storage'

/**
 * Parses a pasted schedule into structured blocks.
 *
 * Recognizes:
 *   - Time ranges: "06:00–07:30", "6:00-7:30", "06:00 – 07:30"
 *   - Separators: lines that are only "⸻", "---", "===", blank lines between blocks
 *   - Title: the first non-time, non-separator line after a time range
 *   - Arrow notes: "→ ..." or "-> ..."
 *   - Bullet items: "• ...", "- ...", "* ..."
 *   - Numbered items: "1. ...", "2. ..."
 *   - Emphasis markers: lines starting with emoji like "👉"
 *   - Parenthetical tags: "(STRICT 90 min)", "(💰)" extracted from title or notes
 */

// Matches time ranges like "06:00–07:30", "6:00-7:30", "06:00 – 07:30"
const TIME_RANGE_RE = /^(\d{1,2}:\d{2})\s*[–\-—]\s*(\d{1,2}:\d{2})\s*$/

// Matches separator lines
const SEPARATOR_RE = /^[⸻\-=─━]{3,}\s*$/

// Matches bullet/list items: "• ...", "- ...", "* ..."
const BULLET_RE = /^\s*[•\-*]\s+(.+)$/

// Matches numbered items: "1. ...", "2. ..."
const NUMBERED_RE = /^\s*\d+[.)]\s+(.+)$/

// Matches arrow notes: "→ ..." or "-> ..."
const ARROW_RE = /^\s*(?:→|->)\s+(.+)$/

// Matches emphasis lines starting with emoji
const EMPHASIS_RE = /^\s*(?:👉|⚡|🔥|💡|⚠️|✅|❌|🚫|💰|🎯)\s*(.*)$/

// Extracts parenthetical tags like (STRICT 90 min) or (💰)
const TAG_RE = /\(([^)]+)\)/g

function extractTags(text: string): { cleaned: string; tags: string[] } {
  const tags: string[] = []
  const cleaned = text.replace(TAG_RE, (_match, content: string) => {
    tags.push(content.trim())
    return ''
  }).trim()
  return { cleaned, tags }
}

function isBlankOrSeparator(line: string): boolean {
  const trimmed = line.trim()
  return trimmed === '' || SEPARATOR_RE.test(trimmed)
}

export function parseSchedule(raw: string): ScheduleBlock[] {
  const lines = raw.split('\n')
  const blocks: ScheduleBlock[] = []
  let current: ScheduleBlock | null = null

  function pushCurrent() {
    if (current) {
      // Trim trailing empty notes
      while (current.notes.length > 0 && current.notes[current.notes.length - 1].trim() === '') {
        current.notes.pop()
      }
      blocks.push(current)
    }
  }

  function makeBlock(startTime: string | null = null, endTime: string | null = null): ScheduleBlock {
    return {
      id: generateId(),
      startTime,
      endTime,
      title: '',
      notes: [],
      items: [],
      tags: [],
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Skip pure separator lines
    if (SEPARATOR_RE.test(trimmed)) {
      continue
    }

    // Time range → start a new block
    const timeMatch = trimmed.match(TIME_RANGE_RE)
    if (timeMatch) {
      pushCurrent()
      current = makeBlock(timeMatch[1], timeMatch[2])
      continue
    }

    // Skip blank lines between blocks (but not inside blocks)
    if (trimmed === '') {
      if (!current || (!current.title && current.items.length === 0 && current.notes.length === 0)) {
        continue
      }
      // Blank line inside a block — could be visual spacing, treat as note separator
      current.notes.push('')
      continue
    }

    // If we don't have a current block yet, start one without time
    if (!current) {
      current = makeBlock()
    }

    // Arrow note
    const arrowMatch = trimmed.match(ARROW_RE)
    if (arrowMatch) {
      current.notes.push(arrowMatch[1])
      continue
    }

    // Emphasis line
    const emphasisMatch = trimmed.match(EMPHASIS_RE)
    if (emphasisMatch) {
      const text = emphasisMatch[1] || trimmed
      current.notes.push(text)
      continue
    }

    // Bullet item
    const bulletMatch = trimmed.match(BULLET_RE)
    if (bulletMatch) {
      const { cleaned, tags } = extractTags(bulletMatch[1])
      current.items.push({ text: cleaned, done: false })
      current.tags.push(...tags)
      continue
    }

    // Numbered item
    const numberedMatch = trimmed.match(NUMBERED_RE)
    if (numberedMatch) {
      const { cleaned, tags } = extractTags(numberedMatch[1])
      current.items.push({ text: cleaned, done: false })
      current.tags.push(...tags)
      continue
    }

    // First non-metadata line becomes the title
    if (!current.title) {
      const { cleaned, tags } = extractTags(trimmed)
      current.title = cleaned
      current.tags.push(...tags)
      continue
    }

    // Everything else is a note
    current.notes.push(trimmed)
  }

  pushCurrent()

  // Deduplicate tags per block
  for (const block of blocks) {
    block.tags = [...new Set(block.tags)]
  }

  return blocks
}
