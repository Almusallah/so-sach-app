# Onboarding Zalo-first → account — specifica

**Il buco (individuato da Yuri, 2026-08-21):** il funnel reale è Zalo-first, ma
il collegamento account esiste solo web-first (codice 6 caratteri generato dal
web e digitato in chat). Un utente solo-Zalo ha il libro in `zalo:<id>`:
invisibile sul web e all'đại lý thuế, irrecuperabile se cambia telefono; il
bottone del benvenuto porta a una sandbox anonima che NON è il suo libro.

**Principio:** l'attivazione viene PRIMA della registrazione. Nessun form
prima del primo momento magico (foto → scrittura). La conversione si propone
DOPO il valore, con un link a un tocco — mai un codice da copiare.

## Flusso
1. Benvenuto invariato (zero attrito, "chụp một tờ hoá đơn").
2. Alla PRIMA voce registrata di un uid Zalo non collegato, la conferma
   aggiunge UNA volta: "💡 Tạo tài khoản để xem sổ trên web và không mất sổ
   khi đổi điện thoại: <link>". Re-prompt SOLO in `menu` e in coda a `quý`
   (riga breve), mai su ogni risposta. Flag `claimPromptedAt` nel libro.
3. Link = `https://sosach.com.vn/claim/<token>` firmato HMAC(SESSION_SECRET):
   payload {zaloId, exp: +72h}, single-use (registro in-memory + persistito
   nel libro come `claimTokenUsedAt`). Nessun dato personale nell'URL oltre
   l'id opaco firmato.
4. `GET /claim/<token>`: valida → pagina con branding token-only: "Sổ của bạn
   trên Zalo: N bút toán" + form registrazione (SĐT + PIN) O login se
   l'account esiste. Alla conferma: `account.zaloId = zaloId`,
   `mergeZaloBook(zaloId, phone)` (macchina esistente), redirect al libro.
   Token scaduto/usato → messaggio garbato + istruzione del flusso codice
   esistente come fallback.
5. Il flusso codice web-first RESTA (serve a chi parte dal web).

## Guardie
- Un token per uid alla volta; rigenerare invalida il precedente.
- `mergeZaloBook` già migra config Sheets (addendum SHEETS_SPEC) — verificare
  che il claim passi di lì e erediti la guardia.
- Rate: /claim GET pubblico ma con rateLimit name="claim" (30/15min IP).
- E2E: mint → claim → merge → il libro Zalo appare nell'account; token riusato
  → rifiutato; scaduto → rifiutato; il prompt appare UNA sola volta.

## Copy (VI, EN nel dict)
- CTA prima voce: "💡 Tạo tài khoản (miễn phí) để xem sổ trên web, cho đại lý
  thuế xem giúp, và không mất sổ khi đổi điện thoại: <link>"
- Pagina claim, titolo: "Kết nối sổ Zalo với tài khoản của bạn"
