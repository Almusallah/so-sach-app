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
// Lista d'attesa pilota (hộ kinh doanh + đại lý thuế), chiave = telefono
// normalizzato. Vive nello stesso store dei libri: su Render è Postgres, quindi
// i lead sopravvivono ai redeploy — sono la pipeline del pilota, non cache.
export const leads = {};
// Piccolo key-value di servizio (token OA Zalo & co.). Deve stare NELLO STORE,
// non nelle env: il refresh_token Zalo ruota a ogni rinnovo, quindi il valore
// incollato a mano nella dashboard è già vecchio dopo il primo refresh.
export const settings = {};

let mode = "json";
let pool = null;
let DATA_DIR = null;

const FILE_BOOKS = () => join(DATA_DIR, "ledger.json");
const FILE_ACCTS = () => join(DATA_DIR, "accounts.json");
const FILE_LEADS = () => join(DATA_DIR, "leads.json");
const FILE_SETTINGS = () => join(DATA_DIR, "settings.json");

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
        // Senza questi limiti una query verso un DB irraggiungibile resta
        // appesa per sempre — e le scritture durevoli qui sotto DEVONO poter
        // fallire in fretta: l'utente aspetta la conferma della propria voce.
        connectionTimeoutMillis: 3000,
        query_timeout: 4000,
        statement_timeout: 4000,
      });
      await pool.query(`CREATE TABLE IF NOT EXISTS docs (
        kind text NOT NULL, key text NOT NULL, doc jsonb NOT NULL,
        updated_at timestamptz DEFAULT now(), PRIMARY KEY (kind, key))`);
      const r = await pool.query("SELECT kind, key, doc FROM docs");
      for (const row of r.rows) {
        if (row.kind === "book") books[row.key] = row.doc;
        else if (row.kind === "account") accounts[row.key] = row.doc;
        else if (row.kind === "lead") leads[row.key] = row.doc;
        else if (row.kind === "setting") settings[row.key] = row.doc;
      }
      mode = "postgres";
      return mode;
    } catch (e) {
      console.error("store: DATABASE_URL presente ma Postgres non raggiungibile → fallback JSON.", e.message);
    }
  }

  if (existsSync(FILE_BOOKS())) { try { Object.assign(books, JSON.parse(readFileSync(FILE_BOOKS(), "utf8"))); } catch {} }
  if (existsSync(FILE_ACCTS())) { try { Object.assign(accounts, JSON.parse(readFileSync(FILE_ACCTS(), "utf8"))); } catch {} }
  if (existsSync(FILE_LEADS())) { try { Object.assign(leads, JSON.parse(readFileSync(FILE_LEADS(), "utf8"))); } catch {} }
  if (existsSync(FILE_SETTINGS())) { try { Object.assign(settings, JSON.parse(readFileSync(FILE_SETTINGS(), "utf8"))); } catch {} }
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

// ---- Scritture durevoli -------------------------------------------------------
// IL PROBLEMA. In modalità Postgres ogni persist era fire-and-forget: il bot
// diceva "✅ Đã ghi vào Sổ Sạch" PRIMA che la UPSERT toccasse il disco. Un
// crash (o un DB irraggiungibile) nel momento sbagliato perdeva una voce già
// confermata all'utente — in un registro FISCALE è il guasto peggiore: la
// promessa del prodotto è esattamente "quello che ti confermo è nel sổ".
//
// LA FORMA. Tre pezzi, componibili:
//   1. una CODA PER CHIAVE (book:uid / account:phone / lead:phone): tutte le
//      scritture della stessa chiave si serializzano, così un rollback non può
//      mai calpestare una mutazione successiva e due UPSERT della stessa riga
//      non possono superarsi sul filo (pool max 5 = connessioni multiple:
//      senza coda, l'ordine d'arrivo in tabella non è garantito);
//   2. RETRY corto con backoff (3 tentativi, 250/500 ms) sopra i timeout del
//      pool: un blip di rete non diventa un 503, un DB giù fallisce in fretta;
//   3. mutateBookDurable(): snapshot → mutazione → persist; se il persist
//      fallisce dopo i retry, la MEMORIA torna allo snapshot e il chiamante
//      risponde "non salvato, riprova" — mai una conferma per una voce che
//      esiste solo in RAM (al prossimo deploy sparirebbe), mai una voce in RAM
//      dopo un "riprova" (al reinvio diventerebbe un doppione).
// In modalità JSON writeFileSync è sincrona: stessa semantica, stesso rollback
// se il filesystem lancia (disco pieno).

