# ============================================================================
#  Sổ Sạch — DECK COMPLETO POST-NDA (17 slide, EN + IT), versione MONOCROMA.
#
#  Questo è il documento che si manda DOPO la firma dell'NDA. Contiene tutto
#  ciò che il brief tiene fuori: economics unitarie, il modello del punteggio,
#  la meccanica del canale Zalo, i numeri scomodi, i criteri di stop.
#
#  DUE CAMBI DI FONDO rispetto alla versione precedente:
#  1. Sistema visivo: via il kit giada/oro (deck_kit), dentro mono_kit — nero,
#     bianco, due grigi, Avenir Next con i glifi vietnamiti completi. La
#     gerarchia la fanno peso e scala, non il colore.
#  2. Posizionamento: la controparte è un PARTNER industriale/strategico, non
#     un fondo. Sparisce ogni traccia della raccolta — niente $300k, niente
#     runway, niente use-of-funds, niente SAFE. Le ultime due slide diventano
#     la forma della collaborazione (cosa portiamo noi / cosa porta il partner
#     / i primi novanta giorni) e una chiusura che dice esplicitamente che non
#     stiamo raccogliendo denaro.
#
#  La fascia CONFIDENTIAL sta su OGNI pagina: barra piena nera con testo
#  bianco; sulle pagine scure la barra è bianca con testo nero, altrimenti
#  sparirebbe nel fondo. Stampata, questa versione non deve potersi confondere
#  con il brief pre-NDA.
#
#  Le slide con gli screenshot usano IMMAGINI VERE (scratchpad/shots): le
#  risposte di produzione del bot, il libro campione generato dai motori veri,
#  il 01/CNKD redatto dal sistema. Le didascalie dicono esattamente questo —
#  niente mockup spacciati per prodotto.
#
#  Rigenera: python3 make_deck_postnda.py
# ============================================================================
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from mono_kit import (W, H, MARG, PAGE, INK, GREY, GREY_L, RULE, WASH, WHITE,
                      tracked, kicker, title, subtitle, rule, footer, bullets,
                      table, stat_row, dark_page, dark_block, photo, SHOTS,
                      st_body, st_small, st_smallk, st_cell)

TOTAL = 17


def band_bar(c, text, dark=False):
    """La fascia di riservatezza: 6mm pieni a tutta larghezza in cima.
    Sulle pagine scure si inverte (barra bianca, testo nero) — una barra nera
    su fondo nero è una fascia che non esiste."""
    bh = 6 * mm
    bg, fg = (WHITE, INK) if dark else (INK, WHITE)
    c.saveState()
    c.setFillColor(bg)
    c.rect(0, H - bh, W, bh, stroke=0, fill=1)
    c.restoreState()
    f, fs, sp = "AV-Db", 6.8, 1.6
    # tracked() non centra: la larghezza va calcolata a mano includendo la
    # crenatura, altrimenti il testo slitta a destra di mezzo alfabeto.
    tw = pdfmetrics.stringWidth(text, f, fs) + sp * (len(text) - 1)
    tracked(c, text, (W - tw) / 2, H - bh + (bh - fs * 0.72) / 2, f, fs, sp, fg)


def fit_title(c, text, y, size=28, font="AV-Bd"):
    """Titolo che si restringe finché sta dentro i margini. I titoli italiani
    sono sistematicamente più lunghi degli inglesi: senza questo, metà delle
    slide IT sforerebbe a destra e il controllo pymupdf lo troverebbe."""
    while size > 15 and pdfmetrics.stringWidth(text, font, size) - 0.6 * (len(text) - 1) > W - 2 * MARG:
        size -= 0.5
    title(c, text, y, size=size, font=font)


def label_block(c, x, y, w, head, body, style=st_small):
    """Il sostituto mono dei vecchi riquadri colorati arrotondati: filetto
    nero, etichetta spaziata, paragrafo. Torna la y sotto il blocco."""
    rule(c, y, x, x + w, color=INK, w=1.1)
    tracked(c, head.upper(), x, y - 12, "AV-Db", 8.2, 1.9, GREY_L)
    p = Paragraph(body, style)
    _, ph = p.wrap(w, 300)
    p.drawOn(c, x, y - 22 - ph)
    return y - 22 - ph


