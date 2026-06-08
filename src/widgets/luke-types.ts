// Local mirror of @leia-org/luke-client's FrontendTool. The designer hosts the
// same widgets as the workbench (for the activity "try"), but only needs the
// tool shape — not the luke client runtime — so we declare it here instead of
// depending on the package.
export interface FrontendTool {
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<unknown> | unknown;
}
