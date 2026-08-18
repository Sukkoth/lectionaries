# Lectionaries API & Data Catalog

High-performance, lightweight Bun server and data validation suite for serving multi-lingual lectionary data, daily scripture readings, and holiday catalogs.

---

## Features

- **Fast Bun Server**: Built with [Bun](https://bun.sh) for serverless execution and static file streaming with `Bun.file()`.
- **Root & Manifest Isolation**:
  - `GET /` returns plain text `"Hello World"`.
  - `GET /manifest.json` serves the root catalog manifest.
- **Security & Integrity**:
  - Path traversal protection (`sanitizePath`) preventing unauthorized filesystem access outside `./data`.
  - Strict HTTP method enforcement (`GET`, `HEAD`, `OPTIONS`) returning `405 Method Not Allowed` for mutating methods.
  - CORS preflight and configurable cache headers.
- **Comprehensive Validation Suite (64 Tests)**:
  - **Manifest Catalog Validation**: Schema rules, language code uniqueness, and 100% referential file integrity on disk.
  - **Readings Schema Validation**: Format checking (`YYYY-MM-DD`, positive orders, version codes) and scraper error field detection.
  - **Scripture Reference & Bounds Validation**: Full-name book matching against `check-point/versions.json` and chapter/verse limit verification against `check-point/bible-bounds.json`.
- **CI/CD Pipeline**: GitHub Actions workflow running formatting checks, ESLint, TypeScript type checking (`tsc --noEmit`), and `bun test`.

---

## Project Architecture

```
├── index.ts                      # Server entry point
├── src/
│   ├── config.ts                 # Server configuration & environment variables
│   ├── routes.ts                 # Static & custom route definitions
│   ├── handlers/
│   │   ├── health.ts             # GET /health endpoint handler
│   │   └── static.ts             # Dynamic static file handler & CORS preflight
│   └── utils/
│       └── security.ts           # Path normalization & traversal security
├── check-point/
│   ├── bible-bounds.json         # 66-book canonical chapter & verse limits
│   └── versions.json             # Translation book registry & localized book names
├── data/                         # Lectionary dataset (years, languages, versions)
│   ├── manifest.json             # Primary catalog manifest
│   └── 2019/                     # Year-specific lectionary files
├── tests/                        # Automated Bun test suite
│   ├── server.test.ts            # Integration & security tests
│   ├── manifest.test.ts          # Catalog & referential integrity tests
│   ├── readings.test.ts          # Language readings schema tests
│   ├── bounds.test.ts            # Bible bounds unit tests
│   └── reference-bounds.test.ts  # Scripture reference & chapter/verse bounds tests
└── .github/workflows/
    └── ci.yml                    # GitHub Actions CI workflow
```

---

## API Endpoints

| Method | Endpoint         | Description                                                                      |
| :----- | :--------------- | :------------------------------------------------------------------------------- |
| `GET`  | `/`              | Returns `"Hello World"`                                                          |
| `GET`  | `/health`        | Returns `{ "status": "ok" }`                                                     |
| `GET`  | `/manifest.json` | Serves root lectionary catalog manifest                                          |
| `GET`  | `/<path>`        | Serves static file from `./data/<path>` (e.g. `/2019/English/esv/readings.json`) |

---

## Getting Started

### Prerequisites

- [Bun runtime](https://bun.sh) (v1.0+)

### Installation

```bash
bun install
```

### Development Server

Run the development server with hot-reloading:

```bash
bun run dev
```

### Production Server

Start the server:

```bash
bun run start
```

---

## Quality Assurance & Scripts

| Command                | Description                                        |
| :--------------------- | :------------------------------------------------- |
| `bun run test`         | Executes all 64 automated tests                    |
| `bun run lint`         | Runs ESLint static code analysis                   |
| `bun run lint:fix`     | Automatically fixes fixable ESLint warnings/errors |
| `bun run format`       | Formats code with Prettier                         |
| `bun run format:check` | Checks code formatting against Prettier rules      |
| `bun run typecheck`    | Validates TypeScript types (`tsc --noEmit`)        |

---

## Deployment (Vercel)

This repository is optimized for Vercel's Free Hobby Tier using Edge Static Routing.

Include a `vercel.json` in your repository root:

```json
{
  "routes": [
    { "src": "^/$", "dest": "/index.html" },
    { "src": "^/manifest.json$", "dest": "/data/manifest.json" },
    { "src": "^/(.*)$", "dest": "/data/$1" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        {
          "key": "Access-Control-Allow-Methods",
          "value": "GET, HEAD, OPTIONS"
        },
        {
          "key": "Cache-Control",
          "value": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400"
        }
      ]
    }
  ]
}
```