def build(lang, out):
    E = lang == "en"
    c = canvas.Canvas(out, pagesize=PAGE)
    c.setTitle("Sổ Sạch — Confidential Deck" if E else "Sổ Sạch — Deck Riservato")
    foot = ("Sổ Sạch — CONFIDENTIAL · disclosed under NDA · August 2026" if E
            else "Sổ Sạch — RISERVATO · comunicato in forza di NDA · Agosto 2026")
    band = ("CONFIDENTIAL — DISCLOSED UNDER NDA — DO NOT CIRCULATE" if E
            else "RISERVATO — COMUNICATO IN FORZA DI NDA — NON DIFFONDERE")

    def page(n, dark=False):
        band_bar(c, band, dark=dark)
        footer(c, n, TOTAL, foot, dark=dark)
        c.showPage()

    # ---------------- 1 · COVER (scura) ----------------
    dark_page(c)
    tracked(c, ("FULL OPERATING PICTURE · AUGUST 2026" if E
                else "QUADRO OPERATIVO COMPLETO · AGOSTO 2026"),
            MARG, H - 34 * mm, "AV-Db", 8.4, 2.0, "#8a8a8a")
    tracked(c, "Sổ Sạch", MARG, H - 64 * mm, "AV-Bd", 72, -2.2, WHITE)
    c.setStrokeColor(HexColor("#3a3a3a")); c.setLineWidth(0.8)
    c.line(MARG, H - 72 * mm, W - MARG, H - 72 * mm)
    c.setFillColor(WHITE); c.setFont("AV", 15)
    c.drawString(MARG, H - 84 * mm,
                 "The AI bookkeeper on Zalo for Vietnam's 5.2 million household businesses." if E
                 else "Il commercialista AI su Zalo per i 5,2 milioni di hộ kinh doanh del Vietnam.")
    c.setFillColor(HexColor("#a8a8a8")); c.setFont("AV", 12)
    c.drawString(MARG, H - 94 * mm,
                 "Everything the first briefing withheld: unit economics, the channel, the moat, the risks" if E
                 else "Tutto ciò che il primo brief tratteneva: economics unitarie, canale, fossato, rischi")
    c.drawString(MARG, H - 101 * mm,
                 "and the numbers we don't like." if E else "e i numeri che non ci piacciono.")
    c.setFillColor(WHITE); c.setFont("AV-Db", 11.5)
    c.drawString(MARG, H - 118 * mm,
                 "Prepared for a partnership conversation, not a fundraising one." if E
                 else "Preparato per una conversazione di partnership, non di raccolta.")
    tracked(c, "SOSACH.COM.VN · YURI FRASSI · YURI@OFFICINEGAP.COM · CÔNG TY TNHH OFFICINE GẶP",
            MARG, 22 * mm, "AV", 7.2, 1.4, "#8a8a8a")
    page(1, dark=True)

    # ---------------- 2 · LO SHOCK ----------------
    kicker(c, "01 — The shock" if E else "01 — Lo shock", H - 28 * mm)
    fit_title(c, "The customer acquisition was done by the state." if E
              else "L'acquisizione clienti l'ha fatta lo Stato.", H - 41 * mm)
    y = table(c, [
        [("Instrument" if E else "Norma"), ("Effect" if E else "Effetto"), ("Who it hits" if E else "Chi colpisce")],
        [("Abolition of thuế khoán, 01/01/2026" if E else "Abolizione del thuế khoán, 01/01/2026"),
         ("lump-sum assessment replaced by self-declaration on real books" if E
          else "accertamento forfettario sostituito da autodichiarazione su libri veri"),
         "5.2M hộ kinh doanh"],
        [("Decree 70/2025" if E else "Decreto 70/2025"),
         ("e-invoicing from a connected cash register above 1 tỷ VND annual revenue" if E
          else "e-fattura da registratore connesso sopra 1 tỷ VND di ricavi annui"),
         ("the upper tier — and the ones who cross it unknowingly" if E
          else "la fascia alta — e chi la supera senza saperlo")],
        [("Decree 141/2026" if E else "Decreto 141/2026"),
         # niente "→": Avenir Next non ha il glifo U+2192 e nei Paragraph
         # usciva un buco bianco al posto della freccia
         ("taxable threshold raised from 500 triệu to 1 tỷ VND" if E
          else "soglia imponibile alzata da 500 triệu a 1 tỷ VND"),
         ("most of the market is exempt — but must still file" if E
          else "gran parte del mercato è esente — ma deve comunque dichiarare")],
        [("Circular 40/2021" if E else "Circolare 40/2021"),
         ("presumptive rates on revenue: 1%+0.5% / 3%+1.5% / 5%+2% by activity" if E
          else "aliquote presuntive sui ricavi: 1%+0,5% / 3%+1,5% / 5%+2% per attività"),
         ("everyone above the threshold" if E else "chiunque sopra soglia")],
    ], [160, 320, 210], MARG, H - 50 * mm, fs=9.3)
    bullets(c, [
        ("<b>The obligation is not optional and not one-off.</b> It recurs every quarter, with a filing deadline "
         "on the last day of the month following. A product tied to a statutory deadline has a re-activation "
         "engine competitors have to buy with marketing." if E
         else "<b>L'obbligo non è facoltativo né una tantum.</b> Torna ogni trimestre, con scadenza l'ultimo giorno "
              "del mese successivo. Un prodotto agganciato a una scadenza di legge ha un motore di riattivazione "
              "che i concorrenti devono comprare col marketing."),
        ("<b>Most of them owe nothing and must file anyway.</b> That is the wedge: we are not selling tax savings, "
         "we are selling the disappearance of an administrative fear." if E
         else "<b>La maggior parte non deve nulla e deve comunque dichiarare.</b> È il cuneo: non vendiamo risparmio "
              "fiscale, vendiamo la scomparsa di una paura amministrativa."),
    ], MARG, y - 8 * mm, W - 2 * MARG, style=st_small)
    page(2)

    # ---------------- 3 · IL CICLO DI PRODOTTO ----------------
    # Screenshot VERO delle risposte di produzione, non il mockup ridisegnato:
    # davanti a un partner la prova vale più dell'illustrazione.
    kicker(c, "02 — The product loop" if E else "02 — Il ciclo di prodotto", H - 28 * mm)
    fit_title(c, "Photograph. Confirm. Filed." if E else "Fotografa. Conferma. Dichiarato.", H - 41 * mm)
    pw_img = 66 * mm  # 66mm di base → ~125mm di altezza: sta sopra il footer
    photo(c, f"{SHOTS}/chat_crop.png", MARG, H - 48 * mm, pw_img,
          caption=("The bot's actual production replies" if E
                   else "Le risposte di produzione del bot, reali"))
    px = MARG + pw_img + 24
    pw = W - MARG - px
    bullets(c, [
        ("<b>Zalo is the whole interface.</b> 77M Vietnamese use it daily; there is no app to install, no password "
         "to remember, no desktop." if E
         else "<b>Zalo è tutta l'interfaccia.</b> 77M di vietnamiti la usano ogni giorno; nessuna app da installare, "
              "nessuna password, nessun desktop."),
        ("<b>Vision does the typing.</b> Claude reads the receipt — amount, supplier, date — and the household "
         "confirms rather than transcribes." if E
         else "<b>La visione fa la digitazione.</b> Claude legge lo scontrino — importo, fornitore, data — e "
              "l'impresa conferma invece di trascrivere."),
        ("<b>Revenue is not photographed.</b> A café does not print a receipt for 200 coffees, so daily takings "
         "arrive as one typed line: <i>thu 2tr4</i>. Photos carry the costs, one line carries the sales." if E
         else "<b>I ricavi non si fotografano.</b> Un bar non stampa scontrini per 200 caffè: l'incasso di giornata "
              "arriva come una riga scritta, <i>thu 2tr4</i>. Le foto portano i costi, una riga porta le vendite."),
        ("<b>The declaration is a by-product.</b> Form 01/CNKD is drafted continuously; at quarter end there is "
         "nothing to prepare, only something to check." if E
         else "<b>La dichiarazione è un sottoprodotto.</b> Il modulo 01/CNKD si redige in continuo; a fine trimestre "
              "non c'è nulla da preparare, solo qualcosa da controllare."),
    ], px, H - 52 * mm, pw, style=st_small)
    page(3)

    # ---------------- 4 · IL LIBRO (nuova slide dedicata) ----------------
    # Il libro live e il 01/CNKD, fianco a fianco: è l'output che il partner
    # può verificare, quindi merita una pagina intera invece di una miniatura.
    kicker(c, "03 — The book it produces" if E else "03 — Il libro che produce", H - 28 * mm)
    fit_title(c, "From photographs to a filed declaration." if E
              else "Dalle fotografie a una dichiarazione depositata.", H - 41 * mm)
    bw_img = 70 * mm
    # didascalia CORTA: tracked() non manda a capo, e una didascalia più larga
    # dell'immagine finiva sotto il paragrafo della colonna destra (collisione
    # vista al render). I dettagli (soglie, flusso di cassa) stanno nel testo.
    photo(c, f"{SHOTS}/book_crop.png", MARG, H - 48 * mm, bw_img,
          caption=("The live web book — score 98/A" if E
                   else "Il libro web live — punteggio 98/A"))
    dx = MARG + bw_img + 26
    dw = W - MARG - dx
    dh = photo(c, f"{SHOTS}/decl_crop.png", dx, H - 48 * mm, dw,
               caption=("Form 01/CNKD, drafted continuously from the book" if E
                        else "Modulo 01/CNKD, redatto in continuo dal libro"))
    p4 = Paragraph(
        ("Sample book of a noodle shop, generated by the real engines — not a design comp. The score is "
         "deliberately hard: an early version graded every household A, which is worthless to a lender. Below "
         "the threshold the declaration shows 0đ due — and says the filing is still owed, which is exactly the "
         "misunderstanding that gets households fined." if E else
         "Libro campione di un locale di bún bò, generato dai motori veri — non una tavola grafica. Il punteggio "
         "è volutamente severo: una prima versione dava la A a tutti, il che non serve a nessun istituto. Sotto "
         "soglia la dichiarazione mostra 0đ dovuti — e dice che il deposito resta dovuto, che è esattamente "
         "l'equivoco per cui le imprese si fanno multare."), st_small)
    _, ph4 = p4.wrap(dw, 300)
    # dh è in punti (photo lavora in punti): il paragrafo parte sotto la didascalia
    p4.drawOn(c, dx, H - 48 * mm - dh - 10 - ph4)
    page(4)

    # ---------------- 5 · CORRETTEZZA ----------------
    kicker(c, "04 — Why this is a correctness product" if E
           else "04 — Perché è un prodotto di correttezza", H - 28 * mm)
    fit_title(c, "The first real receipt found four ways to be confidently wrong." if E
              else "Il primo scontrino vero: quattro modi di sbagliare con sicurezza.", H - 41 * mm, size=24)
    subtitle(c, "We are showing you our bug list. Most decks don't. This is the discipline the category demands." if E
             else "Vi mostriamo la nostra lista di bug. Pochi deck lo fanno. È la disciplina che questa categoria esige.",
             H - 49 * mm)
    y = table(c, [
        [("Failure" if E else "Guasto"), ("What it would have done to a household" if E else "Cosa avrebbe fatto a un'impresa"), ("State" if E else "Stato")],
        [("Date read as MM/DD" if E else "Data letta come MM/DD"),
         ("a receipt printed 10/08 booked as 8 October — entries in the wrong quarter, wrong declaration" if E
          else "uno scontrino del 10/08 registrato all'8 ottobre — voci nel trimestre sbagliato, dichiarazione sbagliata"),
         ("Fixed" if E else "Risolto")],
        [("“30.000” parsed as 30" if E else "“30.000” letto come 30"),
         ("the dot separates thousands in Vietnam — every formatted amount booked 1,000× too small, silently" if E
          else "il punto separa le migliaia in Vietnam — ogni importo formattato registrato 1.000 volte più piccolo, in silenzio"),
         ("Fixed" if E else "Risolto")],
        [("Silent fallback to demo data" if E else "Fallback silenzioso ai dati demo"),
         ("any model failure returned an invented supplier and a plausible amount, indistinguishable from a real read" if E
          else "ogni errore del modello restituiva un fornitore inventato e un importo plausibile, indistinguibile da una lettura vera"),
         ("Fixed" if E else "Risolto")],
        [("Server clock vs Vietnam clock" if E else "Orologio server vs orologio Vietnam"),
         ("an entry dated 1 April fell into Q1, 1 January into the previous year — the wrong quarterly filing" if E
          else "una voce del 1° aprile finiva nel Q1, il 1° gennaio nell'anno prima — deposito trimestrale sbagliato"),
         ("Fixed" if E else "Risolto")],
        [("Empty book at mid-year signup" if E else "Libro vuoto all'iscrizione a metà anno"),
         ("a business turning over 1.44 tỷ VND was told it was exempt, because seven blank months read as no trading" if E
          else "un'impresa da 1,44 tỷ VND risultava esente, perché sette mesi in bianco venivano letti come nessuna vendita"),
         ("Fixed" if E else "Risolto")],
    ], [155, 455, 80], MARG, H - 55 * mm, fs=8.8)
    c.setFillColor(INK); c.setFont("AV-Db", 11)
    c.drawString(MARG, y - 9 * mm,
                 "None of these ever reached a household." if E
                 else "Nessuno di questi ha mai raggiunto un'impresa.")
    c.setFont("AV", 10); c.setFillColor(GREY)
    c.drawString(MARG, y - 15 * mm,
                 "All five were found by tests written before the pilot — 72 of them, run across four timezones on every change." if E
                 else "Tutti e cinque trovati da test scritti prima del pilota — 72, eseguiti su quattro fusi orari a ogni modifica.")
    page(5)

    # ---------------- 6 · MERCATO ----------------
    kicker(c, "05 — Market" if E else "05 — Mercato", H - 28 * mm)
    fit_title(c, "Two customer shapes, one engine." if E else "Due forme di cliente, un solo motore.", H - 41 * mm)
    y = table(c, [
        ["", ("Size" if E else "Dimensione"), ("Definition &amp; source" if E else "Definizione e fonte")],
        ["TAM", "5.2M", ("household businesses required to keep books from 2026 (GSO)" if E
                         else "imprese familiari obbligate ai libri dal 2026 (GSO)")],
        ["SAM", "~1.8M", ("smartphone-active, revenue 200 triệu – 3 tỷ VND — duty is real, capability is not" if E
                          else "smartphone-attive, ricavi 200 triệu – 3 tỷ VND — l'obbligo è reale, la capacità no")],
        [("SOM (Y3)" if E else "SOM (A3)"), "40,000", ("~2.2% of SAM, district by district from HCMC outward" if E
                                                       else "~2,2% del SAM, distretto per distretto da HCMC")],
    ], [90, 100, 500], MARG, H - 48 * mm, fs=9.5)
    # I due segmenti: colonne editoriali (filetto + etichetta), non card colorate.
    cw = (W - 2 * MARG - 30) / 2
    ys = y - 12 * mm
    for i, (head, body) in enumerate([
        (("SEGMENT A — ONLINE SELLERS" if E else "SEGMENTO A — VENDITORI ONLINE"),
         ("Shopee, TikTok Shop, Lazada. Tax is withheld at source by the platform, so their problem is "
          "reconciliation and reclaiming what was over-withheld. Digitally fluent, reachable online, "
          "lower support cost, faster to convert." if E else
          "Shopee, TikTok Shop, Lazada. La ritenuta la opera la piattaforma alla fonte: il loro problema è "
          "riconciliare e recuperare il trattenuto in eccesso. Digitalmente competenti, raggiungibili "
          "online, costo di assistenza minore, conversione più rapida.")),
        (("SEGMENT B — STREET RETAIL" if E else "SEGMENTO B — RETAIL DI STRADA"),
         ("Eateries, kiosks, market stalls, repair shops. Cash, no cash register, no accountant, often no "
          "email. They need the book itself and a warning in human language before the threshold bites. "
          "Unreachable by advertising — reachable through their tax agent." if E else
          "Trattorie, chioschi, bancarelle, officine. Contanti, nessun registratore, nessun contabile, "
          "spesso nessuna email. Serve il libro in sé e un avviso in linguaggio umano prima che la soglia "
          "morda. Irraggiungibili con la pubblicità — raggiungibili tramite il loro đại lý thuế.")),
    ]):
        x = MARG + i * (cw + 30)
        label_block(c, x, ys, cw, head, body)
    page(6)

    # ---------------- 7 · MODELLO DI BUSINESS ----------------
    kicker(c, "06 — Business model" if E else "06 — Modello di business", H - 28 * mm)
    fit_title(c, "Priced for a street vendor. Sold by the person they already trust." if E
              else "Prezzo da bancarella. Venduto da chi ha già la loro fiducia.", H - 41 * mm, size=24)
    y = table(c, [
        [("Line" if E else "Linea"), ("Price" if E else "Prezzo"), ("Y3 share" if E else "Quota A3"), ("What it buys" if E else "Cosa compra")],
        ["Core", "69k VND/mo (~$2.70)", "62%", ("photo ledger, thresholds, declaration draft, Zalo bot" if E
                                                else "libro fotografico, soglie, bozza dichiarazione, bot Zalo")],
        ["Pro", "149k VND/mo (~$5.90)", "23%", ("multi-location, exports, e-invoice via partner API, priority support" if E
                                                else "multi-sede, export, e-fattura via API partner, assistenza prioritaria")],
        [("Tax-agent channel" if E else "Canale đại lý thuế"), "30% rev-share", "15%",
         ("dashboard for an agent running 20–200 households — the trust channel becomes the sales channel" if E
          else "cruscotto per un agente con 20–200 imprese — il canale di fiducia diventa canale di vendita")],
    ], [120, 135, 70, 365], MARG, H - 48 * mm, fs=9.3)
    y2 = stat_row(c, [
        ("$0.20–0.40", "COGS / user / month" if E else "COGS / utente / mese"),
        (">85%", "gross margin at scale" if E else "margine lordo a scala"),
        ("<$4", "blended CAC" if E else "CAC medio"),
        ("~$3.30", "blended ARPU / month" if E else "ARPU medio / mese"),
        ("~2.5 mo", "CAC payback" if E else "payback CAC"),
    ], y - 10 * mm, big=19)
    bullets(c, [
        ("<b>COGS is dominated by vision inference</b>, roughly 20–40 US cents per active user per month at "
         "current volumes and model pricing, and it falls as we route routine receipts to smaller models. "
         "Infrastructure and Zalo fees are effectively fixed." if E
         else "<b>Il COGS è dominato dall'inferenza visiva</b>, circa 20–40 centesimi di dollaro per utente attivo al "
              "mese ai volumi e prezzi attuali, e scende instradando gli scontrini di routine su modelli minori. "
              "Infrastruttura e costi Zalo sono di fatto fissi."),
        ("<b>Quarterly deadlines are a churn counterweight.</b> A lapsed user has a legal reason to come back four "
         "times a year, and we hold the book they need." if E
         else "<b>Le scadenze trimestrali sono un contrappeso al churn.</b> Un utente perso ha un motivo legale per "
              "tornare quattro volte l'anno, e il libro che gli serve lo abbiamo noi."),
    ], MARG, y2 - 8 * mm, W - 2 * MARG, style=st_small)
    page(7)

    # ---------------- 8 · IL FOSSATO ZALO ----------------
    kicker(c, "07 — The moat nobody can shortcut" if E else "07 — Il fossato che non si scavalca", H - 28 * mm)
    fit_title(c, "A verified Zalo Official Account is a licence, not a signup." if E
              else "Un Zalo Official Account verificato è una licenza, non un'iscrizione.", H - 41 * mm, size=24)
    y = table(c, [
        [("Gate" if E else "Barriera"), ("What it actually required" if E else "Cosa ha richiesto davvero")],
        [("Personal identity" if E else "Identità personale"),
         ("the founder's own Zalo account had to pass biometric eKYC before an OA could even be created — the wall "
          "that stops most foreign-run attempts" if E
          else "l'account Zalo personale del fondatore ha dovuto superare l'eKYC biometrico prima ancora di poter "
               "creare un OA — il muro che ferma gran parte dei tentativi a guida straniera")],
        [("Corporate verification" if E else "Verifica societaria"),
         ("four review rounds; rejections for a composited signature, for naming Zalo in the description, and for "
          "business evidence that could not be matched to the company register" if E
          else "quattro round; respinte per firma ricomposta, per aver nominato Zalo nella descrizione, e per prove "
               "d'impresa non riconducibili al registro societario")],
        [("Domain ownership" if E else "Proprietà del dominio"),
         ("cleared only once the company held sosach.com.vn in its own name — a .com.vn requires a Vietnamese "
          "registrant and, for a foreign-represented company, a workaround we had to find" if E
          else "superata solo quando la società ha avuto sosach.com.vn a proprio nome — un .com.vn richiede un "
               "titolare vietnamita e, per una società con rappresentante straniero, un aggiramento da trovare")],
        [("Data residency" if E else "Residenza dei dati"),
         ("Zalo restricts user data to Vietnamese-IP endpoints since 2024; we established by live test which fields "
          "actually survive a foreign endpoint — a fact competitors will have to buy with their own months" if E
          else "Zalo limita i dati utente a endpoint con IP vietnamita dal 2024; abbiamo stabilito con test dal vivo "
               "quali campi sopravvivono davvero a un endpoint estero — un fatto che i concorrenti dovranno pagare "
               "con i propri mesi")],
        [("Paid tier" if E else "Piano a pagamento"),
         ("a verified OA still cannot send a message until an annual OA package is purchased through a pre-funded "
          "Zalo Business account — a rail with its own onboarding" if E
          else "un OA verificato non può comunque inviare messaggi finché non si acquista un pacchetto annuale "
               "tramite un conto Zalo Business precaricato — un binario con il proprio onboarding")],
    ], [145, 545], MARG, H - 48 * mm, fs=8.8)
    c.setFillColor(INK); c.setFont("AV-Db", 11)
    c.drawString(MARG, y - 9 * mm,
                 "Eleven months. Four rejections. One Vietnamese company, one wet seal." if E
                 else "Undici mesi. Quattro respinte. Una società vietnamita, un timbro a inchiostro.")
    c.setFont("AV", 10); c.setFillColor(GREY)
    c.drawString(MARG, y - 15 * mm,
                 "A competitor with more money does not get to skip any of it." if E
                 else "Un concorrente con più soldi non può saltarne nemmeno un passaggio.")
    page(8)

    # ---------------- 9 · DISTRIBUZIONE ----------------
    kicker(c, "08 — Distribution" if E else "08 — Distribuzione", H - 28 * mm)
    fit_title(c, "We don't chase households. We recruit whoever already has them." if E
              else "Non inseguiamo le imprese. Reclutiamo chi già le ha.", H - 41 * mm, size=23)
    y = table(c, [
        [("Channel" if E else "Canale"), ("Mechanic" if E else "Meccanica"), "CAC", ("Honest limitation" if E else "Limite onesto")],
        ["Đại lý thuế",
         ("licensed tax agents each serve 20–200 households; they get a dashboard, we give 30% of revenue" if E
          else "i đại lý thuế abilitati servono 20–200 imprese ciascuno; ricevono un cruscotto, diamo il 30% dei ricavi"),
         "&lt;$2",
         ("slow to recruit; each agent is a relationship, not a signup" if E
          else "lenti da reclutare; ogni agente è un rapporto, non un'iscrizione")],
        [("QR flyers, market streets" if E else "Volantini QR, strade di mercato"),
         ("physical presence where segment B actually is; scan opens the Zalo OA directly" if E
          else "presenza fisica dove il segmento B sta davvero; la scansione apre l'OA Zalo direttamente"),
         "~$3",
         ("labour-intensive, does not scale beyond a city without staff" if E
          else "ad alta intensità di lavoro, non scala oltre una città senza personale")],
        [("Artefact virality" if E else "Viralità da artefatto"),
         ("every declaration and receipt shared on Zalo carries the mark — the customer's paperwork recruits" if E
          else "ogni dichiarazione e ricevuta condivisa su Zalo porta il marchio — la burocrazia del cliente recluta"),
         "~$0",
         ("unproven at scale; we model it at zero" if E else "non provata su scala; la modelliamo a zero")],
    ], [125, 300, 50, 215], MARG, H - 48 * mm, fs=8.8)
    # Il numero scomodo resta scomodo anche in bianco e nero: filetto, etichetta,
    # paragrafo. Nessun riquadro rosso a fare il lavoro che deve fare il testo.
    label_block(c, MARG, y - 10 * mm, W - 2 * MARG,
                ("THE NUMBER WE DON'T LIKE" if E else "IL NUMERO CHE NON CI PIACE"),
                ("At 30% rev-share on a 69k VND subscription, a tax agent running 12 households earns about "
                 "248,000 VND a month — roughly ten US dollars. That is not yet a reason for a professional to "
                 "change how they work. The channel only becomes rational for the agent at around 100 households "
                 "(~2.07M VND/month), which is why the pilot is sized at 100 and why agent recruitment, not "
                 "household acquisition, is the metric that actually decides this business." if E else
                 "Con il 30% su un abbonamento da 69k VND, un đại lý thuế con 12 imprese guadagna circa 248.000 VND "
                 "al mese — sui dieci dollari. Non è ancora un motivo per cui un professionista cambi metodo di "
                 "lavoro. Il canale diventa razionale per l'agente attorno alle 100 imprese (~2,07M VND/mese): "
                 "per questo il pilota è dimensionato a 100 e per questo la metrica che decide davvero questo "
                 "business è il reclutamento degli agenti, non l'acquisizione delle imprese."))
    page(9)

    # ---------------- 10 · L'ASSET DEI DATI ----------------
    kicker(c, "09 — The asset underneath" if E else "09 — L'asset sottostante", H - 28 * mm)
    fit_title(c, "We record how much to trust every figure." if E
              else "Registriamo quanto fidarsi di ogni cifra.", H - 41 * mm)
    subtitle(c, "This is the difference between a subscription list and something a lender can underwrite." if E
             else "È la differenza fra una lista di abbonati e qualcosa che un prestatore può istruire.", H - 49 * mm)
    y = table(c, [
        [("Provenance tag" if E else "Tag di provenienza"), ("Meaning" if E else "Significato"), ("Underwriting weight" if E else "Peso in istruttoria")],
        ["photo", ("read from an image of a document the business actually received" if E
                   else "letto da un'immagine di un documento realmente ricevuto"), ("High" if E else "Alto")],
        ["manual", ("typed by the business — daily takings, cash sales" if E
                    else "digitato dall'impresa — incassi di giornata, vendite in contanti"), ("Medium" if E else "Medio")],
        ["declared", ("carried in from an old notebook or another app at signup" if E
                      else "portato da un vecchio quaderno o da un altro software all'iscrizione"), ("None" if E else "Nessuno")],
        ["bank / pos / einvoice", ("third-party confirmed — the roadmap target" if E
                                   else "confermato da terzi — l'obiettivo di roadmap"), ("Highest" if E else "Massimo")],
    ], [145, 415, 130], MARG, H - 55 * mm, fs=9.3)
    bullets(c, [
        ("<b>Điểm Sổ Sạch</b> — a 0–100 credit-readiness score built from recording density against expected "
         "trading days, documentary completeness, margin and month-to-month steadiness, and filing readiness. "
         "It grades A to D and it is deliberately hard: an early version gave every household an A, which is "
         "worthless to a lender." if E
         else "<b>Điểm Sổ Sạch</b> — punteggio 0–100 di prontezza creditizia costruito su densità di registrazione "
              "rispetto ai giorni di attività attesi, completezza documentale, margine e regolarità mese su mese, e "
              "prontezza dichiarativa. Gradua da A a D ed è volutamente severo: una prima versione dava la A a "
              "tutti, il che non serve a nessun istituto."),
        ("<b>Declared history earns nothing.</b> A household can arrive with three years of notebook, obtain a "
         "correct tax position immediately, and still start at a low score. History fixes your filing; only "
         "evidence builds your credit file." if E
         else "<b>La storia dichiarata non vale punti.</b> Un'impresa può arrivare con tre anni di quaderno, ottenere "
              "subito la posizione fiscale corretta, e partire comunque da un punteggio basso. La storia sistema la "
              "dichiarazione; solo le prove costruiscono il dossier di credito."),
        ("<b>The strategic thesis.</b> At 40,000 households the portfolio is a structured, provenance-weighted record "
         "of how Vietnamese micro-business actually trades — the input a bank or credit fund currently cannot buy at "
         "any price, because nobody is collecting it this way." if E
         else "<b>La tesi strategica.</b> A 40.000 imprese il portafoglio è un registro strutturato e pesato per "
              "provenienza di come commercia davvero la micro-impresa vietnamita — l'input che oggi una banca o un "
              "fondo di credito non può comprare a nessun prezzo, perché nessuno lo raccoglie così."),
    ], MARG, y - 8 * mm, W - 2 * MARG, style=st_small)
    page(10)

    # ---------------- 11 · CONCORRENZA ----------------
    kicker(c, "10 — Competition" if E else "10 — Concorrenza", H - 28 * mm)
    fit_title(c, "MISA gives the software away. We still win the vendor." if E
              else "MISA regala il software. Noi vinciamo comunque il venditore.", H - 41 * mm, size=24)
    y = table(c, [
        ["", ("Vendor language" if E else "Lingua da bancarella"), "Zalo-native",
         ("Explains &amp; files" if E else "Spiega e dichiara"), ("Agent channel" if E else "Canale agenti"),
         ("Provenance" if E else "Provenienza")],
        ["MISA / KiotViet / Sapo", "No", ("Partial" if E else "Parziale"), "No", "No", "No"],
        [("Tax agents, manual" if E else "Đại lý thuế, manuale"), ("Yes" if E else "Sì"),
         ("Partial" if E else "Parziale"), ("Yes" if E else "Sì"), "—", "No"],
        [("Spreadsheet / notebook" if E else "Excel / quaderno"), ("Yes" if E else "Sì"), "No", "No", "No", "No"],
        ["<b>Sổ Sạch</b>", ("<b>Yes</b>" if E else "<b>Sì</b>"), ("<b>Yes</b>" if E else "<b>Sì</b>"),
         ("<b>Yes</b>" if E else "<b>Sì</b>"), ("<b>Built-in</b>" if E else "<b>Integrato</b>"),
         ("<b>Yes</b>" if E else "<b>Sì</b>")],
    ], [145, 115, 85, 105, 105, 105], MARG, H - 48 * mm, fs=9.3, emphasise=4)
    bullets(c, [
        ("<b>Free is not the threat people assume.</b> MISA's free tier is free desktop accounting software for a "
         "person who does not know what a ledger is and does not own a laptop. The price was never the obstacle; "
         "the form factor was." if E
         else "<b>Il gratis non è la minaccia che si crede.</b> Il piano gratuito di MISA è software contabile "
              "desktop per chi non sa cosa sia un libro mastro e non possiede un portatile. Il prezzo non è mai "
              "stato l'ostacolo; il formato sì."),
        ("<b>The realistic threat is a Vietnamese incumbent copying the Zalo form factor.</b> Our answer is the "
         "agent network and the provenance data, neither of which is in the code — and a head start measured in "
         "regulatory approvals rather than features." if E
         else "<b>La minaccia realistica è un incumbent vietnamita che copia il formato Zalo.</b> La nostra risposta "
              "è la rete di agenti e i dati di provenienza, che non stanno nel codice — e un vantaggio misurato in "
              "autorizzazioni ottenute, non in funzionalità."),
    ], MARG, y - 9 * mm, W - 2 * MARG, style=st_small)
    page(11)

    # ---------------- 12 · COSA REGGE IL SEGMENTO ----------------
    # Ex slide "the model": stessa tabella, cornice diversa. Non è un piano che
    # chiediamo di finanziare — è l'aritmetica del percorso in autonomia, messa
    # sul tavolo perché il partner possa farsi la propria idea del segmento.
    kicker(c, "11 — What the segment supports" if E else "11 — Cosa regge il segmento", H - 28 * mm)
    fit_title(c, "The standalone arithmetic, on the table." if E
              else "L'aritmetica del percorso autonomo, sul tavolo.", H - 41 * mm)
    subtitle(c, "Illustrative economics of the standalone path — what the segment supports, not a plan being funded." if E
             else "Economics illustrative del percorso autonomo — cosa regge il segmento, non un piano da finanziare.",
             H - 49 * mm)
    y = table(c, [
        ["", "Y1 (2027)", "Y2 (2028)", "Y3 (2029)"],
        [("Paying subscribers" if E else "Abbonati paganti"), "2,000", "12,000", "40,000"],
        [("Active tax agents" if E else "Agenti attivi"), "25", "120", "400"],
        ["ARR", "$70k", "$450k", "$1.6M"],
        ["EBITDA", "−$90k", "+$60k", "+$520k"],
        [("Gross margin" if E else "Margine lordo"), "85%", "87%", "88%"],
        [("Monthly churn" if E else "Churn mensile"), "3.5%", "2.6%", "2.0%"],
    ], [200, 163, 163, 163], MARG, H - 56 * mm, fs=9.3)
    bullets(c, [
        ("<b>Every assumption, on the table:</b> blended ARPU ~$3.30/month · CAC under $4 · churn 3.5% falling to "
         "2% · 30% of revenue paid away on the agent channel · COGS $0.20–0.40 per active user." if E
         else "<b>Ogni assunzione, sul tavolo:</b> ARPU medio ~3,30 $/mese · CAC sotto i 4 $ · churn dal 3,5% al 2% · "
              "30% dei ricavi ceduto al canale agenti · COGS 0,20–0,40 $ per utente attivo."),
        ("<b>We deliberately reject this market's hockey stick.</b> The pitch we were shown — 200,000 monthly "
         "actives in eighteen months at $7 ARPU against a free incumbent — is not a plan, it is a wish. We would "
         "rather be held to 40,000 at $3.30 and hit it. With a partner's distribution the curve changes shape; "
         "that is precisely the conversation." if E
         else "<b>Rifiutiamo deliberatamente il bastone da hockey di questo mercato.</b> Il pitch che ci è stato "
              "mostrato — 200.000 attivi mensili in diciotto mesi a 7 $ di ARPU contro un incumbent gratuito — non "
              "è un piano, è un desiderio. Preferiamo essere giudicati su 40.000 a 3,30 $ e centrarli. Con la "
              "distribuzione di un partner la curva cambia forma; è esattamente quella la conversazione."),
    ], MARG, y - 9 * mm, W - 2 * MARG, style=st_small)
    page(12)

    # ---------------- 13 · RISCHI E CRITERI DI STOP ----------------
    kicker(c, "12 — Risks &amp; kill criteria".replace("&amp;", "&") if E else "12 — Rischi e criteri di stop", H - 28 * mm)
    fit_title(c, "What would make this fail, and what we've agreed to do about it." if E
              else "Cosa lo farebbe fallire, e cosa ci siamo impegnati a fare.", H - 41 * mm, size=23)
    y = table(c, [
        [("Risk" if E else "Rischio"), ("Why it is real" if E else "Perché è reale"), ("Our response" if E else "Risposta")],
        [("Agents won't sell" if E else "Gli agenti non vendono"),
         ("30% of $2.70 is small money for a professional until volume arrives" if E
          else "il 30% di 2,70 $ è poco per un professionista finché non arriva il volume"),
         ("<b>Kill criterion:</b> if agents decline at 30% rev-share, we pivot to agent-only tooling sold as a seat licence" if E
          else "<b>Criterio di stop:</b> se gli agenti rifiutano il 30%, viriamo su strumenti solo-agenti venduti a licenza")],
        [("Households won't pay" if E else "Le imprese non pagano"),
         ("69k VND/month is real money to a street vendor, and the obligation is new" if E
          else "69k VND/mese sono soldi veri per un venditore ambulante, e l'obbligo è nuovo"),
         ("<b>Kill criterion:</b> pilot week-4 retention below 25% means the wedge is wrong and we stop" if E
          else "<b>Criterio di stop:</b> retention alla settimana 4 sotto il 25% significa cuneo sbagliato, e ci fermiamo")],
        [("Platform dependency" if E else "Dipendenza dalla piattaforma"),
         ("Zalo can change API terms, pricing or data policy unilaterally" if E
          else "Zalo può cambiare unilateralmente termini API, prezzi o policy sui dati"),
         ("the web product works standalone; Zalo is the acquisition channel, not the only runtime" if E
          else "il prodotto web funziona da solo; Zalo è il canale di acquisizione, non l'unico runtime")],
        [("Regulatory reversal" if E else "Marcia indietro normativa"),
         ("thresholds have already moved once (500 triệu to 1 tỷ) and could move again" if E
          else "le soglie si sono già mosse una volta (da 500 triệu a 1 tỷ) e possono muoversi ancora"),
         ("thresholds and rates are configuration, not code; the filing duty survives any threshold change" if E
          else "soglie e aliquote sono configurazione, non codice; l'obbligo dichiarativo sopravvive a ogni cambio")],
        [("Tax correctness" if E else "Correttezza fiscale"),
         ("we compute figures a household will file; being wrong is an existential risk, not a bug" if E
          else "calcoliamo cifre che un'impresa depositerà; sbagliare è un rischio esistenziale, non un bug"),
         ("everything is marked BẢN NHÁP / DRAFT and deferred to a licensed agent; rates validated before the pilot" if E
          else "tutto è marcato BẢN NHÁP / DRAFT e rimandato a un professionista abilitato; aliquote validate prima del pilota")],
        [("Key person" if E else "Persona chiave"),
         ("one founder, in Vietnam, holding the identity that unlocks the Zalo channel" if E
          else "un solo fondatore, in Vietnam, titolare dell'identità che apre il canale Zalo"),
         ("a Vietnamese ground lead and a second admin on every account — both natural early moves of a partnership" if E
          else "un responsabile vietnamita a terra e un secondo amministratore su ogni account — mosse naturali di una partnership")],
    ], [130, 275, 285], MARG, H - 48 * mm, fs=8.3)
    page(13)

    # ---------------- 14 · ROADMAP ----------------
    kicker(c, "13 — Roadmap" if E else "13 — Roadmap", H - 28 * mm)
    fit_title(c, "The distribution risk is already retired." if E
              else "Il rischio distribuzione è già chiuso.", H - 41 * mm)
    y0 = stat_row(c, [
        ("Aug 2026" if E else "Ago 2026", "OA verified & sending" if E else "OA verificato e attivo"),
        ("US-hosted", "receipt pipeline proven" if E else "pipeline scontrini provata"),
        (".com.vn", "domain held by the company" if E else "dominio della società"),
        ("01/CNKD", "auto-drafted from the book" if E else "auto-redatto dal libro"),
    ], H - 56 * mm, big=17)
    y = table(c, [
        [("When" if E else "Quando"), "Milestone", ("Proof we will show you" if E else "Prova che vi mostreremo")],
        [("Now" if E else "Ora"), ("Product live end-to-end: Zalo bot, ledger, score, declaration, agent dashboard, billing rails" if E
                                   else "Prodotto live end-to-end: bot Zalo, libro, punteggio, dichiarazione, cruscotto agenti, incassi"),
         "sosach.com.vn"],
        ["Q4 2026", ("100-household PAID pilot, two HCMC districts, via 3–5 licensed tax agents" if E
                     else "Pilota PAGANTE da 100 imprese, due distretti HCMC, via 3–5 đại lý thuế abilitati"),
         ("week-4 retention ≥25%" if E else "retention sett. 4 ≥25%")],
        ["Q1 2027", ("Zalo Mini App (zero install) + Q4 filing campaign; first agent cohort at 50+ households each" if E
                     else "Zalo Mini App (zero installazione) + campagna deposito Q4; prima coorte di agenti a 50+ imprese ciascuno"),
         ("500 paying" if E else "500 paganti")],
        ["Mid-2027", ("2,000 subscribers · 25 active agents · e-invoice partner API live" if E
                      else "2.000 abbonati · 25 agenti attivi · API partner e-fattura attiva"),
         ("$70k ARR run-rate" if E else "run-rate ARR 70k $")],
        ["2028–29", ("southern provinces via the agent network; first credit-data conversations with lenders" if E
                     else "province del sud via rete agenti; prime conversazioni sui dati di credito con istituti"),
         "$1.6M ARR · EBITDA +$520k"],
    ], [90, 420, 180], MARG, y0 - 8 * mm, fs=9)
    page(14)

    # ---------------- 15 · SQUADRA ----------------
    kicker(c, "14 — Team" if E else "14 — Squadra", H - 28 * mm)
    fit_title(c, "One founder, in the country, with the identity that opens the channel." if E
              else "Un fondatore, nel paese, con l'identità che apre il canale.", H - 41 * mm, size=23)
    y = bullets(c, [
        ("<b>Yuri Frassi — founder.</b> Italian, resident in Hồ Chí Minh City, owner and legal representative of "
         "CÔNG TY TNHH OFFICINE GẶP, a Vietnamese company with a licence covering software sales. Background in "
         "cultural production and delivery across Italy, Saudi Arabia and Vietnam — a discipline of shipping "
         "physical projects to fixed deadlines in unfamiliar regulatory systems." if E
         else "<b>Yuri Frassi — fondatore.</b> Italiano, residente a Hồ Chí Minh, socio e legale rappresentante di "
              "CÔNG TY TNHH OFFICINE GẶP, società vietnamita con licenza per la vendita di software. Provenienza "
              "dalla produzione culturale e dalla consegna fra Italia, Arabia Saudita e Vietnam — la disciplina di "
              "consegnare progetti fisici a date fisse dentro sistemi normativi non familiari."),
        ("<b>What that background actually buys here:</b> the eleven-month Zalo verification was not an engineering "
         "problem, it was a bureaucratic one — company filings, wet seals, a domain registry that assumes a "
         "national ID. That is the work this founder has done for a decade in three countries." if E
         else "<b>Cosa compra davvero quel percorso qui:</b> gli undici mesi di verifica Zalo non sono stati un "
              "problema di ingegneria ma di burocrazia — atti societari, timbri a inchiostro, un registro di domini "
              "che presuppone una carta d'identità nazionale. È il lavoro che questo fondatore fa da dieci anni in "
              "tre paesi."),
        ("<b>Execution evidence.</b> The product you can open today — ledger, tax engine, scoring, agent dashboard, "
         "Zalo integration, billing — was built and put into production solo, with AI leverage, alongside the "
         "regulatory work. Whatever you conclude about the market, the shipping speed is not in question." if E
         else "<b>Prova di esecuzione.</b> Il prodotto che potete aprire oggi — libro, motore fiscale, punteggio, "
              "cruscotto agenti, integrazione Zalo, incassi — è stato costruito e messo in produzione da solo, con "
              "leva AI, in parallelo al lavoro normativo. Qualunque cosa concludiate sul mercato, la velocità di "
              "consegna non è in discussione."),
    ], MARG, H - 50 * mm, W - 2 * MARG, style=st_small)
    # Prima era "il vuoto che vi chiediamo di finanziare". Nessuno finanzia
    # niente: il vuoto resta, e lo chiude una partnership, non un round.
    label_block(c, MARG, y - 6 * mm, W - 2 * MARG,
                ("THE GAP, NAMED" if E else "IL VUOTO, DETTO CHIARO"),
                ("There is no Vietnamese co-founder and no ground team yet. For a product sold in Vietnamese to "
                 "Vietnamese micro-businesses through Vietnamese professionals, that is the single largest "
                 "structural weakness in this company — and the first thing a partnership closes, with a country "
                 "lead inside the partner's own organisation." if E else
                 "Non c'è ancora un co-fondatore vietnamita né una squadra a terra. Per un prodotto venduto in "
                 "vietnamita a micro-imprese vietnamite tramite professionisti vietnamiti, è la maggiore debolezza "
                 "strutturale di questa azienda — ed è la prima cosa che una partnership chiude, con un "
                 "responsabile paese dentro l'organizzazione del partner."))
    page(15)

    # ---------------- 16 · LA FORMA DI UNA PARTNERSHIP ----------------
    kicker(c, "15 — The shape of a partnership" if E else "15 — La forma di una partnership", H - 28 * mm)
    fit_title(c, "What each side puts on the table." if E
              else "Cosa mette sul tavolo ciascuna parte.", H - 41 * mm)
    cw2 = (W - 2 * MARG - 30) / 2
    ytop = H - 52 * mm
    yl = label_block(c, MARG, ytop, cw2,
                     ("WHAT WE BRING" if E else "COSA PORTIAMO NOI"),
                     ("A working instrument against a statutory deadline. A verified Zalo channel that took eleven "
                      "months of bureaucracy nobody can compress. The correctness discipline, the provenance model, "
                      "the scoring engine — and a founder in the country who has already made the early mistakes at "
                      "his own expense." if E else
                      "Uno strumento funzionante contro una scadenza di legge. Un canale Zalo verificato costato "
                      "undici mesi di burocrazia che nessuno può comprimere. La disciplina di correttezza, il modello "
                      "di provenienza, il motore di punteggio — e un fondatore nel paese che gli errori iniziali li "
                      "ha già fatti a proprie spese."))
    yr = label_block(c, MARG + cw2 + 30, ytop, cw2,
                     ("WHAT A PARTNER BRINGS" if E else "COSA PORTA UN PARTNER"),
                     ("Distribution at a scale we cannot buy: an existing base, a field force, branches and licences, "
                      "a Vietnamese ground team, and the balance sheet to treat a five-million-business segment as a "
                      "programme rather than a pilot. People these households already deal with." if E else
                      "Distribuzione a una scala che non possiamo comprare: una base esistente, una rete sul "
                      "territorio, filiali e licenze, una squadra vietnamita a terra, e il bilancio per trattare un "
                      "segmento da cinque milioni di imprese come un programma, non come un pilota. Persone con cui "
                      "queste imprese già hanno a che fare."))
    yn = min(yl, yr) - 9 * mm
    rule(c, yn, color=INK, w=1.1)
    tracked(c, ("THE FIRST NINETY DAYS" if E else "I PRIMI NOVANTA GIORNI"), MARG, yn - 12, "AV-Db", 8.2, 1.9, GREY_L)
    bullets(c, [
        ("<b>Every rate validated by a licensed tax agent</b> before any household relies on a figure the engine produced." if E
         else "<b>Ogni aliquota validata da un đại lý thuế abilitato</b> prima che un'impresa si affidi a una cifra prodotta dal motore."),
        ("<b>A 100-household paid pilot through the partner's existing channel</b> — their base, their branches, not our flyers." if E
         else "<b>Un pilota pagante da 100 imprese sul canale esistente del partner</b> — la sua base, le sue filiali, non i nostri volantini."),
        ("<b>A Vietnamese country lead inside the partner's organisation</b>, running the ground work from day one." if E
         else "<b>Un responsabile paese vietnamita dentro l'organizzazione del partner</b>, alla guida del lavoro a terra dal primo giorno."),
        ("<b>Day 90 is a decision point with real retention data on the table</b> — continue, restructure, or stop." if E
         else "<b>Il giorno 90 è un punto di decisione con dati di retention veri sul tavolo</b> — proseguire, ristrutturare, o fermarsi."),
    ], MARG, yn - 10 * mm, W - 2 * MARG, gap=6, style=st_smallk)
    page(16)

    # ---------------- 17 · CHIUSURA (scura) ----------------
    # Niente ask, niente cifra, niente exit slide: la chiusura dice quello che
    # è vero — non stiamo raccogliendo, vogliamo una conversazione operativa, e
    # la struttura si discute solo dopo che il disegno del pilota è concordato.
    dark_page(c)
    tracked(c, ("16 — WHERE THIS LEAVES US" if E else "16 — DOVE CI LASCIA TUTTO QUESTO"),
            MARG, H - 32 * mm, "AV-Db", 8.4, 2.0, "#8a8a8a")
    tracked(c, "We are not raising money." if E else "Non stiamo raccogliendo denaro.",
            MARG, H - 52 * mm, "AV-Bd", 38, -1.3, WHITE)
    sub17 = ("You now have the full operating picture. What we want next is a working conversation, not a term sheet." if E
             else "Ora avete il quadro operativo completo. Quello che vogliamo è una conversazione di lavoro, non un term sheet.")
    # la riga italiana è più lunga: si restringe finché sta nei margini
    fs17 = 14.0
    while pdfmetrics.stringWidth(sub17, "AV", fs17) > W - 2 * MARG:
        fs17 -= 0.25
    c.setFillColor(HexColor("#a8a8a8")); c.setFont("AV", fs17)
    c.drawString(MARG, H - 65 * mm, sub17)
    cw3 = (W - 2 * MARG - 30) / 2
    dark_block(c, MARG, H - 84 * mm, cw3,
               ("What we are asking for" if E else "Cosa chiediamo"),
               (["An operating conversation: your reading of the",
                 "pilot design, of the agent channel, and of what",
                 "your organisation could carry in the first",
                 "ninety days."]
                if E else
                ["Una conversazione operativa: la vostra lettura",
                 "del disegno del pilota, del canale agenti, e di",
                 "cosa la vostra organizzazione possa portare nei",
                 "primi novanta giorni."]))
    dark_block(c, MARG + cw3 + 30, H - 84 * mm, cw3,
               ("What comes next" if E else "Cosa viene dopo"),
               (["Structure is discussed only after the pilot",
                 "design is agreed. First the ninety days and the",
                 "retention data — then, and only then, the form",
                 "the partnership should take."]
                if E else
                ["La struttura si discute solo dopo aver concordato",
                 "il disegno del pilota. Prima i novanta giorni e i",
                 "dati di retention — poi, e solo poi, la forma che",
                 "la partnership deve prendere."]))
    c.setStrokeColor(HexColor("#3a3a3a")); c.setLineWidth(0.8); c.line(MARG, 46 * mm, W - MARG, 46 * mm)
    c.setFillColor(WHITE); c.setFont("AV-Db", 12.5)
    c.drawString(MARG, 37 * mm, "Yuri Frassi")
    c.setFillColor(HexColor("#a8a8a8")); c.setFont("AV", 10)
    c.drawString(MARG, 30 * mm, "yuri@officinegap.com · sosach.com.vn")
    c.drawString(MARG, 23 * mm, "CÔNG TY TNHH OFFICINE GẶP · 384 Hoàng Diệu, Phường Khánh Hội, Hồ Chí Minh City")
    page(17, dark=True)
    c.save()
    print("wrote", out)


if __name__ == "__main__":
    build("en", "SoSach_Deck_PostNDA_EN.pdf")
    build("it", "SoSach_Deck_PostNDA_IT.pdf")
