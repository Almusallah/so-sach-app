# ============================================================================
#  Sổ Sạch — BRIEF PER IL PRIMO INCONTRO (6 slide, EN + IT).
#
#  QUESTO NON È UN PITCH. Yuri non sta raccogliendo: cerca un partner
#  industriale che possa valorizzare la cosa. Quindi qui NON compaiono:
#  la cifra, la struttura dell'operazione, l'impiego dei fondi, le proiezioni,
#  le economics unitarie. Chi non chiede niente è nella posizione forte, e il
#  documento deve suonare così: un asset che esiste, e una domanda aperta.
#
#  LA TENSIONE È ONESTA. Nessun'altra trattativa è in corso, quindi non se ne
#  inventano: la scarsità vera è (a) la finestra normativa con date pubbliche,
#  (b) un vantaggio di undici mesi che si consuma da solo perché un incumbent
#  vietnamita quella barriera PUÒ superarla, (c) l'assenza di una richiesta.
#  Un rivale inventato è la cosa che un partner industriale verifica per primo.
#  Rigenera: python3 make_brief_coffee.py
# ============================================================================
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from deck_kit import (W, H, MARG, PAGE, GIADA, GIADA_MID, GOLD, GOLD_LT, CARTA_DK, ROSSO,
                      INK, MUTED, WHITE, MINT, st_body, st_small,
                      footer, kicker, title, subtitle, bullets, table, stat_cards,
                      dark_page, dark_card, chat_mock)

TOTAL = 7


