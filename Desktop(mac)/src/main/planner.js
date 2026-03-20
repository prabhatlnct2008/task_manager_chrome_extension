const openai = require('./openai');
const db = require('./db');

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// --- GPT-4o extraction ---

async function extractWithGpt(rawText) {
  const prompt = `Extract clean, actionable tasks from the following messy planning text.

Rules:
- Each task should be a clear, concise action item
- Preserve context: if tasks appear under a heading or project name, include it as sourceContext
- For schedule blocks with times, include the time in the task title
- Ignore empty lines, decorative text, or non-actionable content
- Return valid JSON only

Input text:
"""
${rawText}
"""

Return JSON in this exact format:
{
  "tasks": [
    {
      "title": "the actionable task description",
      "sourceContext": "parent heading or project name if any, empty string otherwise"
    }
  ]
}`;

  const content = await openai.callChatCompletion({
    messages: [{ role: 'user', content: prompt }],
    responseFormat: { type: 'json_object' }
  });

  const parsed = JSON.parse(content);
  if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
    throw new Error('Malformed GPT response: missing tasks array');
  }

  return parsed.tasks.map(t => ({
    title: String(t.title || '').trim(),
    sourceContext: String(t.sourceContext || '').trim(),
    selected: true
  })).filter(t => t.title.length > 0);
}

// --- Local fallback parser ---

function extractLocally(rawText) {
  const lines = rawText.split('\n');
  const tasks = [];
  let currentContext = '';

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // Detect headings (markdown # or text ending with :)
    if (/^#{1,3}\s+/.test(line)) {
      currentContext = line.replace(/^#{1,3}\s+/, '').replace(/:$/, '').trim();
      continue;
    }
    if (/^[A-Z][^.!?]*:$/.test(line)) {
      currentContext = line.replace(/:$/, '').trim();
      continue;
    }

    // Detect time-based schedule lines like "9:00 - 10:00 — Deep work"
    const timeMatch = line.match(/^(\d{1,2}[:.]\d{2})\s*[-–—]\s*(\d{1,2}[:.]\d{2})\s*[-–—:]\s*(.+)/);
    if (timeMatch) {
      const timeRange = `${timeMatch[1]}-${timeMatch[2]}`;
      const desc = timeMatch[3].trim();
      if (desc) {
        tasks.push({
          title: `${timeRange}: ${desc}`,
          sourceContext: currentContext,
          selected: true
        });
      }
      continue;
    }

    // Detect bullet points, numbered lists, checkbox items
    const bulletMatch = line.match(/^(?:[-*+•]|\d+[.)]\s*|\[[ x]]\s*)(.+)/i);
    if (bulletMatch) {
      const text = bulletMatch[1].trim();
      if (text.length > 2) {
        tasks.push({
          title: text,
          sourceContext: currentContext,
          selected: true
        });
      }
      continue;
    }

    // Plain text lines that look actionable (contain a verb-like start or are substantial)
    if (line.length > 5 && !line.match(/^[=\-_]{3,}$/)) {
      tasks.push({
        title: line,
        sourceContext: currentContext,
        selected: true
      });
    }
  }

  return tasks;
}

// --- Main parse function ---

async function parsePlannerText(rawText) {
  const { apiKey } = openai.getConfig();
  let tasks;
  let method;

  if (apiKey) {
    try {
      tasks = await extractWithGpt(rawText);
      method = 'gpt';
    } catch (err) {
      console.error('GPT extraction failed, falling back to local:', err.message);
      tasks = extractLocally(rawText);
      method = 'local_fallback';
    }
  } else {
    tasks = extractLocally(rawText);
    method = 'local';
  }

  // Save to planner history
  db.savePlannerHistory({
    id: generateId(),
    rawInput: rawText,
    parsedOutput: JSON.stringify(tasks),
    method,
    createdAt: Date.now()
  });

  return { tasks, method };
}

module.exports = { parsePlannerText, extractLocally };
