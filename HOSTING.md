# Anonymous HTTP hosting

This fork adds an anonymous-only Streamable HTTP endpoint to [lewpgs/migros-mcp](https://github.com/lewpgs/migros-mcp). The original stdio entrypoint remains available.

## Run

Requires Node.js 22 or newer.

```sh
npm ci
npm run build
PORT=3000 npm run start:http
```

MCP endpoint: `POST /mcp`. Health check: `GET /health`. No Migros account or MCP authentication is required. The HTTP server exposes eight read-only tools: product search/details, stock, stores, promotions, and three Migusto recipe tools. Account, cart, order, Cumulus, and the currently broken upstream category-list tool are not registered by the HTTP entrypoint. Migros account environment variables are never read by that entrypoint.

The HTTP service validates Host and Origin, limits bodies to 64 KiB, limits concurrency to eight requests and traffic to 300 requests/minute per process, and runs as the unprivileged node user in Docker. Set `PUBLIC_HOST` for custom domains, or use Railway's automatic `RAILWAY_PUBLIC_DOMAIN`. For direct browser integrations, set a comma-separated `ALLOWED_ORIGINS` allowlist. Server-side MCP clients do not need an Origin header.

## Railway

Use the Dockerfile, set `PORT=3000`, route the public domain to port 3000, and use `/health` as the health check. Infrastructure settings are in `.railway/railway.ts`; review with `railway config plan` and apply with `railway config apply`.

Only this fork's main branch should be deployed. Upstream changes are reviewed and merged deliberately via the retained upstream repository relationship. Do not auto-sync upstream into production.

## Compatibility fixes

- Uses Migusto's current public search pages and recipe JSON-LD after the legacy `.rest` endpoints were removed. Search uses the site's `q` parameter, with bounded pagination. Ingredient names are additional search terms.
- Recipe slugs include the numeric ID. For recipe ingredient products, pass both `recipeId` and `slug` from `search_recipes`.
- Normalizes numeric product search IDs to strings accepted by the detail tool.
- Unavailable stock data returns `inStock: null` rather than claiming the item is out of stock.
- Updates MCP SDK and Zod and overrides deepmerge to the non-affected 4.1.1 version; audit the lockfile on updates.

The APIs are unofficial and can change. Prices/promotions are the current API response, and stock is approximate. No order placement is available through HTTP.

## Verify

```sh
npm test
npm audit --omit=dev
```

The HTTP tests exercise MCP initialization/discovery, verify the anonymous-only tool set even when account environment variables exist, reject forbidden origins/hosts and oversized requests, and validate product batch limits. Live checks should additionally exercise each tool after changes to upstream APIs.