def build(lang, out):
    E = lang == "en"
    c = canvas.Canvas(out, pagesize=PAGE)
    c.setTitle("Sổ Sạch — Opportunity Brief" if E else "Sổ Sạch — Nota sull'opportunità")
    foot = ("Sổ Sạch · CÔNG TY TNHH OFFICINE GẶP · August 2026" if E
            else "Sổ Sạch · CÔNG TY TNHH OFFICINE GẶP · Agosto 2026")

    # ---------------- 1 · COVER ----------------
    dark_page(c)
    c.setFillColor(GOLD_LT); c.setFont("SS-Sans-Bold", 11.5)
    c.drawString(MARG, H - 34 * mm, "AUGUST 2026" if E else "AGOSTO 2026")
    c.setFillColor(WHITE); c.setFont("SS-Serif-Bold", 60)
    c.drawString(MARG, H - 58 * mm, "Sổ Sạch")
    c.setFillColor(MINT); c.setFont("SS-Sans", 16.5)
    c.drawString(MARG, H - 73 * mm,
                 "Vietnam abolished lump-sum tax for 5.2 million household businesses." if E
                 else "Il Vietnam ha abolito la tassa forfettaria per 5,2 milioni di imprese familiari.")
    c.drawString(MARG, H - 83 * mm,
                 "They must all keep books now. Almost none of them can." if E
                 else "Ora devono tutte tenere i libri. Quasi nessuna ne è capace.")
    c.setFillColor(GOLD_LT); c.setFont("SS-Sans-Bold", 13)
    c.drawString(MARG, H - 101 * mm,
                 "A working instrument, an eleven-month head start," if E
                 else "Uno strumento che funziona, undici mesi di vantaggio,")
    c.drawString(MARG, H - 110 * mm,
                 "and an open question about what it should become." if E
                 else "e una domanda aperta su cosa debba diventare.")
    c.setFillColor(MINT); c.setFont("SS-Sans", 10.5)
    c.drawString(MARG, 24 * mm, "sosach.com.vn · Yuri Frassi · yuri@officinegap.com")
    c.showPage()

    # ---------------- 2 · THE SHOCK ----------------
    kicker(c, "01 · What changed" if E else "01 · Cosa è cambiato", H - 24 * mm)
    title(c, "The customer acquisition was done by the state." if E
          else "L'acquisizione clienti l'ha fatta lo Stato.", H - 37 * mm)
    y = table(c, [
        [("Date" if E else "Data"), ("What happened" if E else "Cosa è successo"), ("Who it reaches" if E else "Chi tocca")],
        ["01/01/2026",
         ("lump-sum tax (thuế khoán) abolished — household businesses must self-declare on real books" if E
          else "abolita la tassa forfettaria (thuế khoán) — le imprese familiari devono autodichiarare su libri veri"),
         "5.2M"],
        ["30/04/2026",
         ("first quarterly declaration filed under the new regime" if E
          else "prima dichiarazione trimestrale nel nuovo regime"),
         ("all of them" if E else "tutte")],
        ["31/01/2027",
         ("Q4 deadline — and then every quarter, permanently" if E
          else "scadenza Q4 — e poi ogni trimestre, per sempre"),
         ("all of them" if E else "tutte")],
        [("2025–26" if E else "2025–26"),
         ("Decree 70/2025: e-invoicing from a connected register above 1 billion VND of revenue "
          "(now carried in Decree 254/2026, in force 01/07/2026)" if E
          else "Decreto 70/2025: e-fattura da registratore connesso sopra 1 miliardo VND di ricavi "
               "(oggi nel Decreto 254/2026, in vigore dal 01/07/2026)"),
         ("the upper tier" if E else "la fascia alta")],
    ], [95, 500, 122], MARG, H - 47 * mm, fs=9.5)
    bullets(c, [
        ("<b>This is not a market that has to be persuaded.</b> Five million businesses acquired a legal "
         "obligation on a fixed date, cannot meet it with a paper notebook, and are penalised for getting it "
         "wrong. Nobody has to be sold the problem." if E
         else "<b>Non è un mercato da convincere.</b> Cinque milioni di imprese hanno acquisito un obbligo di "
              "legge a una data fissa, non possono soddisfarlo con un quaderno, e sono sanzionate se sbagliano. "
              "Il problema non va venduto a nessuno."),
        ("<b>A filing habit forms once.</b> Whoever is in the chat the first time a household actually has to "
         "file is the one they keep. That is the whole race, and it is running now." if E
         else "<b>L'abitudine dichiarativa si forma una volta sola.</b> Chi è nella chat la prima volta che "
              "un'impresa deve davvero dichiarare è quello che si tiene. È tutta qui la corsa, ed è in corso ora."),
    ], MARG, y - 9 * mm, W - 2 * MARG)
    footer(c, 2, TOTAL, foot); c.showPage()

    # ---------------- 3 · WHAT EXISTS ----------------
    kicker(c, "02 · What exists today" if E else "02 · Cosa esiste oggi", H - 24 * mm)
    title(c, "Not a concept. You can open it while we talk." if E
          else "Non un concetto. Potete aprirlo mentre parliamo.", H - 37 * mm)
    chat_mock(c, MARG, H - 46 * mm, (W - 2 * MARG) * 0.46, 54 * mm, lang)
    px = MARG + (W - 2 * MARG) * 0.46 + 20
    pw = W - MARG - px
    yy = bullets(c, [
        ("<b>The product runs in production.</b> A household photographs a receipt inside Zalo; the entry is "
         "written, the tax thresholds are watched, and the quarterly 01/CNKD declaration drafts itself." if E
         else "<b>Il prodotto è in produzione.</b> Un'impresa fotografa uno scontrino dentro Zalo; la scrittura "
              "viene registrata, le soglie fiscali sorvegliate, e la dichiarazione trimestrale 01/CNKD si redige "
              "da sola."),
        ("<b>A verified Zalo Official Account.</b> Eleven months, four rejections, a wet-sealed corporate filing "
         "and a Vietnamese company holding its own .com.vn domain. It is a licence, not a signup." if E
         else "<b>Un Zalo Official Account verificato.</b> Undici mesi, quattro respinte, un atto societario con "
              "timbro a inchiostro e una società vietnamita titolare del proprio dominio .com.vn. È una licenza, "
              "non un'iscrizione."),
        ("<b>Everything above is checkable without us.</b> Open sosach.com.vn. Search the Official Account in "
         "Zalo. Look up enterprise code 0316904153 in the public register, and the domain at "
         "tracuutenmien.gov.vn." if E
         else "<b>Tutto quanto sopra è verificabile senza di noi.</b> Aprite sosach.com.vn. Cercate l'Official "
              "Account su Zalo. Verificate il codice d'impresa 0316904153 nel registro pubblico, e il dominio su "
              "tracuutenmien.gov.vn."),
    ], px, H - 48 * mm, pw, style=st_small)
    c.setFillColor(MUTED); c.setFont("SS-Sans-It", 10)
    c.drawString(MARG, 26 * mm,
                 "What does not exist yet: paying customers. We would rather say that first than have you find it." if E
                 else "Ciò che non esiste ancora: clienti paganti. Preferiamo dirlo noi per primi che farvelo scoprire.")
    footer(c, 3, TOTAL, foot); c.showPage()

    # ---------------- 4 · WHAT WE LEARNED ----------------
    kicker(c, "03 · What eleven months taught us" if E else "03 · Cosa ci hanno insegnato undici mesi", H - 24 * mm)
    title(c, "The things you only learn by shipping this." if E
          else "Le cose che si imparano solo costruendola.", H - 37 * mm)
    subtitle(c, "Any team can read the same decrees. These are the parts that are not in them." if E
             else "Chiunque può leggere gli stessi decreti. Questi sono i pezzi che non ci sono dentro.", H - 46 * mm)
    bullets(c, [
        ("<b>Nobody photographs revenue.</b> A café does not print a receipt for two hundred coffees. Photographs "
         "capture costs; sales arrive as one typed line at closing time. A product specified from the outside gets "
         "this exactly backwards, and then wonders why the books are empty on the income side." if E
         else "<b>I ricavi non si fotografano.</b> Un bar non stampa scontrini per duecento caffè. Le foto portano "
              "i costi; le vendite arrivano come una riga scritta alla chiusura. Un prodotto specificato da fuori "
              "sbaglia esattamente questo, e poi si chiede perché i libri siano vuoti dal lato entrate."),
        ("<b>The threshold is invisible without a book.</b> The household that crosses one billion VND without "
         "noticing is the one who gets hurt — and it cannot know, because not keeping books is the whole reason "
         "it is in this situation. Warning someone before the tax bites is worth more than filing for them after." if E
         else "<b>La soglia è invisibile senza un libro.</b> L'impresa che supera il miliardo di VND senza "
              "accorgersene è quella che si fa male — e non può saperlo, perché non tenere i libri è la ragione "
              "stessa per cui ci si trova. Avvisare prima che il fisco morda vale più che dichiarare dopo."),
        ("<b>Record how much to trust each figure, not just the figure.</b> Every entry is tagged by where it came "
         "from — a photographed document, a typed daily total, a balance carried in from an old notebook. A pile "
         "of numbers is a subscription business. A provenance-weighted record of how micro-businesses actually "
         "trade is something a lender can underwrite, and nobody in this market is collecting it that way." if E
         else "<b>Registrare quanto fidarsi di ogni cifra, non solo la cifra.</b> Ogni voce porta l'origine — un "
              "documento fotografato, un totale scritto a mano, un saldo portato da un vecchio quaderno. Un mucchio "
              "di numeri è un business di abbonamenti. Un registro pesato per provenienza di come commercia davvero "
              "la micro-impresa è qualcosa che un istituto può istruire, e in questo mercato nessuno lo raccoglie così."),
        ("<b>This is a correctness product before it is a software product.</b> The first real receipt we processed "
         "produced four different ways of being confidently wrong. All four were caught by tests before a single "
         "household saw them. In a category where the output is filed with the tax authority, that discipline is "
         "the product." if E
         else "<b>È un prodotto di correttezza prima che di software.</b> Il primo scontrino vero che abbiamo "
              "elaborato ha prodotto quattro modi diversi di sbagliare con sicurezza. Tutti e quattro intercettati "
              "dai test prima che un'impresa li vedesse. In una categoria dove l'output si deposita al fisco, quella "
              "disciplina è il prodotto."),
    ], MARG, H - 54 * mm, W - 2 * MARG, style=st_small)
    footer(c, 4, TOTAL, foot); c.showPage()

    # ---------------- 5 · THE ARITHMETIC ----------------
    # ⚠️ NON è una proiezione e non deve suonare come tale: è aritmetica su un
    #    numero pubblico, a un solo prezzo, così che sia l'altro a farsi l'idea.
    #    Nessuna valutazione, nessun multiplo, nessuna quota di spartizione:
    #    quelle sono conversazioni successive e in questa stanza fanno danno.
    kicker(c, "04 · The arithmetic" if E else "04 · L'aritmetica", H - 24 * mm)
    title(c, "What a five per cent share looks like." if E
          else "Che aspetto ha una quota del cinque per cento.", H - 37 * mm)
    subtitle(c, "Not a forecast. Public segment size × the entry price — so you can form your own view." if E
             else "Non una previsione. Dimensione pubblica del segmento × prezzo d'ingresso — per farvi la vostra idea.",
             H - 46 * mm)
    y = table(c, [
        [("Share of the addressable segment" if E else "Quota del segmento raggiungibile"),
         ("Households" if E else "Imprese"),
         ("Revenue / year" if E else "Ricavi / anno"),
         "USD"],
        ["1%",  "18,000",  "14,9 tỷ VND",  "~$0.6M"],
        ["3%",  "54,000",  "44,7 tỷ VND",  "~$1.8M"],
        ["<b>5%</b>", "<b>90,000</b>", "<b>74,5 tỷ VND</b>", "<b>~$2.9M</b>"],
        ["10%", "180,000", "149,0 tỷ VND", "~$5.8M"],
    ], [270, 130, 160, 157], MARG, H - 53 * mm, fs=10)
    bullets(c, [
        ("<b>The base is 1.8 million</b> — smartphone-active household businesses with revenue between 200 million "
         "and 3 billion VND, where the filing duty is real and the ability to meet it is not. Against the full 5.2 "
         "million the same shares are roughly three times these lines." if E
         else "<b>La base è 1,8 milioni</b> — imprese familiari smartphone-attive con ricavi fra 200 milioni e 3 "
              "miliardi di VND, dove l'obbligo dichiarativo è reale e la capacità di soddisfarlo no. Sui 5,2 "
              "milioni pieni le stesse quote valgono circa il triplo di queste righe."),
        ("<b>Priced at 69.000đ a month, and nothing else.</b> No second tier, no services, no e-invoice revenue, "
         "no lending. Deliberately the most conservative line we can draw, because the interesting question is "
         "what the segment is worth at all — not what we can persuade you it is worth." if E
         else "<b>A 69.000đ al mese, e nient'altro.</b> Nessun secondo livello, nessun servizio, nessun ricavo da "
              "e-fattura, nessun credito. Volutamente la riga più conservativa possibile, perché la domanda "
              "interessante è quanto valga il segmento — non quanto riusciamo a convincervi che valga."),
        ("<b>Five per cent of this segment is a distribution problem, not a product one.</b> The instrument exists. "
         "Ninety thousand households is not something a founder reaches by walking market streets — it is what a "
         "partner with a field force reaches, which is the entire reason for this conversation." if E
         else "<b>Il cinque per cento di questo segmento è un problema di distribuzione, non di prodotto.</b> Lo "
              "strumento esiste. Novantamila imprese non è una cosa a cui arriva un fondatore girando i mercati — "
              "è ciò a cui arriva un partner con una rete sul territorio, ed è tutta qui la ragione di questa "
              "conversazione."),
    ], MARG, y - 9 * mm, W - 2 * MARG, style=st_small)
    footer(c, 5, TOTAL, foot); c.showPage()

    # ---------------- 6 · WHY IT IS WORTH MORE INSIDE ----------------
    kicker(c, "05 · Why this is worth more inside a business" if E
           else "05 · Perché vale di più dentro un'azienda", H - 24 * mm)
    title(c, "Separately, both of us are slower." if E
          else "Separatamente, siamo entrambi più lenti.", H - 37 * mm)
    cw = (W - 2 * MARG - 16) / 2
    ytop = H - 48 * mm
    c.setFillColor(CARTA_DK); c.roundRect(MARG, ytop - 52 * mm, cw, 52 * mm, 10, stroke=0, fill=1)
    c.setFillColor(GIADA); c.setFont("SS-Sans-Bold", 12)
    c.drawString(MARG + 16, ytop - 13 * mm, "WHAT WE BRING" if E else "COSA PORTIAMO NOI")
    p = Paragraph(("A working instrument against a statutory deadline. Eleven months of regulatory groundwork that "
                   "cannot be compressed. A verified channel into the segment. And the product judgement above — "
                   "learned by shipping to real households, not by reading the decrees." if E else
                   "Uno strumento funzionante contro una scadenza di legge. Undici mesi di lavoro normativo che non "
                   "si comprimono. Un canale verificato dentro il segmento. E il giudizio di prodotto qui sopra — "
                   "imparato costruendo per imprese vere, non leggendo i decreti."), st_small)
    _, ph = p.wrap(cw - 32, 300); p.drawOn(c, MARG + 16, ytop - 18 * mm - ph)

    c.setFillColor(GIADA); c.roundRect(MARG + cw + 16, ytop - 52 * mm, cw, 52 * mm, 10, stroke=0, fill=1)
    c.setFillColor(GOLD_LT); c.setFont("SS-Sans-Bold", 12)
    c.drawString(MARG + cw + 32, ytop - 13 * mm, "WHAT A PARTNER BRINGS" if E else "COSA PORTA UN PARTNER")
    p = Paragraph(("<font color='#cfe0d6'>Distribution at a scale we cannot buy: an existing base, a field force, "
                   "branches, licences, and people these households already deal with. A Vietnamese ground team. "
                   "And the balance sheet to treat a five-million-business segment as a programme rather than a "
                   "pilot.</font>" if E else
                   "<font color='#cfe0d6'>Distribuzione a una scala che non possiamo comprare: una base clienti, "
                   "una rete sul territorio, filiali, licenze, e persone con cui queste imprese già hanno a che "
                   "fare. Una squadra vietnamita a terra. E il bilancio per trattare un segmento da cinque milioni "
                   "di imprese come un programma, non come un pilota.</font>"), st_small)
    _, ph = p.wrap(cw - 32, 300); p.drawOn(c, MARG + cw + 32, ytop - 18 * mm - ph)

    c.setFillColor(HexColor("#f6ece6")); c.roundRect(MARG, ytop - 84 * mm, W - 2 * MARG, 26 * mm, 10, stroke=0, fill=1)
    c.setFillColor(ROSSO); c.setFont("SS-Sans-Bold", 10.5)
    c.drawString(MARG + 16, ytop - 60 * mm, "AND THE HONEST PART" if E else "E LA PARTE ONESTA")
    p = Paragraph(("The eleven months are a head start, not a wall. A Vietnamese incumbent can clear the same "
                   "regulatory barrier — it would simply cost them the same eleven months, against a deadline that "
                   "is already running. That is precisely why the head start is worth something now and worth less "
                   "later. We would rather be straight about the shape of the advantage than oversell it." if E else
                   "Gli undici mesi sono un vantaggio, non un muro. Un incumbent vietnamita quella barriera può "
                   "superarla — gli costerebbe semplicemente gli stessi undici mesi, contro una scadenza già in "
                   "corso. È esattamente per questo che il vantaggio vale qualcosa adesso e varrà meno dopo. "
                   "Preferiamo essere chiari sulla forma del vantaggio che gonfiarlo."), st_small)
    _, ph = p.wrap(W - 2 * MARG - 32, 200); p.drawOn(c, MARG + 16, ytop - 64 * mm - ph)
    footer(c, 6, TOTAL, foot); c.showPage()

    # ---------------- 7 · THE OPEN QUESTION ----------------
    dark_page(c)
    c.setFillColor(GOLD_LT); c.setFont("SS-Sans-Bold", 11)
    c.drawString(MARG, H - 28 * mm, "06 · THE QUESTION" if E else "06 · LA DOMANDA")
    c.setFillColor(WHITE); c.setFont("SS-Serif-Bold", 38)
    c.drawString(MARG, H - 46 * mm, "We are not raising money." if E else "Non stiamo raccogliendo denaro.")
    c.setFillColor(MINT); c.setFont("SS-Sans", 15)
    c.drawString(MARG, H - 60 * mm,
                 "We are trying to work out what this should become, and with whom." if E
                 else "Stiamo cercando di capire cosa debba diventare, e con chi.")

    cw2 = (W - 2 * MARG - 16) / 2
    dark_card(c, MARG, H - 72 * mm, cw2, 40 * mm,
              "WHAT WE ARE ASKING FOR TODAY" if E else "COSA CHIEDIAMO OGGI",
              (["Nothing.",
                "An hour, your reading of the segment, and",
                "whether you think this belongs inside a",
                "business like yours or alongside one."]
               if E else
               ["Niente.",
                "Un'ora, la vostra lettura del segmento, e",
                "se pensiate che questa cosa stia dentro",
                "un'azienda come la vostra o accanto."]))
    dark_card(c, MARG + cw2 + 16, H - 72 * mm, cw2, 40 * mm,
              "WHAT COMES NEXT, IF IT IS INTERESTING" if E else "COSA VIENE DOPO, SE INTERESSA",
              (["A mutual confidentiality agreement, then",
                "the operating detail: the economics, the",
                "channel, the scoring and provenance model,",
                "the risks, and what we would not do."]
               if E else
               ["Un accordo di riservatezza, poi il",
                "dettaglio operativo: le economics, il",
                "canale, il modello di punteggio e",
                "provenienza, i rischi, e cosa non faremmo."]))

    c.setFillColor(GOLD); c.setFont("SS-Sans-Bold", 12.5)
    c.drawString(MARG, 56 * mm,
                 "What it is worth is a later conversation. What it could do at scale is this one." if E
                 else "Quanto vale è una conversazione successiva. Cosa può fare su scala è questa.")
    c.setFillColor(GOLD_LT); c.setFont("SS-Sans-Bold", 13)
    c.drawString(MARG, 40 * mm, "Yuri Frassi")
    c.setFillColor(MINT); c.setFont("SS-Sans", 11)
    c.drawString(MARG, 32 * mm, "yuri@officinegap.com · sosach.com.vn")
    c.drawString(MARG, 25 * mm, "CÔNG TY TNHH OFFICINE GẶP · 384 Hoàng Diệu, Phường Khánh Hội, Hồ Chí Minh City")
    c.showPage()
    c.save()
    print("wrote", out)


if __name__ == "__main__":
    build("en", "SoSach_Opportunity_Brief_EN.pdf")
    build("it", "SoSach_Opportunity_Brief_IT.pdf")
