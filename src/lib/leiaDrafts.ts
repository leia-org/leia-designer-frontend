import api from "./axios";

export interface LeiaDraft<TState = unknown> {
  id: string;
  title: string;
  state: TState;
  createdAt: string;
  updatedAt: string;
}

export interface LeiaDraftPayload<TState> {
  title: string;
  state: TState;
}

const normalizeDraft = <TState,>(draft: LeiaDraft<TState> & { _id?: string }): LeiaDraft<TState> => ({
  ...draft,
  id: draft.id || draft._id || "",
});

export const listLeiaDrafts = async <TState,>(): Promise<LeiaDraft<TState>[]> => {
  const response = await api.get<Array<LeiaDraft<TState> & { _id?: string }>>("/api/v1/leia-drafts");
  return response.data.map(normalizeDraft);
};

export const createLeiaDraft = async <TState,>(
  payload: LeiaDraftPayload<TState>,
): Promise<LeiaDraft<TState>> => {
  const response = await api.post<LeiaDraft<TState> & { _id?: string }>("/api/v1/leia-drafts", payload);
  return normalizeDraft(response.data);
};

export const updateLeiaDraft = async <TState,>(
  id: string,
  payload: LeiaDraftPayload<TState>,
): Promise<LeiaDraft<TState>> => {
  const response = await api.put<LeiaDraft<TState> & { _id?: string }>(`/api/v1/leia-drafts/${id}`, payload);
  return normalizeDraft(response.data);
};

export const deleteLeiaDraft = async (id: string): Promise<void> => {
  await api.delete(`/api/v1/leia-drafts/${id}`);
};
