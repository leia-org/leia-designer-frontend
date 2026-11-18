import assert from "node:assert/strict";
import test from "node:test";
import { behaviourPage, behaviourCandidates, CORE_BEHAVIOUR_REFERENCES, missingBehaviourReferences } from "../src/lib/chatBehaviours.mjs";
import { chatFixture, generateLeia } from "./creator-chat-fixture.mjs";

const process = ["requirements-elicitation"];
const problem = (description, selectedProcess = process) => ({
  name: description.includes("gym") ? "gym" : "library", description,
  personaBackground: "Client {{persona.fullName}}", details: description,
  solution: "Users, instructors and training plans", solutionFormat: "text", initialSolution: "",
  process: selectedProcess, extends: {}, overrides: {}, constrainedTo: {},
});
const template = "Ask questions; do not reveal the solution. ".repeat(10) + CORE_BEHAVIOUR_REFERENCES.join("\n") + "\n{{persona.firstName}}";
const behaviour = (description = template) => ({ name: "generic-client", description, role: "Client interviewee", process });
const call = (name, args = {}) => ({ toolCalls: [{ name, callId: name, arguments: JSON.stringify(args) }] });

function editor({ canEdit = true, saved = [] } = {}) {
  const chat = chatFixture({ config: { problem: null, behaviour: null, persona: null }, canEdit, behaviours: saved });
  return {
    ...chat,
    get config() { return chat.editor.draft.config; },
    async create() {
      await chat.turn([call("list_problems"), call("apply_problem", problem("Library management")), call("list_behaviours"), call("apply_behaviour", behaviour())]);
      assert.equal(chat.editor.draft.config.behaviour, null);
      chat.apply();
    },
  };
}

test("a LEIA created in conversation reuses its exact draft when the problem changes to a gym", async () => {
  const e = editor(); await e.create();
  const original = e.config.behaviour;
  assert.ok(original.id.startsWith("generated-"));
  await e.turn([
    call("get_current_behaviour"), call("list_problems"), call("apply_problem", problem("gym management with users, instructors and training plans")), call("list_behaviours"),
    body => {
      const [candidate] = body.toolResults[0].output.items;
      assert.equal(candidate.id, original.id);
      assert.equal(candidate.description, template.slice(0, 240));
      assert.equal(candidate.isDraft, true);
      assert.equal(e.config.behaviour, original);
      return call("get_behaviour", { id: candidate.id });
    },
    body => {
      const detail = body.toolResults[0].output;
      assert.equal(detail.spec.description, template);
      assert.ok(detail.templateReferences.includes("{{problem.details}}"));
      assert.equal(e.config.behaviour, original);
      return call("use_behaviour", { id: detail.id });
    },
  ], "cambiame el problema para que sea de gestión de un gimnasio con los usuarios los instructores y los planes de entrenamiento");
  e.apply();
  assert.equal(e.config.behaviour, original);
  assert.equal(e.config.behaviour.spec.description, template);
  assert.equal(e.results.at(-1).output.status, "proposed");
});

test("a previous draft cannot be selected for a different process or with an invented id", async () => {
  const e = editor(); await e.create();
  const original = e.config.behaviour;
  await assert.rejects(e.turn([call("list_problems"), call("apply_problem", problem("gym game", ["game"])), call("list_behaviours"), call("use_behaviour", { id: original.id })]), /different processes/);
  assert.equal(e.config.behaviour, original);
  assert.match(e.results.at(-1).output.warning, /different processes/);
  await assert.rejects(e.turn([call("use_behaviour", { id: "invented" })]), /available behaviour/);
});

test("missing references fail without changing the editor; a corrected retry preserves extra source references", async () => {
  const e = editor(); await e.create();
  const original = e.config.behaviour;
  await e.turn([
    call("edit_behaviour", { changes: { description: "You manage a gym." } }),
    body => {
      assert.equal(e.config.behaviour, original);
      assert.ok(body.toolResults[0].output.missingReferences.includes("{{persona.firstName}}"));
      return call("edit_behaviour", { changes: { description: CORE_BEHAVIOUR_REFERENCES.join("\n") } });
    },
    body => {
      assert.equal(e.config.behaviour, original);
      assert.deepEqual(Array.from(body.toolResults[0].output.missingReferences), ["{{persona.firstName}}"]);
      return call("edit_behaviour", { changes: {}, appendInstructions: "Be concise." });
    },
  ]);
  assert.equal(e.results.at(-1).output.status, "proposed");
  e.apply();
  assert.equal(e.config.behaviour.spec.description, `${template}\n\nBe concise.`);
});

test("the behaviour uses the final Problem process when tools arrive together", async () => {
  const e = editor();
  await e.turn([call("list_problems"), call("list_behaviours"), { toolCalls: [call("apply_behaviour", { ...behaviour(), process: ["game"] }).toolCalls[0], call("apply_problem", problem("gym game", ["game"])).toolCalls[0]] }]);
  e.apply();
  assert.deepEqual(Array.from(e.config.behaviour.spec.process), ["game"]);
});

