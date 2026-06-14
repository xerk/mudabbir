#!/usr/bin/env node
// One-shot codemod: convert *physical* Tailwind directional utilities to their
// *logical* equivalents so they flip automatically under dir="rtl".
//
// SAFE set only — margins, padding, borders, radii, text-align. Each pattern is
// guarded with \b so look-alikes are never touched:
//   rounded-lg / rounded-l-lg  -> only `rounded-l` (left) flips, `rounded-lg` (large) is left alone
//   border-red-500 / border-l  -> only `border-l` (left border) flips, colors untouched
// Variant chains (md:, hover:, group-hover:) and negatives (-ml-2) are handled
// automatically because the regex only rewrites the directional core + value.
//
// NOT handled here (done manually, need judgment): left-/right- insets,
// space-x-*, and directional icon mirroring.

import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const MAP = [
  [/\bml-/g, "ms-"],
  [/\bmr-/g, "me-"],
  [/\bpl-/g, "ps-"],
  [/\bpr-/g, "pe-"],
  [/\btext-left\b/g, "text-start"],
  [/\btext-right\b/g, "text-end"],
  [/\bborder-l\b/g, "border-s"],
  [/\bborder-r\b/g, "border-e"],
  [/\brounded-l\b/g, "rounded-s"],
  [/\brounded-r\b/g, "rounded-e"],
  [/\brounded-tl\b/g, "rounded-ss"],
  [/\brounded-tr\b/g, "rounded-se"],
  [/\brounded-bl\b/g, "rounded-es"],
  [/\brounded-br\b/g, "rounded-ee"],
];

const files = execSync("git ls-files 'src/**/*.tsx' 'src/**/*.ts'", {
  cwd: process.cwd(),
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean);

let changedFiles = 0;
let totalSubs = 0;
const report = [];

for (const file of files) {
  const original = readFileSync(file, "utf8");
  let next = original;
  let fileSubs = 0;
  for (const [re, to] of MAP) {
    next = next.replace(re, () => {
      fileSubs++;
      return to;
    });
  }
  if (next !== original) {
    writeFileSync(file, next);
    changedFiles++;
    totalSubs += fileSubs;
    report.push(`  ${file}  (${fileSubs})`);
  }
}

console.log(`Changed ${changedFiles} files, ${totalSubs} substitutions:`);
console.log(report.join("\n"));
