---
name: gh-project
description: Create or import GitHub repositories and register them as projects in BB using the `bb gh-project` CLI.
---

# GitHub Projects CLI

Use `bb gh-project` to create GitHub repositories or import existing ones from connected accounts directly into BB as native projects.

## Commands

- `bb gh-project create <name> [--public] [--description <desc>] [--dir <path>]`
  Creates a new GitHub repository under the authenticated user (defaults to private), adds a README, clones it locally, registers it with BB, and links it in Orca.
- `bb gh-project import <owner/repo> [--dir <path>]`
  Clones an existing GitHub repository from connected accounts and registers it directly into BB.
- `bb gh-project available`
  Lists existing GitHub repositories from connected accounts that have not been cloned or registered into BB yet.
- `bb gh-project list`
  Lists all projects currently registered in BB with their local paths and GitHub remote URLs.
