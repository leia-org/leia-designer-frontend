import api from "../lib/axios";

export type AvatarTarget = "leia" | "problem" | "persona";

const getAvatarRegenerationEndpoint = (
  target: AvatarTarget,
  targetId: string,
) => {
  if (target === "leia") {
    return `/api/v1/leias/${targetId}/avatar/regenerate`;
  }

  return `/api/v1/${target}s/${targetId}/avatar/regenerate`;
};

export const regenerateAvatar = async (
  target: AvatarTarget,
  targetId: string,
) => {
  const response = await api.post(getAvatarRegenerationEndpoint(target, targetId));
  return response.data;
};
