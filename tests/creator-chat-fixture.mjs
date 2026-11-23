import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import * as chatBehaviours from "../src/lib/chatBehaviours.mjs";

const require = createRequire(import.meta.url);
export const readSource = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const panelSource = await readSource("src/components/ProblemChatPanel.tsx");
export function declaration(source, name) {
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
export const compile = source => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
export function loadModule(source, resolve = require) {
  const context = { exports: {}, require: resolve, structuredClone, crypto, console };
  vm.createContext(context);
  vm.runInContext(compile(source), context);
  return context.exports;
}
const helper = loadModule(await readSource("src/lib/helper.ts"));
const leia = loadModule(await readSource("src/lib/leia.ts"), () => helper);
const process = loadModule(await readSource("src/lib/process.ts"));
const rubrics = loadModule(await readSource("src/lib/rubrics.ts"));
const rubricSchema = loadModule(await readSource("src/lib/rubricSchema.ts"), name => name === "./axios" ? {} : require(name));
export const { generateLeia } = leia;
const commands = loadModule(await readSource("src/lib/creatorCommands.ts"), name => {
  if (name === "./chatBehaviours.mjs") return chatBehaviours;
  if (name === "./leia") return leia;
  if (name === "./process") return process;
  if (name === "./rubrics") return rubrics;
  if (name === "./rubricSchema") return rubricSchema;
  return require(name);
});

export function chatFixture({ config, canEdit, problems = [], behaviours = [], personas = [] }) {
  const results = [];
  let replies = [];
  let proposal = null;
  const editor = {
    draft: { config, customizations: { leia: { name: "" } }, nameManuallyEdited: false, rubricDraft: null, rubricEnabled: false },
    user: { id: "instructor" },
    canEditBehaviour: canEdit,
    library: { problem: problems, behaviour: [...behaviours], persona: personas },
  };
  const context = {
    ...commands, ...chatBehaviours, chatTools: [], attachments: [], latest: { current: editor }, rubricSchema: null,
    setProposal: value => { proposal = value; },
    sendProblemChatMessage: async (_chatId, body) => {
      if (body.toolResults) results.push(...body.toolResults);
      const next = replies.shift();
      assert.ok(next, "Unexpected model continuation");
      return typeof next === "function" ? next(body) : next;
    },
  };
  vm.createContext(context);
  const source = ["turnPriority", "toolPriority", "runTurn"].map(name => declaration(panelSource, name)).join("\n");
  vm.runInContext(compile(`${source}\nglobalThis.run=runTurn;`), context);
  return {
    editor, results,
    get proposal() { return proposal; },
    async turn(sequence, message = "Create a LEIA") {
      proposal = null;
      replies = [...sequence, { message: "Done" }];
      await context.run("chat", message, editor.draft);
      assert.equal(replies.length, 0);
    },
    apply() {
      assert.ok(proposal, "Expected a proposal to approve");
      assert.equal(proposal.base, editor.draft);
      assert.equal(commands.validateCreatorChanges(proposal.base, proposal.next, editor), null);
      editor.draft = proposal.next;
      const behaviour = editor.draft.config.behaviour;
      if (behaviour?.edited) editor.library.behaviour = chatBehaviours.behaviourCandidates(behaviours, [...editor.library.behaviour, behaviour]);
      proposal = null;
    },
  };
}
