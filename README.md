# 📒 Sổ Sạch

**Chụp hoá đơn. Sổ sách tự lo.** — trợ lý kế toán AI trên Zalo cho hộ kinh doanh Việt Nam. / **Snap the receipt, the books do themselves** — AI bookkeeper on Zalo for Vietnamese household businesses.

**Perché ora (why now):** dal 01/01/2026 il regime forfettario "khoán" è abolito (Nghị quyết 198/2025/QH15 + Luật 108/2025/QH15) — ~5,2 milioni di hộ kinh doanh devono tenere i libri e dichiarare i ricavi reali con il mod. 01/CNKD trimestrale (Thông tư 50/2026/TT-BTC). La soglia di esenzione GTGT/TNCN è 1 miliardo VND/anno (Nghị định 141/2026/NĐ-CP, alzata da 500M), e sopra la stessa soglia scatta l'e-invoice da registratore connesso (Nghị định 254/2026/NĐ-CP, in vigore dal 01/07/2026 — abroga 123/2020 e 70/2025). Sổ Sạch trasforma quest'obbligo in una foto su Zalo.

## Il prodotto

1. **📷 Chụp & gửi** — foto di scontrini/fatture/bonifici, via Zalo OA o web
2. **🤖 AI ghi sổ** — estrazione (Claude vision, structured output) → voce thu/chi confermabile in un tocco; incassi digitati ("thu 2tr4") per le vendite che non stampano scontrino
3. **🔔 Canh ngưỡng** — barre soglia in tempo reale: 1 tỷ (esenzione GTGT/TNCN **e** obbligo e-invoice), con proiezione annua dai ricavi YTD
4. **📄 Tờ khai soạn sẵn** — mod. 01/CNKD (Thông tư 50/2026/TT-BTC) precompilato per il trimestre: ricavi, GTGT, TNCN per categoria di attività (aliquote da Luật 48/2024 + 109/2025, regime NĐ 68/2026), stampabile/PDF
5. **📗 Google Sheets, di proprietà dell'utente** — il libro si rispecchia in un foglio che l'impresa stessa crea (suo account, suo webhook Apps Script): nessuna credenziale Google lato server
6. **🔗 Claim link Zalo→web** — la prima voce scritta in chat frutta un link monouso che trasforma il libro Zalo in un account web con la storia intatta
7. **🌐 Strato bilingue** — vietnamita primario, inglese per profilo; comandi tolleranti ai refusi di una lettera, con stop-list che protegge i comandi distruttivi ("sửa" corregge/cancella l'ultima voce solo su richiesta esplicita)
8. **🧑‍💼 Cruscotto đại lý thuế** — vista multi-cliente per l'agente fiscale che segue 20–200 imprese

Modalità demo integrata: senza `ANTHROPIC_API_KEY` l'estrazione usa un motore locale deterministico marcato "demo" — il prodotto è dimostrabile end-to-end da subito.

## Avvio

```bash
npm install
npm start                     # http://localhost:3500
# produzione: ANTHROPIC_API_KEY=... (visione reale)
#             ZALO_OA_ACCESS_TOKEN / ZALO_APP_ID / ZALO_APP_SECRET (bot OA)
```

## Architettura

```
server.js           Express: API ledger/extract/declaration/claim + webhook Zalo (raw-body, firma sha256)
src/tax.js          Soglie e aliquote hộ kinh doanh (L. 48/2024 + 109/2025, NĐ 68/2026;
                    soglia 1 tỷ da NĐ 141/2026) — configurabili via env
src/declaration.js  Mod. 01/CNKD (Thông tư 50/2026/TT-BTC) redatto in continuo dal libro
src/extract.js      Claude vision (structured) + fallback demo deterministico
src/commands.js     Comandi testuali VI/EN, matching tollerante ai refusi + stop-list
src/sheets.js       Mirror del libro sul Google Sheet dell'utente (webhook Apps Script)
src/claim.js        Token monouso del claim link Zalo→web
src/zalo.js         Client OA: verifica firma webhook, invio messaggi, download immagini
public/             Landing + app web (vietnamita primario, EN toggle, mobile-first)
```

## Legal baseline

Le norme che questo README cita sono le stesse che il codice implementa, e la
fonte di verità è **`docs/LEGAL_BASELINE.md`**: ogni costante fiscale e ogni
citazione (Thông tư 50/2026, NĐ 68/2026 + 141/2026, NĐ 254/2026, Luật 48/2024 +
109/2025) vive lì con il punto esatto del codice che la usa. La routine
settimanale `weekly-sosach-legal-watch` confronta le fonti primarie contro quel
file — **e questo README è fra le superfici sorvegliate**: se una norma cambia,
l'allerta include anche la riga da correggere qui. Manutentori: non aggiornate
una citazione solo qui o solo nel codice — passate da LEGAL_BASELINE.md.

## Deploy (Render)

`render.yaml` incluso — Blueprint su dashboard.render.com. Env opzionali: `ANTHROPIC_API_KEY`, `ZALO_*`. Nota: `data/` è effimero sul free tier (il libro è demo; produzione → Postgres).

## Disclaimer

Prototipo. Aliquote e soglie codificate dalle norme citate ma **da validare con un đại lý thuế** prima dell'uso reale; le dichiarazioni generate sono bozze.

---
© 2026 Sổ Sạch — prototipo dimostrativo.
