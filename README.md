# 📒 Sổ Sạch

**Chụp hoá đơn. Sổ sách tự lo.** — trợ lý kế toán AI trên Zalo cho hộ kinh doanh Việt Nam. / **Snap the receipt, the books do themselves** — AI bookkeeper on Zalo for Vietnamese household businesses.

**Perché ora (why now):** dal 01/01/2026 il regime forfettario "khoán" è abolito — ~5,2 milioni di hộ kinh doanh devono tenere i libri e dichiarare i ricavi reali (prima scadenza trimestrale: 30/04/2026), e dal 06/2025 chi supera 1 miliardo VND/anno deve emettere e-invoice da registratore di cassa (Decreto 70/2025). Sổ Sạch trasforma quest'obbligo in una foto su Zalo.

## Il prodotto

1. **📷 Chụp & gửi** — foto di scontrini/fatture/bonifici, via Zalo OA o web
2. **🤖 AI ghi sổ** — estrazione (Claude vision, structured output) → voce thu/chi confermabile in un tocco
3. **🔔 Canh ngưỡng** — barre soglia in tempo reale: 500M (soglia tassabilità 2026) e 1B (obbligo e-invoice), con proiezione annua dai ricavi YTD
4. **📄 Tờ khai soạn sẵn** — mod. 01/CNKD (Thông tư 40/2021/TT-BTC) precompilato per il trimestre: ricavi, GTGT, TNCN per categoria di attività, stampabile/PDF

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
server.js        Express: API ledger/extract/declaration + webhook Zalo (raw-body, firma sha256)
src/tax.js       Soglie e aliquote hộ kinh doanh (Circ. 40/2021; riforma 2026) — configurabili via env
src/extract.js   Claude vision (structured) + fallback demo deterministico
src/zalo.js      Client OA: verifica firma webhook, invio messaggi, download immagini
public/          Landing + app web (vietnamita primario, EN toggle, mobile-first)
```

## Deploy (Render)

`render.yaml` incluso — Blueprint su dashboard.render.com. Env opzionali: `ANTHROPIC_API_KEY`, `ZALO_*`. Nota: `data/` è effimero sul free tier (il libro è demo; produzione → Postgres).

## Disclaimer

Prototipo. Aliquote e soglie codificate dalle norme citate ma **da validare con un đại lý thuế** prima dell'uso reale; le dichiarazioni generate sono bozze.

---
© 2026 Sổ Sạch — prototipo dimostrativo.
