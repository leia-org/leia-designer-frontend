import api from "./axios";

// Wire types for the design-time problem-chat assistant. The model drives the
// editor through frontend tools (apply_problem / get_current_problem), reusing
// the same tool round-trip the workbench chat uses.

export interface ProblemChatTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ProblemChatToolCall {
  callId: string;
  name: string;
  arguments: string;
}

export interface ProblemChatToolResult {
  callId: string;
  output: unknown;
}

export interface ProblemChatResponse {
  message?: string;
  toolCalls?: ProblemChatToolCall[];
  responseId?: string;
}

export interface UploadedFile {
  fileId: string;
  filename: string;
  bytes: number;
}

/** Open a problem-chat session bound to the instructor's BYOK model + key. */
export async function openProblemChat(modelName: string, apiKeyId: string): Promise<string> {
  const { data } = await api.post("/api/v1/runner/problem-chat/session", {
    modelName,
    apiKeyId,
  });
  return data.chatId as string;
}

/** Attach a PDF (past exercise sheet) to the session. */
export async function uploadProblemChatFile(chatId: string, file: File): Promise<UploadedFile> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post(
    `/api/v1/runner/problem-chat/${chatId}/files`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data as UploadedFile;
}

/** Send a chat turn (or a tool-result continuation). */
export async function sendProblemChatMessage(
  chatId: string,
  body: {
    message?: string;
    tools?: ProblemChatTool[];
    toolResults?: ProblemChatToolResult[];
    fileIds?: string[];
  },
): Promise<ProblemChatResponse> {
  const { data } = await api.post(
    `/api/v1/runner/problem-chat/${chatId}/messages`,
    body,
  );
  return data as ProblemChatResponse;
}
