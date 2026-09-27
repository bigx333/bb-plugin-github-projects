import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ownerPattern = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const repoPattern = /^[A-Za-z0-9_.][A-Za-z0-9._-]{0,99}$/;

export function validateRepoName(name: string): string {
  if (!repoPattern.test(name) || name === "." || name === "..") {
    throw new Error("Repository name must be a valid GitHub repository name.");
  }
  return name;
}

export function parseGitHubRepo(value: string): { owner: string; name: string; slug: string } {
  const parts = value.split("/");
  if (parts.length !== 2 || !ownerPattern.test(parts[0])) {
    throw new Error("Repository must be in owner/repo format.");
  }
  const name = validateRepoName(parts[1]);
  return { owner: parts[0], name, slug: `${parts[0]}/${name}` };
}

export function resolveProjectPath(parentDir: string, repoName: string, targetDir?: string): string {
  validateRepoName(repoName);
  if (!path.isAbsolute(parentDir)) {
    throw new Error("Default Projects Directory must be an absolute path.");
  }
  if (targetDir && !path.isAbsolute(targetDir)) {
    throw new Error("Project directory must be an absolute path.");
  }
  const root = path.resolve(parentDir);
  const target = targetDir ? path.resolve(targetDir) : path.join(root, repoName);
  if (path.dirname(target) !== root) {
    throw new Error("Project directory must be a direct child of Default Projects Directory.");
  }
  validateRepoName(path.basename(target));
  return target;
}

export async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.lstat(target);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function githubRepoFromRemote(remote: string): string | null {
  const match = remote.match(/^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([^/]+)\/([^/]+)\/?$/i);
  if (!match) return null;
  const name = match[2].replace(/\.git$/i, "");
  try {
    return parseGitHubRepo(`${match[1]}/${name}`).slug.toLowerCase();
  } catch {
    return null;
  }
}

export async function verifyExistingImport(target: string, expectedSlug: string): Promise<string> {
  const stat = await fs.lstat(target);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`Import destination is not a regular directory: ${target}`);
  }

  let topLevel: string;
  let remote: string;
  try {
    const top = await execFileAsync("git", ["-C", target, "rev-parse", "--show-toplevel"]);
    topLevel = top.stdout.trim();
    const origin = await execFileAsync("git", ["-C", target, "remote", "get-url", "origin"]);
    remote = origin.stdout.trim();
  } catch {
    throw new Error(`Import destination must be a Git repository with an origin remote: ${target}`);
  }

  if ((await fs.realpath(topLevel)) !== (await fs.realpath(target))) {
    throw new Error(`Import destination must be the repository root: ${target}`);
  }
  if (githubRepoFromRemote(remote) !== parseGitHubRepo(expectedSlug).slug.toLowerCase()) {
    throw new Error(`Import destination has a different GitHub origin: ${target}`);
  }
  return remote;
}
