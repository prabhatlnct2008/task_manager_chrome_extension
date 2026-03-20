import type { Classification, Settings } from '../types'
import { CLASSIFICATION_CONFIG } from '../constants'

interface ClassificationResult {
  classification: Classification
  message: string
  suggestion: string
  usedFallback: boolean
}

interface TaskExtractionResult {
  tasks: string[]
  usedFallback: boolean
}

export async function classifyCheckin(
  activeTaskTitle: string,
  userResponse: string,
  settings: Settings
): Promise<ClassificationResult> {
  if (!settings.apiKey) {
    return fallbackClassify(userResponse)
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const toneInstruction = {
      gentle: 'Be very gentle, warm, and encouraging in your message.',
      balanced: 'Be supportive but direct in your message.',
      firm: 'Be clear and decisive in your message. No fluff.',
    }[settings.tone]

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          {
            role: 'system',
            content: `You are a focus classification assistant for a productivity tool. Given a user's planned task and their self-reported current activity, classify their focus state. ${toneInstruction}

Respond with ONLY valid JSON (no markdown):
{
  "classification": "aligned" | "slightly_off" | "off_track" | "break" | "urgent",
  "message": "Short supportive message (1-2 sentences)",
  "suggestion": "What the user should do next (1 sentence)"
}`,
          },
          {
            role: 'user',
            content: `Planned task: ${activeTaskTitle}\nUser reports: ${userResponse}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 150,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      return fallbackClassify(userResponse)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) {
      return fallbackClassify(userResponse)
    }

    const parsed = JSON.parse(content)
    const validClassifications: Classification[] = ['aligned', 'slightly_off', 'off_track', 'break', 'urgent']
    if (!validClassifications.includes(parsed.classification)) {
      return fallbackClassify(userResponse)
    }

    const cls = parsed.classification as Classification
    return {
      classification: cls,
      message: parsed.message || CLASSIFICATION_CONFIG[cls].defaultMessage,
      suggestion: parsed.suggestion || CLASSIFICATION_CONFIG[cls].defaultSuggestion,
      usedFallback: false,
    }
  } catch {
    return fallbackClassify(userResponse)
  }
}

export async function extractTasksFromPlanText(
  rawText: string,
  settings: Settings
): Promise<TaskExtractionResult> {
  const fallbackTasks = fallbackExtractTasks(rawText)

  if (!settings.apiKey) {
    return {
      tasks: fallbackTasks,
      usedFallback: true,
    }
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          {
            role: 'system',
            content: `You turn messy planning text into a clean flat task list for a productivity app.

Rules:
- Return ONLY valid JSON.
- Output shape:
{
  "tasks": ["task 1", "task 2"]
}
- Keep tasks short and actionable.
- Preserve context.
- If a line is a subtask under a heading/block, prefix it with the parent context.
- Ignore separators and pure time-range lines.
- Do not include duplicate tasks.
- Do not invent work that is not implied by the text.`,
          },
          {
            role: 'user',
            content: rawText,
          },
        ],
        temperature: 0.2,
        max_tokens: 400,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      return {
        tasks: fallbackTasks,
        usedFallback: true,
      }
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) {
      return {
        tasks: fallbackTasks,
        usedFallback: true,
      }
    }

    const parsed = JSON.parse(content)
    const tasks = Array.isArray(parsed.tasks)
      ? parsed.tasks
        .filter((task: unknown): task is string => typeof task === 'string')
        .map((task: string) => task.trim())
        .filter(Boolean)
      : []

    if (tasks.length === 0) {
      return {
        tasks: fallbackTasks,
        usedFallback: true,
      }
    }

    return {
      tasks: dedupeTasks(tasks),
      usedFallback: false,
    }
  } catch {
    return {
      tasks: fallbackTasks,
      usedFallback: true,
    }
  }
}

function fallbackClassify(userResponse: string): ClassificationResult {
  const lower = userResponse.toLowerCase()

  let classification: Classification = 'slightly_off'

  if (
    lower.includes('on task') ||
    lower.includes('working on it') ||
    lower.includes('doing it') ||
    lower.includes('focused') ||
    lower.includes('planned task')
  ) {
    classification = 'aligned'
  } else if (
    lower.includes('distract') ||
    lower.includes('off track') ||
    lower.includes('not working') ||
    lower.includes('browsing') ||
    lower.includes('social media') ||
    lower.includes('youtube')
  ) {
    classification = 'off_track'
  } else if (
    lower.includes('break') ||
    lower.includes('rest') ||
    lower.includes('pause') ||
    lower.includes('lunch') ||
    lower.includes('coffee')
  ) {
    classification = 'break'
  } else if (
    lower.includes('urgent') ||
    lower.includes('emergency') ||
    lower.includes('important') ||
    lower.includes('boss') ||
    lower.includes('client')
  ) {
    classification = 'urgent'
  }

  const config = CLASSIFICATION_CONFIG[classification]
  return {
    classification,
    message: config.defaultMessage,
    suggestion: config.defaultSuggestion,
    usedFallback: true,
  }
}

function fallbackExtractTasks(rawText: string): string[] {
  const lines = rawText.split('\n')
  const tasks: string[] = []
  let currentContext = ''

  for (const originalLine of lines) {
    const trimmed = originalLine.trim()
    if (!trimmed) continue
    if (/^[⸻\-=─━]{3,}$/.test(trimmed)) continue
    if (/^\d{1,2}:\d{2}\s*[–\-—]\s*\d{1,2}:\d{2}$/.test(trimmed)) continue

    const cleaned = trimmed
      .replace(/^\s*(?:→|->)\s*/, '')
      .replace(/^\s*[•*]\s+/, '')
      .replace(/^\s*-\s+/, '')
      .replace(/^\s*\d+[.)]\s+/, '')
      .trim()

    if (!cleaned) continue

    const isBulletLike =
      /^\s*(?:→|->)/.test(trimmed) ||
      /^\s*[•*-]\s+/.test(trimmed) ||
      /^\s*\d+[.)]\s+/.test(trimmed)

    if (isBulletLike) {
      tasks.push(currentContext ? `${currentContext}: ${cleaned}` : cleaned)
      continue
    }

    if (currentContext) {
      tasks.push(cleaned)
    }

    currentContext = cleaned
  }

  if (tasks.length === 0 && currentContext) {
    tasks.push(currentContext)
  }

  return dedupeTasks(tasks)
}

function dedupeTasks(tasks: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const task of tasks) {
    const normalized = task.toLowerCase()
    if (seen.has(normalized)) continue
    seen.add(normalized)
    result.push(task)
  }

  return result
}

export function chipToClassification(chipValue: string): Classification {
  switch (chipValue) {
    case 'on_task':
      return 'aligned'
    case 'distracted':
      return 'off_track'
    case 'urgent':
      return 'urgent'
    case 'break':
      return 'break'
    default:
      return 'slightly_off'
  }
}
