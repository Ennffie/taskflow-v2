export type ParsedTaskDraft = {
  title: string;
  assignee: string | null;
  deadline_date: string | null;
  deadline_time: string | null;
  reminder_hint: string | null;
  next_action: string;
  confidence: 'high' | 'medium' | 'low';
};

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const MODEL = 'gemma4:e4b';
const TODAY = '2026-05-01';
const TEAM_MEMBERS = ['Enfield', 'Bro', 'Pamela', 'Alice', 'Claire', 'Silvie', 'Shani', 'Benne'];

function extractJson(text: string): ParsedTaskDraft {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as ParsedTaskDraft;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`No JSON found in model output: ${trimmed.slice(0, 200)}`);
    return JSON.parse(match[0]) as ParsedTaskDraft;
  }
}

function buildPrompt(content: string) {
  return `You are a task-extraction engine.
Today date is ${TODAY}.
Resolve relative dates like tomorrow / next Friday against that date.
Known people who may be assignees: ${TEAM_MEMBERS.join(', ')}.
Extract a single best task draft from the pasted content.
Return JSON only. No markdown. No explanation.

Rules:
- Keep language as found in source when possible.
- If assignee is unknown, use null.
- If deadline date is unknown, use null.
- If deadline time is unknown, use null.
- If reminder is unknown, use null.
- If content is not clearly a task, still make the best possible draft and lower confidence.
- deadline_date format: YYYY-MM-DD or null
- deadline_time format: HHMM or null
- confidence: one of high, medium, low
- next_action should be a short plain string.

JSON schema:
{
  "title": string,
  "assignee": string | null,
  "deadline_date": string | null,
  "deadline_time": string | null,
  "reminder_hint": string | null,
  "next_action": string,
  "confidence": "high" | "medium" | "low"
}

Pasted content:
---
${content}
---`;
}

export async function parseTaskWithGemma(content: string): Promise<ParsedTaskDraft> {
  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      prompt: buildPrompt(content),
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status}`);
  }

  const data = await response.json();
  return extractJson(data.response ?? '');
}
