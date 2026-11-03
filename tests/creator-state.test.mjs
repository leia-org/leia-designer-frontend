import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

// Execute the actual tool loop, React state updaters, assembly and test handler.
// Flush queued state updates between model responses, as React does. No model,
// API, browser session, database or credentials are required for this regression.
const source = async path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const createSource = await source("src/screens/CreateLeia.tsx");
const panelSource = await source("src/components/ProblemChatPanel.tsx");
const previewSource = await source("src/components/LeiaLivePreview.tsx");
const require = createRequire(import.meta.url);
const chatHelpers = panelSource.includes("missingBehaviourReferences")
  ? await import("../src/lib/chatBehaviours.mjs") : {};
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
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
function loadModule(source, require) {
  const context = { exports: {}, require, structuredClone, console };
  vm.createContext(context); vm.runInContext(compile(source), context);
  return context.exports;
}
const helper = loadModule(await source("src/lib/helper.ts"));
const { generateLeia } = loadModule(await source("src/lib/leia.ts"), () => helper);
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
const template = (chatHelpers.CORE_BEHAVIOUR_REFERENCES ?? ["{{problem.description}}", "{{persona.fullName}}"]).join("\n");
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
  let replies = [];
  const queued = [];
  const requests = [];
  const results = [];
  const context = {
    ...chatHelpers, exports: {}, require, console: { error() {} }, Date, useCallback: fn => fn, useMemo: fn => fn(), generateLeia,
    leiaConfig: config, currentUser: { id: "synthetic-instructor" }, canEditBehaviour: canEdit,
    problems, behaviours, personas: [], chatTools: [], attachments: [],
    currentProblemRef: { current: null }, currentBehaviourRef: { current: null }, currentPersonaRef: { current: null },
    previousBehaviourRef: { current: config.behaviour }, rememberedBehavioursRef: { current: new Map() },
    inspectedLibrariesRef: { current: new Set() }, problemsRef: { current: problems }, behavioursRef: { current: behaviours }, personasRef: { current: [] },
    currentStep: 1, leiaConfigSnapShot: null, selectedLabelIds: [], customizations: {},
    currentDraftIdRef: { current: "draft" }, chatState: { messages: [{ role: "user", text: "Burger stock" }] },
    chatModelName: "fixture-model", chatApiKeyId: "fixture-key", pendingLabelDrafts: [], supervisorConfig: {},
    leiaNameManuallyEdited: false, leiaPublish: false, behaviourPublish: false, problemPublish: false, personaPublish: false,
    chatBusy: false, chatOptionsLoading: false, testingLeia: false,
    Button: ({ children, disabled }) => React.createElement("button", { disabled }, children), PlayArrowIcon: "svg", CircularProgress: "svg",
    pushMessage() {}, setError(message) { context.error = message; },
    setLeiaConfig: update => queued.push(update),
    setTestingLeia(value) { context.testingLeia = value; },
    resolveTestRunnerConfiguration: () => ({ model: "fixture-model" }),
    saveCurrentDraft: async () => ({ id: "draft" }),
    api: { post: async (path, payload) => { requests.push({ path, payload }); return { data: { sessionId: "fixture-session" } }; } },
    navigate: (path, options) => { context.navigation = { path, ...options }; },
    sendProblemChatMessage: async (_chatId, body) => {
      render();
      if (body.toolResults) results.push(...body.toolResults);
      const next = replies.shift();
      assert.ok(next, "Unexpected model continuation");
      return typeof next === "function" ? next(body) : next;
    },
  };
  const callbacks = ["copyProcess", "haveSameProcess", "applyChatProblem", "applyChatBehaviour", "applyChatPersona", "handleUseExistingProblem", "handleUseExistingBehaviour", "handleTestLeia"].map(name => declaration(createSource, name));
  const code = [
    ...callbacks, declaration(panelSource, "stripAvatar"), declaration(panelSource, "runTurn"),
    "globalThis.run=runTurn; globalThis.onApplyProblem=applyChatProblem; globalThis.onApplyBehaviour=applyChatBehaviour; globalThis.onApplyPersona=applyChatPersona; globalThis.onUseProblem=handleUseExistingProblem; globalThis.onUseBehaviour=handleUseExistingBehaviour; globalThis.testLeia=handleTestLeia;",
    `globalThis.assemble=()=>{${declaration(createSource, "leiaAssembly")} return leiaAssembly;};`,
    `globalThis.testAction=()=>{${declaration(createSource, "isStep1Complete")}${declaration(createSource, "canTest")}${declaration(createSource, "testAction")}return testAction;};`,
    readPreviewProps,
  ].join("\n");
  vm.createContext(context); vm.runInContext(compile(code), context);
  function render() {
    while (queued.length) context.leiaConfig = queued.shift()(context.leiaConfig);
    context.currentProblemRef.current = context.leiaConfig.problem;
    context.currentBehaviourRef.current = context.leiaConfig.behaviour;
    context.currentPersonaRef.current = context.leiaConfig.persona;
    Object.assign(context, context.assemble());
  }
  render();
  return {
    context, requests, results, render,
    async turn(sequence) {
      replies = [...sequence, { message: "Done" }];
      context.inspectedLibrariesRef.current.clear();
      context.chatBusy = true;
      try { await context.run("chat", "Change to burger management"); }
      finally { context.chatBusy = false; render(); }
      assert.equal(replies.length, 0);
    },
    preview() { return renderToStaticMarkup(React.createElement(LeiaLivePreview, { ...context.previewProps(), title: "Burger stock", onTitleChange() {}, testAction: context.testAction() })); },
  };
}

