# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**UIGen** is an AI-powered React component generator with live preview. Users describe components in natural language; Claude generates them using tools that update a virtual file system, which instantly renders in an iframe preview.

## Commands

```bash
npm run setup       # First-time: install deps, generate Prisma client, run migrations
npm run dev         # Start dev server (Next.js + Turbopack) at localhost:3000
npm run build       # Production build
npm run lint        # ESLint
npm run test        # Run all Vitest tests
npm run db:reset    # Force-reset SQLite database
```

Run a single test file:
```bash
npx vitest src/lib/__tests__/file-system.test.ts
```

`NODE_OPTIONS='--require ./node-compat.cjs'` is prepended automatically by the npm scripts — needed for Babel standalone to work in Node.

## Architecture

### Request Flow

1. User sends a message via `ChatContext` (wraps Vercel AI SDK `useChat`)
2. `POST /api/chat` receives the message + current virtual file system state
3. Claude (Haiku 4.5 by default) responds with text + tool calls:
   - `str_replace_editor` — create or patch files via string replacement
   - `file_manager` — create, read, delete, rename files
4. `FileSystemContext` processes tool calls and updates in-memory state
5. `PreviewFrame` picks up file system changes, transforms JSX via Babel (client-side), and re-renders the iframe

### Key Subsystems

**Virtual File System** (`src/lib/file-system.ts`)
In-memory `Map<string, FileNode>` tree — no disk I/O. Serializable for DB storage. Implements the text editor operations Claude's tools expect (view with line ranges, str_replace, insert).

**Preview Pipeline** (`src/lib/transform/jsx-transformer.ts`)
Babel standalone transforms JSX → JS in the browser. An import map is built from the virtual file system so inter-file imports resolve to blob URLs. Renders in a sandboxed iframe.

**State Management**
Two React Contexts own all shared state:
- `FileSystemContext` (`src/lib/contexts/file-system-context.tsx`) — file tree + tool call dispatch
- `ChatContext` (`src/lib/contexts/chat-context.tsx`) — chat messages, wraps `useChat`

**Provider / Fallback** (`src/lib/provider.ts`)
Returns the Anthropic model when `ANTHROPIC_API_KEY` is set; otherwise returns `MockLanguageModel`, which replays a static 4-step demo flow so the UI works without credentials.

**Authentication** (`src/lib/auth.ts`, `src/actions/index.ts`)
JWT in an httpOnly cookie (7-day expiry, `jose`). Passwords hashed with `bcrypt`. Server actions handle sign-up/sign-in/sign-out. Projects are optional — anonymous users get full functionality but work is not persisted.

**Database** (`prisma/schema.prisma`)
SQLite via Prisma. Two models: `User` and `Project` (messages + file system stored as JSON strings). Prisma client is generated into `src/generated/prisma`.

### Layout

`src/app/main-content.tsx` renders a three-panel layout via `react-resizable-panels`:
- Left 35%: `ChatInterface`
- Right 65%: tabbed `PreviewFrame` / `CodeEditor` + `FileTree`

### Claude Integration Details

- System prompt is in `src/lib/prompts/generation.tsx` and uses ephemeral cache control for prompt caching
- Model is configured in `src/lib/provider.ts` — change `MODEL_ID` there to switch models
- The `api/chat` route (`src/app/api/chat/route.ts`) serializes/deserializes the virtual file system for each request

## Environment

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Optional — omit to use mock provider |

## Path Aliases

`@/*` maps to `src/*` (configured in `tsconfig.json`).
