# Sổ Sạch ↔ Google Sheets — specifica di integrazione

**Pattern**: push via webhook Apps Script (vedi `docs/sheets/Code.gs`). Il server
NON parla con le API Google: fa POST JSON all'URL `/exec` del foglio dell'utente.
Zero OAuth, zero chiavi Google lato server, revoca = cancellare il deployment.
Stesso schema già in produzione nei fogli di ricerca immobiliare di Yuri.

## Dati per utente (in `book.profile`, persistiti da persistBook)
- `sheets.url`    — URL /exec del deployment Apps Script (validato: https,
                    host `script.google.com` o `script.googleusercontent.com`)
- `sheets.secret` — stringa condivisa; mai loggata, MAI restituita nelle
                    risposte API (write-only come le altre credenziali)
- `sheets.lastPushAt` / `sheets.lastPushOk` — diagnostica mostrata in UI

## Rotte (server.js)
- `POST /api/sheets/config`  { url, secret }  — salva; risponde senza il secret.
- `DELETE /api/sheets/config`                 — scollega.
- `POST /api/sheets/push`                     — push manuale; risponde
  { ok, at } o { ok:false, error } con l'errore del foglio in chiaro.
- Push AUTOMATICO: dopo ogni mutazione del libro (ledger POST/DELETE, opening,
  webhook Zalo) → debounce 30 s per uid (un timer per uid, reset a ogni
  mutazione; niente push a raffica mentre arrivano foto). Fallimenti: log +
  lastPushOk=false, MAI bloccare la scrittura contabile — il libro è la fonte
  di verità, il foglio è una vista.

## Payload
```json
{ "secret": "...", "sheets": {
    "Sổ thu chi": [["Ngày","Loại","Số tiền (VND)","Đối tác","Mô tả","Nguồn","Gốc"],
                    ["2026-08-10","Chi",30000,"HỆ THỐNG SIÊU THỊ JMART","Mua hàng tạp phẩm","zalo","photo"], ...],
    "Tổng hợp":   [["","Q1","Q2","Q3","Q4","Năm"],
                    ["Thu",...],["Chi",...],["Lãi gộp",...],
                    ["Thuế tạm tính",...],["Hạn nộp",...]]
} }
```
- Righe ledger ordinate per data ASC (come il CSV). Numeri come NUMERI (non
  stringhe formattate): il foglio deve poter fare somme.
- "Tổng hợp" calcolata con gli STESSI motori (totals/quarterlyTax/
  buildDeclaration) — mai ricalcolare a mano.

## Sicurezza
- SSRF: accetta SOLO host Google Script; niente IP, niente porte custom,
  follow-redirect disattivato oltre googleusercontent.
- Timeout fetch 10 s; 2 retry con backoff sul push automatico, 0 sul manuale
  (l'utente vede l'errore e riprova).
- Rate: max 1 push/10 s per uid anche su push manuale.

## UI (public/)
- Sezione nel modal Tài khoản: campo URL + campo secret (password), bottone
  "Kết nối", stato ultima sincronizzazione, bottone "Đẩy ngay", link alla
  guida con il template Code.gs da copiare (pagina statica o accordion).
- i18n VI/EN come il resto.

## Test
- Unit: buildSheetsPayload(book) — forma, ordinamento, numeri, tab Tổng hợp
  coerente con buildDeclaration.
- E2E: server di test che finge l'Apps Script (echo secret check), config →
  push → risposta ok; secret sbagliato → errore visibile; URL non-Google
  rifiutato 400.

---
## ADDENDUM post-ispezione (2026-08-21 — mappa completa del codice, 12 call-site persistBook)

**Trappole confermate dall'ispezione, VINCOLANTI per l'implementazione:**
1. **Segreto**: `ledgerPayload()` (server.js:565) restituisce `profile` INTERO e lo servono
   4 rotte (`GET /api/ledger`, `POST /api/opening`, `GET /api/agent/client/:phone`,
   l'eco di `POST /api/profile`). Con `sheets.secret` dentro profile il segreto
   trapela — anche al đại lý thuế del cliente. → helper `publicProfile()` che
   REDIGE `sheets.secret` (specchia `publicAccount()` di src/auth.js:126), usato in
   OGNI risposta che porta un profile.
2. **Libro "demo" è globale condiviso**: config Sheets su uid `demo` = il foglio di
   uno riceve i libri di tutti gli anonimi. → `POST /api/sheets/config` richiede
   auth (`requireAuth`); niente Sheets per anonimi e per `demo`.
3. **Redirect Apps Script**: `/exec` risponde SEMPRE 302 verso
   `script.googleusercontent.com`. `redirect:"error"` = ogni push fallisce. →
   `redirect:"manual"`, segui UN solo hop, ri-valida l'host contro la whitelist.
4. **`removeBook` (merge Zalo→account)**: un timer di push pendente sul libro
   cancellato ricreerebbe un libro VUOTO e spazzerebbe le tab del foglio
   (Code.gs fa clearContents). → la pushFn controlla `books[uid]` esista e abbia
   entries o config; altrimenti no-op. E `mergeZaloBook` (server.js:95) migra
   l'eventuale config Sheets sul libro di destinazione prima del removeBook.
5. **Rate limit**: il middleware `rateLimit` è per-IP e il suo `globalMax` è un
   SINGLETON condiviso col contatore Anthropic di /api/extract → NON usarlo.
   Throttle per-uid col timestamp `sheets.lastPushAt` (≥10 s), niente globalMax.
6. **Hook di push = i 12 call-site persistBook** mappati (server.js:95,193,228,271,
   346,481,594,603,614,668,677,717) — il push tocca SOLO le mutazioni di VOCI
   (193,228,271,346,594,603,717) + un push su config nuova; register/profile/
   demo-seed NON spingono (il demo-seed è anonimo per definizione).
7. **CSV vs Sheet**: il CSV (server.js:682) ha 6 colonne senza "Gốc"; il payload 7.
   Aggiungere "Gốc" anche al CSV nella stessa PR, o documentare la differenza.
8. **Righe illimitate**: payload = TUTTE le voci; Apps Script ha cap 6 min. → cap
   a 5.000 righe più recenti con riga finale "… troncato, esporta CSV per lo storico".
9. **E2E**: `DATA_DIR` env è IGNORATA (server.js:36 hard-coda join(__dirname,"data"))
   → l'e2e scrive in data/ reale; pulire prima/dopo, mai committare data/.
