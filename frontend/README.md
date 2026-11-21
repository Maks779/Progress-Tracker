# Frontend

Ember client: web SPA, Android and iOS from one codebase.

## Stack

- [Expo](https://expo.dev) SDK 58 (React Native 0.88, TypeScript). Every library runs in Expo Go, so the app can be tested on an iPhone without a Mac.
- Expo Router (file-based navigation), TanStack Query (server data), i18next (English, Polish, Ukrainian)
- API client generated from `../backend/openapi.json` with Orval
- Inter font, Lucide icons, design tokens from the Figma file
- Jest, ESLint, TypeScript

## Layout

```
frontend/
├── src/
│   ├── app/              routes: every file is a screen, _layout.tsx files are navigators
│   │   └── (tabs)/       bottom tabs: Home, History, +, Progress, Profile
│   └── shared/
│       ├── api/          fetcher, query client; generated/ is written by Orval
│       ├── i18n/         i18next setup and locales/en|pl|uk.json
│       ├── theme/        design tokens, light and dark themes, breakpoints
│       └── ui/           Text, Button, Card, Screen, icons
├── app.json              Expo config
└── orval.config.ts       API client generation
```

## Run

Requirements: Node.js LTS, the backend running (see the root README).

```bash
npm install
npm run web        # browser at http://localhost:8082
npm start          # QR code for Expo Go on a phone
```

The dev server uses port 8082. On a phone, Expo Go must be on the same Wi-Fi as the computer; the app then calls the API on the same computer at port 8000. If the phone cannot connect, allow ports 8000 and 8082 in the Windows firewall for private networks.

## Checks

```bash
npm run lint
npm run typecheck
npm test
```

## API client

After the backend's `openapi.json` changes, regenerate the client (CI fails while it is outdated):

```bash
npm run api
```
