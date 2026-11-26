import type { ActivityStage, Experiment, StageOutput } from "../models/Experiment";

const ANY_PREVIOUS_STAGE_REF = /{{\s*previousStage\b([^{}]*)}}/g;
const ANY_PREVIOUS_STAGE_REF_TEST = /{{\s*previousStage\b[^{}]*}}/;
export const PREVIOUS_STAGE_TEST_DISABLED_REASON =
  "Cannot test in Designer because this LEIA references previousStage. Add it to a staged activity and test it in Workbench.";
const STAGE_OUTPUT_KEYS: ReadonlyArray<StageOutput> = [
  "conversation",
  "submitedSolution",
  "problem",
];
const PREVIOUS_STAGE_PROBLEM_FIELDS = [
  "description",
  "details",
  "personaBackground",
  "solution",
  "initialSolution",
  "solutionFormat",
  "evaluationPrompt",
  "process",
] as const;
const SUPPORTED_OUTPUTS = new Map<string, StageOutput>([
  [".outputs.conversation", "conversation"],
  [".outputs.submitedSolution", "submitedSolution"],
  ...PREVIOUS_STAGE_PROBLEM_FIELDS.map(
    (field): [string, StageOutput] => [`.leia.problem.${field}`, "problem"],
  ),
]);
const OUTPUT_LABELS: Record<StageOutput, string> = {
  conversation: "conversation",
  submitedSolution: "submitted solution",
  problem: "problem",
};

export const STAGE_OUTPUT_PATTERNS: Record<StageOutput, RegExp> = {
  conversation: /{{\s*previousStage\.outputs\.conversation\s*}}/,
  submitedSolution: /{{\s*previousStage\.outputs\.submitedSolution\s*}}/,
  problem: /{{\s*previousStage\.leia\.problem\.(?:description|details|personaBackground|solution|initialSolution|solutionFormat|evaluationPrompt|process)\s*}}/,
};

export function getStageOutputSource(stage: ActivityStage, output: StageOutput): string | null {
  return stage.outputSources?.[output] ?? null;
}

type PreviousStageInspectableLeia =
  | {
      spec?: {
        behaviour?: { spec?: { description?: string } | null } | null;
        rubric?: { spec?: { evaluationPrompt?: string } | null } | null;
      } | null;
    }
  | string
  | null
  | undefined;

function getLeiaTemplates(leia: PreviousStageInspectableLeia): string[] {
  if (!leia || typeof leia !== "object") return [];
  return [
    leia.spec?.behaviour?.spec?.description ?? "",
    leia.spec?.rubric?.spec?.evaluationPrompt ?? "",
  ];
}

export function leiaHasPreviousStageReferences(
  leia: PreviousStageInspectableLeia,
): boolean {
  return getLeiaTemplates(leia).some((text) =>
    ANY_PREVIOUS_STAGE_REF_TEST.test(text),
  );
}

export function leiaUsesPreviousStageOutputs(
  leia: PreviousStageInspectableLeia,
): boolean {
  return getLeiaTemplates(leia).some(
    (text) =>
      STAGE_OUTPUT_PATTERNS.conversation.test(text) ||
      STAGE_OUTPUT_PATTERNS.submitedSolution.test(text) ||
      STAGE_OUTPUT_PATTERNS.problem.test(text),
  );
}

export function stageUsesOutput(experiment: Experiment, stageId: string, output: StageOutput): boolean {
  const pattern = STAGE_OUTPUT_PATTERNS[output];
  return experiment.leias.some(
    (entry) =>
      entry.stageId === stageId &&
      getLeiaTemplates(entry.leia).some((template) => pattern.test(template)),
  );
}

export function hasTranscriptionMessages(
  entry: { configuration?: { data?: Record<string, unknown> } } | null | undefined,
): boolean {
  const messages = entry?.configuration?.data?.messages;
  return (
    Array.isArray(messages) &&
    messages.some(
      (message) =>
        typeof (message as { text?: unknown } | null)?.text === "string" &&
        ((message as { text: string }).text).trim().length > 0,
    )
  );
}

