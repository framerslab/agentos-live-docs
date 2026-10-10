# Platform Storage Strategy

`@framers/sql-storage-adapter` gives one `StorageAdapter` interface over several SQL backends; its resolver knows five adapter kinds. This page says which one fits each platform and how the package picks one (as of 0.6.9).

```typescript
import { createDatabase } from '@framers/sql-storage-adapter';

// Try IndexedDB persistence first, then in-memory sql.js
const db = await createDatabase({
  priority: ['indexeddb', 'sqljs'],
});
```

---

## Adapters

| Adapter kind | Engine | Where it runs | Persistence | Needs |
| --- | --- | --- | --- | --- |
| `indexeddb` | sql.js (SQLite compiled to WebAssembly) | Browsers, WebViews, Electron renderers | The database file is saved as one blob in IndexedDB (database `app-db`, store `sqliteDb` by default), every 5 seconds with `autoSave` on (the default) | `sql.js` (a dependency) |
| `sqljs` | sql.js | Anywhere | In memory; in Node, with a `filePath`, the file is loaded at open and written back after changes | `sql.js` (a dependency) |
| `better-sqlite3` | Native SQLite | Node and the Electron main process; it refuses to open in a browser | A file (default `<cwd>/db_data/app.sqlite3`; the parent directory is created) | `better-sqlite3` (peer) |
| `capacitor` | Native SQLite through `@capacitor-community/sqlite` | Capacitor iOS and Android apps | On the device; the adapter turns on WAL journaling | `@capacitor-community/sqlite` (peer) |
| `postgres` | PostgreSQL through `pg` | Node | A PostgreSQL server | `pg` (a dependency) and a connection string |

For Electron, the `@framers/sql-storage-adapter/electron` entry point holds `createElectronMainAdapter()` and `createElectronRendererAdapter()` (renderer access goes over IPC through a preload script).

---

## Recommendations by platform

| Platform | Primary | Fallback | Why |
| --- | --- | --- | --- |
| **Web** | `indexeddb` | `sqljs` | Survives reloads; plain `sqljs` in a browser is memory only |
| **Electron** | `better-sqlite3` in the main process (or the Electron adapters) | `sqljs` | Native SQLite file; the renderer reaches it over IPC |
| **Capacitor** | `capacitor` | `indexeddb` | Native SQLite on the device |
| **Node** | `better-sqlite3` | `sqljs` | A local file with no server |
| **Cloud / multi-user** | `postgres` | | One database for many processes and users |

---

## How the package picks an adapter

There are two entry points, and they pick differently.

### `resolveStorageAdapter(options)`

Without `options.priority`, it builds the order from the runtime, first match wins:

1. The `STORAGE_ADAPTER` environment variable (one adapter kind)
2. Electron main process: `['better-sqlite3']`, with a console note pointing at the Electron adapter
3. Electron renderer: `['indexeddb', 'sqljs']`, with a console note pointing at the Electron adapter
4. Capacitor native platform: `['capacitor', 'indexeddb', 'sqljs']`
5. A Postgres connection string (`options.postgres.connectionString` or `DATABASE_URL`): `['postgres', 'better-sqlite3', 'indexeddb', 'sqljs']`
6. A `window` with `indexedDB`: `['indexeddb', 'sqljs']`
7. Otherwise: `['better-sqlite3', 'indexeddb', 'sqljs']`

It then creates and opens each candidate in turn and returns the first that opens, logging which one it chose (`quiet: true` silences the logs). When none opens, it throws a `StorageResolutionError`.

### `createDatabase(options)`

`createDatabase()` takes `url`, `file`, `postgres`, `mobile`, `indexedDb`, `type` and `priority`, sets the priority itself and then calls `resolveStorageAdapter()`. It returns an adapter that is already open.

- `priority` wins when given.
- `type` picks one adapter: `postgres` → `postgres`, `sqlite` → `better-sqlite3`, `browser` → `sqljs`, `mobile` → `capacitor`, `memory` → `better-sqlite3` on `:memory:`.
- Otherwise the priority is `['sqljs']` in a browser or Deno and `['better-sqlite3', 'sqljs']` in Node.

So without `priority` or `type`, `createDatabase()` never chooses `indexeddb`, `capacitor` or `postgres`: in a browser it opens an in-memory sql.js database, and in Node it opens SQLite even when `url`, `postgres` or `DATABASE_URL` names a PostgreSQL server. Pass `type` or `priority` to get those adapters, or call `resolveStorageAdapter()` for the runtime detection above.

---

## Usage Examples

### Web Application

```typescript
import { IndexedDbAdapter } from '@framers/sql-storage-adapter';

const db = new IndexedDbAdapter({
  dbName: 'my-app-db',
  autoSave: true,
  saveIntervalMs: 5000,
});

await db.open();
await db.run('CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, data TEXT)');
```

### Desktop Application (Electron main process)

```typescript
import { app } from 'electron';
import path from 'node:path';
import { createDatabase } from '@framers/sql-storage-adapter';

const db = await createDatabase({
  type: 'sqlite',
  file: path.join(app.getPath('userData'), 'app.db'),
});
```

### Mobile Application (Capacitor)

```typescript
import { createDatabase } from '@framers/sql-storage-adapter';

const db = await createDatabase({
  priority: ['capacitor', 'indexeddb'],
});
```

### Cloud Application (Node.js)

```typescript
import { createDatabase } from '@framers/sql-storage-adapter';

const db = await createDatabase({
  type: 'postgres',
  postgres: { connectionString: process.env.DATABASE_URL },
});
```

---

## Summary Table

| Platform | Primary | Fallback | How to ask for it |
| --- | --- | --- | --- |
| **Web** | IndexedDB | sql.js | `priority: ['indexeddb', 'sqljs']`, `new IndexedDbAdapter()`, or `resolveStorageAdapter()` |
| **Electron** | better-sqlite3 | sql.js | `type: 'sqlite'` in the main process, or the Electron adapters |
| **Capacitor** | capacitor | IndexedDB | `priority: ['capacitor', 'indexeddb']`, or `resolveStorageAdapter()` |
| **Node** | better-sqlite3 | sql.js | `createDatabase()` with no options |
| **Cloud** | Postgres | | `type: 'postgres'` or `priority: ['postgres']` with a connection string |
