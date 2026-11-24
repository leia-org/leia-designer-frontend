export interface PlaceholderItem {
  token: string;
  description: string;
}

export interface PlaceholderGroup {
  title: string;
  items: readonly PlaceholderItem[];
}

export interface PlaceholderSection {
  id: "leia" | "stages";
  label: string;
  groups: readonly PlaceholderGroup[];
}

export const BEHAVIOUR_PLACEHOLDER_SECTIONS: readonly PlaceholderSection[] = [
  {
    id: "leia",
    label: "LEIA components",
    groups: [
      {
        title: "Persona",
        items: [
          { token: "{{persona.fullName}}", description: "Full name of the persona" },
          { token: "{{persona.firstName}}", description: "First name of the persona" },
          { token: "{{persona.description}}", description: "Persona description" },
          { token: "{{persona.personality}}", description: "Personality traits" },
          { token: "{{persona.subjectPronoum}}", description: "Subject pronoun (he, she, they)" },
          { token: "{{persona.objectPronoum}}", description: "Object pronoun (him, her, them)" },
          { token: "{{persona.possesivePronoum}}", description: "Possessive pronoun (his, hers, theirs)" },
          { token: "{{persona.possesiveAdjective}}", description: "Possessive adjective (his, her, their)" },
        ],
      },
      {
        title: "Problem",
        items: [
          { token: "{{problem.description}}", description: "Scenario / problem statement" },
          { token: "{{problem.details}}", description: "Additional details and requirements" },
          { token: "{{problem.personaBackground}}", description: "Persona background for this problem" },
          { token: "{{problem.solution}}", description: "Expected reference solution" },
          { token: "{{problem.initialSolution}}", description: "Initial solution template" },
          { token: "{{problem.solutionFormat}}", description: "Expected solution format" },
          { token: "{{problem.evaluationPrompt}}", description: "Custom evaluation prompt" },
          { token: "{{problem.process}}", description: "Problem process type(s)" },
        ],
      },
      {
        title: "Behaviour",
        items: [
          { token: "{{behaviour.role}}", description: "Agent role in this behaviour" },
          { token: "{{behaviour.process}}", description: "Behaviour process type(s)" },
          { token: "{{behaviour.tooltip}}", description: "Behaviour tooltip summary" },
        ],
      },
      {
        title: "Rubric",
        items: [
          { token: "{{rubric.name}}", description: "Rubric name" },
          { token: "{{rubric.criteria}}", description: "Compact summary of rubric sections, weights, levels, and criteria" },
          { token: "{{rubric.markdown}}", description: "Complete rubric rendered as Markdown tables" },
          { token: "{{rubric.evaluationPrompt}}", description: "Rubric evaluation instructions" },
          { token: "{{rubric.sections}}", description: "Raw JSON of the rubric sections" },
        ],
      },
    ],
  },
  {
    id: "stages",
    label: "Staged activities",
    groups: [
      {
        title: "Previous stage outputs",
        items: [
          { token: "{{previousStage.outputs.conversation}}", description: "Conversation transcript from an earlier stage" },
          { token: "{{previousStage.outputs.submitedSolution}}", description: "Submitted solution from an earlier stage" },
        ],
      },
      {
        title: "Previous stage problem",
        items: [
          { token: "{{previousStage.leia.problem.description}}", description: "Scenario / problem statement from an earlier stage" },
          { token: "{{previousStage.leia.problem.details}}", description: "Additional details and requirements from an earlier stage" },
          { token: "{{previousStage.leia.problem.personaBackground}}", description: "Persona background from an earlier stage problem" },
          { token: "{{previousStage.leia.problem.solution}}", description: "Expected reference solution from an earlier stage" },
          { token: "{{previousStage.leia.problem.initialSolution}}", description: "Initial solution template from an earlier stage" },
          { token: "{{previousStage.leia.problem.solutionFormat}}", description: "Expected solution format from an earlier stage" },
          { token: "{{previousStage.leia.problem.evaluationPrompt}}", description: "Custom evaluation prompt from an earlier stage" },
          { token: "{{previousStage.leia.problem.process}}", description: "Problem process type(s) from an earlier stage" },
        ],
      },
    ],
  },
];

export const BEHAVIOUR_PLACEHOLDER_ITEMS: readonly PlaceholderItem[] = BEHAVIOUR_PLACEHOLDER_SECTIONS.flatMap(
  (section) => section.groups.flatMap((group) => group.items),
);