// Gancio SOLO test: i fallimenti di persistenza non si possono provocare a
// comando su un DB vero, quindi il test li inietta qui. Ignorato fuori da
// NODE_ENV=test.
export const _durability = { failNext: 0, delayNextMs: 0 };
async function maybeFailForTest() {
  if (process.env.NODE_ENV !== "test") return;
  if (_durability.delayNextMs > 0) {
    // Rallenta UN persist: serve al test che prova che la coda serializza
    // DAVVERO (in modalità JSON writeFileSync è sincrona e senza questo delay
    // due mutazioni "concorrenti" non potrebbero mai interleave).
    const d = _durability.delayNextMs;
    _durability.delayNextMs = 0;
    await new Promise((r) => setTimeout(r, d));
  }
  if (_durability.failNext > 0) {
    _durability.failNext--;
    throw new Error("test-induced persist failure");
  }
}

const PERSIST_ATTEMPTS = 3;
async function withRetry(fn) {
  let lastErr;
  for (let i = 0; i < PERSIST_ATTEMPTS; i++) {
    if (i) await new Promise((r) => setTimeout(r, 250 * i));
    try { return await fn(); } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

// Coda per chiave. La tail si ripulisce quando è ancora lei l'ultima: la mappa
// non cresce con gli uid che smettono di scrivere.
const queues = new Map();
function enqueue(qkey, task) {
  const prev = queues.get(qkey) || Promise.resolve();
  const run = prev.then(task, task);       // parte comunque, anche dopo un errore
  const tail = run.catch(() => {});
  queues.set(qkey, tail);
  tail.then(() => { if (queues.get(qkey) === tail) queues.delete(qkey); });
  return run;
}

// Il persist grezzo di UNA chiave, letto al momento dell'esecuzione (mai
// serializzare il doc alla chiamata: in coda potrebbe già essere cambiato).
async function persistNow(kind, key) {
  await maybeFailForTest();
  if (mode === "json") {
    const file = { book: FILE_BOOKS, account: FILE_ACCTS, lead: FILE_LEADS }[kind];
    const data = { book: books, account: accounts, lead: leads }[kind];
    writeFileSync(file(), JSON.stringify(data, null, 2));
    return;
  }
  await withRetry(() => upsert(kind, key, { book: books, account: accounts, lead: leads }[kind][key]));
}

// Mutazione FISCALE durevole di un libro: l'unica via ammessa per toccare
// entries. Torna { ok:true, result } o { ok:false, error } — mai lancia per un
// persist fallito (il chiamante deve poter rispondere all'utente).
export function mutateBookDurable(uid, mutate) {
  return enqueue("book:" + uid, async () => {
    const existed = Object.prototype.hasOwnProperty.call(books, uid);
    const snapshot = existed ? JSON.stringify(books[uid]) : null;
    let result;
    try {
      result = mutate(getBook(uid));
    } catch (e) {
      // la mutazione stessa è scoppiata: è un bug di programmazione, si
      // ripristina e si rilancia — mai persistere uno stato a metà
      if (existed) books[uid] = JSON.parse(snapshot); else delete books[uid];
      throw e;
    }
    try {
      await persistNow("book", uid);
      return { ok: true, result };
    } catch (e) {
      if (existed) books[uid] = JSON.parse(snapshot); else delete books[uid];
      console.error(`store: scrittura NON durevole su ${uid} — rollback in memoria.`, e.message);
      return { ok: false, error: e.message };
    }
  });
}

// Fusione durevole di DUE libri, sotto ENTRAMBE le code.
// IL BUG CHE PREVIENE (trovato dal verifier prima del commit): il merge girava
// solo nella coda della destinazione, quindi una voce scritta sulla SORGENTE
// mentre il merge attendeva la propria UPSERT — "thu 300k" e il tocco sul
// claim-link nello stesso secondo, la sequenza canonica dell'onboarding —
// veniva confermata all'utente e poi CANCELLATA dal removeBook. Qui il corpo
// parte solo quando è in testa a TUTTE E DUE le code e le tiene bloccate fino
// alla rimozione della sorgente: una scrittura concorrente o arriva PRIMA
// (e viene fusa) o si accoda DOPO (a sorgente già rimossa). Nessun deadlock:
// questo è l'unico punto che prende due code, sempre nello stesso ordine.
export function mergeBooksDurable(srcUid, dstUid, mutate) {
  if (srcUid === dstUid) throw new Error("mergeBooksDurable: src e dst coincidono");
  let arrived = 0, release;
  const bothAtHead = new Promise((r) => { release = r; });
  const body = (async () => {
    await bothAtHead;
    const srcExisted = Object.prototype.hasOwnProperty.call(books, srcUid);
    const dstExisted = Object.prototype.hasOwnProperty.call(books, dstUid);
    const srcSnap = srcExisted ? JSON.stringify(books[srcUid]) : null;
    const dstSnap = dstExisted ? JSON.stringify(books[dstUid]) : null;
    const restore = () => {
      if (srcExisted) books[srcUid] = JSON.parse(srcSnap); else delete books[srcUid];
      if (dstExisted) books[dstUid] = JSON.parse(dstSnap); else delete books[dstUid];
    };
    let result;
    try { result = mutate(books[srcUid] || null, getBook(dstUid)); }
    catch (e) { restore(); throw e; }
    try { await persistNow("book", dstUid); }
    catch (e) {
      restore();
      console.error(`store: merge ${srcUid}→${dstUid} NON durevole — rollback.`, e.message);
      return { ok: false, error: e.message };
    }
    // Destinazione durevole: ora la sorgente si rimuove INLINE (mai via
    // removeBook: accoderebbe sulla coda che stiamo bloccando → deadlock).
    // Se la rimozione fallisce, al riavvio la sorgente risorge con voci già
    // copiate — un doppione rumoroso, mai una perdita.
    try {
      delete books[srcUid];
      if (mode === "postgres" && pool) {
        await withRetry(() => pool.query("DELETE FROM docs WHERE kind='book' AND key=$1", [srcUid]));
      } else if (mode === "json") {
        writeFileSync(FILE_BOOKS(), JSON.stringify(books, null, 2));
      }
    } catch (e) { console.error(`store: merge ${srcUid}→${dstUid}: rimozione sorgente fallita (doppione al riavvio).`, e.message); }
    return { ok: true, result };
  })();
  const join = () => { if (++arrived === 2) release(); return body.catch(() => {}); };
  enqueue("book:" + srcUid, join);
  enqueue("book:" + dstUid, join);
  return body;
}

// Persist durevoli e awaitabili per account e lead (niente rollback interno:
// la mutazione avviene nel chiamante, che sa cosa ripristinare).
export function persistAccountDurable(phone) {
  return enqueue("account:" + phone, async () => {
    try { await persistNow("account", phone); return { ok: true }; }
    catch (e) {
      console.error(`store: account ${phone} NON durevole.`, e.message);
      return { ok: false, error: e.message };
    }
  });
}
export function persistLeadDurable(phone) {
  return enqueue("lead:" + phone, async () => {
    try { await persistNow("lead", phone); return { ok: true }; }
    catch (e) {
      console.error(`store: lead ${phone} NON durevole.`, e.message);
      return { ok: false, error: e.message };
    }
  });
}

// Write-through legacy per i metadati NON fiscali (flag claim, timestamp di
// push Sheets…): il chiamante non aspetta, ma la scrittura passa comunque
// dalla coda della chiave — l'ordine con le scritture durevoli resta garantito.
export function persistBook(uid) {
  enqueue("book:" + uid, async () => {
    if (!Object.prototype.hasOwnProperty.call(books, uid)) return; // rimosso nel frattempo
    await persistNow("book", uid);
  }).catch((e) => console.error("persistBook:", e.message));
}
export function persistAccount(phone) {
  enqueue("account:" + phone, async () => {
    if (!Object.prototype.hasOwnProperty.call(accounts, phone)) return;
    await persistNow("account", phone);
  }).catch((e) => console.error("persistAccount:", e.message));
}
export function persistLead(phone) {
  enqueue("lead:" + phone, async () => {
    if (!Object.prototype.hasOwnProperty.call(leads, phone)) return;
    await persistNow("lead", phone);
  }).catch((e) => console.error("persistLead:", e.message));
}
// await-abile: il refresh token Zalo va persistito PRIMA di essere usato, o un
// crash nel mezzo lascia in DB una catena di token già invalidata da Zalo.
export async function persistSetting(key) {
  if (mode === "json") writeFileSync(FILE_SETTINGS(), JSON.stringify(settings, null, 2));
  else await upsert("setting", key, settings[key]);
}

export function getBook(uid) {
  // lang: lingua di bot e web ("vi"|"en"); i libri nati prima del campo non
  // ce l'hanno — chi legge usa sempre `profile.lang || "vi"`.
  if (!books[uid]) books[uid] = { profile: { name: "", category: "services_goods", revenueEstimate: 0, lang: "vi" }, entries: [] };
  return books[uid];
}

// Rimuove un libro (usato quando un libro Zalo viene fuso in un account).
// Passa dalla coda della chiave e si può await-are: nel merge la rimozione
// della sorgente deve avvenire DOPO che la destinazione è durevole — un crash
// in mezzo lascia al peggio un doppione visibile, mai una voce persa.
export function removeBook(uid) {
  return enqueue("book:" + uid, async () => {
    delete books[uid];
    if (mode === "postgres" && pool) {
      await withRetry(() => pool.query("DELETE FROM docs WHERE kind='book' AND key=$1", [uid]));
    } else if (mode === "json") {
      writeFileSync(FILE_BOOKS(), JSON.stringify(books, null, 2));
    }
  });
}