test("video regression: persona, behaviour, then problem in separate responses tests and restores the new LEIA", async () => {
  const e = editor();
  await e.turn([...inspect(), call("apply_persona", { name: "burger-director", fullName: "Laura", description: "Operations director", personality: "Pragmatic" }), call("apply_behaviour", behaviour()), call("apply_problem", problem("burger-inventory"))]);
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

test("changing a problem alone never silently inherits an unchecked behaviour or stale preview", async () => {
  const e = editor();
  await e.turn([...inspect(), call("apply_problem", problem("burger-inventory"))]);
  assert.equal(e.context.leiaConfig.behaviour, null);
  assert.equal(e.context.generatedLeia, null);
  assert.equal(e.context.testAction().props.disabled, true);
  await e.context.testLeia();
  assert.equal(e.requests.length, 0);
  const html = e.preview();
  assert.ok(html.includes("burger-inventory"));
  assert.ok(html.includes("Sara"));
  assert.equal((html.match(/Waiting for the assistant/g) ?? []).length, 1);
  assert.ok(!html.includes("Ready to test"));
  const restored = editor({ config: e.context.leiaConfig });
  assert.equal(restored.preview(), html);
});

test("an explicit behaviour choice never leaks from one user turn to the next", async () => {
  const e = editor();
  await e.turn([...inspect(), call("apply_behaviour", behaviour())]);
  await e.turn([...inspect(), call("apply_problem", problem("burger-inventory"))]);
  assert.equal(e.context.leiaConfig.behaviour, null);
  assert.equal(e.context.generatedLeia, null);
});

test("a new problem with a different process invalidates even this turn's behaviour", async () => {
  const e = editor();
  await e.turn([...inspect(), call("apply_behaviour", behaviour()), call("apply_problem", problem("burger-game", ["game"]))]);
  assert.equal(e.context.leiaConfig.behaviour, null);
  assert.equal(e.context.generatedLeia, null);
  assert.equal(e.results.at(-1).output.behaviourPreserved, false);
  await e.context.testLeia();
  assert.equal(e.requests.length, 0);
});

test("selecting an existing problem preserves a compatible behaviour explicitly chosen in this turn", async () => {
  const p = resource("burger-inventory", problem("burger-inventory"));
  const b = resource("saved-interview", behaviour());
  const e = editor({ canEdit: false, problems: [p], behaviours: [b] });
  await e.turn([...inspect(), call("use_behaviour", { id: b.id }), call("use_problem", { id: p.id })]);
  assert.equal(e.context.leiaConfig.behaviour, b);
  assert.equal(e.context.generatedLeia.spec.problem.metadata.name, p.id);
});

test("failed behaviour selection cannot preserve the inherited behaviour for another problem", async () => {
  const e = editor({ canEdit: false });
  await e.turn([...inspect(), call("use_behaviour", { id: "invented" }), call("apply_problem", problem("burger-inventory"))]);
  assert.equal(e.context.leiaConfig.behaviour, null);
  assert.equal(e.context.generatedLeia, null);
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
      inspectedLibrariesRef: { current: new Set() }, pushMessage() {}, setInput() {}, setError() {}, setSending() {},
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
