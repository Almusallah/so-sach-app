# ============================================================================
#  Sổ Sạch — DECK COMPLETO POST-NDA (16 slide, EN + IT).
#
#  Questo è il documento che si manda DOPO la firma. Contiene tutto ciò che il
#  teaser tiene fuori: economics unitarie, il modello del punteggio, la
#  meccanica del canale Zalo, i numeri scomodi, i criteri di stop.
#  Ogni pagina porta la fascia CONFIDENTIAL: stampata, non deve essere
#  possibile confonderla con il teaser.
#  Rigenera: python3 make_deck_postnda.py
# ============================================================================
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from deck_kit import (W, H, MARG, PAGE, GIADA, GIADA_MID, GOLD, GOLD_LT, CARTA_DK, ROSSO,
                      INK, MUTED, WHITE, MINT, BORDER, st_body, st_small, st_cell,
                      footer, kicker, title, subtitle, bullets, table, stat_cards,
                      dark_page, dark_card, stamp, chat_mock)

TOTAL = 16


def build(lang, out):
    E = lang == "en"
    c = canvas.Canvas(out, pagesize=PAGE)
    c.setTitle("Sổ Sạch — Confidential Investor Deck" if E else "Sổ Sạch — Deck Investitori Riservato")
    foot = ("Sổ Sạch — CONFIDENTIAL · disclosed under NDA · August 2026" if E
            else "Sổ Sạch — RISERVATO · comunicato in forza di NDA · Agosto 2026")
    band = ("confidential — disclosed under NDA — do not circulate" if E
            else "riservato — comunicato in forza di nda — non diffondere")

    def page(n, dark=False):
        stamp(c, band)
        footer(c, n, TOTAL, foot, dark=dark)
        c.showPage()

    # ---------------- 1 · COVER ----------------
    dark_page(c)
    c.setFillColor(ROSSO); c.rect(0, H - 7 * mm, W, 7 * mm, stroke=0, fill=1)
    c.setFillColor(WHITE); c.setFont("SS-Sans-Bold", 8)
    c.drawCentredString(W / 2, H - 5 * mm, band.upper())
    c.setFillColor(GOLD_LT); c.setFont("SS-Sans-Bold", 12)
    c.drawString(MARG, H - 36 * mm, "CONFIDENTIAL INVESTOR DECK · AUGUST 2026" if E
                 else "DECK INVESTITORI RISERVATO · AGOSTO 2026")
    c.setFillColor(WHITE); c.setFont("SS-Serif-Bold", 60)
    c.drawString(MARG, H - 60 * mm, "Sổ Sạch")
    c.setFillColor(MINT); c.setFont("SS-Sans", 16)
    c.drawString(MARG, H - 74 * mm, "The AI bookkeeper on Zalo for Vietnam's 5.2 million household businesses."
                 if E else "Il commercialista AI su Zalo per i 5,2 milioni di hộ kinh doanh del Vietnam.")
    c.setFillColor(GOLD_LT); c.setFont("SS-Sans", 11.5)
    c.drawString(MARG, H - 90 * mm,
                 "Everything the teaser withheld: unit economics, the channel, the moat, the risks and the numbers we don't like."
                 if E else
                 "Tutto ciò che il teaser tratteneva: economics unitarie, canale, fossato, rischi e i numeri che non ci piacciono.")
    c.setFillColor(MINT); c.setFont("SS-Sans", 10)
    c.drawString(MARG, 30 * mm, "Yuri Frassi · yuri@officinegap.com · sosach.com.vn")
    c.drawString(MARG, 23 * mm, "CÔNG TY TNHH OFFICINE GẶP · enterprise code 0316904153 · Hồ Chí Minh City")
    page(1, dark=True)

    # ---------------- 2 · THE SHOCK ----------------
    kicker(c, "01 · The shock" if E else "01 · Lo shock", H - 28 * mm)
    title(c, "The customer acquisition was done by the state." if E
          else "L'acquisizione clienti l'ha fatta lo Stato.", H - 41 * mm)
    y = table(c, [
        [("Instrument" if E else "Norma"), ("Effect" if E else "Effetto"), ("Who it hits" if E else "Chi colpisce")],
        [("Abolition of thuế khoán, 01/01/2026" if E else "Abolizione del thuế khoán, 01/01/2026"),
         ("lump-sum assessment replaced by self-declaration on real books" if E
          else "accertamento forfettario sostituito da autodichiarazione su libri veri"),
         "5.2M hộ kinh doanh"],
        [("Decree 70/2025" if E else "Decreto 70/2025"),
         ("e-invoicing from a connected cash register above 1 billion VND annual revenue" if E
          else "e-fattura da registratore connesso sopra 1 miliardo VND di ricavi annui"),
         ("the upper tier — and the ones who cross it unknowingly" if E
          else "la fascia alta — e chi la supera senza saperlo")],
        [("Decree 141/2026" if E else "Decreto 141/2026"),
         ("taxable threshold raised 500M → 1 billion VND" if E
          else "soglia imponibile alzata da 500M a 1 miliardo VND"),
         ("most of the market is exempt — but must still file" if E
          else "gran parte del mercato è esente — ma deve comunque dichiarare")],
        [("Circular 40/2021" if E else "Circolare 40/2021"),
         ("presumptive rates on revenue: 1%+0.5% / 3%+1.5% / 5%+2% by activity" if E
          else "aliquote presuntive sui ricavi: 1%+0,5% / 3%+1,5% / 5%+2% per attività"),
         ("everyone above the threshold" if E else "chiunque sopra soglia")],
    ], [167, 325, 225], MARG, H - 51 * mm, fs=9.5)
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
    ], MARG, y - 8 * mm, W - 2 * MARG)
    page(2)

    # ---------------- 3 · THE LOOP ----------------
    kicker(c, "02 · The product loop" if E else "02 · Il ciclo di prodotto", H - 28 * mm)
    title(c, "Photograph. Confirm. Filed." if E else "Fotografa. Conferma. Dichiarato.", H - 41 * mm)
    chat_mock(c, MARG, H - 50 * mm, (W - 2 * MARG) * 0.47, 56 * mm, lang)
    px = MARG + (W - 2 * MARG) * 0.47 + 20
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

    # ---------------- 4 · CORRECTNESS ----------------
    kicker(c, "03 · Why this is a correctness product" if E else "03 · Perché è un prodotto di correttezza", H - 28 * mm)
    title(c, "The first real receipt found four ways to be confidently wrong." if E
          else "Il primo scontrino vero: quattro modi di sbagliare con sicurezza.", H - 41 * mm, size=23)
    subtitle(c, "We are showing you our bug list. Most decks don't. This is the discipline the category demands." if E
             else "Vi mostriamo la nostra lista di bug. Pochi deck lo fanno. È la disciplina che questa categoria esige.",
             H - 50 * mm)
    y = table(c, [
        [("Failure" if E else "Guasto"), ("What it would have done to a household" if E else "Cosa avrebbe fatto a un'impresa"), ("State" if E else "Stato")],
        [("Date read as MM/DD" if E else "Data letta come MM/DD"),
         ("a receipt printed 10/08 booked as 8 October — entries in the wrong quarter, wrong declaration" if E
          else "uno scontrino del 10/08 registrato all'8 ottobre — voci nel trimestre sbagliato, dichiarazione sbagliata"),
         ("Fixed" if E else "Risolto")],
        [("\"30.000\" parsed as 30" if E else "\"30.000\" letto come 30"),
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
         ("a business turning over 1.44 billion VND was told it was exempt, because seven blank months read as no trading" if E
          else "un'impresa da 1,44 miliardi VND risultava esente, perché sette mesi in bianco venivano letti come nessuna vendita"),
         ("Fixed" if E else "Risolto")],
    ], [172, 449, 96], MARG, H - 56 * mm, fs=9.5)
    c.setFillColor(GIADA); c.setFont("SS-Sans-Bold", 11)
    c.drawString(MARG, y - 10 * mm,
                 "None of these ever reached a household." if E
                 else "Nessuno di questi ha mai raggiunto un'impresa.")
    c.setFont("SS-Sans", 10.5); c.setFillColor(MUTED)
    c.drawString(MARG, y - 16 * mm,
                 "All five were found by tests written before the pilot — 72 of them, run across four timezones on every change." if E
                 else "Tutti e cinque trovati da test scritti prima del pilota — 72, eseguiti su quattro fusi orari a ogni modifica.")
    page(4)

    # ---------------- 5 · MARKET ----------------
    kicker(c, "04 · Market" if E else "04 · Mercato", H - 28 * mm)
    title(c, "Two customer shapes, one engine." if E else "Due forme di cliente, un solo motore.", H - 41 * mm)
    y = table(c, [
        ["", ("Size" if E else "Dimensione"), ("Definition &amp; source" if E else "Definizione e fonte")],
        ["TAM", "5.2M", ("household businesses required to keep books from 2026 (GSO)" if E
                         else "imprese familiari obbligate ai libri dal 2026 (GSO)")],
        ["SAM", "~1.8M", ("smartphone-active, revenue 200M–3B VND — duty is real, capability is not" if E
                          else "smartphone-attive, ricavi 200M–3B VND — l'obbligo è reale, la capacità no")],
        [("SOM (Y3)" if E else "SOM (A3)"), "40,000", ("~2.2% of SAM, district by district from HCMC outward" if E
                                                       else "~2,2% del SAM, distretto per distretto da HCMC")],
    ], [95, 105, 480], MARG, H - 48 * mm, fs=9.5)
    cw = (W - 2 * MARG - 16) / 2
    c.setFillColor(CARTA_DK); c.roundRect(MARG, y - 46 * mm, cw, 40 * mm, 10, stroke=0, fill=1)
    c.setFillColor(GIADA); c.setFont("SS-Sans-Bold", 12)
    c.drawString(MARG + 14, y - 15 * mm, "SEGMENT A — ONLINE SELLERS" if E else "SEGMENTO A — VENDITORI ONLINE")
    p = Paragraph(("Shopee, TikTok Shop, Lazada. Tax is withheld at source by the platform, so their problem is "
                   "reconciliation and reclaiming what was over-withheld. Digitally fluent, reachable online, "
                   "lower support cost, faster to convert." if E else
                   "Shopee, TikTok Shop, Lazada. La ritenuta la opera la piattaforma alla fonte: il loro problema è "
                   "riconciliare e recuperare il trattenuto in eccesso. Digitalmente competenti, raggiungibili "
                   "online, costo di assistenza minore, conversione più rapida."), st_small)
    _, ph = p.wrap(cw - 28, 200); p.drawOn(c, MARG + 14, y - 20 * mm - ph)
    c.setFillColor(CARTA_DK); c.roundRect(MARG + cw + 16, y - 46 * mm, cw, 40 * mm, 10, stroke=0, fill=1)
    c.setFillColor(GIADA); c.setFont("SS-Sans-Bold", 12)
    c.drawString(MARG + cw + 30, y - 15 * mm, "SEGMENT B — STREET RETAIL" if E else "SEGMENTO B — RETAIL DI STRADA")
    p = Paragraph(("Eateries, kiosks, market stalls, repair shops. Cash, no cash register, no accountant, often no "
                   "email. They need the book itself and a warning in human language before the threshold bites. "
                   "Unreachable by advertising — reachable through their tax agent." if E else
                   "Trattorie, chioschi, bancarelle, officine. Contanti, nessun registratore, nessun contabile, "
                   "spesso nessuna email. Serve il libro in sé e un avviso in linguaggio umano prima che la soglia "
                   "morda. Irraggiungibili con la pubblicità — raggiungibili tramite il loro đại lý thuế."), st_small)
    _, ph = p.wrap(cw - 28, 200); p.drawOn(c, MARG + cw + 30, y - 20 * mm - ph)
    page(5)

    # ---------------- 6 · BUSINESS MODEL ----------------
    kicker(c, "05 · Business model" if E else "05 · Modello di business", H - 28 * mm)
    title(c, "Priced for a street vendor. Sold by the person they already trust." if E
          else "Prezzo da bancarella. Venduto da chi ha già la loro fiducia.", H - 41 * mm, size=24)
    y = table(c, [
        [("Line" if E else "Linea"), ("Price" if E else "Prezzo"), ("Y3 share" if E else "Quota A3"), ("What it buys" if E else "Cosa compra")],
        ["Core", "69k VND/mo (~$2.70)", "62%", ("photo ledger, thresholds, declaration draft, Zalo bot" if E
                                                else "libro fotografico, soglie, bozza dichiarazione, bot Zalo")],
        ["Pro", "149k VND/mo (~$5.90)", "23%", ("multi-location, exports, e-invoice via partner API, priority support" if E
                                                else "multi-sede, export, e-fattura via API partner, assistenza prioritaria")],
        [("Tax-agent channel" if E else "Canale đại lý thuế"), ("30% rev-share" if E else "30% rev-share"), "15%",
         ("dashboard for an agent running 20–200 households — the trust channel becomes the sales channel" if E
          else "cruscotto per un agente con 20–200 imprese — il canale di fiducia diventa canale di vendita")],
    ], [130, 140, 75, 335], MARG, H - 48 * mm, fs=9.5)
    stat_cards(c, [
        ("$0.20–0.40", "COGS / user / month" if E else "COGS / utente / mese"),
        (">85%", "gross margin at scale" if E else "margine lordo a scala"),
        ("<$4", "blended CAC" if E else "CAC medio"),
        ("~$3.30", "blended ARPU / month" if E else "ARPU medio / mese"),
        ("~2.5 mo", "CAC payback" if E else "payback CAC"),
    ], MARG, y - 12 * mm, (W - 2 * MARG - 4 * 12) / 5, 24 * mm, gap=12, big_size=17)
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
    ], MARG, y - 42 * mm, W - 2 * MARG, style=st_small)
    page(6)

    # ---------------- 7 · THE ZALO MOAT ----------------
    kicker(c, "06 · The moat nobody can shortcut" if E else "06 · Il fossato che non si scavalca", H - 28 * mm)
    title(c, "A verified Zalo Official Account is a licence, not a signup." if E
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
    ], [150, 567], MARG, H - 48 * mm, fs=9.5)
    c.setFillColor(GIADA); c.setFont("SS-Sans-Bold", 11.5)
    c.drawString(MARG, y - 10 * mm,
                 "Eleven months. Four rejections. One Vietnamese company, one wet seal." if E
                 else "Undici mesi. Quattro respinte. Una società vietnamita, un timbro a inchiostro.")
    c.setFont("SS-Sans", 10.5); c.setFillColor(MUTED)
    c.drawString(MARG, y - 16 * mm,
                 "A competitor with more money does not get to skip any of it." if E
                 else "Un concorrente con più soldi non può saltarne nemmeno un passaggio.")
    page(7)

    # ---------------- 8 · DISTRIBUTION ----------------
    kicker(c, "07 · Distribution" if E else "07 · Distribuzione", H - 28 * mm)
    title(c, "We don't chase households. We recruit whoever already has them." if E
          else "Non inseguiamo le imprese. Reclutiamo chi già le ha.", H - 41 * mm, size=23)
    y = table(c, [
        [("Channel" if E else "Canale"), ("Mechanic" if E else "Meccanica"), ("CAC"), ("Honest limitation" if E else "Limite onesto")],
        [("Đại lý thuế" if E else "Đại lý thuế"),
         ("licensed tax agents each serve 20–200 households; they get a dashboard, we give 30% of revenue" if E
          else "i đại lý thuế abilitati servono 20–200 imprese ciascuno; ricevono un cruscotto, diamo il 30% dei ricavi"),
         "<$2",
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
    ], [130, 320, 55, 175], MARG, H - 48 * mm, fs=9)
    c.setFillColor(HexColor("#f6ece6")); c.roundRect(MARG, y - 34 * mm, W - 2 * MARG, 27 * mm, 10, stroke=0, fill=1)
    c.setFillColor(ROSSO); c.setFont("SS-Sans-Bold", 10.5)
    c.drawString(MARG + 16, y - 16 * mm, "THE NUMBER WE DON'T LIKE" if E else "IL NUMERO CHE NON CI PIACE")
    p = Paragraph(("At 30% rev-share on a 69k VND subscription, a tax agent running 12 households earns about "
                   "248,000 VND a month — roughly ten US dollars. That is not yet a reason for a professional to "
                   "change how they work. The channel only becomes rational for the agent at around 100 households "
                   "(~2.07M VND/month), which is why the pilot is sized at 100 and why agent recruitment, not "
                   "household acquisition, is the metric that actually decides this business." if E else
                   "Con il 30% su un abbonamento da 69k VND, un đại lý thuế con 12 imprese guadagna circa 248.000 VND "
                   "al mese — sui dieci dollari. Non è ancora un motivo per cui un professionista cambi metodo di "
                   "lavoro. Il canale diventa razionale per l'agente attorno alle 100 imprese (~2,07M VND/mese): "
                   "per questo il pilota è dimensionato a 100 e per questo la metrica che decide davvero questo "
                   "business è il reclutamento degli agenti, non l'acquisizione delle imprese."), st_small)
    _, ph = p.wrap(W - 2 * MARG - 32, 200); p.drawOn(c, MARG + 16, y - 20 * mm - ph)
    page(8)

    # ---------------- 9 · THE DATA ASSET ----------------
    kicker(c, "08 · The asset underneath" if E else "08 · L'asset sottostante", H - 28 * mm)
    title(c, "We record how much to trust every figure." if E
          else "Registriamo quanto fidarsi di ogni cifra.", H - 41 * mm)
    subtitle(c, "This is the difference between a subscription list and something a lender can underwrite." if E
             else "È la differenza fra una lista di abbonati e qualcosa che un prestatore può istruire.", H - 50 * mm)
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
    ], [150, 427, 140], MARG, H - 56 * mm, fs=9.5)
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
        ("<b>The exit thesis.</b> At 40,000 households the portfolio is a structured, provenance-weighted record of "
         "how Vietnamese micro-business actually trades — the input a bank or credit fund currently cannot buy at "
         "any price, because nobody is collecting it this way." if E
         else "<b>La tesi di exit.</b> A 40.000 imprese il portafoglio è un registro strutturato e pesato per "
              "provenienza di come commercia davvero la micro-impresa vietnamita — l'input che oggi una banca o un "
              "fondo di credito non può comprare a nessun prezzo, perché nessuno lo raccoglie così."),
    ], MARG, y - 9 * mm, W - 2 * MARG, style=st_small)
    page(9)

    # ---------------- 10 · COMPETITION ----------------
    kicker(c, "09 · Competition" if E else "09 · Concorrenza", H - 28 * mm)
    title(c, "MISA gives the software away. We still win the vendor." if E
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
    ], [150, 120, 90, 105, 105, 110], MARG, H - 48 * mm, fs=9.5)
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
    ], MARG, y - 10 * mm, W - 2 * MARG, style=st_small)
    page(10)

    # ---------------- 11 · NUMBERS ----------------
    kicker(c, "10 · The model" if E else "10 · Il modello", H - 28 * mm)
    title(c, "Channel-built, not hoped." if E else "Costruito sul canale, non sperato.", H - 41 * mm)
    y = table(c, [
        ["", "Y1 (2027)", "Y2 (2028)", "Y3 (2029)"],
        [("Paying subscribers" if E else "Abbonati paganti"), "2,000", "12,000", "40,000"],
        [("Active tax agents" if E else "Agenti attivi"), "25", "120", "400"],
        ["ARR", "$70k", "$450k", "$1.6M"],
        ["EBITDA", "−$90k", "+$60k", "+$520k"],
        [("Gross margin" if E else "Margine lordo"), "85%", "87%", "88%"],
        [("Monthly churn" if E else "Churn mensile"), "3.5%", "2.6%", "2.0%"],
    ], [200, 140, 140, 140], MARG, H - 48 * mm, fs=9.5)
    bullets(c, [
        ("<b>Every assumption, on the table:</b> blended ARPU ~$3.30/month · CAC under $4 · churn 3.5% falling to "
         "2% · 30% of revenue paid away on the agent channel · COGS $0.20–0.40 per active user." if E
         else "<b>Ogni assunzione, sul tavolo:</b> ARPU medio ~3,30 $/mese · CAC sotto i 4 $ · churn dal 3,5% al 2% · "
              "30% dei ricavi ceduto al canale agenti · COGS 0,20–0,40 $ per utente attivo."),
        ("<b>We deliberately reject this market's hockey stick.</b> The pitch we were shown — 200,000 monthly "
         "actives in eighteen months at $7 ARPU against a free incumbent — is not a plan, it is a wish. We would "
         "rather be held to 40,000 at $3.30 and hit it." if E
         else "<b>Rifiutiamo deliberatamente il bastone da hockey di questo mercato.</b> Il pitch che ci è stato "
              "mostrato — 200.000 attivi mensili in diciotto mesi a 7 $ di ARPU contro un incumbent gratuito — non "
              "è un piano, è un desiderio. Preferiamo essere giudicati su 40.000 a 3,30 $ e centrarli."),
    ], MARG, y - 10 * mm, W - 2 * MARG, style=st_small)
    page(11)

    # ---------------- 12 · RISKS ----------------
    kicker(c, "11 · Risks &amp; kill criteria" if E else "11 · Rischi e criteri di stop", H - 28 * mm)
    title(c, "What would make this fail, and what we've agreed to do about it." if E
          else "Cosa lo farebbe fallire, e cosa ci siamo impegnati a fare.", H - 41 * mm, size=24)
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
         ("thresholds have already moved once (500M → 1B) and could move again" if E
          else "le soglie si sono già mosse una volta (500M → 1B) e possono muoversi ancora"),
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
         ("first hires are a Vietnamese ground lead and a second admin on every account" if E
          else "le prime assunzioni sono un responsabile vietnamita a terra e un secondo amministratore su ogni account")],
    ], [140, 289, 288], MARG, H - 48 * mm, fs=8.5)
    page(12)

    # ---------------- 13 · ROADMAP ----------------
    kicker(c, "12 · Roadmap" if E else "12 · Roadmap", H - 28 * mm)
    title(c, "The distribution risk is already retired." if E
          else "Il rischio distribuzione è già chiuso.", H - 41 * mm)
    stat_cards(c, [
        ("Aug 2026" if E else "Ago 2026", "OA verified &amp; sending" if E else "OA verificato e attivo"),
        ("US-hosted", "receipt pipeline proven" if E else "pipeline scontrini provata"),
        (".com.vn", "domain held by the company" if E else "dominio della società"),
        ("01/CNKD", "auto-drafted from the book" if E else "auto-redatto dal libro"),
    ], MARG, H - 48 * mm, (W - 2 * MARG - 3 * 14) / 4, 22 * mm, big_size=16)
    y = table(c, [
        [("When" if E else "Quando"), ("Milestone"), ("Proof we will show you" if E else "Prova che vi mostreremo")],
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
    ], [95, 432, 190], MARG, H - 74 * mm, fs=9.5)
    page(13)

    # ---------------- 14 · TEAM ----------------
    kicker(c, "13 · Team" if E else "13 · Squadra", H - 28 * mm)
    title(c, "One founder, in the country, with the identity that opens the channel." if E
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
    ], MARG, H - 50 * mm, W - 2 * MARG)
    c.setFillColor(HexColor("#f6ece6")); c.roundRect(MARG, y - 30 * mm, W - 2 * MARG, 24 * mm, 10, stroke=0, fill=1)
    c.setFillColor(ROSSO); c.setFont("SS-Sans-Bold", 10.5)
    c.drawString(MARG + 16, y - 12 * mm, "THE GAP WE ARE ASKING YOU TO FUND" if E else "IL VUOTO CHE VI CHIEDIAMO DI FINANZIARE")
    p = Paragraph(("There is no Vietnamese co-founder and no ground team yet. For a product sold in Vietnamese to "
                   "Vietnamese micro-businesses through Vietnamese professionals, that is the single largest "
                   "structural weakness in this company, and the first hire this round makes." if E else
                   "Non c'è ancora un co-fondatore vietnamita né una squadra a terra. Per un prodotto venduto in "
                   "vietnamita a micro-imprese vietnamite tramite professionisti vietnamiti, è la maggiore "
                   "debolezza strutturale di questa azienda, ed è la prima assunzione che questo round finanzia."),
                  st_small)
    _, ph = p.wrap(W - 2 * MARG - 32, 200); p.drawOn(c, MARG + 16, y - 16 * mm - ph)
    page(14)

    # ---------------- 15 · USE OF FUNDS ----------------
    kicker(c, "14 · Use of funds" if E else "14 · Impiego dei fondi", H - 28 * mm)
    title(c, "$300,000 buys eighteen months and one decisive experiment." if E
          else "300.000 $ comprano diciotto mesi e un esperimento decisivo.", H - 41 * mm, size=24)
    y = table(c, [
        [("Allocation" if E else "Voce"), ("Amount" if E else "Importo"), ("What it is actually for" if E else "A cosa serve davvero")],
        [("Vietnamese ground team" if E else "Squadra vietnamita a terra"), "$120k",
         ("a country lead plus two support/agent-relations staff — the gap named on the previous slide" if E
          else "un responsabile paese più due addetti supporto/relazioni agenti — il vuoto della slide precedente")],
        [("Paid pilot &amp; agent recruitment" if E else "Pilota pagante e reclutamento agenti"), "$70k",
         ("100 households, 3–5 agents, two districts, subsidised first quarter, field research" if E
          else "100 imprese, 3–5 agenti, due distretti, primo trimestre agevolato, ricerca sul campo")],
        [("Product &amp; correctness" if E else "Prodotto e correttezza"), "$60k",
         ("tax-agent validation of every rate, e-invoice partner integration, Mini App, inference costs" if E
          else "validazione professionale di ogni aliquota, integrazione partner e-fattura, Mini App, costi di inferenza")],
        [("Legal, IP &amp; compliance" if E else "Legale, IP e compliance"), "$30k",
         ("trademark registration, tax-advisory review, data-protection posture, corporate housekeeping" if E
          else "registrazione marchio, revisione fiscale professionale, assetto privacy, adempimenti societari")],
        [("Reserve" if E else "Riserva"), "$20k",
         ("the Zalo platform changing its terms is a when, not an if" if E
          else "che Zalo cambi i propri termini è un quando, non un se")],
    ], [200, 90, 427], MARG, H - 48 * mm, fs=9.5)
    c.setFillColor(GIADA); c.setFont("SS-Sans-Bold", 11)
    c.drawString(MARG, y - 11 * mm,
                 "SAFE or priced seed — terms open. The milestones on the roadmap slide are offered as the covenant." if E
                 else "SAFE o seed priced — termini aperti. Le milestone della roadmap sono offerte come patto.")
    page(15)

    # ---------------- 16 · ASK ----------------
    dark_page(c)
    c.setFillColor(ROSSO); c.rect(0, H - 7 * mm, W, 7 * mm, stroke=0, fill=1)
    c.setFillColor(WHITE); c.setFont("SS-Sans-Bold", 8)
    c.drawCentredString(W / 2, H - 5 * mm, band.upper())
    c.setFillColor(GOLD_LT); c.setFont("SS-Sans-Bold", 11)
    c.drawString(MARG, H - 30 * mm, "15 · THE ASK &amp; THE EXIT".replace("&amp;", "&") if E else "15 · RICHIESTA ED EXIT")
    c.setFillColor(WHITE); c.setFont("SS-Serif-Bold", 44)
    c.drawString(MARG, H - 48 * mm, "$300k · 18 " + ("months" if E else "mesi"))
    cw2 = (W - 2 * MARG - 16) / 2
    dark_card(c, MARG, H - 58 * mm, cw2, 46 * mm,
              "WHAT YOU ARE BUYING" if E else "COSA STATE COMPRANDO",
              (["A verified channel to 5.2M businesses that a",
                "competitor cannot obtain quickly at any price.",
                "A working product against a statutory deadline.",
                "A founder already in the country, already through",
                "the bureaucracy, already shipping."]
               if E else
               ["Un canale verificato verso 5,2M di imprese che un",
                "concorrente non ottiene in fretta a nessun prezzo.",
                "Un prodotto funzionante contro una scadenza di legge.",
                "Un fondatore già nel paese, già oltre la burocrazia,",
                "già in produzione."]))
    dark_card(c, MARG + cw2 + 16, H - 58 * mm, cw2, 46 * mm,
              "HOW THIS RETURNS" if E else "COME RIENTRA",
              (["Strategic acquisition by a Vietnamese fintech or",
                "banking group buying the household channel.",
                "Credit-data licensing to lenders who cannot",
                "otherwise see this segment at all.",
                "Regional replication: the same tax shock is",
                "scheduled across South-East Asia."]
               if E else
               ["Acquisizione strategica da parte di un gruppo",
                "fintech o bancario vietnamita che compra il canale.",
                "Licenza dei dati di credito a istituti che altrimenti",
                "questo segmento non lo vedono affatto.",
                "Replica regionale: lo stesso shock fiscale è",
                "previsto in tutto il Sud-Est asiatico."]))
    c.setFillColor(GOLD_LT); c.setFont("SS-Sans-Bold", 13)
    c.drawString(MARG, 52 * mm, "Yuri Frassi — founder" if E else "Yuri Frassi — fondatore")
    c.setFillColor(MINT); c.setFont("SS-Sans", 11)
    c.drawString(MARG, 44 * mm, "yuri@officinegap.com · sosach.com.vn")
    c.drawString(MARG, 37 * mm, "CÔNG TY TNHH OFFICINE GẶP · 384 Hoàng Diệu, Phường Khánh Hội, Hồ Chí Minh City")
    c.setFillColor(GOLD); c.setFont("SS-Sans-It", 9.5)
    c.drawString(MARG, 25 * mm,
                 "Figures marked as projections are projections. Everything described as live can be opened and "
                 "checked while you read this." if E
                 else "Le cifre indicate come proiezioni sono proiezioni. Tutto ciò che è descritto come attivo può "
                      "essere aperto e verificato mentre leggete.")
    footer(c, 16, TOTAL, foot, dark=True); c.showPage()
    c.save()
    print("wrote", out)


if __name__ == "__main__":
    build("en", "SoSach_Deck_PostNDA_EN.pdf")
    build("it", "SoSach_Deck_PostNDA_IT.pdf")
