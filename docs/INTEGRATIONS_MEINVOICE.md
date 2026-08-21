# Sổ Sạch × MISA meInvoice — superficie di integrazione e posizione
*(ricerca 2026-08-21, fonti primarie: doc.meinvoice.vn, misa.vn, contratto CTV pubblico)*

> **Correzione 2026-08-21** (verificata su chinhphu.vn): il **Decreto 254/2026/NĐ-CP** (emesso 30/06/2026, in vigore 01/07/2026, attuativo della Legge 108/2025/QH15) **abroga** i Decreti 123/2020 e 70/2025 (e l'art. 1 del 41/2022) riprendendone la sostanza MTT sopra 1 tỷ — i riferimenti al 70/2025 qui sotto restano come contesto storico; deck e brief in docs/ sono stati riallineati in pari data.

## Cosa esiste tecnicamente
- **Open API fatture ATTIVE (pubblica, gratuita)**: `https://api.meinvoice.vn/api/v3` (+ testapi),
  REST/JSON, Bearer JWT 14gg via `POST /api/integration/auth/token` {appid, taxcode,
  username, password} — **modello KiotViet**: un AppID per ISV (emesso da MISA su
  richiesta, gratuito), credenziali meInvoice DEL commerciante per collegarlo.
  Operazioni: emissione (incl. **MTT/registratore di cassa** — lo strumento del
  Decreto 70/2025), rettifica, annullo, download, firma USB/file/HSM. Docs:
  doc.meinvoice.vn/itg + /api. Precedenti: KiotViet, Sapo, iPOS, Viindoo, connettori
  Haravan di terzi.
- **API fatture PASSIVE ("MISA INBOT")**: esiste, riservata ai partner, prerequisito
  abbonamento input-invoice (taglio enterprise). Alternativa onesta: puxare
  direttamente dal portale GDT (hoadondientu.gdt.gov.vn) con le credenziali del hộ.
- **Programma partner**: đại lý (per đại lý thuế! — lo stesso canale nostro), ASP,
  e **CTV pubblico: 20% sul primo ordine**, riconciliazione mensile, ⚠️ Điều 3.1:
  MISA può cambiare i termini senza preavviso.
- **Prezzi**: pacchetti MTT da 833đ → 200đ/fattura, setup 500k; l'API consuma il
  pacchetto del commerciante, nessun sovrapprezzo API pubblicato.
- ⚠️ **REGOLATORIO**: le pagine MISA sono già ri-ancorate su **Decreto 254/2026 +
  Circolare 91/2026 (in vigore 01/07/2026)** che riprende il quadro del 70/2025 —
  i NOSTRI materiali citano ancora solo 70/2025: aggiornare deck/brief/sito.

## Le tre proposte, in ordine
1. **"Xuất hóa đơn ngay trên Zalo"** (consumer dell'Open API): al superamento del
   1 tỷ Sổ Sạch non avvisa soltanto — emette la fattura MTT dal thread, sul
   pacchetto meInvoice del commerciante. 2–4 settimane. ⚠️ custodia credenziali
   (auth a password, non OAuth) e ⚠️ architettura provider-agnostica OBBLIGATORIA
   (KiotViet offre MISA/Viettel/VNPT switchabili — stessa cosa da noi).
2. **Corsia CTV** (zero engineering, giorni): il threshold-watcher consiglia
   meInvoice con referral code → ~20% del primo ordine + posizionamento
   "compagno di compliance". Garnish, non business model (termini unilaterali).
   Crea lo storico di relazione per chiedere l'AppID della proposta 1.
3. **Import spese via INBOT**: la metà mancante del libro, ma dipendenza massima
   per il fit minimo (prodotto enterprise). La VERA voce di roadmap è il pull
   diretto dal portale GDT.

## Posizione strategica
**Consumer arms-length + stretta di mano CTV. Nessuna partnership formale ora.**
Tutto il necessario è pubblico e gratuito; MISA sta costruendo verso il nostro
segmento (homepage: "Agentic AI cho … hộ kinh doanh") — dargli volume di fatture
sì (lo vogliono), MAI il cervello conversazionale del libro (il fossato).
Rivisitare la partnership formale solo quando Sổ Sạch entra da CANALE, non da
supplicante. BATNA credibile: Viettel S-Invoice / VNPT-Invoice nello stesso slot.
