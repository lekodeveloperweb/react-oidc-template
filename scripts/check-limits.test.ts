import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const SCRIPT_PATH = path.resolve("scripts/check-limits.js");
const SCRIPT_CONTENT = readFileSync(SCRIPT_PATH, "utf8");

function runChecker(target: string, ...flags: string[]) {
  try {
    const stdout = execFileSync(
      process.execPath,
      [SCRIPT_PATH, target, ...flags],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    return { code: 0, stdout, stderr: "" };
  } catch (error) {
    const failure = error as {
      status?: number;
      stdout?: string;
      stderr?: string;
    };
    return {
      code: failure.status ?? 1,
      stdout: failure.stdout ?? "",
      stderr: failure.stderr ?? "",
    };
  }
}

/** Violation types and counts, read from the summary lines of the report. */
function violationCounts(stderr: string): Record<string, number> {
  return Object.fromEntries(
    [...stderr.matchAll(/^ {2}([\w-]+): (\d+)$/gm)].map(([, type, count]) => [
      type,
      Number(count),
    ]),
  );
}

function withTempFile(
  name: string,
  source: string,
  run: (file: string, dir: string) => void,
) {
  const dir = mkdtempSync(path.join(tmpdir(), "check-limits-"));
  try {
    const file = path.join(dir, name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, source);
    run(file, dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("check-limits.js", () => {
  it("runs linter.verify with an inline flat config using languageOptions", () => {
    expect(SCRIPT_CONTENT).toContain("languageOptions");
    // The original checker passed the eslintrc shape, which ESLint 10
    // rejects with "configuredParser not found in config".
    expect(SCRIPT_CONTENT).toMatch(/languageOptions:\s*\{\s*\n\s*parser:/);
    expect(SCRIPT_CONTENT).not.toMatch(
      /["']parserOptions["']\s*:\s*\{[^}]*["']parser["']\s*:/,
    );
  });

  it("finds .tsx and .ts files and lints them without parse errors", () => {
    const out = runChecker("src/");
    expect(out.stderr).not.toMatch("Parsing error");
    expect(out.code).toBe(1);
    expect(out.stderr).toMatch(/App\.tsx/);
  });

  it("skips generated directories: dist, node_modules, build", () => {
    withTempFile("dist/bundle.js", bundleSample(), (_file, dir) => {
      const out = runChecker(dir);
      expect(out.code).toBe(1);
      expect(out.stderr).toMatch("nothing was audited");
    });
  });

  it("warns and fails when the target directory has no files to audit", () => {
    withTempFile("nested.js", "export const x = 1;\n", (_file, dir) => {
      rmSync(path.join(dir, "nested.js"));
      const out = runChecker(dir);
      expect(out.code).toBe(1);
      expect(out.stderr).toMatch("nothing was audited");
    });
  });

  it("passes clean files and reports the audited count", () => {
    withTempFile("clean.ts", "export const x = 1;\n", (file) => {
      const out = runChecker(file);
      expect(out.code).toBe(0);
      expect(out.stdout).toMatch("PASS");
      expect(out.stdout).toMatch("1 files audited");
    });
  });

  it("reports over-long functions, files, var and bind usage", () => {
    withTempFile("sample.tsx", longSample(), (file) => {
      const out = runChecker(file, "--func-limit=5", "--file-limit=10");
      expect(out.code).toBe(1);
      expect(violationCounts(out.stderr)).toEqual({
        "function-length": 1,
        "file-length": 1,
        "var-usage": 1,
        "bind-usage": 1,
      });
    });
  });

  it("lints a tsx file with jsx markup", () => {
    withTempFile("mixed.tsx", mixedTsxSample(), (file) => {
      const out = runChecker(file);
      expect(out.stderr).not.toMatch("Parsing error");
    });
  });

  it("fails loudly when a file cannot be parsed at all", () => {
    withTempFile("broken.ts", "const broken = <<<unparseable>>>;\n", (file) => {
      const out = runChecker(file);
      expect(out.code).toBe(1);
      expect(out.stderr).toMatch(/could not lint .*: Parsing error/);
    });
  });
});

/** .tsx fixture exercising every checker rule. */
function longSample() {
  const body = Array.from(
    { length: 12 },
    (_, i) => `  const v${i} = ${i};`,
  ).join("\n");
  return [
    "var legacy = 1;",
    "const handler = () => {",
    body,
    "  return legacy;",
    "};",
    "const bound = handler.bind(null);",
    "export const View = () => <div>{bound}</div>;",
    "",
  ].join("\n");
}

function mixedTsxSample() {
  return [
    "export const fetchJson = async <T,>(url: string): Promise<T> => {",
    "  const res = await fetch(url);",
    "  return (await res.json()) as T;",
    "};",
    "export const View = () => <div>ok</div>;",
    "",
  ].join("\n");
}

/** A minified bundle that would otherwise trip the file-length rule. */
function bundleSample() {
  return Array.from({ length: 600 }, (_, i) => `const v${i} = ${i};`).join(
    "\n",
  );
}
