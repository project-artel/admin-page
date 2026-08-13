# Project Context

Fill this document during project initialization. Agents must verify commands against repository configuration before running them.

## Overview

- Product: Artel admin page
- Primary users: TODO
- Core domain: TODO
- Runtime environment: Browser SPA (React 19 + Vite 8, TypeScript)

## Architecture

- Entry points: `index.html`, `src/main.tsx`
- Main modules: `src/api` (orchestration client), `src/auth` (session boundary), `src/projects`,
  `src/qaStats` (QA run-config dashboard)
- Dependency direction: feature modules depend on `src/api`; `src/api` depends on nothing local
- External systems: artel-orchestration-server REST API (`VITE_ORCHESTRATION_URL`), artel-home for
  the OAuth login flow (`VITE_HOME_URL`), GitHub repository `project-artel/admin-page`, and Jira
  project `ARTEL` via the `mcp-atlassian` MCP server
- Persistent data: none. Session lives in orchestration cookies; the theme is in the `artel-theme`
  cookie scoped to `.artel.kr`, shared with artel-home

## Commands

| Purpose | Command |
|---|---|
| Install dependencies | `npm install` |
| Run locally | `npm run dev` (port 5174) |
| Format | TODO |
| Lint | `npm run lint` |
| Type-check | `npm run typecheck` |
| Unit tests | `npm test` (vitest) |
| Integration tests | TODO |
| Build | `npm run build` |
| Set up Jira credentials | `cp .jira.env.example .jira.env` |

Work is tracked in Jira project `ARTEL`, not in GitHub issues. Jira access goes
through the `mcp-atlassian` MCP server, declared in `.mcp.json` at the
repository root. Claude Code starts it on demand and asks for approval the first
time it connects.

Credentials live in `.jira.env`, which the server reads through `--env-file`.
Copy `.jira.env.example` and fill in `JIRA_URL`, `JIRA_USERNAME`, and
`JIRA_API_TOKEN`, issuing the token at
`https://id.atlassian.com/manage-profile/security/api-tokens`. `.gitignore`
excludes `.jira.env`; never commit it.

The server reads that file itself, so the setup does not depend on how Claude
Code was launched or on which shell exports the variables. Do not register a
`jira` server in user scope as well, or two copies start.

## Constraints

- Supported platforms: modern browsers
- Compatibility requirements: TODO
- Performance constraints: TODO
- Security or privacy requirements: TODO

## Ownership

- Maintainers: TODO
- Sensitive modules: TODO
- Changes requiring explicit review: TODO
