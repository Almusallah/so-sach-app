# ============================================================================
#  Sổ Sạch — BRIEF PER IL PRIMO INCONTRO, versione monocroma (7 slide, EN+IT).
#  Stesso testo del brief precedente, sistema visivo completamente diverso:
#  nero su bianco, Avenir Next, gerarchia per peso e scala. Nessuna richiesta,
#  nessuna struttura, nessuna valutazione — vedi make_brief_coffee.py per il
#  perché di ogni scelta di contenuto.
#  Rigenera: python3 make_brief_mono.py
# ============================================================================
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from mono_kit import (W, H, MARG, PAGE, INK, PAPER, GREY, GREY_L, RULE, WASH, WHITE, photo, SHOTS,
                      st_body, st_small, st_smallk, tracked, kicker, title, subtitle,
                      rule, footer, bullets, table, stat_row, dark_page, dark_block, chat_mock)

TOTAL = 8


def build(lang, out):
    E = lang == "en"
    c = canvas.Canvas(out, pagesize=PAGE)
    c.setTitle("Sổ Sạch — Opportunity Brief" if E else "Sổ Sạch — Nota sull'opportunità")
    foot = "Sổ Sạch · Officine Gặp · Hồ Chí Minh City · " + ("August 2026" if E else "Agosto 2026")

    # ---------------- 1 · COVER ----------------
    dark_page(c)
    tracked(c, "AUGUST 2026" if E else "AGOSTO 2026", MARG, H - 34 * mm, "AV-Db", 8.4, 2.0, "#8a8a8a")
    tracked(c, "Sổ Sạch", MARG, H - 66 * mm, "AV-Bd", 76, -2.4, WHITE)
    c.setStrokeColor(HexColor("#3a3a3a")); c.setLineWidth(0.8)
    c.line(MARG, H - 74 * mm, W - MARG, H - 74 * mm)
    c.setFillColor(WHITE); c.setFont("AV", 15.5)
    c.drawString(MARG, H - 86 * mm,
                 "Vietnam abolished lump-sum tax for 5.2 million household businesses." if E
                 else "Il Vietnam ha abolito la tassa forfettaria per 5,2 milioni di imprese familiari.")
    c.setFillColor(HexColor("#a8a8a8"))
    c.drawString(MARG, H - 95 * mm,
                 "They must all keep books now. Almost none of them can." if E
                 else "Ora devono tutte tenere i libri. Quasi nessuna ne è capace.")
    c.setFillColor(WHITE); c.setFont("AV-Db", 12)
    c.drawString(MARG, H - 116 * mm,
                 "A working instrument, an eleven-month head start," if E
                 else "Uno strumento che funziona, undici mesi di vantaggio,")
    c.drawString(MARG, H - 124 * mm,
                 "and an open question about what it should become." if E
                 else "e una domanda aperta su cosa debba diventare.")
    tracked(c, "SOSACH.COM.VN · YURI FRASSI · YURI@OFFICINEGAP.COM", MARG, 22 * mm, "AV", 7.4, 1.5, "#8a8a8a")
    c.showPage()

    # ---------------- 2 · THE SHOCK ----------------
    kicker(c, "01 — What changed" if E else "01 — Cosa è cambiato", H - 26 * mm)
    title(c, "The customer acquisition" if E else "L'acquisizione clienti", H - 42 * mm, size=31)
    title(c, "was done by the state." if E else "l'ha fatta lo Stato.", H - 54 * mm, size=31)
    y = table(c, [
        [("Date" if E else "Data"), ("What happened" if E else "Cosa è successo"), ("Reaches" if E else "Tocca")],
        ["01/01/2026",
         ("Lump-sum tax abolished — household businesses must self-declare on real books" if E
          else "Abolita la tassa forfettaria — le imprese familiari devono autodichiarare su libri veri"), "5,2M"],
        ["30/04/2026",
         ("First quarterly declaration filed under the new regime" if E
          else "Prima dichiarazione trimestrale nel nuovo regime"), ("all" if E else "tutte")],
        ["31/01/2027",
         ("Q4 deadline — and then every quarter, permanently" if E
          else "Scadenza Q4 — e poi ogni trimestre, per sempre"), ("all" if E else "tutte")],
        ["2025–26",
         ("Decree 70/2025 — e-invoicing from a connected register above 1 billion VND" if E
          else "Decreto 70/2025 — e-fattura da registratore connesso sopra 1 miliardo VND"),
         ("upper tier" if E else "fascia alta")],
    ], [92, 500, 125], MARG, H - 64 * mm, fs=9.8)
    bullets(c, [
        ("<b>This is not a market that has to be persuaded.</b> Five million businesses acquired a legal obligation "
         "on a fixed date, cannot meet it with a paper notebook, and are penalised for getting it wrong." if E
         else "<b>Non è un mercato da convincere.</b> Cinque milioni di imprese hanno acquisito un obbligo di legge "
              "a una data fissa, non possono soddisfarlo con un quaderno, e sono sanzionate se sbagliano."),
        ("<b>A filing habit forms once.</b> Whoever is in the chat the first time a household actually has to file "
         "is the one they keep. That is the whole race, and it is running now." if E
         else "<b>L'abitudine dichiarativa si forma una volta sola.</b> Chi è nella chat la prima volta che "
              "un'impresa deve davvero dichiarare è quello che si tiene. È tutta qui la corsa, ed è in corso ora."),
    ], MARG, y - 11 * mm, W - 2 * MARG, style=st_smallk)
    footer(c, 2, TOTAL, foot); c.showPage()

    # ---------------- 3 · WHAT EXISTS ----------------
    kicker(c, "02 — What exists today" if E else "02 — Cosa esiste oggi", H - 26 * mm)
    title(c, "Not a concept." if E else "Non un concetto.", H - 42 * mm, size=31)
    title(c, "You can open it while we talk." if E else "Potete aprirlo mentre parliamo.", H - 54 * mm, size=31)
    # Lo scambio vero: le risposte sono le stringhe di PRODUZIONE del bot,
    # renderizzate e fotografate — non un mockup inventato.
    photo(c, f"{SHOTS}/chat_crop.png", MARG, H - 60 * mm, 62 * mm,
          caption=("The bot's actual production replies" if E else "Le risposte di produzione del bot"))
    px = MARG + 62 * mm + 22
    bullets(c, [
        ("<b>The product runs in production.</b> A household photographs a receipt inside Zalo; the entry is "
         "written, the thresholds are watched, and the quarterly 01/CNKD declaration drafts itself." if E
         else "<b>Il prodotto è in produzione.</b> Un'impresa fotografa uno scontrino dentro Zalo; la scrittura "
              "viene registrata, le soglie sorvegliate, e la dichiarazione trimestrale 01/CNKD si redige da sola."),
        ("<b>A verified Zalo Official Account.</b> Eleven months, four rejections, a wet-sealed corporate filing, "
         "and a Vietnamese company holding its own .com.vn domain. A licence, not a signup." if E
         else "<b>Un Zalo Official Account verificato.</b> Undici mesi, quattro respinte, un atto societario con "
              "timbro a inchiostro, e una società vietnamita titolare del proprio dominio .com.vn. Una licenza, "
              "non un'iscrizione."),
        ("<b>All of it is checkable without us.</b> sosach.com.vn · the Official Account in Zalo · enterprise code "
         "0316904153 in the public register · the domain at tracuutenmien.gov.vn." if E
         else "<b>Tutto è verificabile senza di noi.</b> sosach.com.vn · l'Official Account su Zalo · codice "
              "d'impresa 0316904153 nel registro pubblico · il dominio su tracuutenmien.gov.vn."),
    ], px, H - 64 * mm, W - MARG - px, style=st_small)
    c.setFillColor(GREY); c.setFont("AV-It", 10)
    c.drawString(px, 30 * mm,
                 "What does not exist yet: paying customers. We would rather say that first than have you find it." if E
                 else "Ciò che non esiste ancora: clienti paganti. Preferiamo dirlo noi per primi che farvelo scoprire.")
    footer(c, 3, TOTAL, foot); c.showPage()

    # ---------------- 4 · THE BOOK ----------------
    kicker(c, "03 — The book it produces" if E else "03 — Il libro che produce", H - 26 * mm)
    title(c, "From photographs to a filed declaration." if E
          else "Dalle fotografie a una dichiarazione depositata.", H - 44 * mm, size=30)
    colw = (W - 2 * MARG - 26) / 2
    photo(c, f"{SHOTS}/book_crop.png", MARG, H - 50 * mm, 86 * mm,
          caption=("The live book — totals, credit-readiness score, thresholds, cash flow" if E
                   else "Il libro live — totali, punteggio, soglie, flusso di cassa"))
    dh = photo(c, f"{SHOTS}/decl_crop.png", MARG + colw + 26, H - 52 * mm, colw,
          caption=("Form 01/CNKD, drafted continuously from the book" if E
                   else "Modulo 01/CNKD, redatto in continuo dal libro"))
    p4 = Paragraph(
        ("Sample book of a noodle shop, generated by the real engines. The score is deliberately hard: an early "
         "version graded every household A, which is worthless to a lender. Below the threshold the declaration "
         "shows 0đ due — and says the filing is still owed, which is the misunderstanding that gets households "
         "fined." if E else
         "Libro campione di un locale di bún bò, generato dai motori veri. Il punteggio è volutamente severo: una "
         "prima versione dava la A a tutti, il che non serve a nessun istituto. Sotto soglia la dichiarazione "
         "mostra 0đ dovuti — e dice che il deposito resta dovuto, che è l'equivoco per cui le imprese si fanno "
         "multare."), st_small)
    _, ph4 = p4.wrap(colw, 200)
    p4.drawOn(c, MARG + colw + 26, H - 54 * mm - dh - 10 - ph4)
    footer(c, 4, TOTAL, foot); c.showPage()

    # ---------------- 5 · WHAT WE LEARNED ----------------
    kicker(c, "04 — What eleven months taught us" if E else "04 — Cosa ci hanno insegnato undici mesi", H - 26 * mm)
    title(c, "The things you only learn" if E else "Le cose che si imparano", H - 42 * mm, size=31)
    title(c, "by shipping this." if E else "solo costruendola.", H - 54 * mm, size=31)
    subtitle(c, "Anyone can read the same decrees. These are the parts that are not in them." if E
             else "Chiunque può leggere gli stessi decreti. Questi sono i pezzi che non ci sono dentro.", H - 63 * mm)
    bullets(c, [
        ("<b>Nobody photographs revenue.</b> A café does not print a receipt for two hundred coffees. Photographs "
         "capture costs; sales arrive as one typed line at closing. A product specified from the outside gets this "
         "exactly backwards, then wonders why the books are empty on the income side." if E
         else "<b>I ricavi non si fotografano.</b> Un bar non stampa scontrini per duecento caffè. Le foto portano i "
              "costi; le vendite arrivano come una riga scritta alla chiusura. Un prodotto specificato da fuori "
              "sbaglia esattamente questo, e poi si chiede perché i libri siano vuoti dal lato entrate."),
        ("<b>The threshold is invisible without a book.</b> The household that crosses one billion VND without "
         "noticing is the one who gets hurt — and it cannot know, because not keeping books is the whole reason it "
         "is in that position. Warning someone before the tax bites is worth more than filing for them after." if E
         else "<b>La soglia è invisibile senza un libro.</b> L'impresa che supera il miliardo di VND senza "
              "accorgersene è quella che si fa male — e non può saperlo, perché non tenere i libri è la ragione "
              "stessa per cui ci si trova. Avvisare prima che il fisco morda vale più che dichiarare dopo."),
        ("<b>Record how much to trust each figure, not just the figure.</b> Every entry is tagged by origin — a "
         "photographed document, a typed daily total, a balance carried in from an old notebook. A pile of numbers "
         "is a subscription business; a provenance-weighted record of how micro-businesses actually trade is "
         "something a lender can underwrite, and nobody here is collecting it that way." if E
         else "<b>Registrare quanto fidarsi di ogni cifra, non solo la cifra.</b> Ogni voce porta l'origine — un "
              "documento fotografato, un totale scritto a mano, un saldo portato da un vecchio quaderno. Un mucchio "
              "di numeri è un business di abbonamenti; un registro pesato per provenienza di come commercia davvero "
              "la micro-impresa è qualcosa che un istituto può istruire, e qui nessuno lo raccoglie così."),
        ("<b>This is a correctness product before it is a software product.</b> The first real receipt we processed "
         "produced four different ways of being confidently wrong. All four were caught by tests before a single "
         "household saw them. Where the output is filed with the tax authority, that discipline is the product." if E
         else "<b>È un prodotto di correttezza prima che di software.</b> Il primo scontrino vero ha prodotto quattro "
              "modi diversi di sbagliare con sicurezza. Tutti e quattro intercettati dai test prima che un'impresa li "
              "vedesse. Dove l'output si deposita al fisco, quella disciplina è il prodotto."),
    ], MARG, H - 72 * mm, W - 2 * MARG, style=st_small)
    footer(c, 5, TOTAL, foot); c.showPage()

    # ---------------- 6 · THE ARITHMETIC ----------------
    kicker(c, "05 — The arithmetic" if E else "05 — L'aritmetica", H - 26 * mm)
    title(c, "What a five per cent share looks like." if E
          else "Che aspetto ha una quota del cinque per cento.", H - 44 * mm, size=31)
    subtitle(c, "Not a forecast. Public segment size × the entry price — so you can form your own view." if E
             else "Non una previsione. Dimensione pubblica del segmento × prezzo d'ingresso — per farvi la vostra idea.",
             H - 54 * mm)
    y = table(c, [
        [("Share of the addressable segment" if E else "Quota del segmento raggiungibile"),
         ("Households" if E else "Imprese"), ("Revenue / year" if E else "Ricavi / anno"), "USD"],
        ["1%",  "18.000",  "14,9 tỷ VND",  "≈ $0,6M"],
        ["3%",  "54.000",  "44,7 tỷ VND",  "≈ $1,8M"],
        ["5%",  "90.000",  "74,5 tỷ VND",  "≈ $2,9M"],
        ["10%", "180.000", "149,0 tỷ VND", "≈ $5,8M"],
    ], [280, 130, 160, 147], MARG, H - 62 * mm, fs=10.5, emphasise=3)
    bullets(c, [
        ("<b>The base is 1.8 million</b> — smartphone-active household businesses turning over 200 million to 3 "
         "billion VND, where the filing duty is real and the ability to meet it is not. Against the full 5.2 million "
         "the same shares are roughly three times these lines." if E
         else "<b>La base è 1,8 milioni</b> — imprese familiari smartphone-attive con ricavi fra 200 milioni e 3 "
              "miliardi di VND, dove l'obbligo dichiarativo è reale e la capacità di soddisfarlo no. Sui 5,2 milioni "
              "pieni le stesse quote valgono circa il triplo."),
        ("<b>At 69.000đ a month, and nothing else.</b> No second tier, no services, no e-invoice revenue, no "
         "lending — deliberately the most conservative line we can draw, because the interesting question is what "
         "the segment is worth at all, not what we can persuade you it is worth." if E
         else "<b>A 69.000đ al mese, e nient'altro.</b> Nessun secondo livello, nessun servizio, nessun ricavo da "
              "e-fattura, nessun credito — volutamente la riga più conservativa possibile, perché la domanda "
              "interessante è quanto valga il segmento, non quanto riusciamo a convincervi che valga."),
        ("<b>Five per cent is a distribution problem, not a product one.</b> The instrument exists. Ninety thousand "
         "households is not somewhere a founder walks to — it is where a partner with a field force already is." if E
         else "<b>Il cinque per cento è un problema di distribuzione, non di prodotto.</b> Lo strumento esiste. "
              "Novantamila imprese non è un posto dove arriva un fondatore camminando — è dove un partner con una "
              "rete sul territorio è già."),
    ], MARG, y - 11 * mm, W - 2 * MARG, style=st_small)
    footer(c, 6, TOTAL, foot); c.showPage()

    # ---------------- 7 · WORTH MORE INSIDE ----------------
    kicker(c, "06 — Why this is worth more inside a business" if E
           else "06 — Perché vale di più dentro un'azienda", H - 26 * mm)
    title(c, "Separately, both of us are slower." if E
          else "Separatamente, siamo entrambi più lenti.", H - 44 * mm, size=31)
    cw = (W - 2 * MARG - 30) / 2
    ytop = H - 58 * mm
    for i, (head, body) in enumerate([
        (("WHAT WE BRING" if E else "COSA PORTIAMO NOI"),
         ("A working instrument against a statutory deadline. Eleven months of regulatory groundwork that cannot be "
          "compressed. A verified channel into the segment. And the product judgement opposite — learned by shipping "
          "to real households, not by reading decrees." if E else
          "Uno strumento funzionante contro una scadenza di legge. Undici mesi di lavoro normativo che non si "
          "comprimono. Un canale verificato dentro il segmento. E il giudizio di prodotto qui accanto — imparato "
          "costruendo per imprese vere, non leggendo decreti.")),
        (("WHAT A PARTNER BRINGS" if E else "COSA PORTA UN PARTNER"),
         ("Distribution at a scale we cannot buy: an existing base, a field force, branches, licences, and people "
          "these households already deal with. A Vietnamese ground team. And the balance sheet to treat a "
          "five-million-business segment as a programme rather than a pilot." if E else
          "Distribuzione a una scala che non possiamo comprare: una base clienti, una rete sul territorio, filiali, "
          "licenze, e persone con cui queste imprese già hanno a che fare. Una squadra vietnamita a terra. E il "
          "bilancio per trattare un segmento da cinque milioni di imprese come un programma, non un pilota.")),
    ]):
        x = MARG + i * (cw + 30)
        tracked(c, head, x, ytop, "AV-Db", 8.2, 1.9, GREY_L)
        rule(c, ytop - 9, x, x + cw, color=INK, w=1.1)
        p = Paragraph(body, st_body)
        _, ph = p.wrap(cw, 300); p.drawOn(c, x, ytop - 20 - ph)

    yb = ytop - 62 * mm
    rule(c, yb + 14 * mm)
    tracked(c, "AND THE HONEST PART" if E else "E LA PARTE ONESTA", MARG, yb + 8 * mm, "AV-Db", 8.2, 1.9, GREY_L)
    p = Paragraph(("The eleven months are a head start, not a wall. A Vietnamese incumbent can clear the same "
                   "regulatory barrier — it would simply cost them the same eleven months, against a deadline "
                   "already running. Which is exactly why the head start is worth something now and less later. "
                   "We would rather be straight about the shape of the advantage than oversell it." if E else
                   "Gli undici mesi sono un vantaggio, non un muro. Un incumbent vietnamita quella barriera può "
                   "superarla — gli costerebbe semplicemente gli stessi undici mesi, contro una scadenza già in "
                   "corso. Ed è esattamente per questo che il vantaggio vale qualcosa adesso e meno dopo. "
                   "Preferiamo essere chiari sulla forma del vantaggio che gonfiarlo."), st_body)
    _, ph = p.wrap(W - 2 * MARG, 200); p.drawOn(c, MARG, yb + 4 * mm - ph)
    footer(c, 7, TOTAL, foot); c.showPage()

    # ---------------- 8 · THE QUESTION ----------------
    dark_page(c)
    tracked(c, ("07 — The question" if E else "07 — La domanda").upper(), MARG, H - 30 * mm, "AV-Db", 8.4, 2.0, "#8a8a8a")
    tracked(c, "We are not raising money." if E else "Non stiamo raccogliendo denaro.",
            MARG, H - 52 * mm, "AV-Bd", 40, -1.4, WHITE)
    c.setFillColor(HexColor("#a8a8a8")); c.setFont("AV", 15)
    c.drawString(MARG, H - 66 * mm,
                 "We are trying to work out what this should become, and with whom." if E
                 else "Stiamo cercando di capire cosa debba diventare, e con chi.")
    cw2 = (W - 2 * MARG - 30) / 2
    dark_block(c, MARG, H - 86 * mm, cw2,
               "What we are asking for today" if E else "Cosa chiediamo oggi",
               (["Nothing.", "", "An hour, your reading of the segment, and whether",
                 "you think this belongs inside a business like yours", "or alongside one."]
                if E else
                ["Niente.", "", "Un'ora, la vostra lettura del segmento, e se",
                 "pensiate che questa cosa stia dentro un'azienda", "come la vostra o accanto."]))
    dark_block(c, MARG + cw2 + 30, H - 86 * mm, cw2,
               "What comes next, if it is interesting" if E else "Cosa viene dopo, se interessa",
               (["A confidentiality agreement, then the operating", "detail: the economics, the channel, the scoring",
                 "and provenance model, the risks, and the things", "we would not do."]
                if E else
                ["Un accordo di riservatezza, poi il dettaglio", "operativo: le economics, il canale, il modello di",
                 "punteggio e provenienza, i rischi, e le cose che", "non faremmo."]))
    c.setFillColor(WHITE); c.setFont("AV-Db", 13)
    c.drawString(MARG, 52 * mm,
                 "What it is worth is a later conversation. What it could do at scale is this one." if E
                 else "Quanto vale è una conversazione successiva. Cosa può fare su scala è questa.")
    c.setStrokeColor(HexColor("#3a3a3a")); c.setLineWidth(0.8); c.line(MARG, 44 * mm, W - MARG, 44 * mm)
    c.setFillColor(WHITE); c.setFont("AV-Db", 12)
    c.drawString(MARG, 33 * mm, "Yuri Frassi")
    c.setFillColor(HexColor("#a8a8a8")); c.setFont("AV", 10)
    c.drawString(MARG, 26 * mm, "yuri@officinegap.com · sosach.com.vn")
    c.drawString(MARG, 19 * mm, "CÔNG TY TNHH OFFICINE GẶP · 384 Hoàng Diệu, Phường Khánh Hội, Hồ Chí Minh City")
    c.showPage()
    c.save()
    print("wrote", out)


if __name__ == "__main__":
    build("en", "SoSach_Brief_EN.pdf")
    build("it", "SoSach_Brief_IT.pdf")
