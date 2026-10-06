/**
 * Audits source files for agent-clean-code compliance.
 *
 * Checks (applied to .js/.jsx/.ts/.tsx):
 * - Function length (default 4-20 lines)
 * - File length (default < 500 lines)
 * - Use of `var` (should be const/let)
 * - Use of method binding on route handlers
 *
 * A PASS is only meaningful when files were actually scanned: an empty scan
 * (e.g. an all-TypeScript tree before .ts support existed) would otherwise
 * report success without inspecting anything.
 *
 * Lint strategy (ESLint 10 + typescript-eslint 8 + TypeScript 6):
 * - The original checker passed an eslintrc-style config (`parserOptions` at
 *   the top level). ESLint 10 expects flat-config `languageOptions`, so every
 *   file it inspected crashed with "configuredParser not found in config".
 * - typescript-eslint derives the TS/TSX grammar from both the filePath
 *   extension and `ecmaFeatures.jsx`: generic arrows (`async <T>(url: string)`)
 *   parse under TS, JSX markup parses under TSX. `.tsx` files need jsx on, so
 *   `.ts`/`.js` files are linted with jsx off to keep generic arrows valid.
 * - Function-length violations come from the core ESLint rule run via
 *   `Linter.verify` with the project's typescript-eslint parser.
 *
 * @example
 * node scripts/check-limits.js src/
 * node scripts/check-limits.js src/controllers/webController.js --func-limit=15
 * node scripts/check-limits.js src --func-limit=15 --file-limit=300
 */

import fs from "node:fs";
import path from "node:path";
import { Linter } from "eslint";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const tsParser = require("typescript-eslint").parser;

const DEFAULT_FUNC_LIMIT = 20;
const DEFAULT_FILE_LIMIT = 500;
const AUDIT_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx"];
const SKIP_DIRECTORIES = ["node_modules", "dist", "build"];

/** Inline flat config; eslintrc-style top-level `parserOptions` is rejected by ESLint 10. */
const AGENT_LIMITS_CONFIG_TEMPLATE = {
  files: ["**/*.{js,jsx,ts,tsx}"],
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
  },
  rules: {
    "max-lines-per-function": [
      "error",
      { skipBlankLines: true, skipComments: true },
    ],
  },
};

/**
 * Parses positional and `--flag=value` args from the reference skill CLI.
 * @example node scripts/check-limits.js src --func-limit=15 --file-limit=300
 */
function parseArgs(argv) {
  const positional = [];
  const overrides = {};
  for (const arg of argv.slice(2)) {
    const match = arg.match(/^--(func-limit|file-limit)=(\d+)$/);
    if (match) {
      overrides[match[1]] = Number(match[2]);
    } else if (!arg.startsWith("--")) {
      positional.push(arg);
    }
  }
  return {
    target: positional[0] || ".",
    funcLimit: overrides["func-limit"] ?? DEFAULT_FUNC_LIMIT,
    fileLimit: overrides["file-limit"] ?? DEFAULT_FILE_LIMIT,
  };
}

function collectAuditFiles(target) {
  if (isSkipDirectory(target)) return [];
  if (fs.statSync(target).isFile())
    return hasAuditExtension(target) ? [target] : [];
  const entries = fs.readdirSync(target, { withFileTypes: true });
  return entries.flatMap((entry) => collectEntryFiles(target, entry));
}

/** Collects audit-relevant files from one directory entry without descending into dependencies or build output. */
function collectEntryFiles(dir, entry) {
  const fullPath = path.join(dir, entry.name);
  if (entry.isDirectory() && !isSkipDirectory(fullPath)) {
    return collectAuditFiles(fullPath);
  }
  return entry.isFile() && hasAuditExtension(fullPath) ? [fullPath] : [];
}

/** Build output and dependencies are generated, so they are not agent-clean-code violations. */
function isSkipDirectory(filePath) {
  const name = path.basename(filePath);
  return SKIP_DIRECTORIES.some((skip) => name === skip);
}

function hasAuditExtension(filePath) {
  return AUDIT_EXTENSIONS.some((ext) => filePath.endsWith(ext));
}

function countLines(content) {
  return content.split("\n").length;
}

/**
 * Runs `max-lines-per-function` over one file. A parse failure is fatal to
 * the run — the checker never reports a PASS for a file it could not parse.
 */
function findLongFunctions(content, filePath, limit) {
  const linter = new Linter();
  const config = buildAgentLimitsConfig(filePath, limit);
  const messages = linter.verify(content, config, { filePath });
  const fatal = messages.filter((message) => message.fatal);
  if (fatal.length > 0) {
    throw new Error(
      `check-limits.js could not lint ${filePath}: ${fatal
        .map((message) => message.message)
        .join("; ")}`,
    );
  }
  return messages
    .filter((message) => message.ruleId === "max-lines-per-function")
    .map(createFunctionLengthIssue);
}

/** Builds the inline flat config, injecting the function limit from CLI args. */
function buildAgentLimitsConfig(filePath, limit) {
  const templateRules = AGENT_LIMITS_CONFIG_TEMPLATE.rules;
  const templateRule = templateRules["max-lines-per-function"];
  return {
    ...AGENT_LIMITS_CONFIG_TEMPLATE,
    languageOptions: languageOptionsForFile(filePath),
    rules: {
      ...templateRules,
      "max-lines-per-function": [
        templateRule[0],
        { ...templateRule[1], max: limit },
      ],
    },
  };
}

/**
 * The parser chooses its grammar from the filePath extension and jsx flag:
 * generic arrows (`async <T>(url: string)`) parse under TS, JSX markup under
 * TSX, so jsx is enabled only for .tsx/.jsx and off for .ts/.js.
 */
function languageOptionsForFile(filePath) {
  const languageOptions = AGENT_LIMITS_CONFIG_TEMPLATE.languageOptions;
  return {
    ...languageOptions,
    parserOptions: {
      ...languageOptions.parserOptions,
      ecmaFeatures: { jsx: isJsxRequired(filePath) },
    },
  };
}

function isJsxRequired(filePath) {
  return filePath.endsWith(".tsx") || filePath.endsWith(".jsx");
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
  return findLongFunctions(content, filePath, funcLimit).map((func) => ({
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
  const files = collectAuditFiles(path.resolve(target));
  if (files.length === 0) return printEmptyScanWarning();
  const issues = files.flatMap((file) => auditFile(file, funcLimit, fileLimit));
  if (issues.length === 0) return printPass(files.length);
  printIssueReport(issues, funcLimit);
}

/** A zero-file scan cannot certify compliance, so warn instead of falsely passing. */
function printEmptyScanWarning() {
  console.error(
    "WARNING: No .js/.jsx/.ts/.tsx files found in the target — nothing was audited.",
  );
  process.exit(1);
}

/** Prints the stable success message with how many files were audited. */
function printPass(auditedCount) {
  console.log(
    `PASS: No agent-clean-code violations found (${auditedCount} files audited).`,
  );
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
