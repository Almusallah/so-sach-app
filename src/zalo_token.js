// ============================================================================
//  Sổ Sạch — gestione token Zalo OA (access token a scadenza 1 ora).
//
//  Perché esiste: il token OA scade in ~1 ora. Leggerlo una volta dalle env
//  significa che il bot risponde per un'ora dopo il deploy e poi smette — e
//  smette in SILENZIO, perché il webhook continua a restituire 200 e l'errore
//  vive solo nella risposta di sendText. Il pilota morirebbe senza un allarme.
//
//  Tre trappole del flusso Zalo, tutte gestite qui:
//   1. il refresh_token è MONOUSO e RUOTA: ogni refresh ne restituisce uno
//      nuovo e invalida il vecchio → va persistito (Postgres), non tenuto in
//      una env var, altrimenti dopo il primo rinnovo la catena è persa;
//   2. due webhook concorrenti che rinnovano insieme bruciano il token (uno
//      dei due vince, l'altro resta con un refresh già speso) → single-flight;
//   3. il nuovo refresh_token va SCRITTO PRIMA di essere usato: se il processo
//      muore tra la risposta di Zalo e il salvataggio, la catena è irrecuperabile
//      e serve ri-incollare il token a mano dalla dashboard.
// ============================================================================
import { settings, persistSetting } from "./store.js";

const KEY = "zalo_oa_token";
const OAUTH = "https://oauth.zaloapp.com/v4/oa/access_token";
// Rinnova un po' prima della scadenza: un token che scade mentre è in volo
// produce esattamente l'errore silenzioso che vogliamo evitare.
const SKEW_MS = 5 * 60_000;

const APP_ID = () => process.env.ZALO_APP_ID || null;
const APP_SECRET = () => process.env.ZALO_APP_SECRET || null;

let inFlight = null;   // single-flight: una sola richiesta di refresh alla volta

function current() {
  return settings[KEY] || null;
}

// Primo avvio: adotta i valori incollati nelle env, poi lo store diventa la
// fonte di verità (le env restano il seme, non il registro).
export async function bootstrapFromEnv() {
  const envAccess = process.env.ZALO_OA_ACCESS_TOKEN || null;
  const envRefresh = process.env.ZALO_OA_REFRESH_TOKEN || null;
  if (!envAccess && !envRefresh) return current();
  const have = current();
  // Non sovrascrivere una catena viva già rinnovata in autonomia.
  if (have?.refreshToken && have.refreshToken !== envRefresh) return have;
  if (have?.accessToken && !envRefresh) return have;
  settings[KEY] = {
    accessToken: envAccess || have?.accessToken || null,
    refreshToken: envRefresh || have?.refreshToken || null,
    // senza scadenza nota trattiamo il token come "da verificare subito"
    expiresAt: envAccess ? Date.now() + 55 * 60_000 : 0,
    source: "env",
    updatedAt: new Date().toISOString(),
  };
  await persistSetting(KEY);
  return settings[KEY];
}

async function refresh(refreshToken) {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    app_id: APP_ID() || "",
    grant_type: "refresh_token",
  });
  const res = await fetch(OAUTH, {
    method: "POST",
    headers: { secret_key: APP_SECRET() || "", "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!data.access_token) {
    throw new Error(`zalo refresh failed: ${JSON.stringify(data).slice(0, 200)}`);
  }
  // Scrivere PRIMA di restituire: vedi trappola 3 in testa al file.
  settings[KEY] = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: Date.now() + (Number(data.expires_in || 3600) * 1000),
    source: "refresh",
    updatedAt: new Date().toISOString(),
  };
  await persistSetting(KEY);
  return settings[KEY];
}

// Token valido, rinnovando se serve. `force` salta la cache (usato dopo un
// -216 "token expired" restituito da un'API OA).
export async function getAccessToken({ force = false } = {}) {
  const t = current();
  if (!t) return null;
  const stillGood = t.accessToken && !force && Date.now() < (t.expiresAt || 0) - SKEW_MS;
  if (stillGood) return t.accessToken;
  if (!t.refreshToken) return t.accessToken || null;   // nessuna catena: usa quel che c'è

  if (!inFlight) {
    inFlight = refresh(t.refreshToken)
      .catch((e) => { console.error("zalo token:", e.message); return current(); })
      .finally(() => { inFlight = null; });
  }
  const out = await inFlight;
  return out?.accessToken || null;
}

export function tokenStatus() {
  const t = current();
  if (!t) return { configured: false };
  return {
    configured: !!t.accessToken,
    hasRefresh: !!t.refreshToken,
    expiresInMin: t.expiresAt ? Math.round((t.expiresAt - Date.now()) / 60000) : null,
    source: t.source,
    updatedAt: t.updatedAt,
  };
}
