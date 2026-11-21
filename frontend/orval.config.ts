import { defineConfig } from 'orval';

export default defineConfig({
  ember: {
    input: '../backend/openapi.json',
    output: {
      mode: 'tags-split',
      target: 'src/shared/api/generated/endpoints',
      schemas: 'src/shared/api/generated/model',
      client: 'react-query',
      httpClient: 'fetch',
      baseUrl: '',
      clean: true,
      override: {
        mutator: { path: 'src/shared/api/fetcher.ts', name: 'apiFetch' },
      },
    },
  },
});
