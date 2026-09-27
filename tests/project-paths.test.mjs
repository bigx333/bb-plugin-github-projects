import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parseGitHubRepo, resolveProjectPath, verifyExistingImport } from "../project-paths.ts";

test("repository names cannot escape the projects directory or become CLI flags", () => {
  assert.equal(parseGitHubRepo("Owner/.github").slug, "Owner/.github");
  for (const value of ["owner/..", "owner/.", "../repo", "owner/-flag", "owner/repo/extra"]) {
    assert.throws(() => parseGitHubRepo(value));
  }
});

test("project paths must be direct children of the configured directory", () => {
  const root = path.join(os.tmpdir(), "projects");
  assert.equal(resolveProjectPath(root, "repo"), path.join(root, "repo"));
  assert.equal(resolveProjectPath(root, "repo", path.join(root, "custom")), path.join(root, "custom"));
  for (const target of [root, path.join(root, "nested", "repo"), path.join(root, "..", "secret"), "relative/repo", path.join(root, "-flag")]) {
    assert.throws(() => resolveProjectPath(root, "repo", target));
  }
});

test("existing imports require the requested GitHub origin at the repository root", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bb-gh-project-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const repo = path.join(root, "repo");
  await fs.mkdir(repo);
  execFileSync("git", ["init", "-q", repo]);
  execFileSync("git", ["-C", repo, "remote", "add", "origin", "git@github.com:Owner/Repo.git"]);

  assert.equal(await verifyExistingImport(repo, "owner/repo"), "git@github.com:Owner/Repo.git");
  await assert.rejects(verifyExistingImport(repo, "owner/other"), /different GitHub origin/);

  const nested = path.join(repo, "nested");
  await fs.mkdir(nested);
  await assert.rejects(verifyExistingImport(nested, "owner/repo"), /repository root/);

  const link = path.join(root, "link");
  await fs.symlink(repo, link);
  await assert.rejects(verifyExistingImport(link, "owner/repo"), /regular directory/);

  const unrelated = path.join(root, "unrelated");
  await fs.mkdir(unrelated);
  await assert.rejects(verifyExistingImport(unrelated, "owner/repo"), /Git repository with an origin/);
});
