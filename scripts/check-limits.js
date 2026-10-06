/**
 * Audits source files for agent-clean-code compliance.
 *
 * Checks:
 * - Function length (default 4-20 lines)
 * - File length (default < 500 lines)
 * - Use of `var` (should be const/let)
 * - Use of method binding on route handlers
 *
 * @example
 * node scripts/check-limits.js src/
 * node scripts/check-limits.js src/controllers/webController.js --func-limit=15
 */

import fs from "node:fs";
import path from "node:path";
import { Linter } from "eslint";

const DEFAULT_FUNC_LIMIT = 20;
const DEFAULT_FILE_LIMIT = 500;

function parseArgs(argv) {
  const target = argv[2] || ".";
  const funcLimit = parseInt(argv[3], 10) || DEFAULT_FUNC_LIMIT;
  const fileLimit = parseInt(argv[4], 10) || DEFAULT_FILE_LIMIT;
  return { target, funcLimit, fileLimit };
}

function collectJsFiles(target) {
  if (path.basename(target) === "node_modules") return [];
  if (fs.statSync(target).isFile())
    return target.endsWith(".js") ? [target] : [];
  const entries = fs.readdirSync(target, { withFileTypes: true });
  return entries.flatMap((entry) => collectEntryFiles(target, entry));
}

/** Collects JavaScript files from one directory entry without descending into dependencies. */
function collectEntryFiles(dir, entry) {
  const fullPath = path.join(dir, entry.name);
  if (entry.isDirectory() && entry.name !== "node_modules") {
    return collectJsFiles(fullPath);
  }
  return entry.isFile() && entry.name.endsWith(".js") ? [fullPath] : [];
}

function countLines(content) {
  return content.split("\n").length;
}

function findLongFunctions(content, limit) {
  const linter = new Linter();
  const messages = linter.verify(content, {
    parserOptions: { ecmaVersion: "latest", sourceType: "module" },
    rules: {
      "max-lines-per-function": [
        "error",
        { max: limit, skipBlankLines: true, skipComments: true },
      ],
    },
  });
  return messages
    .filter((message) => message.ruleId === "max-lines-per-function")
    .map(createFunctionLengthIssue);
}

/** Converts an ESLint function-length diagnostic to the checker's report shape. */
function createFunctionLengthIssue(message) {
  const name = message.message.match(/Function '([^']+)'/)?.[1] || "anonymous";
  const lines = Number(message.message.match(/too many lines \((\d+)\)/)?.[1]);
  return { name, start: message.line, lines };
}

function checkVarUsage(content) {
  const issues = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*var\s+/.test(lines[i])) {
      issues.push({ line: i + 1, text: lines[i].trim() });
    }
  }
  return issues;
}

function checkBindUsage(content) {
  const bindPattern = new RegExp("\\." + "bind\\(");
  return content
    .split("\n")
    .flatMap((line, index) =>
      bindPattern.test(line) ? [{ line: index + 1, text: line.trim() }] : [],
    );
}

function auditFile(filePath, funcLimit, fileLimit) {
  const content = fs.readFileSync(filePath, "utf8");
  return [
    ...collectFileLengthIssues(filePath, content, fileLimit),
    ...collectFunctionLengthIssues(filePath, content, funcLimit),
    ...formatLineIssues("var-usage", filePath, checkVarUsage(content)),
    ...formatLineIssues("bind-usage", filePath, checkBindUsage(content)),
  ];
}

/** Reports a file-length violation only when its line count exceeds the limit. */
function collectFileLengthIssues(filePath, content, fileLimit) {
  const lineCount = countLines(content);
  if (lineCount <= fileLimit) return [];
  return [
    { type: "file-length", path: filePath, value: lineCount, limit: fileLimit },
  ];
}

/** Attaches file paths to genuine ESLint function-length diagnostics. */
function collectFunctionLengthIssues(filePath, content, funcLimit) {
  return findLongFunctions(content, funcLimit).map((func) => ({
    type: "function-length",
    path: filePath,
    ...func,
  }));
}

/** Adds file and issue type context to line-based audit findings. */
function formatLineIssues(type, filePath, issues) {
  return issues.map(({ line, text }) => ({ type, path: filePath, line, text }));
}

function main() {
  const { target, funcLimit, fileLimit } = parseArgs(process.argv);
  const files = collectJsFiles(path.resolve(target));
  const issues = files.flatMap((file) => auditFile(file, funcLimit, fileLimit));
  if (issues.length === 0) return printPass();
  printIssueReport(issues, funcLimit);
}

/** Prints the stable success message and exits with a successful status. */
function printPass() {
  console.log("PASS: No agent-clean-code violations found.");
  process.exit(0);
}

/** Prints grouped and detailed findings before exiting with failure. */
function printIssueReport(issues, funcLimit) {
  const counts = countIssuesByType(issues);
  console.error("Agent Clean Code violations:");
  for (const [type, count] of Object.entries(counts)) {
    console.error(`  ${type}: ${count}`);
  }
  console.error("");
  issues.forEach((issue) => console.error(formatIssue(issue, funcLimit)));
  process.exit(1);
}

/** Counts findings by violation type for the report summary. */
function countIssuesByType(issues) {
  return issues.reduce((counts, { type }) => {
    counts[type] = (counts[type] || 0) + 1;
    return counts;
  }, {});
}

/** Formats one audit finding using the checker's existing CLI convention. */
function formatIssue(issue, funcLimit) {
  if (issue.type === "file-length") {
    return `${issue.path}: ${issue.value} lines (limit: ${issue.limit})`;
  }
  if (issue.type === "function-length") {
    return `${issue.path}:${issue.start} ${issue.name}: ${issue.lines} lines (limit: ${funcLimit})`;
  }
  return `${issue.path}:${issue.line} ${issue.text}`;
}

main();
