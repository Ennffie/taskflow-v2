export type LocalModelId = 'llama3:8b';

export type LocalTaskFact = {
  title: string;
  status: string;
  due_date: string | null;
  assignees: string[];
  progress?: number | null;
  is_focus?: boolean;
  priority?: string;
};

export type LocalDecisionContext = {
  today: string;
  currentUserName: string;
  summary: {
    openMainCount: number;
    dueTodayCount: number;
    overdueCount: number;
    myOpenCount: number;
  };
  topPriority: Array<{
    title: string;
    due_date: string | null;
    assignees: string[];
    progress: number;
    reason: string;
  }>;
  tasks: LocalTaskFact[];
  profiles: Array<{ name: string }>;
};

export async function generateLocalChatReply(
  bridgeUrl: string,
  model: LocalModelId,
  input: string,
  sessionId: string,
  context: LocalDecisionContext,
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
