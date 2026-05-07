export type LocalModelId = 'qwen3:8b';

export async function generateLocalChatReply(
  bridgeUrl: string,
  model: LocalModelId,
  input: string,
  sessionId: string,
  context: {
    today: string;
    tasks: Array<{ title: string; status: string; due_date: string | null; assignees: string[]; progress?: number | null }>;
    profiles: Array<{ name: string }>;
  },
) {
  const response = await fetch(`${bridgeUrl}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: input,
      session_id: `local-${sessionId}`,
      model,
      context,
    }),
  });

  if (!response.ok) {
    throw new Error(`Local model error: ${response.status}`);
  }

  const data = await response.json();
  return (data.reply ?? '').trim();
}
