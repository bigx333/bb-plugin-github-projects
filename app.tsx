import { useCallback, useEffect, useMemo, useState } from "react";
import {
  definePluginApp,
  useBbNavigate,
  useRpc,
} from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import type { RepoItem, rpcContract } from "./server";

function GithubIcon({ className = "size-4 shrink-0" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function DownloadIcon({ className = "size-4 shrink-0" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function LockIcon({ className = "size-3.5 shrink-0" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function GlobeIcon({ className = "size-3.5 shrink-0" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

/**
 * 1. Create Modal: exactly one line — the name of the project, defaults to private.
 */
function CreateProjectModal() {
  const rpc = useRpc<typeof rpcContract>();
  const navigate = useBbNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [githubUser, setGithubUser] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onOpen = () => {
      setError(null);
      setName("");
      setIsOpen(true);

      rpc.call("get_defaults", null).then(
        (defaults) => setGithubUser(defaults.githubUser),
        () => {},
      );
    };

    window.addEventListener("bb:open-create-github-modal", onOpen);
    return () => window.removeEventListener("bb:open-create-github-modal", onOpen);
  }, [rpc]);

  const handleCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim()) return;

      setIsCreating(true);
      setError(null);

      try {
        const result = await rpc.call("create_project", {
          name: name.trim(),
          isPrivate: true,
        });

        if (result.ok) {
          toast.success(`Created GitHub project ${result.projectName}`);
          setIsOpen(false);
          if (result.projectId) {
            navigate.toProject(result.projectId);
          }
        } else {
          setError(result.error ?? "Failed to create project.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsCreating(false);
      }
    },
    [name, rpc, navigate],
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isCreating) {
          setIsOpen(false);
        }
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-popover p-5 shadow-2xl text-popover-foreground space-y-3 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GithubIcon className="size-5 text-foreground" />
            <h2 className="text-sm font-semibold leading-none">New Project on GitHub</h2>
          </div>
          <button
            type="button"
            disabled={isCreating}
            onClick={() => setIsOpen(false)}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {/* The one single line: project name (defaults to private) */}
        <form onSubmit={handleCreate} className="space-y-2 pt-1">
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-within:ring-1 focus-within:ring-ring">
              <span className="text-xs text-muted-foreground select-none">
                {githubUser ? `${githubUser}/` : "github.com/"}
              </span>
              <input
                type="text"
                autoFocus
                disabled={isCreating}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="project-name"
                className="ml-1 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <button
              type="submit"
              disabled={isCreating || !name.trim()}
              className="inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-md bg-primary px-3.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isCreating ? (
                <>
                  <svg className="size-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Creating…
                </>
              ) : (
                "Create Project"
              )}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Defaults to private repository · Clones to ~/projects/&lt;name&gt;
          </p>
        </form>
      </div>
    </div>
  );
}

/**
 * 2. Import Modal: lists existing GitHub projects for connected accounts excluding already cloned ones.
 */
function ImportProjectModal() {
  const rpc = useRpc<typeof rpcContract>();
  const navigate = useBbNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [repos, setRepos] = useState<RepoItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [importingRepo, setImportingRepo] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchRepos = useCallback(() => {
    setIsLoading(true);
    rpc.call("list_importable_repos", null).then(
      (res) => {
        setRepos(res.repos);
        setIsLoading(false);
      },
      (err) => {
        setIsLoading(false);
        setError("Failed to load GitHub repositories.");
        console.error(err);
      },
    );
  }, [rpc]);

  useEffect(() => {
    const onOpen = () => {
      setError(null);
      setSearch("");
      setImportingRepo(null);
      setIsOpen(true);
      fetchRepos();
    };

    window.addEventListener("bb:open-import-github-modal", onOpen);
    return () => window.removeEventListener("bb:open-import-github-modal", onOpen);
  }, [fetchRepos]);

  const filteredRepos = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return repos;
    return repos.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.nameWithOwner.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q)),
    );
  }, [repos, search]);

  const handleImport = useCallback(
    async (repo: RepoItem) => {
      setImportingRepo(repo.nameWithOwner);
      setError(null);

      try {
        const result = await rpc.call("import_project", {
          nameWithOwner: repo.nameWithOwner,
        });

        if (result.ok) {
          toast.success(`Imported GitHub project ${result.projectName}`);
          setIsOpen(false);
          if (result.projectId) {
            navigate.toProject(result.projectId);
          }
        } else {
          setError(result.error ?? "Failed to import project.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setImportingRepo(null);
      }
    },
    [rpc, navigate],
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !importingRepo) {
          setIsOpen(false);
        }
      }}
    >
      <div className="w-full max-w-xl rounded-xl border border-border bg-popover p-5 shadow-2xl text-popover-foreground space-y-3 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-2 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <DownloadIcon className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold leading-none">Import from GitHub</h2>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Existing repositories from connected accounts (excluding already cloned projects).
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={!!importingRepo}
            onClick={() => setIsOpen(false)}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {/* Search filter */}
        <div className="relative">
          <input
            type="text"
            autoFocus
            disabled={!!importingRepo}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search repositories…"
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Repositories list */}
        <div className="rounded-md border border-border bg-background/50 overflow-hidden">
          <div className="max-h-72 overflow-y-auto divide-y divide-border/40">
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-xs text-muted-foreground gap-2">
                <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Checking connected GitHub accounts…
              </div>
            ) : filteredRepos.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                {search ? "No matching repositories found." : "All repositories are already cloned and registered in BB."}
              </div>
            ) : (
              filteredRepos.map((repo) => {
                const isThisImporting = importingRepo === repo.nameWithOwner;
                return (
                  <div
                    key={repo.nameWithOwner}
                    className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-accent/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {repo.isPrivate ? (
                          <LockIcon className="text-muted-foreground" />
                        ) : (
                          <GlobeIcon className="text-muted-foreground" />
                        )}
                        <span className="font-mono text-xs font-medium text-foreground truncate">
                          {repo.nameWithOwner}
                        </span>
                      </div>
                      {repo.description && (
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5 max-w-md">
                          {repo.description}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={!!importingRepo}
                      onClick={() => handleImport(repo)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
                    >
                      {isThisImporting ? (
                        <>
                          <svg className="size-3 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                          Importing…
                        </>
                      ) : (
                        "Import"
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
          <span>{filteredRepos.length} uncloned repositories available</span>
          <button
            type="button"
            onClick={fetchRepos}
            disabled={isLoading || !!importingRepo}
            className="hover:underline hover:text-foreground"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}

export default definePluginApp((app) => {
  // App overlay hosting the two distinct modals
  app.slots.experimental_appOverlay({
    id: "github-project-modals",
    component: () => (
      <>
        <CreateProjectModal />
        <ImportProjectModal />
      </>
    ),
  });

  // Content script that injects TWO separate lines directly into the native picker dropdown:
  // Line 1: "New project on GitHub"
  // Line 2: "Import from GitHub"
  app.contentScripts.register({
    id: "github-project-picker-items",
    mount({ signal }) {
      const injectItems = () => {
        const newProjectItems = document.querySelectorAll<HTMLElement>(
          '[data-value="new-project"]',
        );

        for (const newProjectEl of newProjectItems) {
          const parent = newProjectEl.parentElement;
          if (!parent) continue;

          // 1. Injected "New project on GitHub"
          let createGhEl = parent.querySelector<HTMLElement>('[data-value="new-github-project"]');
          if (!createGhEl) {
            createGhEl = document.createElement("div");
            createGhEl.setAttribute("cmdk-item", "");
            createGhEl.setAttribute("role", "option");
            createGhEl.setAttribute("data-value", "new-github-project");
            createGhEl.className = `${newProjectEl.className} text-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer`;
            createGhEl.innerHTML = `
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="size-4 shrink-0 text-muted-foreground" aria-hidden="true">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              <span class="min-w-0 flex-1 truncate">New project on GitHub</span>
            `;

            createGhEl.addEventListener("click", (e) => {
              e.preventDefault();
              e.stopPropagation();
              document.dispatchEvent(
                new KeyboardEvent("keydown", {
                  key: "Escape",
                  code: "Escape",
                  keyCode: 27,
                  bubbles: true,
                }),
              );
              window.dispatchEvent(new CustomEvent("bb:open-create-github-modal"));
            });

            newProjectEl.after(createGhEl);
          }

          // 2. Injected "Import from GitHub"
          let importGhEl = parent.querySelector<HTMLElement>('[data-value="import-github-project"]');
          if (!importGhEl) {
            importGhEl = document.createElement("div");
            importGhEl.setAttribute("cmdk-item", "");
            importGhEl.setAttribute("role", "option");
            importGhEl.setAttribute("data-value", "import-github-project");
            importGhEl.className = `${newProjectEl.className} text-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer`;
            importGhEl.innerHTML = `
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" class="size-4 shrink-0 text-muted-foreground" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span class="min-w-0 flex-1 truncate">Import from GitHub</span>
            `;

            importGhEl.addEventListener("click", (e) => {
              e.preventDefault();
              e.stopPropagation();
              document.dispatchEvent(
                new KeyboardEvent("keydown", {
                  key: "Escape",
                  code: "Escape",
                  keyCode: 27,
                  bubbles: true,
                }),
              );
              window.dispatchEvent(new CustomEvent("bb:open-import-github-modal"));
            });

            createGhEl.after(importGhEl);
          }
        }
      };

      injectItems();

      const observer = new MutationObserver(() => {
        injectItems();
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      signal.addEventListener("abort", () => {
        observer.disconnect();
        document
          .querySelectorAll('[data-value="new-github-project"], [data-value="import-github-project"]')
          .forEach((el) => el.remove());
      });
    },
  });
});
