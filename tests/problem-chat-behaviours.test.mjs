import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { behaviourCandidates, CORE_BEHAVIOUR_REFERENCES, missingBehaviourReferences, templateReferences } from "../src/lib/chatBehaviours.mjs";

// Exercise the actual editor callbacks and tool loop without an LLM, browser,
// network or database. TypeScript is already a frontend build dependency.
const createSource = await readFile(new URL("../src/screens/CreateLeia.tsx", import.meta.url), "utf8");
const panelSource = await readFile(new URL("../src/components/ProblemChatPanel.tsx", import.meta.url), "utf8");
function declaration(source, name) {
  const file = ts.createSourceFile("source.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let result;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(file) === name) result = `const ${node.getText(file)};`;
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.ok(result, `Missing declaration: ${name}`);
  return result;
}
const compile = source => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const callbackSource = [
  ...["copyProcess", "haveSameProcess", "applyChatProblem", "applyChatBehaviour", "handleUseExistingBehaviour"].map(name => declaration(createSource, name)),
  declaration(panelSource, "stripAvatar"),
  declaration(panelSource, "runTurn"),
  "globalThis.run = runTurn;",
  "globalThis.onApplyProblem = applyChatProblem;",
  "globalThis.onApplyBehaviour = applyChatBehaviour;",
  "globalThis.onUseBehaviour = handleUseExistingBehaviour;",
].join("\n");

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
  const results = [];
  let replies = [];
  const context = {
    behaviourCandidates, missingBehaviourReferences, templateReferences,
    useCallback: fn => fn, canEditBehaviour: canEdit,
    currentUser: { id: "instructor" }, behaviours: saved, chatTools: [], attachments: [],
    leiaConfig: { problem: null, behaviour: null, persona: null },
    currentProblemRef: { current: null }, currentBehaviourRef: { current: null },
    currentPersonaRef: { current: null }, previousBehaviourRef: { current: null },
    rememberedBehavioursRef: { current: new Map() }, inspectedLibrariesRef: { current: new Set() },
    behavioursRef: { current: saved }, problemsRef: { current: [] }, personasRef: { current: [] },
    pushMessage: () => {}, Date,
    setLeiaConfig: update => {
      context.leiaConfig = update(context.leiaConfig);
      context.currentProblemRef.current = context.leiaConfig.problem;
      context.currentBehaviourRef.current = context.leiaConfig.behaviour;
    },
    sendProblemChatMessage: async (_chatId, body) => {
      if (body.toolResults) results.push(...body.toolResults);
      const next = replies.shift();
      assert.ok(next, "Unexpected model continuation");
      return typeof next === "function" ? next(body) : next;
    },
  };
  vm.createContext(context);
  vm.runInContext(compile(callbackSource), context);
  return {
    context, results,
    async turn(sequence, message = "Create a LEIA") {
      replies = [...sequence, { message: "Done" }];
      context.inspectedLibrariesRef.current.clear();
      await context.run("chat", message);
      assert.equal(replies.length, 0);
    },
    async create() {
      await this.turn([call("list_problems"), call("apply_problem", problem("Library management")), call("list_behaviours"), call("apply_behaviour", behaviour())]);
    },
  };
}

test("a LEIA created in conversation reuses its exact draft when the problem changes to a gym", async () => {
  const e = editor(); await e.create();
  const original = e.context.leiaConfig.behaviour;
  assert.ok(original.id.startsWith("generated-"));
  await e.turn([
    call("get_current_behaviour"), call("list_problems"), call("apply_problem", problem("gym management with users, instructors and training plans")), call("list_behaviours"),
    body => {
      const [candidate] = body.toolResults[0].output;
      assert.equal(candidate.id, original.id);
      assert.equal(candidate.description, template); // Includes references beyond character 240.
      assert.equal(candidate.isDraft, true);
      assert.ok(candidate.templateReferences.includes("{{problem.details}}"));
      assert.equal(e.context.leiaConfig.behaviour, null); // Never silently keep an unchecked selection.
      return call("use_behaviour", { id: candidate.id });
    },
  ], "cambiame el problema para que sea de gestión de un gimnasio con los usuarios los instructores y los planes de entrenamiento");
  assert.equal(e.context.leiaConfig.behaviour, original);
  assert.equal(e.context.leiaConfig.behaviour.spec.description, template);
  assert.equal(e.results.at(-1).output.status, "selected");
});

