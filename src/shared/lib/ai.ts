import type { Classification, Settings } from '../types'
import { CLASSIFICATION_CONFIG } from '../constants'

interface ClassificationResult {
  classification: Classification
  message: string
  suggestion: string
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
