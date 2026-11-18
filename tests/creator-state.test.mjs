import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

import { CORE_BEHAVIOUR_REFERENCES } from "../src/lib/chatBehaviours.mjs";
import { chatFixture, compile, declaration, generateLeia, loadModule, readSource } from "./creator-chat-fixture.mjs";

const createSource = await readSource("src/screens/CreateLeia.tsx");
const panelSource = await readSource("src/components/ProblemChatPanel.tsx");
const previewSource = await readSource("src/components/LeiaLivePreview.tsx");
const require = createRequire(import.meta.url);
const ui = new Proxy({}, { get: () => ({ children, label, value }) => React.createElement("div", null, children ?? label ?? value) });
const { LeiaLivePreview } = loadModule(previewSource, name => name === "@mui/material"
  ? ui : name.startsWith("@mui/icons-material/") ? { default: "svg" } : require(name));
const readPreviewProps = (() => {
  const file = ts.createSourceFile("CreateLeia.tsx", createSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let properties;
  function visit(node) {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(file) === "LeiaLivePreview") {
      properties = ["leia", "readyToTest"].map(name => {
        const attribute = node.attributes.properties.find(item => item.name?.getText(file) === name);
        assert.ok(attribute?.initializer?.expression, name);
        return `${name}: ${attribute.initializer.expression.getText(file)}`;
      });
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.ok(properties);
  return `globalThis.previewProps=()=>({${properties.join(",")}});`;
})();
const process = ["requirements-elicitation"];
const template = CORE_BEHAVIOUR_REFERENCES.join("\n");
const problem = (name, tags = process) => ({ name, description: `${name} requirements`, personaBackground: "Client {{persona.fullName}}", details: "Inventory", solution: "Stock model", process: tags, extends: {}, overrides: {}, constrainedTo: {} });
const behaviour = (tags = process) => ({ name: "burger-interview", role: "Operations director", description: template, process: tags });
const resource = (id, spec) => ({ id, apiVersion: "v1", metadata: { name: id, version: "1.0.0" }, spec });
const preset = () => ({
  persona: resource("theatre-owner", { fullName: "Sara", description: "Client", personality: "Patient" }),
  problem: resource("re-mermaid-class-tickets", problem("ticket-platform")),
  behaviour: resource("theatre-interview", { ...behaviour(), role: "Theater owner" }),
});
const call = (name, args = {}) => ({ toolCalls: [{ name, callId: name, arguments: JSON.stringify(args) }] });
const inspect = () => [call("list_personas"), call("list_problems"), call("list_behaviours")];

function editor({ config = preset(), canEdit = true, problems = [], behaviours = [] } = {}) {
  const requests = [];
  const chat = chatFixture({ config, canEdit, problems, behaviours });
  const context = {
    exports: {}, require, console: { error() {} }, useMemo: fn => fn(), generateLeia,
    leiaConfig: config, currentUser: { id: "synthetic-instructor" }, canEditBehaviour: canEdit,
    currentStep: 1, leiaConfigSnapShot: null, selectedLabelIds: [], customizations: {},
    currentDraftIdRef: { current: "draft" }, chatState: { messages: [{ role: "user", text: "Burger stock" }] },
    chatModelName: "fixture-model", chatApiKeyId: "fixture-key", pendingLabelDrafts: [], supervisorConfig: {},
    leiaNameManuallyEdited: false, leiaPublish: false, behaviourPublish: false, problemPublish: false, personaPublish: false,
    chatBusy: false, chatOptionsLoading: false, testingLeia: false,
    Button: ({ children, disabled }) => React.createElement("button", { disabled }, children), PlayArrowIcon: "svg", CircularProgress: "svg",
    pushMessage() {}, setError(message) { context.error = message; },
    setTestingLeia(value) { context.testingLeia = value; },
    resolveTestRunnerConfiguration: () => ({ model: "fixture-model" }),
    saveCurrentDraft: async () => ({ id: "draft" }),
    api: { post: async (path, payload) => { requests.push({ path, payload }); return { data: { sessionId: "fixture-session" } }; } },
    navigate: (path, options) => { context.navigation = { path, ...options }; },
  };
  const code = [
    declaration(createSource, "handleTestLeia"), "globalThis.testLeia=handleTestLeia;",
    `globalThis.assemble=()=>{${declaration(createSource, "leiaAssembly")} return leiaAssembly;};`,
    `globalThis.testAction=()=>{${declaration(createSource, "isStep1Complete")}${declaration(createSource, "canTest")}${declaration(createSource, "testAction")}return testAction;};`,
    readPreviewProps,
  ].join("\n");
  vm.createContext(context); vm.runInContext(compile(code), context);
  function render() {
    Object.assign(context, context.assemble());
  }
  render();
  return {
    context, requests, results: chat.results, render,
    async turn(sequence) {
      context.chatBusy = true;
      try {
        await chat.turn(sequence);
        chat.apply();
        context.leiaConfig = chat.editor.draft.config;
      } finally {
        context.chatBusy = false;
        render();
      }
    },
    preview() { return renderToStaticMarkup(React.createElement(LeiaLivePreview, { ...context.previewProps(), title: "Burger stock", onTitleChange() {}, testAction: context.testAction() })); },
  };
}

test("video regression: persona, behaviour, then problem in separate responses tests and restores the new LEIA", async () => {
  const e = editor();
  await e.turn([...inspect(), call("apply_persona", { name: "burger-director", fullName: "Laura", firstName: "Laura", description: "Operations director", personality: "Pragmatic" }), call("apply_behaviour", behaviour()), call("apply_problem", problem("burger-inventory"))]);
  assert.equal(e.context.leiaConfig.behaviour.metadata.name, "burger-interview");
  assert.equal(e.context.generatedLeia.spec.problem.metadata.name, "burger-inventory");
  assert.equal(e.context.testAction().props.disabled, false);
  await e.context.testLeia();
  assert.equal(e.requests[0].payload.spec.problem.metadata.name, "burger-inventory");
  const saved = e.context.navigation.state.save;
  assert.equal(saved.leiaConfig.behaviour.spec.description, template);
  const restored = editor({ config: saved.leiaConfig });
  assert.equal(restored.context.generatedLeia.spec.persona.spec.fullName, "Laura");
  assert.equal(restored.context.generatedLeia.spec.problem.metadata.name, "burger-inventory");
  assert.ok(!restored.preview().includes("Waiting for the assistant"));
});

test("problem-first and parallel tool calls both use the final problem", async () => {
  for (const parallel of [false, true]) {
    const e = editor({ config: { persona: preset().persona, problem: null, behaviour: null } });
    const p = call("apply_problem", problem("burger-inventory"));
    const b = call("apply_behaviour", behaviour());
    await e.turn([...inspect(), ...(parallel ? [{ toolCalls: [...b.toolCalls, ...p.toolCalls] }] : [p, b])]);
    assert.equal(e.context.generatedLeia.spec.problem.metadata.name, "burger-inventory");
    assert.equal(e.context.testAction().props.disabled, false);
  }
});

test("a behaviour authored before the first problem also survives when starting from scratch", async () => {
  const e = editor({ config: { persona: preset().persona, problem: null, behaviour: null } });
  await e.turn([...inspect(), call("apply_behaviour", behaviour()), call("apply_problem", problem("burger-inventory"))]);
  assert.equal(e.context.generatedLeia.spec.problem.metadata.name, "burger-inventory");
});

test("a problem-only proposal keeps a compatible behaviour and assembles a fresh preview", async () => {
  const e = editor();
  const original = e.context.leiaConfig.behaviour;
  await e.turn([...inspect(), call("apply_problem", problem("burger-inventory"))]);
  assert.equal(e.context.leiaConfig.behaviour, original);
  assert.equal(e.context.generatedLeia.spec.problem.metadata.name, "burger-inventory");
  assert.equal(e.context.testAction().props.disabled, false);
});

test("a new problem with a different process cannot be applied with an incompatible behaviour", async () => {
  const e = editor();
  const original = e.context.leiaConfig;
  await assert.rejects(e.turn([...inspect(), call("apply_behaviour", behaviour()), call("apply_problem", problem("burger-game", ["game"]))]), /different processes/);
  assert.equal(e.context.leiaConfig, original);
  assert.match(e.results.at(-1).output.warning, /different processes/);
});

test("selecting an existing problem preserves a compatible behaviour explicitly chosen in this turn", async () => {
  const p = resource("burger-inventory", problem("burger-inventory"));
  const b = resource("saved-interview", behaviour());
  const e = editor({ canEdit: false, problems: [p], behaviours: [b] });
  await e.turn([...inspect(), call("use_behaviour", { id: b.id }), call("use_problem", { id: p.id })]);
  assert.equal(e.context.leiaConfig.behaviour, b);
  assert.equal(e.context.generatedLeia.spec.problem.metadata.name, p.id);
});

test("a rejected command prevents applying the other commands in the same proposal", async () => {
  const e = editor({ canEdit: false });
  const original = e.context.leiaConfig;
  await assert.rejects(e.turn([...inspect(), call("use_behaviour", { id: "invented" }), call("apply_problem", problem("burger-inventory"))]), /available behaviour/);
  assert.equal(e.context.leiaConfig, original);
});

test("assembly errors immediately clear the old LEIA and disable testing", async () => {
  const e = editor();
  assert.ok(e.context.generatedLeia);
  e.context.leiaConfig = { ...e.context.leiaConfig, problem: resource("invalid", { ...problem("invalid"), constrainedTo: { persona: { spec: { fullName: "Different" } } } }) };
  e.render();
  assert.equal(e.context.generatedLeia, null);
  assert.ok(e.context.generationError);
  assert.equal(e.context.testAction().props.disabled, true);
  await e.context.testLeia();
  assert.equal(e.requests.length, 0);
});

test("testing is blocked while the assistant is running and while a test is already starting", async () => {
  const e = editor();
  e.context.chatBusy = true;
  assert.equal(e.context.testAction().props.disabled, true);
  assert.ok(!e.preview().includes("Ready to test"));
  await e.context.testLeia();
  assert.equal(e.requests.length, 0);
  e.context.chatBusy = false;
  e.context.testingLeia = true;
  await e.context.testLeia();
  assert.equal(e.requests.length, 0);
});

test("the send handler reports busy state during requests and clears it on success or failure", async () => {
  for (const fail of [false, true]) {
    const changes = [];
    const context = {
      input: "Create a LEIA", sending: false, disabled: false,
      pushMessage() {}, setInput() {}, setError() {}, setSending() {}, setProposal() {}, setRevising() {}, draft: {}, revising: false,
      onBusyChange: busy => changes.push(busy), ensureSession: async () => "chat",
      runTurn: async () => { assert.deepEqual(changes, [true]); if (fail) throw new Error("Model unavailable"); return "Done"; },
    };
    vm.createContext(context);
    vm.runInContext(compile(`${declaration(panelSource, "handleSend")}globalThis.send=handleSend;`), context);
    await context.send();
    assert.deepEqual(changes, [true, false]);
    context.disabled = true;
    await context.send();
    assert.deepEqual(changes, [true, false]);
  }
});
