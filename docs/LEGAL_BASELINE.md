# Sổ Sạch — LEGAL BASELINE (la verità che il prodotto implementa)
*Aggiornare questo file OGNI volta che cambia una costante fiscale nel codice o
una citazione nei materiali. La routine settimanale `weekly-sosach-legal-watch`
confronta le fonti ufficiali CONTRO questo file: se diverge, scatta l'allerta.*
*Ultimo aggiornamento: 2026-08-21.*

## Regime e obblighi
| # | Assunzione del prodotto | Fonte normativa | Dove vive nel codice/materiali |
|---|---|---|---|
| 1 | Thuế khoán abolito dal 01/01/2026; hộ kinh doanh dichiara su libri veri | Riforma 2026 (L. Quản lý thuế 108/2025/QH15) | copy sito, deck, brief |
| 2 | Dichiarazione trimestrale mẫu **01/CNKD**, scadenza ultimo giorno del mese successivo al trimestre | Thông tư 40/2021/TT-BTC | `src/tax.js` nextDeadline, `src/declaration.js` |
| 3 | Soglia esenzione VAT/PIT: **1 tỷ VND/anno** (alzata da 500M) | Nghị định 141/2026/NĐ-CP | `src/tax.js` THRESHOLDS.taxFree (env TAX_FREE_THRESHOLD) |
| 4 | Aliquote presuntive su ricavi: distribuzione 1%+0,5% · F&B/servizi-con-merce 3%+1,5% · servizi puri 5%+2% | Allegato Thông tư 40/2021/TT-BTC | `src/tax.js` CATEGORIES |
| 5 | E-invoice da registratore (MTT) sopra 1 tỷ | **Nghị định 254/2026/NĐ-CP** (in vigore 01/07/2026; abroga 123/2020, 70/2025, art.1 41/2022) + Thông tư 91/2026/TT-BTC | soglia in `src/tax.js` eInvoice; citazioni in deck/brief/sito |
| 6 | 70/2025 e 123/2020 = SOLO storia, mai legge viva | — | materiali: sempre accoppiati a 254/2026 |

## Sorgenti da sorvegliare (in quest'ordine)
1. `xaydungchinhsach.chinhphu.vn` + `vanban.chinhphu.vn` (primarie)
2. `thuvienphapluat.vn` / `luatvietnam.vn` (secondarie veloci)
3. `gdt.gov.vn` (circolari, mẫu, avvisi 01/CNKD)
4. Canarini di settore: `meinvoice.vn/tin-tuc`, `misa.vn` news — si ri-ancorano
   in fretta (provato: avevano già 254/2026 mentre noi citavamo 70/2025)

## Cosa conta come "richiede modifica"
- Cambio ALIQUOTE o SOGLIE (righe 3–4) → toccare `src/tax.js` + validare con đại lý thuế
- Nuovo decreto/circolare che sostituisce una fonte in tabella → citazioni in materiali+sito
- Cambio del mẫu 01/CNKD o delle scadenze → `src/declaration.js` + print sheet
- Cambi al regime hộ kinh doanh (definizioni, obblighi libri) → copy + spec prodotto
