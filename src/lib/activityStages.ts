import type { ActivityStage, Experiment, StageOutput } from "../models/Experiment";

export const STAGE_OUTPUT_PATTERNS: Record<StageOutput, RegExp> = {
  conversation: /{{\s*previousStage\.outputs\.conversation\s*}}/,
  submitedSolution: /{{\s*previousStage\.outputs\.submitedSolution\s*}}/,
};

export function getStageOutputSource(stage: ActivityStage, output: StageOutput): string | null {
  return stage.outputSources?.[output] ?? null;
}

export function leiaUsesPreviousStageOutputs(
  leia: {
    spec?: {
      behaviour?: { spec?: { description?: string } };
      rubric?: { spec?: { evaluationPrompt?: string } };
    };
  } | string | null | undefined,
): boolean {
  if (!leia || typeof leia !== "object") return false;
  const templates = [
    leia.spec?.behaviour?.spec?.description ?? "",
    leia.spec?.rubric?.spec?.evaluationPrompt ?? "",
  ];
  return templates.some(
    (text) =>
      STAGE_OUTPUT_PATTERNS.conversation.test(text) ||
      STAGE_OUTPUT_PATTERNS.submitedSolution.test(text),
  );
}

export function stageUsesOutput(experiment: Experiment, stageId: string, output: StageOutput): boolean {
  const pattern = STAGE_OUTPUT_PATTERNS[output];
  return experiment.leias.some(
    (entry) =>
      entry.stageId === stageId &&
      typeof entry.leia === "object" &&
      (pattern.test(entry.leia?.spec?.behaviour?.spec?.description ?? "") ||
        pattern.test(
          (entry.leia as { spec?: { rubric?: { spec?: { evaluationPrompt?: string } } } })
            ?.spec?.rubric?.spec?.evaluationPrompt ?? "",
        )),
  );
}

export function stageHasTranscriptionMode(experiment: Experiment, stageId: string): boolean {
  return experiment.leias.some(
    (entry) => entry.stageId === stageId && entry.configuration?.mode === "transcription",
  );
}

export function getDependentStagesForConversation(
  experiment: Experiment,
  stageId: string | undefined,
): number[] {
  const stages = experiment.stages;
  if (!stages?.length || !stageId) return [];
  const sourceIndex = stages.findIndex(({ id }) => id === stageId);
  if (sourceIndex === -1) return [];

  const dependents: number[] = [];
  stages.forEach((stage, index) => {
    if (index <= sourceIndex) return;
    if (!stageUsesOutput(experiment, stage.id, "conversation")) return;
    if (getStageOutputSource(stage, "conversation") === stageId) {
      dependents.push(index + 1);
    }
  });
  return dependents;
}
