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
  the OAuth login flow (`VITE_HOME_URL`)
- Persistent data: none. Session lives in orchestration cookies; the theme is in `localStorage`
  under `artel-theme`, shared with artel-home

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

## Constraints

- Supported platforms: modern browsers
- Compatibility requirements: TODO
- Performance constraints: TODO
- Security or privacy requirements: TODO

## Ownership

- Maintainers: TODO
- Sensitive modules: TODO
- Changes requiring explicit review: TODO
