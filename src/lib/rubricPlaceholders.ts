import {
  BEHAVIOUR_PLACEHOLDER_SECTIONS,
  type PlaceholderItem,
  type PlaceholderSection,
} from "./behaviourPlaceholders";

const LEIA_BASE_GROUPS = BEHAVIOUR_PLACEHOLDER_SECTIONS[0].groups.filter(
  (group) => group.title !== "Rubric",
);

export const RUBRIC_PLACEHOLDER_SECTIONS: readonly PlaceholderSection[] = [
  {
    id: "stages",
    label: "Stage outputs",
    groups: [
      {
        title: "Current stage outputs",
        items: [
          {
            token: "{{currentStage.outputs.conversation}}",
            description: "Conversation transcript from the current stage",
          },
          {
            token: "{{currentStage.outputs.submitedSolution}}",
            description: "Solution submitted by the participant in the current stage",
          },
        ],
      },
      {
        title: "Previous stage outputs",
        items: [
          {
            token: "{{previousStage.outputs.conversation}}",
            description: "Conversation transcript from an earlier stage",
          },
          {
            token: "{{previousStage.outputs.submitedSolution}}",
            description: "Submitted solution from an earlier stage",
          },
        ],
      },
    ],
  },
  {
    id: "leia",
    label: "LEIA components",
    groups: LEIA_BASE_GROUPS,
  },
];

export const RUBRIC_PLACEHOLDER_ITEMS: readonly PlaceholderItem[] =
  RUBRIC_PLACEHOLDER_SECTIONS.flatMap((section) =>
    section.groups.flatMap((group) => group.items),
  );