test("basic users can reuse saved templates but cannot author or select an authored draft", async () => {
  const saved = { id: "saved-client", metadata: { name: "saved-client" }, spec: behaviour() };
  const e = editor({ canEdit: false, saved: [saved] });
  await e.turn([call("list_problems"), call("apply_problem", problem("gym")), call("list_behaviours"), call("use_behaviour", { id: saved.id })]);
  e.apply();
  assert.equal(e.config.behaviour, saved);
  await assert.rejects(e.turn([call("edit_behaviour", { changes: {}, appendInstructions: "Be brief." })]), /Only advanced users/);
  const draft = { ...saved, id: "generated-client", edited: true };
  e.editor.library.behaviour.push(draft);
  await assert.rejects(e.turn([call("use_behaviour", { id: draft.id })]), /Only advanced users/);
  assert.equal(e.config.behaviour, saved);
});

test("editing a saved Behaviour proposes a draft copy with an available name", async () => {
  const saved = { id: "saved-client", metadata: { name: "saved-client" }, spec: behaviour() };
  const copy = { ...saved, id: "existing-copy", metadata: { name: "saved-client-copy" } };
  const chat = chatFixture({
    config: { problem: null, behaviour: saved, persona: null }, canEdit: true, behaviours: [saved, copy],
  });
  chat.editor.draft.customizations.behaviour = { name: "saved-client" };
  await chat.turn([call("edit_behaviour", { changes: {}, appendInstructions: "Be concise." })]);
  assert.equal(chat.proposal.changes[0].after, "saved-client-copy-2");
  chat.apply();
  assert.equal(chat.editor.draft.config.behaviour.metadata.name, "saved-client-copy-2");
  assert.equal(chat.editor.draft.customizations.behaviour, undefined);
  assert.equal(saved.spec.description, template);
});

test("template checks accept supported whitespace and keep draft edits ahead of the saved version", () => {
  assert.deepEqual(missingBehaviourReferences(CORE_BEHAVIOUR_REFERENCES.map(x => x.replace("{{", "{{ ").replace("}}", " }}")).join("\n")), []);
  const saved = { id: "a", spec: { description: "old" } };
  const edited = { ...saved, edited: true, spec: { description: template } };
  assert.equal(behaviourCandidates([saved], [edited])[0], edited);
});

test("assembling the adapted LEIA resolves gym context without changing reusable source placeholders", async () => {
  const e = editor(); await e.create();
  const original = e.config.behaviour;
  await e.turn([call("list_problems"), call("apply_problem", problem("gym management")), call("list_behaviours"), call("use_behaviour", { id: original.id })]);
  e.apply();
  const persona = { spec: { fullName: "Alex Example", firstName: "Alex", description: "Client", personality: "patient" } };
  const result = generateLeia(persona, original, e.config.problem);
  assert.ok(result.spec.behaviour.spec.description.includes("gym management"));
  assert.ok(!result.spec.behaviour.spec.description.includes("{{"));
  assert.equal(original.spec.description, template);
});


test("large behaviour libraries return compact pages and complete details only on demand", async () => {
  const saved = Array.from({ length: 35 }, (_, i) => ({
    id: `saved-${i}`, metadata: { name: `client-${i}` },
    spec: { ...behaviour(template.repeat(30)), conversationDynamics: { instructions: "x".repeat(20000) } },
  }));
  const e = editor({ saved });
  const seen = [];
  for (const offset of [0, 10, 20, 30]) {
    await e.turn([call("list_behaviours", { offset })]);
    const page = e.results.at(-1).output;
    assert.equal(page.total, 35);
    assert.equal(page.items.length, offset === 30 ? 5 : 10);
    assert.equal(page.nextOffset, offset === 30 ? null : offset + 10);
    assert.ok(Buffer.byteLength(JSON.stringify(page)) < 10000);
    for (const item of page.items) {
      seen.push(item.id);
      assert.equal(item.description.length, 240);
      assert.equal(item.conversationDynamics, undefined);
    }
  }
  assert.deepEqual(seen, saved.map(item => item.id));
  await e.turn([call("get_behaviour", { id: "saved-34" })]);
  assert.equal(e.results.at(-1).output.spec.description, saved[34].spec.description);
  assert.equal(e.results.at(-1).output.spec.conversationDynamics.instructions.length, 20000);
  assert.equal(e.config.behaviour, null);
  await e.turn([call("get_behaviour", { id: "unknown" })]);
  assert.match(e.results.at(-1).output.error, /available Behaviour/);
});

test("invalid pagination offsets start at the first page", () => {
  const candidates = [{ id: "saved", spec: behaviour() }];
  for (const offset of [-1, 0.5, NaN, Infinity]) {
    assert.equal(behaviourPage(candidates, offset).items[0].id, "saved");
  }
  assert.deepEqual(behaviourPage([], 0), { items: [], total: 0, nextOffset: null });
  assert.deepEqual(behaviourPage(candidates, 10), { items: [], total: 1, nextOffset: null });
});
