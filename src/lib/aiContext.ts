import { AIWorkspaceRecord, buildWorkspaceContext } from "./aiWorkspaceStore";

export interface ServerContextSession {
  id: string;
  ip: string;
  user: string;
  note?: string;
}

export interface ContextSection {
  title: string;
  content: string | null | undefined;
}

export function buildContextSections(sections: ContextSection[]): string {
  return sections
    .map((section) => {
      const body = section.content?.trim();
      if (!body) {
        return "";
      }

      return `【${section.title}】\n${body}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

export function buildServerContextSummary(
  sessions: ServerContextSession[],
  selectedSessionIds: string[],
  currentSession?: ServerContextSession | null,
): string {
  if (sessions.length === 0) {
    if (!currentSession) {
      return "当前没有可用的服务器会话。";
    }

    return formatSessionSummary(currentSession, selectedSessionIds.includes(currentSession.id), true);
  }

  const selectedSet = new Set(selectedSessionIds);
  return sessions
    .map((session) =>
      formatSessionSummary(
        session,
        selectedSet.has(session.id),
        currentSession?.id === session.id,
      ),
    )
    .join("\n");
}

function formatSessionSummary(
  session: ServerContextSession,
  isSelected: boolean,
  isCurrent: boolean,
): string {
  const statusTags = [isSelected ? "已选中" : "", isCurrent ? "当前会话" : ""].filter(Boolean);
  const suffix = statusTags.length > 0 ? ` [${statusTags.join(" / ")}]` : "";
  const note = session.note?.trim() ? ` 备注: ${session.note.trim()}` : "";
  return `- ${session.user}@${session.ip} (ID: ${session.id})${suffix}${note}`;
}

export function buildWorkspacePromptContext(
  manualContext: string,
  records: AIWorkspaceRecord[],
): string {
  return buildWorkspaceContext(manualContext, records);
}
