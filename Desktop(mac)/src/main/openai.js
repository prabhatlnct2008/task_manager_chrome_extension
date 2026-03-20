const db = require('./db');

const DEFAULT_MODEL = 'gpt-4o';
const TIMEOUT_MS = 15000;

function getConfig() {
  const apiKey = db.getSetting('openai_api_key') || '';
  const model = db.getSetting('openai_model') || DEFAULT_MODEL;
  return { apiKey, model };
}

async function callChatCompletion({ messages, responseFormat, maxTokens = 2048 }) {
  const { apiKey, model } = getConfig();
  if (!apiKey) {
    throw new Error('No OpenAI API key configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const body = {
      model,
      messages,
      max_tokens: maxTokens
    };

    if (responseFormat) {
      body.response_format = responseFormat;
    }

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      throw new Error(`OpenAI API error ${resp.status}: ${errBody}`);
    }

    const data = await resp.json();
    return data.choices[0].message.content;
  } finally {
    clearTimeout(timeout);
  }
}

async function testApiKey(apiKey) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const resp = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: controller.signal
    });

    if (resp.ok) return { valid: true };
    const body = await resp.text();
    return { valid: false, error: `HTTP ${resp.status}: ${body}` };
  } catch (err) {
    return { valid: false, error: err.message };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { callChatCompletion, testApiKey, getConfig, DEFAULT_MODEL };
