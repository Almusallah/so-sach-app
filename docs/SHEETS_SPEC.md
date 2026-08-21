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
