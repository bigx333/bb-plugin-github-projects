Create and import GitHub repositories directly from BB's native project picker and command line.

## What you get

- **New project on GitHub** entry directly in BB's native project picker dropdown. It opens a focused, one-line prompt for the repository name and creates a private GitHub repository automatically.
- **Import from GitHub** entry directly in the project picker dropdown. It lists all repositories from your connected GitHub account that have not yet been cloned or added to BB, with instant search and one-click import.
- Automatic local cloning into your projects directory and registration with BB's project database and Orca workspace fleet.
- A `bb gh-project` CLI command for creating, importing, and listing GitHub projects from your terminal.
- An agent skill (`gh-project`) allowing AI coding agents to discover and create GitHub projects autonomously.

## How it works

The plugin connects with the GitHub CLI (`gh`) on the host to authenticate and manage repositories. When you create or import a project, it provisions the repository on GitHub, clones the files locally, and registers the folder with `bb.sdk.projects.create` so BB immediately recognizes it as an active project.

## Commands

- `bb gh-project create <name> [--public] [--description <desc>] [--dir <path>]` — Create a new GitHub repository and register it in BB.
- `bb gh-project import <owner/repo> [--dir <path>]` — Clone an existing GitHub repository and add it to BB.
- `bb gh-project available` — List uncloned GitHub repositories ready to import.
- `bb gh-project list` — List all registered BB projects and their repository remotes.

## Requirements

Requires the GitHub CLI (`gh`) to be installed and authenticated on the machine where BB runs.
