# ============================================================================
#  Sổ Sạch — TEASER PRE-NDA (8 slide, EN + IT).
#
#  REGOLA DI QUESTO DOCUMENTO: si manda a freddo, quindi non deve contenere
#  nulla che permetta a qualcuno di ricostruire l'azienda. Fuori restano:
#  economics unitarie, ARPU/CAC/churn, la percentuale di rev-share agli agenti,
#  il modello del punteggio, la meccanica Zalo, i kill criteria, il piano
#  finanziario anno per anno. Restano DENTRO solo fatti verificabili da terzi e
#  la dimensione del problema — abbastanza per ottenere la riunione, non
#  abbastanza per fare a meno di noi.
#  Rigenera: python3 make_deck_prenda.py
# ============================================================================
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from deck_kit import (W, H, MARG, PAGE, chat_mock, GIADA, GIADA_MID, GOLD, GOLD_LT, CARTA, CARTA_DK,
                      INK, MUTED, WHITE, MINT, st_body, st_small,
                      footer, kicker, title, subtitle, bullets, table, stat_cards,
                      dark_page, dark_card, stamp)

TOTAL = 8


def build(lang, out):
    E = lang == "en"
    c = canvas.Canvas(out, pagesize=PAGE)
    c.setTitle("Sổ Sạch — Investor Teaser" if E else "Sổ Sạch — Teaser Investitori")
    foot = ("Sổ Sạch — investor teaser · non-confidential · August 2026" if E
            else "Sổ Sạch — teaser investitori · non riservato · Agosto 2026")

    # ---------------- 1 · COVER ----------------
    dark_page(c)
    c.setFillColor(GOLD_LT); c.setFont("SS-Sans-Bold", 12)
    c.drawString(MARG, H - 34 * mm, "INVESTOR TEASER · AUGUST 2026" if E else "TEASER INVESTITORI · AGOSTO 2026")
    c.setFillColor(WHITE); c.setFont("SS-Serif-Bold", 62)
    c.drawString(MARG, H - 58 * mm, "Sổ Sạch")
    c.setFillColor(MINT); c.setFont("SS-Sans", 16.5)
    c.drawString(MARG, H - 72 * mm,
                 "Vietnam abolished lump-sum tax for 5.2 million household businesses." if E
                 else "Il Vietnam ha abolito la tassa forfettaria per 5,2 milioni di imprese familiari.")
    c.drawString(MARG, H - 82 * mm,
                 "Overnight, they all have to keep books. Almost none of them can." if E
                 else "Da un giorno all'altro devono tutti tenere i libri. Quasi nessuno ne è capace.")
    c.setFillColor(GOLD_LT); c.setFont("SS-Sans-Bold", 13)
    c.drawString(MARG, H - 100 * mm,
                 "An AI bookkeeper that lives inside Zalo. Photograph a receipt — the book writes itself." if E
                 else "Un commercialista AI dentro Zalo. Fotografi lo scontrino — il libro si scrive da solo.")
    c.setFillColor(MINT); c.setFont("SS-Sans", 10.5)
    c.drawString(MARG, 26 * mm, "sosach.com.vn · CÔNG TY TNHH OFFICINE GẶP · Hồ Chí Minh City")
    c.drawString(MARG, 19 * mm,
                 "This teaser contains no confidential information. The full deck is available under NDA." if E
                 else "Questo teaser non contiene informazioni riservate. Il deck completo è disponibile previo NDA.")
    c.showPage()

    # ---------------- 2 · WHY NOW ----------------
    kicker(c, "01 · Why now" if E else "01 · Perché ora", H - 24 * mm)
    title(c, "A deadline set by law, not by a marketing plan." if E
          else "Una scadenza fissata dalla legge, non da un piano marketing.", H - 37 * mm)
    y = table(c, [
        [("Date" if E else "Data"), ("What changed" if E else "Cosa è cambiato"), ("Consequence" if E else "Conseguenza")],
        ["01/01/2026",
         ("Lump-sum tax (thuế khoán) abolished for household businesses" if E
          else "Abolita la tassa forfettaria (thuế khoán) per le imprese familiari"),
         ("5.2M businesses must self-declare on real books" if E
          else "5,2M imprese devono autodichiarare su libri veri")],
        ["30/04/2026",
         ("First quarterly declaration due under the new regime" if E
          else "Prima dichiarazione trimestrale nel nuovo regime"),
         ("Deadline recurs 4× a year, forever" if E else "La scadenza torna 4 volte l'anno, per sempre")],
        [("2025–26" if E else "2025–26"),
         ("Decree 70/2025: e-invoicing from cash registers above 1 billion VND revenue "
          "(now carried in Decree 254/2026, in force 01/07/2026)" if E
          else "Decreto 70/2025: e-fattura da registratore di cassa sopra 1 miliardo VND di ricavi "
               "(oggi nel Decreto 254/2026, in vigore dal 01/07/2026)"),
         ("A threshold nobody can see without a book" if E
          else "Una soglia invisibile senza un libro")],
    ], [90, 400, 260], MARG, H - 47 * mm)
    bullets(c, [
        ("The state did the customer acquisition. Every one of these businesses now has a legal obligation "
         "it cannot meet with a paper notebook, and a penalty if it gets it wrong." if E
         else "L'acquisizione clienti l'ha fatta lo Stato. Ognuna di queste imprese ha ora un obbligo di legge "
              "che un quaderno non soddisfa, e una sanzione se sbaglia."),
        ("Accounting software exists — and is aimed at companies with an accountant. "
         "A woman selling bún bò from a cart is not going to open a desktop ledger." if E
         else "Il software contabile esiste — ed è pensato per aziende con un contabile. "
              "Chi vende bún bò da un carretto non aprirà un gestionale."),
    ], MARG, y - 12 * mm, W - 2 * MARG)
    footer(c, 2, TOTAL, foot); c.showPage()

    # ---------------- 3 · THE PRODUCT ----------------
    kicker(c, "02 · The product" if E else "02 · Il prodotto", H - 24 * mm)
    title(c, "Three steps, and two of them are ours." if E
          else "Tre passaggi, e due sono nostri.", H - 37 * mm)
    subtitle(c, "No app to install. It runs where 77 million Vietnamese already are." if E
             else "Nessuna app da installare. Vive dove sono già 77 milioni di vietnamiti.", H - 46 * mm)

    steps = [
        ("1", "She photographs the receipt" if E else "Fotografa lo scontrino",
         "In a Zalo chat, like sending a picture to a friend." if E
         else "In una chat Zalo, come mandare una foto a un'amica."),
        ("2", "We read it and write the book" if E else "Lo leggiamo e scriviamo il libro",
         "Amount, supplier, date, category — confirmed in one tap." if E
         else "Importo, fornitore, data, categoria — confermati con un tocco."),
        ("3", "The declaration is already filled" if E else "La dichiarazione è già compilata",
         "Quarterly form 01/CNKD, drafted from the book she never had to keep." if E
         else "Modulo trimestrale 01/CNKD, redatto dal libro che non ha dovuto tenere."),
    ]
    cw = (W - 2 * MARG - 2 * 16) / 3
    for i, (n, head, sub) in enumerate(steps):
        x = MARG + i * (cw + 16)
        c.setFillColor(CARTA_DK); c.roundRect(x, H - 108 * mm, cw, 48 * mm, 10, stroke=0, fill=1)
        c.setFillColor(GOLD); c.setFont("SS-Serif-Bold", 30)
        c.drawString(x + 16, H - 74 * mm, n)
        c.setFillColor(GIADA); c.setFont("SS-Sans-Bold", 13)
        c.drawString(x + 16, H - 84 * mm, head)
        from reportlab.platypus import Paragraph
        p = Paragraph(sub, st_small); p.wrapOn(c, cw - 32, 60); p.drawOn(c, x + 16, H - 100 * mm)

    c.setFillColor(GIADA); c.setFont("SS-Sans-Bold", 12)
    c.drawString(MARG, H - 118 * mm,
                 "It also tells her, in plain Vietnamese, how close she is to the tax threshold — "
                 "before it costs her money." if E
                 else "Le dice anche, in vietnamita semplice, quanto è vicina alla soglia fiscale — "
                      "prima che le costi denaro.")
    chat_mock(c, MARG, H - 124 * mm, (W - 2 * MARG) * 0.52, 54 * mm, lang)
    from reportlab.platypus import Paragraph
    px = MARG + (W - 2 * MARG) * 0.52 + 22
    pw = W - MARG - px
    p2 = Paragraph(
        "<b>Why this shape wins.</b> The competing products are ledgers that assume an accountant. This one "
        "assumes a phone, a receipt and thirty seconds. The entire interface is a conversation she is already "
        "having forty times a day." if E else
        "<b>Perché questa forma vince.</b> I prodotti concorrenti sono gestionali che presuppongono un contabile. "
        "Questo presuppone un telefono, uno scontrino e trenta secondi. L'intera interfaccia è una conversazione "
        "che lei ha già quaranta volte al giorno.", st_body)
    _, ph = p2.wrap(pw, 200); p2.drawOn(c, px, H - 124 * mm - 54 * mm + (54 * mm - ph) / 2)
    footer(c, 3, TOTAL, foot); c.showPage()

    # ---------------- 4 · MARKET ----------------
    kicker(c, "03 · Market" if E else "03 · Mercato", H - 24 * mm)
    title(c, "A country-sized segment the incumbents can't reach down to." if E
          else "Un segmento grande quanto un paese, fuori portata per gli incumbent.", H - 37 * mm, size=24)
    y = table(c, [
        ["", ("Size" if E else "Dimensione"), ("Definition" if E else "Definizione")],
        ["TAM", "5.2M",
         ("household businesses required to keep books from 2026 (General Statistics Office)" if E
          else "imprese familiari obbligate ai libri dal 2026 (Ufficio Statistico Generale)")],
        ["SAM", "~1.8M",
         ("smartphone-active, revenue 200M–3B VND — where the duty is real and the ability isn't" if E
          else "smartphone-attive, ricavi 200M–3B VND — dove l'obbligo è reale e la capacità no")],
        [("SOM (Y3)" if E else "SOM (A3)"), "40,000",
         ("~2.2% of SAM, built district by district from Hồ Chí Minh City outward" if E
          else "~2,2% del SAM, costruito distretto per distretto a partire da Hồ Chí Minh")],
    ], [95, 110, 475], MARG, H - 47 * mm)
    bullets(c, [
        ("<b>Two customer shapes, one engine.</b> Online sellers on Shopee and TikTok, whose tax is withheld at "
         "source and who need reconciliation; and street retail — eateries, kiosks, market stalls — who need the "
         "book itself." if E
         else "<b>Due forme di cliente, un solo motore.</b> Venditori online su Shopee e TikTok, con ritenuta alla "
              "fonte e bisogno di riconciliazione; e retail di strada — trattorie, chioschi, bancarelle — che hanno "
              "bisogno del libro in sé."),
        ("<b>Vietnam is not the ceiling.</b> The same shock — informal micro-business pulled into a declarative tax "
         "regime — is scheduled or under way across South-East Asia. The engine is not Vietnam-specific; the "
         "distribution is." if E
         else "<b>Il Vietnam non è il tetto.</b> Lo stesso shock — la micro-impresa informale trascinata in un regime "
              "dichiarativo — è previsto o in corso in tutto il Sud-Est asiatico. Il motore non è specifico del "
              "Vietnam; la distribuzione sì."),
    ], MARG, y - 10 * mm, W - 2 * MARG)
    footer(c, 4, TOTAL, foot); c.showPage()

    # ---------------- 5 · WHAT IS ALREADY TRUE ----------------
    kicker(c, "04 · Status" if E else "04 · Stato", H - 24 * mm)
    title(c, "This is not a deck about something we intend to build." if E
          else "Questo non è un deck su qualcosa che intendiamo costruire.", H - 37 * mm, size=24)
    subtitle(c, "Every line below is checkable by you, today, without our help." if E
             else "Ogni riga qui sotto è verificabile da voi, oggi, senza il nostro aiuto.", H - 46 * mm)
    stat_cards(c, [
        ("LIVE", "product in production" if E else "prodotto in produzione"),
        ("VERIFIED", "Zalo Official Account" if E else "Zalo Official Account"),
        (".com.vn", "domain held by the company" if E else "dominio della società"),
        ("01/CNKD", "declaration auto-drafted" if E else "dichiarazione auto-redatta"),
    ], MARG, H - 54 * mm, (W - 2 * MARG - 3 * 14) / 4, 24 * mm, big_size=19)
    y = table(c, [
        [("Claim" if E else "Affermazione"), ("How to check it yourself" if E else "Come verificarlo da soli")],
        [("The product exists and runs" if E else "Il prodotto esiste e funziona"),
         "sosach.com.vn — " + ("open it; the sample book, the score and the declaration draft are all live" if E
                               else "apritelo; libro campione, punteggio e bozza di dichiarazione sono live")],
        [("The Zalo channel is open" if E else "Il canale Zalo è aperto"),
         ("Search the Official Account <b>Sổ Sạch - Sosachcomvn</b> in Zalo — verified badge, in production" if E
          else "Cercate l'Official Account <b>Sổ Sạch - Sosachcomvn</b> su Zalo — badge verificato, in produzione")],
        [("The company is real and Vietnamese" if E else "La società è reale e vietnamita"),
         ("CÔNG TY TNHH OFFICINE GẶP, enterprise code 0316904153 — public register, Hồ Chí Minh City" if E
          else "CÔNG TY TNHH OFFICINE GẶP, codice impresa 0316904153 — registro pubblico, Hồ Chí Minh")],
        [("The domain is ours, not rented" if E else "Il dominio è nostro, non affittato"),
         ("tracuutenmien.gov.vn — VNNIC registry lookup names the company as registrant" if E
          else "tracuutenmien.gov.vn — il registro VNNIC indica la società come titolare")],
    ], [190, 490], MARG, H - 88 * mm)
    from reportlab.platypus import Paragraph
    c.setFillColor(CARTA_DK); c.roundRect(MARG, y - 40 * mm, W - 2 * MARG, 26 * mm, 10, stroke=0, fill=1)
    c.setFillColor(GOLD); c.setFont("SS-Sans-Bold", 10)
    c.drawString(MARG + 16, y - 21 * mm, "WHAT IS NOT YET TRUE" if E else "CIÒ CHE NON È ANCORA VERO")
    p3 = Paragraph(
        "No paying customers yet. We have a verified channel, a working product and a legal deadline pushing "
        "5.2 million businesses toward it — and zero revenue. The paid pilot is the next milestone and it is "
        "precisely what this round funds. We would rather you heard that from us on slide five than found it "
        "on your own in diligence." if E else
        "Nessun cliente pagante, ancora. Abbiamo un canale verificato, un prodotto funzionante e una scadenza "
        "di legge che ci spinge contro 5,2 milioni di imprese — e ricavi zero. Il pilota a pagamento è la "
        "prossima milestone ed è esattamente ciò che questo round finanzia. Preferiamo ve lo diciamo noi alla "
        "slide cinque, piuttosto che lo troviate da soli in due diligence.", st_small)
    _, ph3 = p3.wrap(W - 2 * MARG - 32, 100); p3.drawOn(c, MARG + 16, y - 24 * mm - ph3)
    footer(c, 5, TOTAL, foot); c.showPage()

    # ---------------- 6 · WHY IT IS HARD TO COPY ----------------
    kicker(c, "05 · Defensibility" if E else "05 · Difendibilità", H - 24 * mm)
    title(c, "The hard part was never the software." if E
          else "La parte difficile non è mai stata il software.", H - 37 * mm)
    bullets(c, [
        ("<b>A verified Zalo Official Account is a licence, not a signup.</b> It took four review rounds, a "
         "wet-signed and sealed corporate filing, and a Vietnamese company that owns its own domain. A foreign "
         "team cannot obtain one quickly, and without one there is no channel to these customers at all." if E
         else "<b>Un Zalo Official Account verificato è una licenza, non un'iscrizione.</b> Sono serviti quattro "
              "round di revisione, un atto societario firmato a mano e timbrato, e una società vietnamita "
              "proprietaria del proprio dominio. Un team straniero non lo ottiene in fretta, e senza non esiste "
              "alcun canale verso questi clienti."),
        ("<b>Distribution runs through people, not ads.</b> These customers are not reachable by performance "
         "marketing. They are reachable by the person who already does their paperwork — and that relationship "
         "is built, not bought." if E
         else "<b>La distribuzione passa dalle persone, non dagli annunci.</b> Questi clienti non si raggiungono "
              "con il performance marketing. Si raggiungono tramite chi già si occupa delle loro pratiche — e quel "
              "rapporto si costruisce, non si compra."),
        ("<b>The book compounds into something a lender wants.</b> A subscription list is worth its subscriptions. "
         "A structured, provenance-tagged record of how tens of thousands of micro-businesses actually trade is "
         "worth considerably more, to counterparties who are not us." if E
         else "<b>Il libro si accumula in qualcosa che interessa a chi presta denaro.</b> Una lista di abbonati vale "
              "i suoi abbonamenti. Un registro strutturato e tracciato per provenienza di come decine di migliaia di "
              "micro-imprese commerciano davvero vale molto di più, per controparti che non siamo noi."),
        ("<b>Compliance posture, never 'tax optimisation'.</b> We compute what the law prescribes and defer to a "
         "licensed tax agent. In a regulated market that is the only position that survives contact with the "
         "authorities." if E
         else "<b>Postura di compliance, mai 'ottimizzazione fiscale'.</b> Calcoliamo ciò che la legge prescrive e "
              "rimandiamo al professionista abilitato. In un mercato regolato è l'unica posizione che sopravvive al "
              "contatto con le autorità."),
    ], MARG, H - 48 * mm, W - 2 * MARG)
    footer(c, 6, TOTAL, foot); c.showPage()

    # ---------------- 7 · THE ASK ----------------
    kicker(c, "06 · The ask" if E else "06 · La richiesta", H - 24 * mm)
    title(c, "$300,000 to turn a working product into a paying one." if E
          else "300.000 $ per far incassare un prodotto che già funziona.", H - 37 * mm, size=24)
    stat_cards(c, [
        ("$300k", "seed — SAFE or priced" if E else "seed — SAFE o priced"),
        ("18 " + ("months" if E else "mesi"), "runway to Series-A metrics" if E else "runway a metriche Series-A"),
        ("100", "paid pilot households" if E else "hộ pilota paganti"),
        ("$1.6M", "ARR target, year 3" if E else "ARR obiettivo, anno 3"),
    ], MARG, H - 46 * mm, (W - 2 * MARG - 3 * 14) / 4, 26 * mm)
    y = table(c, [
        [("Where it goes" if E else "Dove va"), ("Why" if E else "Perché")],
        [("Paid pilot &amp; the agent channel" if E else "Pilota pagante e canale agenti"),
         ("100 households in two districts, recruited through licensed tax agents — the one experiment that "
          "decides whether this is a business" if E
          else "100 imprese in due distretti, reclutate tramite đại lý thuế abilitati — l'unico esperimento che "
               "decide se questa è un'azienda")],
        [("Product &amp; correctness" if E else "Prodotto e correttezza"),
         ("a bookkeeping product is a correctness product; the engineering spend is on being right, not on features" if E
          else "un prodotto di contabilità è un prodotto di correttezza; la spesa tecnica è sull'essere esatti, non sulle funzioni")],
        [("Vietnamese ground team" if E else "Squadra vietnamita a terra"),
         ("support and agent relationships in the customer's own language, in the customer's own district" if E
          else "assistenza e rapporti con gli agenti nella lingua del cliente, nel distretto del cliente")],
    ], [230, 450], MARG, H - 80 * mm)
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.platypus import Paragraph as _P
    st_lead = ParagraphStyle("lead", fontName="SS-Sans-Bold", fontSize=11.5, leading=16, textColor=GIADA)
    p4 = _P("We are not pitching a hockey stick. The plan is 40,000 subscribers at under $4 a month, against a "
            "free incumbent — and we will show you why we think that is the honest number." if E
            else "Non stiamo vendendo una crescita a bastone da hockey. Il piano è 40.000 abbonati sotto i 4 $ al "
                 "mese, contro un incumbent gratuito — e vi mostreremo perché riteniamo sia il numero onesto.", st_lead)
    _, ph4 = p4.wrap(W - 2 * MARG, 120); p4.drawOn(c, MARG, y - 12 * mm - ph4)
    footer(c, 7, TOTAL, foot); c.showPage()

    # ---------------- 8 · WHAT IS BEHIND THE NDA ----------------
    dark_page(c)
    c.setFillColor(GOLD_LT); c.setFont("SS-Sans-Bold", 11)
    c.drawString(MARG, H - 26 * mm, "07 · NEXT STEP" if E else "07 · PROSSIMO PASSO")
    c.setFillColor(WHITE); c.setFont("SS-Serif-Bold", 34)
    c.drawString(MARG, H - 42 * mm, "What sits behind the NDA" if E else "Cosa c'è dietro l'NDA")
    c.setFillColor(MINT); c.setFont("SS-Sans", 12)
    c.drawString(MARG, H - 52 * mm,
                 "A one-page mutual-respect document, signable the same day. Then you get all of this:" if E
                 else "Un documento di una pagina, firmabile in giornata. Poi ricevete tutto questo:")

    cw2 = (W - 2 * MARG - 16) / 2
    dark_card(c, MARG, H - 62 * mm, cw2, 40 * mm,
              "THE ECONOMICS" if E else "LE ECONOMICS",
              (["Unit economics per subscriber: COGS, gross margin,",
                "CAC by channel, payback period, LTV.",
                "Three-year model with every assumption stated.",
                "The tax-agent channel economics — including the",
                "uncomfortably small number at pilot scale."]
               if E else
               ["Economics unitarie per abbonato: COGS, margine,",
                "CAC per canale, payback, LTV.",
                "Modello a tre anni con ogni assunzione esplicita.",
                "Le economics del canale agenti — compreso il",
                "numero scomodamente piccolo alla scala pilota."]))
    dark_card(c, MARG + cw2 + 16, H - 62 * mm, cw2, 40 * mm,
              "THE MACHINERY" if E else "IL MECCANISMO",
              (["How the Zalo barrier was actually cleared, and why",
                "it is a moat rather than an anecdote.",
                "The credit-readiness score and the provenance model",
                "that turns a ledger into an underwritable file.",
                "Risks, and the kill criteria we have committed to."]
               if E else
               ["Come la barriera Zalo è stata davvero superata, e",
                "perché è un fossato e non un aneddoto.",
                "Il punteggio di affidabilità e il modello di provenienza",
                "che rende un libro un dossier istruibile.",
                "Rischi, e i criteri di stop che ci siamo dati."]))

    c.setFillColor(GOLD_LT); c.setFont("SS-Sans-Bold", 13)
    c.drawString(MARG, 62 * mm, "Yuri Frassi — founder" if E else "Yuri Frassi — fondatore")
    c.setFillColor(MINT); c.setFont("SS-Sans", 11)
    c.drawString(MARG, 54 * mm, "yuri@officinegap.com · sosach.com.vn")
    c.drawString(MARG, 47 * mm, "CÔNG TY TNHH OFFICINE GẶP · 384 Hoàng Diệu, Phường Khánh Hội, Hồ Chí Minh City")
    c.setFillColor(GOLD); c.setFont("SS-Sans-It", 9.5)
    c.drawString(MARG, 34 * mm,
                 "Nothing in this teaser is confidential. Nothing in it is enough to build this without us." if E
                 else "Nulla in questo teaser è riservato. Nulla in esso basta a costruire tutto questo senza di noi.")
    c.showPage()
    c.save()
    print("wrote", out)


if __name__ == "__main__":
    build("en", "SoSach_Teaser_PreNDA_EN.pdf")
    build("it", "SoSach_Teaser_PreNDA_IT.pdf")
