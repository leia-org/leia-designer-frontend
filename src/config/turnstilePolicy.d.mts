export type TurnstileState = "disabled" | "unavailable" | "ready";

export declare function getTurnstilePolicy(
  enabledValue?: string,
  siteKeyValue?: string,
): {
  enabled: boolean;
  siteKey: string | undefined;
  state: TurnstileState;
};
