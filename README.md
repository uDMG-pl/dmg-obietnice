# DMG Obietnice

A Next.js application for publishing and managing public promises. The public
website reads promises from MongoDB, while the versioned management API is
protected with Better Auth API keys.

## Local setup

Requirements:

- Node.js 20.9 or newer
- npm
- a MongoDB database

Install dependencies and create a local environment file:

```bash
npm install
cp .env.example .env.local
```

Generate a Better Auth secret and put it in `.env.local`:

```bash
openssl rand -base64 32
```

At minimum, configure these variables:

| Variable | Purpose | Example/default |
| --- | --- | --- |
| `MONGODB_URI` | MongoDB connection string | required |
| `MONGODB_DB` | MongoDB database name | required |
| `MONGODB_COLLECTION` | Promise collection | `obietnice` |
| `BETTER_AUTH_SECRET` | Secret used by Better Auth; use at least 32 random characters | required |
| `BETTER_AUTH_URL` | Public origin of this application | `http://localhost:3000` locally |
| `API_KEY_OWNER_EMAIL` | Email assigned to the technical API-key owner | required; e.g. `api-keys@dmg-obietnice.invalid` |
| `API_RATE_LIMIT_MAX` | Requests allowed per API key in one window | `100` |
| `API_RATE_LIMIT_WINDOW_MS` | Rate-limit window in milliseconds | `60000` |

The Turnstile and submission rate-limit variables in `.env.example` are used by
the public submission form and are independent of the management API.

Start the development server:

```bash
npm run dev
```

The website and API are then available at
[http://localhost:3000](http://localhost:3000).

## API keys

API keys are managed locally from the command line. They are stored as hashes,
and the full secret is printed only once when a key is created. Save it in a
secret manager immediately. The first command also creates the technical owner
and the required Better Auth MongoDB indexes.

Create a read-only key:

```bash
npm run api-keys -- create --name "Reporting integration" --scope read
```

Create a read/write key, optionally with an expiry:

```bash
npm run api-keys -- create \
  --name "Editorial integration" \
  --scope read-write \
  --expires-in-days 90
```

Key names can be at most 32 characters. Expiries are optional and can be from
1 to 365 days; keys without `--expires-in-days` do not expire automatically.

List safe key metadata (never the full key):

```bash
npm run api-keys -- list
```

Revoke a key by the ID shown by `list`:

```bash
npm run api-keys -- revoke --id KEY_ID
```

Read-only keys can call `GET` endpoints. Read/write keys can call every promise
endpoint. Send the key in the `x-api-key` header; it is never accepted in the
URL. Missing or invalid keys return `401`, insufficient permissions return
`403`, and rate-limited requests return `429`.

## Promise API

The API is versioned under `/api/v1`. Its full machine-readable contract is in
[`docs/openapi.yaml`](docs/openapi.yaml).

Set convenient shell variables for the examples:

```bash
export BASE_URL=http://localhost:3000
export API_KEY=dmg_your_key_here
```

List the newest promises. `limit` defaults to 50 and is capped at 100:

```bash
curl --get "$BASE_URL/api/v1/promises" \
  --header "x-api-key: $API_KEY" \
  --data-urlencode "limit=25"
```

The list response contains an opaque cursor for the next page:

```json
{
  "data": [
    {
      "id": "66a12f15f32e7a58d83b6f19",
      "title": "Publish the annual report",
      "dateDue": { "year": 2026, "month": 9 },
      "status": "promised",
      "tags": ["reports"]
    }
  ],
  "pagination": {
    "limit": 25,
    "nextCursor": "66a12f15f32e7a58d83b6f19"
  }
}
```

Pass `nextCursor` back unchanged to fetch the next page:

```bash
curl --get "$BASE_URL/api/v1/promises" \
  --header "x-api-key: $API_KEY" \
  --data-urlencode "limit=25" \
  --data-urlencode "cursor=66a12f15f32e7a58d83b6f19"
```

For numbered navigation, request a page directly (one-based):

```bash
curl --get "$BASE_URL/api/v1/promises" \
  --header "x-api-key: $API_KEY" \
  --data-urlencode "limit=25" \
  --data-urlencode "page=2"
```

This returns only the requested page and adds `currentPage`, `totalCount`, and
`totalPages` to `pagination`. Out-of-range pages are clamped to the last page;
an empty collection returns page 1 of 1. `page` and `cursor` cannot be combined.
Existing requests without `page` retain the original cursor response.

Deploy this service version before the UDMG numbered admin promises panel.
No MongoDB migration, additional index or replacement API key is required.

Get one promise:

```bash
curl "$BASE_URL/api/v1/promises/66a12f15f32e7a58d83b6f19" \
  --header "x-api-key: $API_KEY"
```

Create a promise with a read/write key:

```bash
curl --request POST "$BASE_URL/api/v1/promises" \
  --header "x-api-key: $API_KEY" \
  --header "content-type: application/json" \
  --data '{
    "title": "Publish the annual report",
    "description": "Make the audited report publicly available.",
    "url": "https://example.com/announcement",
    "datePromised": { "year": 2025, "month": 11, "day": 4 },
    "dateDue": { "year": 2026, "month": 9 },
    "status": "promised",
    "tags": ["reports", "transparency"]
  }'
```

Update selected fields. Set `description`, `url`, `datePromised`, `dateDue`, or
`notes` to `null` to remove that value; use an empty array to clear `tags`:

```bash
curl --request PATCH \
  "$BASE_URL/api/v1/promises/66a12f15f32e7a58d83b6f19" \
  --header "x-api-key: $API_KEY" \
  --header "content-type: application/json" \
  --data '{
    "status": "fulfilled",
    "notes": null,
    "tags": []
  }'
```

Permanently delete a promise:

```bash
curl --request DELETE \
  "$BASE_URL/api/v1/promises/66a12f15f32e7a58d83b6f19" \
  --header "x-api-key: $API_KEY"
```

All response bodies are JSON except a successful `DELETE`, which returns `204`
with no body. Errors use one shape throughout the API:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "title",
        "code": "too_small",
        "message": "Too small: expected string to have >=1 characters"
      }
    ]
  }
}
```

## Promise dates

The API accepts dates only in their canonical partial-date object form:

```json
{ "year": 2026 }
{ "year": 2026, "month": 7 }
{ "year": 2026, "month": 7, "day": 11 }
```

A month requires a year, and a day requires both a year and a month. Calendar
dates are validated, including leap years. Existing MongoDB `Date` values and
ISO date strings remain readable by the public website and are normalized to an
exact day, but new API writes always use the object form.

## Verification

Run the automated checks before submitting changes:

```bash
npm test
npm run lint
npm run build
```

Run the integration suite against a local MongoDB instance to exercise the real
Better Auth adapter, API routes, and CLI processes:

```bash
TEST_MONGODB_URI=mongodb://127.0.0.1:27017 npm test
```

The suite creates and drops a uniquely named test database. Without
`TEST_MONGODB_URI`, these integration tests are skipped.

## Learn more

- [Next.js documentation](https://nextjs.org/docs)
- [Better Auth documentation](https://www.better-auth.com/docs)
