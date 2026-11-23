import { z } from "zod";
import type { Behaviour, Persona, Problem } from "../models/Leia";
import type { RubricDefinition, RubricSnapshot } from "../models/Rubric";
import type { User } from "../models/User";
import { missingBehaviourReferences, templateReferences } from "./chatBehaviours.mjs";
import { generateLeia } from "./leia";
import { normalizeProcess, normalizeProcessFields } from "./process";
import { validateAgainstRubricSchema, type JsonSchema } from "./rubricSchema";
import { validateRubricSemantics } from "./rubrics";

export type LeiaConfig = { persona: Persona | null; problem: Problem | null; behaviour: Behaviour | null };
export type Component = keyof LeiaConfig;
export type LeiaCustomizations = Partial<Record<Component, { name: string; version?: string }>> & {
  leia: { name: string; version?: string };
};

export interface CreatorDraft {
  config: LeiaConfig;
  customizations: LeiaCustomizations;
  nameManuallyEdited: boolean;
  rubricDraft: RubricSnapshot | null;
  rubricEnabled: boolean;
}

const components = ["problem", "behaviour", "persona"] as const;
const text = z.string();
const nonempty = text.trim().min(1);
const process = z.array(z.enum(["requirements-elicitation", "game", "other"]));
const specObject = z.record(z.string(), z.unknown());
const specs = {
  problem: z.strictObject({
    description: nonempty, personaBackground: text, details: text, solution: text,
    initialSolution: text.optional(), solutionFormat: z.enum(["text", "mermaid", "yaml", "markdown", "html", "json", "xml"]).optional(),
    evaluationPrompt: text.optional(), process: process.optional(),
    extends: specObject.optional(), overrides: specObject.optional(), constrainedTo: specObject.optional(),
    widgets: z.array(z.strictObject({
      widgetType: nonempty, slot: z.enum(["left", "right", "main"]).optional(), params: specObject.optional(),
      tools: z.array(z.strictObject({ name: nonempty, enabled: z.boolean().optional(), usage: text.optional() })).optional(),
    })).optional(),
  }),
  behaviour: z.strictObject({ description: nonempty, role: nonempty, process: process.optional(), tooltip: text.optional() }),
  persona: z.strictObject({
    firstName: nonempty, description: nonempty, fullName: text.optional(), personality: text.optional(),
    subjectPronoum: text.optional(), objectPronoum: text.optional(), possesivePronoum: text.optional(), possesiveAdjective: text.optional(),
  }),
};

const commandTargets = {
  apply_problem: "problem", edit_problem: "problem", use_problem: "problem",
  apply_behaviour: "behaviour", edit_behaviour: "behaviour", use_behaviour: "behaviour",
  apply_persona: "persona", edit_persona: "persona", use_persona: "persona",
  apply_rubric: "rubric",
  set_leia_name: "leia",
} as const;
type CommandName = keyof typeof commandTargets;
export type DraftTarget = Component | "rubric" | "leia";

export function commandTarget(name: string): DraftTarget | undefined {
  return Object.hasOwn(commandTargets, name) ? commandTargets[name as CommandName] : undefined;
}

type Resource = NonNullable<LeiaConfig[Component]>;
export type CreatorLibrary = { problem: Problem[]; behaviour: Behaviour[]; persona: Persona[] };
export type CommandContext = { user: User; canEditBehaviour: boolean; library: CreatorLibrary; rubricSchema?: JsonSchema | null };
type CommandAction = "Create" | "Edit" | "Replace" | "Reuse" | "Set title";
type Result = { draft: CreatorDraft; action: CommandAction } | { error: string; missingReferences?: string[] };

function sameProcess(left: unknown, right: unknown): boolean {
  const actual = new Set(normalizeProcess(left));
  const expected = new Set(normalizeProcess(right));
  return actual.size === expected.size && [...actual].every(tag => expected.has(tag));
}

export function processConflict({ config: { behaviour, problem } }: CreatorDraft): boolean {
  return Boolean(behaviour && problem && !sameProcess(behaviour.spec.process, problem.spec.process));
}

