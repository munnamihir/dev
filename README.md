# ScreenShift

**Legacy screens. Modern systems. Verifiable migrations.**

ScreenShift is a runnable, dependency-free migration workbench for legacy **ASP.NET Web Forms** screens. Paste or upload `.aspx` markup and optional C# code-behind, inspect extracted controls and risks, preview modern **Angular standalone / reactive forms** code, generate a **.NET 8** API contract scaffold, and download a ZIP of the generated artifacts. This is a **real rule-based migration foundation**, not an AI-powered semantic translator yet.

## Quick start

Requires Node.js 20+; no API keys or npm install needed.

```bash
npm start
# open http://localhost:4173
npm test
```

1. Click **Try sample** to import the bundled legacy registration screen.
2. Click **Analyze & generate** to create a migration report and scaffold artifacts.
3. Inspect the extracted controls, risks and file previews, then **Download ZIP**.
4. Replace the sample with your own non-sensitive `.aspx` / `.aspx.cs` files.

Set `PORT=4174` to change the port. The service binds to `127.0.0.1` by default; set `HOST` explicitly only if you have added appropriate access controls. Local projects persist under `.data/`, which is gitignored.

## Repository-wide application discovery (v0.3)

Open **http://localhost:4173/discovery** or use **Application discovery** in the workbench navigation. Select a local folder or load the synthetic sample to discover candidate modules, Web Forms screens, API controllers, literal client-to-API routes, Common API references, authorization annotations and `dbo` database references.

The discovery engine is **deterministic and heuristic**. Unresolved links and unverified policies are explicitly marked for human review; findings are not a security certification, a proven call graph or behavior-equivalent migration. It supports source folders with up to 200 files / 1.5 MB text, excluding hidden or credential-like paths. Sources are sent only to the local server for transient analysis and are **not executed or persisted** by the discovery endpoint.

- `GET /api/discovery/sample` — synthetic multi-module sample (no employer-owned source)
- `POST /api/discovery/analyze` — accepts `{"files":[{"path":"...","content":"..."}]}`
- `/discovery` — import UI, module and API report, policy findings, downloadable JSON

Not supported yet: AST/Roslyn dependency tracing, dynamic routes, inherited/global authorization, runtime verification, cross-repository analysis, and full autonomous migration.

## Working features

- Multiple local migration projects; create, list, delete, and persist.
- Client-side `.aspx` and `.aspx.cs` import; 2 MiB HTTP request limit.
- Deterministic Web Forms analysis for core server controls, validators, and C# event handlers.
- Risk findings for Telerik/RadControls, lifecycle operations, direct SQL and other manual work.
- Angular standalone component, HTML and basic CSS using reactive forms.
- .NET 8 controller/DTO **contract scaffold**; its POST returns HTTP **501** until business rules are implemented.
- JSON migration report, actionable review checklist, and downloadable ZIP.
- Node built-in test suite and GitHub Actions CI; no runtime dependencies.

## What is *not* automated

No claim of behavior-equivalent translation, full code-behind interpretation, database schema migration, authentication, Telerik conversions, safe SQL replacement, or exhaustive WCAG compliance. All generated code requires developer review and tests before it touches production. The parser handles a representative subset of Web Forms controls and intentionally reports unsupported controls. Do not upload employer or proprietary source code without authorization.

## Architecture

```
public/                Accessible responsive UI
server.mjs             HTTP API, input limits, safe artifact delivery
lib/engine.mjs         Parser, findings, generator
lib/store.mjs          Local project persistence
lib/zip.mjs            Dependency-free ZIP export
samples/               Synthetic Web Forms sample
.github/workflows/     CI
```

### API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Health and version |
| GET | `/api/sample` | Synthetic legacy screen |
| GET | `/api/projects` | List project summaries |
| POST | `/api/projects` | Create `{name}` |
| GET | `/api/projects/:id` | Read project incl. analysis |
| DELETE | `/api/projects/:id` | Delete project |
| POST | `/api/projects/:id/analyze` | Analyze `{aspx, codeBehind}` |
| GET | `/api/projects/:id/download` | ZIP generated artifacts |

## Product roadmap

1. Full ASPX AST parser and code-behind Roslyn analyzer, with data flow and event mapping.
2. Secure repository ingestion and content hashing; application-level screen dependency graph.
3. AI-assisted conversion behind an explicit reviewer approval loop, with reproducible prompts and confidence evidence.
4. Playwright browser diffs, contract tests and accessibility checks, evidence-based migration readiness.
5. Multi-tenant teams, SSO, isolated job workers, billing, audit log, and GitHub PR creation.

## Security notes

This starter is **local-first** and deliberately does not implement multi-user authentication. Do **not** expose it to the public internet or upload confidential code. No source is sent to external AI services. The generated API stub does **not** implement the legacy application's business logic. Before a hosted SaaS launch, add authenticated tenants, secure secrets, sandboxed processing, rate limiting, retention policies, security reviews and tenant isolation.
## v0.2 — multi-module API architecture

The migration studio accepts an optional JSON architecture manifest describing each module's API basePath, a separate Common API for dbo-backed shared resources, an OIDC identity contract, per-endpoint permissions and role alternatives. Use the synthetic `samples/architecture.json` fixture to explore. No employer source, credentials or proprietary RFP code are included.

Generated artifacts include Angular permission guard, OIDC adapter contract, same-origin auth interceptor, module-specific API clients, per-module secured .NET controllers, JWT validation policy registrations, and an API policy matrix. Optional screen bindings connect a screen's list/read and write operations to explicitly declared endpoints; read results get loading/empty/401/403 states.

**Security limitation:** This is a scaffolding generator, NOT a functioning enterprise SSO product or behavior-preserving migration engine. Connect an audited OIDC integration and real DTOs, enforce authorization and resource ownership independently in every API, and review all generated controller bodies (which return HTTP 501).
