import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { defineRpcContract, type BbPluginApi } from "@get-bb/plugin-sdk";
import { z } from "zod";

const execFileAsync = promisify(execFile);

const DEFAULT_PARENT_DIR = path.join(os.homedir(), "Projects");

async function runCmd(cmd: string, args: string[], cwd?: string) {
  return execFileAsync(cmd, args, { cwd });
}

async function getLocalHostId(bb: BbPluginApi): Promise<string> {
  const { primaryHostId } = await bb.sdk.system.config();
  if (!primaryHostId) {
    throw new Error("BB's local host is unavailable; cannot register a local project.");
  }
  return primaryHostId;
}

const repoItemSchema = z.object({
  name: z.string(),
  nameWithOwner: z.string(),
  url: z.string(),
  isPrivate: z.boolean(),
  description: z.string().nullable(),
  pushedAt: z.string().optional(),
});

export type RepoItem = z.infer<typeof repoItemSchema>;

export const rpcContract = defineRpcContract({
  get_defaults: {
    input: z.null(),
    output: z.object({
      githubUser: z.string().nullable(),
    }),
  },
  list_importable_repos: {
    input: z.null(),
    output: z.object({
      repos: z.array(repoItemSchema),
    }),
  },
  create_project: {
    input: z.object({
      name: z.string().trim().min(1).max(100),
      description: z.string().optional(),
      isPrivate: z.boolean().default(true),
      targetDir: z.string().optional(),
    }),
    output: z.object({
      ok: z.boolean(),
      projectId: z.string(),
      projectName: z.string(),
      projectPath: z.string(),
      gitRemoteUrl: z.string().optional(),
      error: z.string().optional(),
    }),
  },
  import_project: {
    input: z.object({
      nameWithOwner: z.string().trim().min(1),
      targetDir: z.string().optional(),
    }),
    output: z.object({
      ok: z.boolean(),
      projectId: z.string(),
      projectName: z.string(),
      projectPath: z.string(),
      gitRemoteUrl: z.string().optional(),
      error: z.string().optional(),
    }),
  },
});

async function getAuthenticatedUser(): Promise<string | null> {
  try {
    const { stdout } = await runCmd("gh", ["api", "user", "-q", ".login"]);
    const user = stdout.trim();
    return user.length > 0 ? user : null;
  } catch {
    return null;
  }
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function getUnclonedRepos(bb: BbPluginApi, defaultParentDir: string): Promise<RepoItem[]> {
  let allRepos: RepoItem[] = [];

  try {
    const { stdout } = await runCmd("gh", [
      "repo",
      "list",
      "--limit",
      "100",
      "--json",
      "name,nameWithOwner,url,isPrivate,description,pushedAt",
    ]);
    allRepos = JSON.parse(stdout);
  } catch (err) {
    bb.log.error(`Failed to list GitHub repos via gh CLI: ${String(err)}`);
    return [];
  }

  const registeredRemotes = new Set<string>();
  const registeredNames = new Set<string>();

  try {
    const bbProjects = await bb.sdk.projects.list();
    for (const p of bbProjects) {
      registeredNames.add(p.name.toLowerCase());
      if (p.gitRemoteUrl) {
        const m = p.gitRemoteUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/i);
        if (m) registeredRemotes.add(`${m[1]}/${m[2]}`.toLowerCase());
      }
      for (const s of p.sources || []) {
        if (s.path) {
          registeredNames.add(path.basename(s.path).toLowerCase());
        }
      }
    }
  } catch (err) {
    bb.log.warn(`Could not inspect bb projects list: ${String(err)}`);
  }

  try {
    const entries = await fs.readdir(defaultParentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        registeredNames.add(entry.name.toLowerCase());
        const gitDir = path.join(defaultParentDir, entry.name, ".git");
        if (await pathExists(gitDir)) {
          try {
            const { stdout } = await runCmd("git", [
              "-C",
              path.join(defaultParentDir, entry.name),
              "remote",
              "get-url",
              "origin",
            ]);
            const m = stdout.trim().match(/github\.com[/:]([^/]+)\/([^/.]+)/i);
            if (m) registeredRemotes.add(`${m[1]}/${m[2]}`.toLowerCase());
          } catch {
            // ignore missing origin
          }
        }
      }
    }
  } catch {
    // ignore
  }

  return allRepos.filter((r) => {
    const nameMatch = registeredNames.has(r.name.toLowerCase());
    const remoteMatch = registeredRemotes.has(r.nameWithOwner.toLowerCase());
    return !nameMatch && !remoteMatch;
  });
}