export function suggestedTitle(config: LeiaConfig): string {
  const name = config.problem?.metadata?.name || config.persona?.metadata?.name || "";
  return name.startsWith("ai-generated-") ? "" : name.replace(/[-_]+/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
}

function setComponent(draft: CreatorDraft, component: Component, resource: Resource, keepCustomization: boolean): CreatorDraft {
  const customizations = { ...draft.customizations };
  if (!keepCustomization) delete customizations[component];
  return { ...draft, config: { ...draft.config, [component]: resource }, customizations };
}

function availableCopyName(name: string, library: Resource[]): string {
  const used = new Set(library.map(resource => resource.metadata.name));
  let candidate = `${name}-copy`;
  for (let index = 2; used.has(candidate); index++) candidate = `${name}-copy-${index}`;
  return candidate;
}

function setTitle(draft: CreatorDraft, name: string): CreatorDraft {
  return { ...draft, customizations: { ...draft.customizations, leia: { ...draft.customizations.leia, name } } };
}

function referencesIn(value: unknown): string[] {
  if (typeof value === "string") return templateReferences(value);
  return value && typeof value === "object" ? Object.values(value).flatMap(referencesIn) : [];
}

function normalizeSpec(component: Component, spec: Record<string, unknown>, draft: CreatorDraft) {
  if (component === "problem") {
    return normalizeProcessFields({ ...spec, process: spec.process ?? [], extends: spec.extends ?? {}, overrides: spec.overrides ?? {}, constrainedTo: spec.constrainedTo ?? {} });
  }
  if (component === "behaviour") {
    return { ...spec, process: normalizeProcess(spec.process ?? draft.config.problem?.spec.process) };
  }
  return spec;
}

// Execute a chat command against a working copy. Only the review button can commit it.
export function stageCreatorCommand(
  draft: CreatorDraft,
  tool: string,
  args: Record<string, unknown>,
  context: CommandContext,
): Result {
  const component = commandTarget(tool);
  if (!component) return { error: `Unknown command ${tool}.` };
  if (component === "leia") {
    const parsed = z.strictObject({ name: nonempty }).safeParse(args);
    if (!parsed.success) return { error: "Provide a title." };
    return { draft: setTitle(draft, parsed.data.name), action: "Set title" };
  }
  if (component === "rubric") {
    if (!draft.rubricEnabled) return { error: "The instructor must enable a rubric before proposing one." };
    if (!context.rubricSchema) return { error: "Rubric schema is not available." };
    const rubric = args as unknown as RubricDefinition;
    const error = validateAgainstRubricSchema(rubric, context.rubricSchema) ?? validateRubricSemantics(rubric);
    if (error) return { error };
    const previous = draft.rubricDraft;
    const action = previous ? "Replace" : "Create";
    if (previous?.metadata.name === rubric.metadata.name && JSON.stringify(previous.spec) === JSON.stringify(rubric.spec)) {
      return { draft, action };
    }
    return { draft: { ...draft, rubricDraft: rubric }, action };
  }

  const selected = draft.config[component];
  if (tool.startsWith("use_")) {
    const found = context.library[component].find(resource => resource.id === args.id);
    if (!found) return { error: `Choose an available ${component} from the library.` };
    if (component === "behaviour" && found.edited && !context.canEditBehaviour) {
      return { error: "Only advanced users and administrators can reuse authored Behaviour drafts." };
    }
    return { draft: selected === found ? draft : setComponent(draft, component, found, false), action: "Reuse" };
  }

  if (component === "behaviour" && !context.canEditBehaviour) {
    return { error: "Only advanced users and administrators can author Behaviours." };
  }

  const editing = tool.startsWith("edit_");
  let spec: Record<string, unknown>;
  let name: string;
  if (editing) {
    if (!selected) return { error: `Select a ${component} before editing it.` };
    const editSchema = z.strictObject({ changes: specs[component].partial(), appendInstructions: nonempty.optional() });
    const parsed = editSchema.safeParse(args);
    if (!parsed.success) return { error: `Provide valid ${component} fields to edit.` };
    const { changes, appendInstructions } = parsed.data;
    if (appendInstructions && (component !== "behaviour" || Object.hasOwn(changes, "description"))) {
      return { error: "Use appendInstructions only to add to Behaviour instructions, without replacing the description." };
    }
    spec = { ...selected.spec, ...changes };
    if (appendInstructions && component === "behaviour") spec.description = `${draft.config.behaviour!.spec.description}\n\n${appendInstructions}`;
    const present = new Set(referencesIn(spec));
    const missingReferences = [...new Set(referencesIn(selected.spec))].filter(reference => !present.has(reference));
    if (missingReferences.length) return { error: "Preserve the existing template references.", missingReferences };
    name = selected.edited ? selected.metadata.name : availableCopyName(selected.metadata.name, context.library[component]);
  } else {
    const { name: proposedName, ...raw } = args;
    const parsed = specs[component].safeParse(raw);
    if (!parsed.success) return { error: `Provide a complete ${component} with valid fields.` };
    spec = parsed.data;
    name = nonempty.safeParse(proposedName).data ?? `ai-generated-${component}`;
    if (component === "behaviour") {
      const missingReferences = missingBehaviourReferences(typeof spec.description === "string" ? spec.description : undefined);
      if (missingReferences.length) return { error: "Include the required Behaviour template references.", missingReferences };
    }
  }

  spec = normalizeSpec(component, spec, draft);
  if (editing && JSON.stringify(spec) === JSON.stringify(selected?.spec)) return { draft, action: "Edit" };
  const now = new Date().toISOString();
  const resource = {
    id: editing && selected?.edited ? selected.id : `generated-${crypto.randomUUID()}`,
    apiVersion: selected && editing ? selected.apiVersion : "v1",
    metadata: { name, version: "1.0.0" },
    spec,
    edited: true,
    isPublished: false,
    user: context.user,
    createdAt: editing && selected?.edited ? selected.createdAt : now,
    updatedAt: now,
  } as Resource;
  const customizedName = draft.customizations[component]?.name.trim();
  const keepCustomization = editing && Boolean(selected?.edited || (customizedName && customizedName !== selected?.metadata.name));
  return {
    draft: setComponent(draft, component, resource, keepCustomization),
    action: editing ? "Edit" : selected ? "Replace" : "Create",
  };
}

export function validateCreatorChanges(base: CreatorDraft, next: CreatorDraft, context: CommandContext): string | null {
  const { behaviour, persona, problem } = next.config;
  const behaviourChanged = behaviour !== base.config.behaviour;
  const problemChanged = problem !== base.config.problem;
  if (behaviourChanged && behaviour?.edited && !context.canEditBehaviour) return "Your role cannot edit this Behaviour.";
  if (behaviourChanged && behaviour && !behaviour.edited && !problem) return "Select a Problem before reusing a Behaviour.";
  if ((behaviourChanged || problemChanged) && processConflict(next)) {
    return "The Problem and Behaviour use different processes. Ask for a proposal with a compatible Behaviour.";
  }
  for (const component of components) {
    const resource = next.config[component];
    if (resource && resource !== base.config[component] && !resource.edited && !context.library[component].some(candidate => candidate === resource)) {
      return `The proposed ${component} is no longer available. Ask for a fresh proposal.`;
    }
  }
  if ((behaviourChanged || problemChanged || persona !== base.config.persona) && behaviour && persona && problem) {
    try {
      generateLeia(persona, behaviour, problem, next.rubricDraft);
    } catch (error) {
      return error instanceof Error ? error.message : "These components cannot be combined.";
    }
  }
  return null;
}

interface FieldChange { field: string; before: unknown; after: unknown }
export interface ReviewedChange {
  target: DraftTarget;
  action: CommandAction;
  before: string;
  after: string;
  version?: string;
  reason?: string;
  fields: FieldChange[];
}
export interface CreatorProposal {
  base: CreatorDraft;
  next: CreatorDraft;
  changes: ReviewedChange[];
}

function reviewFields(before: Record<string, unknown>, after: Record<string, unknown>): FieldChange[] {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter(field => JSON.stringify(before[field]) !== JSON.stringify(after[field]))
    .map(field => ({ field, before: before[field], after: after[field] }));
}

export function reviewCreatorChanges(base: CreatorDraft, staged: CreatorDraft, actions: Map<DraftTarget, CommandAction>): CreatorProposal {
  const next = staged !== base && !staged.nameManuallyEdited && !staged.customizations.leia.name.trim()
    ? setTitle(staged, suggestedTitle(staged.config)) : staged;
  const changes: ReviewedChange[] = [];
  const previousBehaviour = base.config.behaviour;
  const newProblem = next.config.problem;
  const requiresCompatibleBehaviour = previousBehaviour && newProblem && newProblem !== base.config.problem
    && !sameProcess(previousBehaviour.spec.process, newProblem.spec.process);
  for (const target of components) {
    const previous = base.config[target];
    const resource = next.config[target];
    const action = actions.get(target);
    if (!resource || previous === resource || !action) continue;
    const netAction = !previous && action !== "Reuse" ? "Create" : action;
    changes.push({
      target, action: netAction,
      before: previous ? base.customizations[target]?.name || previous.metadata.name : "",
      after: next.customizations[target]?.name || resource.metadata.name,
      version: netAction === "Reuse" && !resource.edited ? resource.metadata.version : undefined,
      reason: target === "behaviour" && requiresCompatibleBehaviour
        ? "The proposed Problem uses a different process. It needs a compatible Behaviour."
        : undefined,
      fields: reviewFields({ ...previous?.spec }, { ...resource.spec }),
    });
  }
  const rubric = next.rubricDraft;
  const previousRubric = base.rubricDraft;
  if (rubric && rubric !== previousRubric) changes.push({
    target: "rubric",
    action: previousRubric ? "Replace" : "Create",
    before: previousRubric?.metadata.name ?? "",
    after: rubric.metadata.name,
    fields: reviewFields({ ...previousRubric?.spec }, { ...rubric.spec }),
  });
  if (base.customizations.leia.name !== next.customizations.leia.name) changes.push({
    target: "leia", action: "Set title", before: base.customizations.leia.name, after: next.customizations.leia.name, fields: [],
  });
  return { base, next, changes };
}
