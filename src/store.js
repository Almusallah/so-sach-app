// ============================================================================
//  Sổ Sạch — storage layer.
//  JSON file per default (demo/pilot locale); Postgres quando DATABASE_URL è
//  presente (Render → il libro sopravvive ai redeploy). Stesso shape in memoria:
//    books[uid]     = { profile:{...}, entries:[...] }
//    accounts[phone]= { phone, pinHash, salt, role, name, agentCode?, agentPhone?,
//                       sub:{plan,activeUntil,pilot}, createdAt }
// ============================================================================
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export const books = {};
export const accounts = {};

let mode = "json";
let pool = null;
let DATA_DIR = null;

const FILE_BOOKS = () => join(DATA_DIR, "ledger.json");
const FILE_ACCTS = () => join(DATA_DIR, "accounts.json");

export async function initStore(dataDir) {
  DATA_DIR = dataDir;
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  if (process.env.DATABASE_URL) {
    try {
      const { default: pg } = await import("pg");
      pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
        max: 5,
      });
      await pool.query(`CREATE TABLE IF NOT EXISTS docs (
        kind text NOT NULL, key text NOT NULL, doc jsonb NOT NULL,
        updated_at timestamptz DEFAULT now(), PRIMARY KEY (kind, key))`);
      const r = await pool.query("SELECT kind, key, doc FROM docs");
      for (const row of r.rows) {
        if (row.kind === "book") books[row.key] = row.doc;
        else if (row.kind === "account") accounts[row.key] = row.doc;
      }
      mode = "postgres";
      return mode;
    } catch (e) {
      console.error("store: DATABASE_URL presente ma Postgres non raggiungibile → fallback JSON.", e.message);
    }
  }

  if (existsSync(FILE_BOOKS())) { try { Object.assign(books, JSON.parse(readFileSync(FILE_BOOKS(), "utf8"))); } catch {} }
  if (existsSync(FILE_ACCTS())) { try { Object.assign(accounts, JSON.parse(readFileSync(FILE_ACCTS(), "utf8"))); } catch {} }
  mode = "json";
  return mode;
}

export const storeMode = () => mode;

async function upsert(kind, key, doc) {
  if (mode === "postgres" && pool) {
    await pool.query(
      `INSERT INTO docs (kind, key, doc, updated_at) VALUES ($1,$2,$3,now())
       ON CONFLICT (kind, key) DO UPDATE SET doc = $3, updated_at = now()`,
      [kind, key, doc]
    );
  }
}

// Write-through: aggiorna file (JSON mode) o riga (PG mode). Fire-and-forget OK.
export function persistBook(uid) {
  if (mode === "json") writeFileSync(FILE_BOOKS(), JSON.stringify(books, null, 2));
  else upsert("book", uid, books[uid]).catch((e) => console.error("persistBook:", e.message));
}
export function persistAccount(phone) {
  if (mode === "json") writeFileSync(FILE_ACCTS(), JSON.stringify(accounts, null, 2));
  else upsert("account", phone, accounts[phone]).catch((e) => console.error("persistAccount:", e.message));
}

export function getBook(uid) {
  if (!books[uid]) books[uid] = { profile: { name: "", category: "services_goods", revenueEstimate: 0 }, entries: [] };
  return books[uid];
}