export default async function plugin(bb: BbPluginApi) {
  bb.log.info("bb-plugin-github-projects loaded");

  const settings = bb.settings.define({
    defaultProjectsDir: {
      type: "string",
      label: "Default Projects Directory",
      description: "Parent folder for cloned GitHub projects. Defaults to ~/Projects on the BB server machine.",
      default: DEFAULT_PARENT_DIR,
    },
    defaultPrivate: {
      type: "boolean",
      label: "Create Private Repositories by Default",
      default: true,
    },
  });

  // Register RPC Handlers
  bb.rpc.register(rpcContract, {
    async get_defaults() {
      const githubUser = await getAuthenticatedUser();
      return { githubUser };
    },

    async list_importable_repos() {
      const { defaultProjectsDir } = await settings.get();
      const parentDir = defaultProjectsDir || DEFAULT_PARENT_DIR;
      const repos = await getUnclonedRepos(bb, parentDir);
      return { repos };
    },

    async create_project({ name, description, isPrivate, targetDir }) {
      const { defaultProjectsDir } = await settings.get();
      const parentDir = defaultProjectsDir || DEFAULT_PARENT_DIR;
      const cleanName = name.trim().replace(/[^a-zA-Z0-9._-]/g, "-");
      const resolvedPath = targetDir ? path.resolve(targetDir) : path.join(parentDir, cleanName);

      bb.log.info(`Creating GitHub project ${cleanName} at ${resolvedPath}`);

      await fs.mkdir(path.dirname(resolvedPath), { recursive: true });

      const exists = await pathExists(resolvedPath);
      let gitRemoteUrl = "";

      if (!exists) {
        const ghArgs = [
          "repo",
          "create",
          cleanName,
          isPrivate ? "--private" : "--public",
          "--add-readme",
          "--clone",
        ];
        if (description?.trim()) {
          ghArgs.push("--description", description.trim());
        }

        await runCmd("gh", ghArgs, path.dirname(resolvedPath));

        try {
          const { stdout } = await runCmd("git", ["-C", resolvedPath, "remote", "get-url", "origin"]);
          gitRemoteUrl = stdout.trim();
        } catch {
          // remote url fallback
        }
      } else {
        try {
          const { stdout } = await runCmd("git", ["-C", resolvedPath, "remote", "get-url", "origin"]);
          gitRemoteUrl = stdout.trim();
        } catch {
          await runCmd("git", ["-C", resolvedPath, "init"]);
          const ghArgs = [
            "repo",
            "create",
            cleanName,
            isPrivate ? "--private" : "--public",
            "--source",
            resolvedPath,
            "--push",
          ];
          if (description?.trim()) {
            ghArgs.push("--description", description.trim());
          }
          await runCmd("gh", ghArgs);
          const { stdout } = await runCmd("git", ["-C", resolvedPath, "remote", "get-url", "origin"]);
          gitRemoteUrl = stdout.trim();
        }
      }

      const hostId = await getLocalHostId(bb);

      const project = await bb.sdk.projects.create({
        name: cleanName,
        source: {
          hostId,
          type: "local_path",
          path: resolvedPath,
        },
      });

      return {
        ok: true,
        projectId: project.id,
        projectName: project.name,
        projectPath: resolvedPath,
        gitRemoteUrl: gitRemoteUrl || undefined,
      };
    },

    async import_project({ nameWithOwner, targetDir }) {
      const { defaultProjectsDir } = await settings.get();
      const parentDir = defaultProjectsDir || DEFAULT_PARENT_DIR;
      const repoName = nameWithOwner.includes("/") ? nameWithOwner.split("/")[1] : nameWithOwner;
      const cleanName = repoName.trim().replace(/[^a-zA-Z0-9._-]/g, "-");
      const resolvedPath = targetDir ? path.resolve(targetDir) : path.join(parentDir, cleanName);

      bb.log.info(`Importing GitHub repo ${nameWithOwner} to ${resolvedPath}`);

      await fs.mkdir(path.dirname(resolvedPath), { recursive: true });

      const exists = await pathExists(resolvedPath);
      let gitRemoteUrl = `https://github.com/${nameWithOwner}.git`;

      if (!exists) {
        await runCmd("gh", ["repo", "clone", nameWithOwner, resolvedPath]);
        try {
          const { stdout } = await runCmd("git", ["-C", resolvedPath, "remote", "get-url", "origin"]);
          gitRemoteUrl = stdout.trim();
        } catch {
          // fallback
        }
      }

      const hostId = await getLocalHostId(bb);

      const project = await bb.sdk.projects.create({
        name: cleanName,
        source: {
          hostId,
          type: "local_path",
          path: resolvedPath,
        },
      });

      return {
        ok: true,
        projectId: project.id,
        projectName: project.name,
        projectPath: resolvedPath,
        gitRemoteUrl,
      };
    },
  });

  // Register CLI commands: bb gh-project
  bb.cli.register({
    name: "gh-project",
    summary: "Create and import GitHub projects in BB",
    commands: [
      {
        name: "create",
        summary: "Create a GitHub repository, clone it locally, and register it as a BB project",
        usage: "bb gh-project create <name> [--public] [--description <desc>] [--dir <path>]",
      },
      {
        name: "import",
        summary: "Clone an existing GitHub repository and register it as a BB project",
        usage: "bb gh-project import <owner/repo> [--dir <path>]",
      },
      {
        name: "list",
        summary: "List registered BB projects with their GitHub remotes",
        usage: "bb gh-project list",
      },
      {
        name: "available",
        summary: "List available GitHub repositories that have not been cloned yet",
        usage: "bb gh-project available",
      },
    ],
    async run(argv) {
      const sub = argv[0];
      if (!sub || sub === "help" || sub === "--help" || sub === "-h") {
        return {
          exitCode: 0,
          stdout: [
            "bb gh-project — Manage GitHub-backed BB projects",
            "",
            "Commands:",
            "  create <name> [--public] [--description <desc>] [--dir <path>]",
            "    Create a new repository on GitHub (defaults to private) and add it to BB",
            "  import <owner/repo> [--dir <path>]",
            "    Clone an existing GitHub repository and register it in BB",
            "  available",
            "    List uncloned GitHub repositories available to import",
            "  list",
            "    List existing BB projects and their repository remotes",
            "",
          ].join("\n"),
        };
      }

      if (sub === "available") {
        const { defaultProjectsDir } = await settings.get();
        const parentDir = defaultProjectsDir || DEFAULT_PARENT_DIR;
        const repos = await getUnclonedRepos(bb, parentDir);
        const lines = [`Available GitHub repositories to import (${repos.length}):`];
        for (const r of repos) {
          const privTag = r.isPrivate ? "[private]" : "[public]";
          lines.push(`  - ${r.nameWithOwner} ${privTag}`);
        }
        return { exitCode: 0, stdout: lines.join("\n") + "\n" };
      }

      if (sub === "list") {
        const projects = await bb.sdk.projects.list();
        const lines = ["BB Projects:"];
        for (const p of projects) {
          const defaultSource = p.sources?.find((s) => s.isDefault) ?? p.sources?.[0];
          const loc = defaultSource ? defaultSource.path : "(no source)";
          const remote = p.gitRemoteUrl ? ` [${p.gitRemoteUrl}]` : "";
          lines.push(`  - ${p.name} (${p.id}): ${loc}${remote}`);
        }
        return { exitCode: 0, stdout: lines.join("\n") + "\n" };
      }

      if (sub === "import") {
        const nameWithOwner = argv[1];
        if (!nameWithOwner) {
          return { exitCode: 1, stderr: "Error: repository name is required. Usage: bb gh-project import <owner/repo>\n" };
        }

        let dir: string | undefined;
        for (let i = 2; i < argv.length; i++) {
          if (argv[i] === "--dir" && argv[i + 1]) {
            dir = argv[i + 1];
            i++;
          }
        }

        const { defaultProjectsDir } = await settings.get();
        const parentDir = defaultProjectsDir || DEFAULT_PARENT_DIR;
        const repoName = nameWithOwner.includes("/") ? nameWithOwner.split("/")[1] : nameWithOwner;
        const cleanName = repoName.trim().replace(/[^a-zA-Z0-9._-]/g, "-");
        const resolvedPath = dir ? path.resolve(dir) : path.join(parentDir, cleanName);

        await fs.mkdir(path.dirname(resolvedPath), { recursive: true });

        const exists = await pathExists(resolvedPath);
        if (!exists) {
          await runCmd("gh", ["repo", "clone", nameWithOwner, resolvedPath]);
        }

        const hostId = await getLocalHostId(bb);

        const project = await bb.sdk.projects.create({
          name: cleanName,
          source: {
            hostId,
            type: "local_path",
            path: resolvedPath,
          },
        });

        return {
          exitCode: 0,
          stdout: `Successfully imported and registered BB project: ${project.name} (${project.id}) at ${resolvedPath}\n`,
        };
      }

      if (sub === "create") {
        const name = argv[1];
        if (!name) {
          return { exitCode: 1, stderr: "Error: project name is required. Usage: bb gh-project create <name>\n" };
        }

        const isPublic = argv.includes("--public");
        let description: string | undefined;
        let dir: string | undefined;

        for (let i = 2; i < argv.length; i++) {
          if (argv[i] === "--description" && argv[i + 1]) {
            description = argv[i + 1];
            i++;
          } else if (argv[i] === "--dir" && argv[i + 1]) {
            dir = argv[i + 1];
            i++;
          }
        }

        const { defaultProjectsDir } = await settings.get();
        const parentDir = defaultProjectsDir || DEFAULT_PARENT_DIR;
        const resolvedPath = dir ? path.resolve(dir) : path.join(parentDir, name);

        await fs.mkdir(path.dirname(resolvedPath), { recursive: true });

        const ghArgs = [
          "repo",
          "create",
          name,
          isPublic ? "--public" : "--private",
          "--add-readme",
          "--clone",
        ];
        if (description) ghArgs.push("--description", description);

        await runCmd("gh", ghArgs, path.dirname(resolvedPath));

        const hostId = await getLocalHostId(bb);

        const project = await bb.sdk.projects.create({
          name,
          source: {
            hostId,
            type: "local_path",
            path: resolvedPath,
          },
        });

        return {
          exitCode: 0,
          stdout: `Successfully created GitHub repository and registered BB project: ${project.name} (${project.id}) at ${resolvedPath}\n`,
        };
      }

      return { exitCode: 1, stderr: `Unknown command: ${sub}\n` };
    },
  });
}
