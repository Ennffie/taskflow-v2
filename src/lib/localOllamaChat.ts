const OLLAMA_URL = 'http://localhost:11434/api/generate';

export type LocalModelId = 'gemma4:e4b' | 'qwen3:8b';

export async function generateLocalChatReply(model: LocalModelId, prompt: string) {
  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: {
        num_predict: 220,
        temperature: 0.4,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Local model error: ${response.status}`);
  }

  const data = await response.json();
  return (data.response ?? '').trim();
}

export function buildLocalCoachPrompt(input: string, context: {
  currentUserName: string;
  tasks: Array<{ title: string; status: string; due_date: string | null; assignees: string[]; progress?: number | null; }>;
}) {
  const tasksSummary = context.tasks
    .slice(0, 24)
    .map((task) => `- ${task.title} | status=${task.status} | due=${task.due_date || 'null'} | assignees=${task.assignees.join(', ') || 'none'} | progress=${task.progress ?? 0}`)
    .join('\n');

  return `You are Silly, a warm Cantonese task coach for ${context.currentUserName}.
Reply in Traditional Chinese Cantonese.
Be concise, practical, and natural.
If the user asks about tasks, use the task list below.
If uncertain, say so briefly instead of inventing facts.
Do not use markdown tables.

Current task list:
${tasksSummary || '- no tasks loaded'}

User message:
${input}`;
}