test("a previous draft cannot be selected for a different process or with an invented id", async () => {
  const e = editor(); await e.create();
  const original = e.context.leiaConfig.behaviour;
  await e.turn([call("list_problems"), call("apply_problem", problem("gym game", ["game"])), call("list_behaviours"), call("use_behaviour", { id: original.id }), call("use_behaviour", { id: "invented" })]);
  assert.equal(e.context.leiaConfig.behaviour, null);
  assert.match(e.results.at(-2).output.error, /process/);
  assert.match(e.results.at(-1).output.error, /no behaviour/);
});

test("missing references fail without changing the editor; a corrected retry preserves extra source references", async () => {
  const e = editor(); await e.create();
  const original = e.context.leiaConfig.behaviour;
  await e.turn([
    call("list_behaviours"), call("apply_behaviour", behaviour("You manage a gym.")),
    body => {
      assert.equal(e.context.leiaConfig.behaviour, original);
      assert.ok(body.toolResults[0].output.missingReferences.includes("{{persona.firstName}}"));
      return call("apply_behaviour", behaviour(CORE_BEHAVIOUR_REFERENCES.join("\n")));
    },
    body => {
      assert.equal(e.context.leiaConfig.behaviour, original);
      assert.deepEqual(Array.from(body.toolResults[0].output.missingReferences), ["{{persona.firstName}}"]);
      return call("apply_behaviour", behaviour(template + "\nBe concise."));
    },
  ]);
  assert.equal(e.results.at(-1).output.status, "applied");
  assert.ok(e.context.leiaConfig.behaviour.spec.description.endsWith("Be concise."));
});

test("the behaviour uses the final Problem process when tools arrive together", async () => {
  const e = editor();
  await e.turn([call("list_problems"), call("list_behaviours"), { toolCalls: [call("apply_behaviour", behaviour()).toolCalls[0], call("apply_problem", problem("gym game", ["game"])).toolCalls[0]] }]);
  assert.deepEqual(Array.from(e.context.leiaConfig.behaviour.spec.process), ["game"]);
});

test("basic users can reuse saved templates but cannot author or select an authored draft", async () => {
  const saved = { id: "saved-client", metadata: { name: "saved-client" }, spec: behaviour() };
  const e = editor({ canEdit: false, saved: [saved] });
  await e.turn([call("list_problems"), call("apply_problem", problem("gym")), call("list_behaviours"), call("use_behaviour", { id: saved.id }), call("apply_behaviour", behaviour())]);
  assert.equal(e.context.leiaConfig.behaviour, saved);
  assert.match(e.results.at(-1).output.error, /cannot author/);
  const draft = { ...saved, id: "generated-client", edited: true };
  e.context.rememberedBehavioursRef.current.set(draft.id, draft);
  await e.turn([call("list_behaviours"), call("use_behaviour", { id: draft.id })]);
  assert.equal(e.context.leiaConfig.behaviour, saved);
  assert.match(e.results.at(-1).output.error, /advanced user/);
});

test("template checks accept supported whitespace and keep draft edits ahead of the saved version", () => {
  assert.deepEqual(missingBehaviourReferences(CORE_BEHAVIOUR_REFERENCES.map(x => x.replace("{{", "{{ ").replace("}}", " }}")).join("\n")), []);
  const saved = { id: "a", spec: { description: "old" } };
  const edited = { ...saved, edited: true, spec: { description: template } };
  assert.equal(behaviourCandidates([saved], [edited])[0], edited);
});

test("assembling the adapted LEIA resolves gym context without changing reusable source placeholders", async () => {
  function load(source, require) {
    const context = { exports: {}, require, console, structuredClone };
    vm.createContext(context); vm.runInContext(compile(source), context); return context.exports;
  }
  const helper = load(await readFile(new URL("../src/lib/helper.ts", import.meta.url), "utf8"));
  const { generateLeia } = load(await readFile(new URL("../src/lib/leia.ts", import.meta.url), "utf8"), () => helper);
  const e = editor(); await e.create();
  const original = e.context.leiaConfig.behaviour;
  await e.turn([call("list_problems"), call("apply_problem", problem("gym management")), call("list_behaviours"), call("use_behaviour", { id: original.id })]);
  const persona = { spec: { fullName: "Alex Example", firstName: "Alex", description: "Client", personality: "patient" } };
  const result = generateLeia(persona, original, e.context.leiaConfig.problem);
  assert.ok(result.spec.behaviour.spec.description.includes("gym management"));
  assert.ok(!result.spec.behaviour.spec.description.includes("{{"));
  assert.equal(original.spec.description, template);
});
