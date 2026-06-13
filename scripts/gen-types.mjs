// Generates `strudel.d.ts`: permissive type stubs for everything the prelude
// (`strudel.js`) re-exports, so your editor gives autocomplete + docs-on-hover.
//
// Design: these types are intentionally NOT accurate. Strudel registers most
// chainable methods on Pattern.prototype dynamically at runtime, so a faithful
// static type is infeasible. Instead every function/method is typed as
// `(...args: any[]) => Pattern`. That's all the editor needs for completion and
// chaining; real correctness is enforced by the evaluate-on-save checker.
//
// Two data sources:
//   1. Authoritative NAMES come from runtime introspection of the live registry
//      (module exports + Pattern.prototype), so we never miss a registered name.
//   2. Hover DOCS come from the JSDoc comments in the packages' shipped source
//      (.mjs files), parsed below and attached to matching names.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// 1. Names from the live registry
// ---------------------------------------------------------------------------
const strudel = await import('../strudel.js');
const Pattern = strudel.Pattern;

const isFn = (v) => typeof v === 'function';

// Standalone exports that are functions (note, s, stack, sometimesBy, ...).
const exportedFns = Object.keys(strudel)
  .filter((k) => isFn(strudel[k]) && !k.startsWith('_'))
  .sort();

// Non-function exports that are Patterns (silence, ...) or other useful consts.
const exportedConsts = Object.keys(strudel)
  .filter((k) => !isFn(strudel[k]) && !k.startsWith('_'))
  .sort();

// Chainable members on the Pattern prototype (.fast, .rev, .jux, ...). Use
// descriptors so we never invoke getters (some query `this` and throw on the
// bare prototype). Split into callable methods vs getter-backed properties.
const protoMethods = [];
const protoGetters = [];
for (const k of Object.getOwnPropertyNames(Pattern.prototype)) {
  if (k === 'constructor' || k.startsWith('_')) continue;
  const desc = Object.getOwnPropertyDescriptor(Pattern.prototype, k);
  if (typeof desc.value === 'function') protoMethods.push(k);
  else if (desc.get) protoGetters.push(k);
}
protoMethods.sort();
protoGetters.sort();

// ---------------------------------------------------------------------------
// 2. JSDoc from the shipped package source
// ---------------------------------------------------------------------------
function sourceFilesFor(pkg) {
  const pkgDir = dirname(require.resolve(`${pkg}/package.json`));
  return readdirSync(pkgDir)
    .filter((f) => f.endsWith('.mjs'))
    .map((f) => join(pkgDir, f));
}

// name -> { description, examples: string[] }
const docs = new Map();

function cleanLines(block) {
  return block
    .split('\n')
    .map((l) => l.replace(/^\s*\*?\s?/, '').replace(/\s+$/, ''));
}

function parseBlock(block) {
  const inner = block.replace(/^\/\*\*+/, '').replace(/\*+\/\s*$/, '');
  const lines = cleanLines(inner);
  const names = [];
  const descLines = [];
  const examples = [];
  let mode = 'desc';
  let current = null;

  for (const line of lines) {
    const tag = line.match(/^@(\w+)\s*(.*)$/);
    if (tag) {
      if (current) {
        examples.push(current.join('\n').trim());
        current = null;
      }
      const [, name, rest] = tag;
      if (name === 'name') {
        const id = rest.trim().split(/\s+/)[0];
        if (id) names.push(id);
        mode = 'other';
      } else if (name === 'synonyms') {
        rest
          .split(/[,\s]+/)
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((s) => names.push(s));
        mode = 'other';
      } else if (name === 'example') {
        mode = 'example';
        current = [];
      } else {
        mode = 'other';
      }
      continue;
    }
    if (mode === 'desc') descLines.push(line);
    else if (mode === 'example' && current) current.push(line);
  }
  if (current) examples.push(current.join('\n').trim());

  return {
    names,
    description: descLines.join('\n').trim(),
    examples: examples.filter(Boolean),
  };
}

for (const pkg of ['@strudel/core', '@strudel/mini']) {
  for (const file of sourceFilesFor(pkg)) {
    const src = readFileSync(file, 'utf8');
    const blocks = src.match(/\/\*\*[\s\S]*?\*\//g) || [];
    for (const block of blocks) {
      const { names, description, examples } = parseBlock(block);
      if (!names.length || (!description && !examples.length)) continue;
      for (const name of names) {
        if (!docs.has(name)) docs.set(name, { description, examples });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Emit strudel.d.ts
// ---------------------------------------------------------------------------
function jsdocComment(name, indent = '') {
  const doc = docs.get(name);
  if (!doc) return '';
  const out = [];
  const esc = (s) => s.replace(/\*\//g, '*\\/');
  if (doc.description) out.push(...esc(doc.description).split('\n'));
  for (const ex of doc.examples.slice(0, 2)) {
    out.push('', '@example', ...esc(ex).split('\n'));
  }
  if (!out.length) return '';
  return (
    `${indent}/**\n` +
    out.map((l) => `${indent} * ${l}`.replace(/\s+$/, '')).join('\n') +
    `\n${indent} */\n`
  );
}

const documentedCount = { fns: 0, methods: 0 };

const methodDecls = protoMethods
  .map((m) => {
    if (docs.has(m)) documentedCount.methods++;
    return `${jsdocComment(m, '  ')}  ${m}(...args: any[]): Pattern;`;
  })
  .join('\n');

const getterDecls = protoGetters
  .map((g) => `${jsdocComment(g, '  ')}  readonly ${g}: any;`)
  .join('\n');

const fnDecls = exportedFns
  .map((fn) => {
    if (docs.has(fn)) documentedCount.fns++;
    return `${jsdocComment(fn)}export function ${fn}(...args: any[]): Pattern;`;
  })
  .join('\n\n');

const constDecls = exportedConsts
  .map((c) => {
    const isPattern = strudel[c] instanceof Pattern;
    return `${jsdocComment(c)}export const ${c}: ${isPattern ? 'Pattern' : 'any'};`;
  })
  .join('\n\n');

const header = `// AUTO-GENERATED by scripts/gen-types.mjs — do not edit by hand.
// Regenerate after upgrading Strudel:  bun run gen-types
//
// Permissive type stubs for autocomplete + docs-on-hover only. Every function
// returns Pattern so chains complete; argument types are intentionally \`any\`.
// Real correctness comes from the evaluate-on-save checker, not these types.
`;

const body = `${header}
/** A Strudel pattern. Methods are chainable and return a new Pattern. */
export interface Pattern {
${methodDecls}
${getterDecls}

  // Safety net for methods registered at runtime that aren't enumerated above.
  [key: string]: any;
}

// ---- Standalone functions (controls, combinators, modifiers) --------------

${fnDecls}

// ---- Values & other exports -----------------------------------------------

${constDecls}
`;

const outFile = join(root, 'strudel.d.ts');
const { writeFileSync } = await import('node:fs');
writeFileSync(outFile, body);

console.log(`wrote ${outFile}`);
console.log(
  `  ${exportedFns.length} functions (${documentedCount.fns} documented), ` +
    `${protoMethods.length} Pattern methods (${documentedCount.methods} documented), ` +
    `${exportedConsts.length} consts`,
);
console.log(`  ${docs.size} JSDoc entries parsed from source`);