export function stageHasTranscriptionMode(experiment: Experiment, stageId: string): boolean {
  return experiment.leias.some(
    (entry) => entry.stageId === stageId && entry.configuration?.mode === "transcription",
  );
}

export function stageHasEmptyTranscription(experiment: Experiment, stageId: string): boolean {
  return experiment.leias.some(
    (entry) =>
      entry.stageId === stageId &&
      entry.configuration?.mode === "transcription" &&
      !hasTranscriptionMessages(entry),
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

export function getActivityReplicationBlocker(experiment: Experiment): string | null {
  const leias = experiment.leias ?? [];
  const stages = experiment.stages;

  if (!stages) {
    if (!leias.length) {
      return "Add at least one LEIA before replicating";
    }
    if (experiment.orchestration?.mode === "multi") {
      if (leias.length < 2) {
        return "MultiLEIA requires at least two LEIAs";
      }
      if (leias.some((entry) => entry.configuration?.mode === "transcription")) {
        return "MultiLEIA currently supports standard text mode only";
      }
    }
    return null;
  }

  const positions = new Map(stages.map(({ id }, index) => [id, index]));
  if (!stages.length || positions.size !== stages.length) {
    return "An activity requires at least one stage and unique stage IDs";
  }
  if (leias.some((entry) => !entry.stageId || !positions.has(entry.stageId))) {
    return "Invalid activity stages";
  }

  for (const [index, stage] of stages.entries()) {
    const number = index + 1;
    const entries = leias.filter((entry) => entry.stageId === stage.id);
    if (!entries.length) {
      return `Stage ${number} requires at least one LEIA`;
    }
    if (entries.some((entry) => !entry.leia)) {
      return `Stage ${number} requires valid LEIAs`;
    }

    const referencedOutputs = new Set<StageOutput>();
    for (const entry of entries) {
      const entryRefs = new Set<StageOutput>();
      for (const template of getLeiaTemplates(entry.leia)) {
        for (const match of template.matchAll(ANY_PREVIOUS_STAGE_REF)) {
          const output = SUPPORTED_OUTPUTS.get(match[1].trimEnd());
          if (!output) {
            return `Stage ${number} contains an unsupported previous stage output`;
          }
          entryRefs.add(output);
        }
      }
      if (entryRefs.size > 0 && entry.configuration?.mode === "transcription") {
        return `Stage ${number} cannot use transcription mode because it uses outputs from an earlier stage`;
      }
      for (const output of entryRefs) {
        referencedOutputs.add(output);
      }
    }

    if (referencedOutputs.size > 0 && index === 0) {
      return "The first stage cannot use previous stage references";
    }

    for (const output of STAGE_OUTPUT_KEYS) {
      const sourceId = getStageOutputSource(stage, output);
      if (sourceId) {
        const sourcePosition = positions.get(sourceId);
        if (sourcePosition === undefined || !(sourcePosition < index)) {
          return `The source of stage ${number} must be an earlier stage`;
        }
      }
      if (referencedOutputs.has(output) && !sourceId) {
        return `Select an earlier stage for ${OUTPUT_LABELS[output]} in stage ${number}`;
      }
    }

    const conversationSourceId = getStageOutputSource(stage, "conversation");
    if (referencedOutputs.has("conversation") && conversationSourceId) {
      const sourceIndex = positions.get(conversationSourceId);
      if (sourceIndex !== undefined && stageHasEmptyTranscription(experiment, conversationSourceId)) {
        return `Stage ${sourceIndex + 1} requires non-empty transcription chat messages because stage ${number} uses its conversation`;
      }
    }

    if (stage.orchestration?.mode === "multi") {
      if (entries.length < 2) {
        return `Stage ${number} requires at least two LEIAs for MultiLEIA`;
      }
      if (entries.some((entry) => entry.configuration?.mode === "transcription")) {
        return "MultiLEIA currently supports standard text mode only";
      }
    }
  }

  return null;
}
