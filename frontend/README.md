# Frontend

Progress Tracker client: web SPA, Android and iOS from one codebase.

**Planned stack:** Expo (React Native + TypeScript), Expo Router, TanStack Query, Zustand, react-hook-form + zod, i18next, Orval-generated API client. Every dependency must run in Expo Go ([decisions §2](../.claude/docs/decisions.md)).

**Responsibilities:**
- Onboarding, Home / Today, session logging per tracker type, history, progress & records, goals, settings
- Responsive layout (mobile / tablet / desktop), light and dark themes, accessibility
- English, Polish and Ukrainian with runtime switching
- Active workout and outbox stored on the device ([decisions §7](../.claude/docs/decisions.md))

> No source code yet. The UI follows the Figma file.
