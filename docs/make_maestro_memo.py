# ============================================================================
#  Sổ Sạch — Investment Memorandum for Maestro Equity Partners (EN + IT).
#  Same giada/gold reportlab theme + Vietnamese-capable system fonts as the BP.
#  Regenerate: python3 make_maestro_memo.py
# ============================================================================
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.platypus import (BaseDocTemplate, Frame, PageTemplate, Paragraph,
                                Spacer, Table, TableStyle, PageBreak)
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

_SUP = "/System/Library/Fonts/Supplemental"
pdfmetrics.registerFont(TTFont("SS-Sans", f"{_SUP}/Arial.ttf"))
pdfmetrics.registerFont(TTFont("SS-Sans-Bold", f"{_SUP}/Arial Bold.ttf"))
pdfmetrics.registerFont(TTFont("SS-Serif-Bold", f"{_SUP}/Times New Roman Bold.ttf"))

GIADA_INK = HexColor("#0b3d2e"); GOLD = HexColor("#c8922a")
CARTA = HexColor("#f7f5ef"); CARTA_DK = HexColor("#eee9dd")
INK = HexColor("#20241f"); MUTED = HexColor("#5f6a5f"); BORDER = HexColor("#d8d2c2")

st_body = ParagraphStyle("body", fontName="SS-Sans", fontSize=9.6, leading=14, textColor=INK)
st_small = ParagraphStyle("small", parent=st_body, fontSize=8.4, leading=12, textColor=MUTED)
st_h1 = ParagraphStyle("h1", fontName="SS-Serif-Bold", fontSize=21, leading=25, textColor=GIADA_INK, spaceAfter=4)
st_kick = ParagraphStyle("kick", fontName="SS-Sans-Bold", fontSize=8.6, leading=11, textColor=GOLD)
st_cell = ParagraphStyle("cell", parent=st_body, fontSize=8.8, leading=12)
st_cellb = ParagraphStyle("cellb", parent=st_cell, fontName="SS-Sans-Bold")
st_cellw = ParagraphStyle("cellw", parent=st_cell, fontName="SS-Sans-Bold", textColor=HexColor("#ffffff"))
st_quote = ParagraphStyle("quote", parent=st_body, fontSize=10.6, leading=16, textColor=GIADA_INK)

def table(data, widths, header=True):
    rows = [[Paragraph(c, st_cellw if (header and i == 0) else (st_cellb if j == 0 else st_cell))
             for j, c in enumerate(r)] for i, r in enumerate(data)]
    t = Table(rows, colWidths=widths, repeatRows=1 if header else 0)
    style = [("GRID", (0, 0), (-1, -1), 0.5, BORDER), ("VALIGN", (0, 0), (-1, -1), "TOP"),
             ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
             ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
             ("ROWBACKGROUNDS", (0, 1 if header else 0), (-1, -1), [None, CARTA_DK])]
    if header: style.append(("BACKGROUND", (0, 0), (-1, 0), GIADA_INK))
    t.setStyle(TableStyle(style))
    return t

def note_box(text):
    t = Table([[Paragraph(text, st_quote)]], colWidths=[465])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), CARTA_DK),
                           ("LINEBEFORE", (0, 0), (0, -1), 3, GOLD),
                           ("TOPPADDING", (0, 0), (-1, -1), 10), ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                           ("LEFTPADDING", (0, 0), (-1, -1), 12), ("RIGHTPADDING", (0, 0), (-1, -1), 12)]))
    return t

def bullets(items):
    # ● renders in Arial; fancier glyphs (◆ ✓ ✗) come out as empty boxes.
    return [Paragraph(f'<font color="#c8922a">●</font>&nbsp;&nbsp;{x}', st_body) for x in items]

def build(lang, out):
    E = lang == "en"
    def sec(n, t):
        s.append(Spacer(1, 14))
        s.append(Paragraph(n, st_kick))
        s.append(Paragraph(t, st_h1))
        s.append(Spacer(1, 4))

    doc = BaseDocTemplate(out, pagesize=A4,
                          leftMargin=18*mm, rightMargin=18*mm, topMargin=20*mm, bottomMargin=16*mm,
                          title="Sổ Sạch — Investment Memorandum (Maestro Equity Partners)")
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="f")
    def deco(canv, _doc):
        canv.saveState()
        canv.setFillColor(GIADA_INK); canv.rect(0, A4[1]-12*mm, A4[0], 12*mm, stroke=0, fill=1)
        canv.setFillColor(HexColor("#e9c46a")); canv.setFont("SS-Sans-Bold", 8.5)
        canv.drawString(18*mm, A4[1]-8*mm, "Sổ Sạch")
        canv.setFillColor(HexColor("#cfe0d6")); canv.setFont("SS-Sans", 8)
        canv.drawRightString(A4[0]-18*mm, A4[1]-8*mm,
                             "Investment Memorandum · Maestro Equity Partners" if E else
                             "Memorandum d'Investimento · Maestro Equity Partners")
        canv.setFillColor(MUTED); canv.setFont("SS-Sans", 7.6)
        canv.drawString(18*mm, 9*mm, "Private & confidential — prepared for Maestro Equity Partners · July 2026")
        canv.drawRightString(A4[0]-18*mm, 9*mm, str(canv.getPageNumber()))
        canv.restoreState()
    doc.addPageTemplates([PageTemplate(id="p", frames=[frame], onPage=deco)])

    s = []
    # ---- Cover block ----
    s.append(Spacer(1, 8))
    s.append(Paragraph("INVESTMENT MEMORANDUM" if E else "MEMORANDUM D'INVESTIMENTO", st_kick))
    s.append(Paragraph("Sổ Sạch", ParagraphStyle("t", parent=st_h1, fontSize=34, leading=38)))
    s.append(Paragraph(
        "The AI bookkeeper on Zalo for Vietnam's 5.2 million household businesses — live product, "
        "regulatory tailwind, asking $300k." if E else
        "Il commercialista AI su Zalo per i 5,2 milioni di hộ kinh doanh del Vietnam — prodotto live, "
        "vento regolatorio a favore, richiesta $300k.", st_quote))
    s.append(Spacer(1, 10))
    s.append(note_box(
        "<b>Why you are reading this now.</b> On 01/01/2026 Vietnam abolished lump-sum (khoán) taxation: "
        "5.2 million household businesses must keep books and self-declare, most for the first time in "
        "their lives. The first mandatory quarterly filing fell on 30/04/2026; the next wave of "
        "obligations (platform seller verification, Law 122/2025) lands 01/07/2026. Compliance shocks of "
        "this size create category winners. Sổ Sạch is our bid to be that winner — and unlike a deck, "
        "it is already live, in Vietnamese, at <b>so-sach.onrender.com</b>." if E else
        "<b>Perché state leggendo questo adesso.</b> Il 01/01/2026 il Vietnam ha abolito la tassazione "
        "forfettaria (khoán): 5,2 milioni di hộ kinh doanh devono tenere i libri e autodichiarare, per lo "
        "più per la prima volta nella vita. Il primo deposito trimestrale obbligatorio è scaduto il "
        "30/04/2026; la prossima ondata di obblighi (verifica dei venditori online, Legge 122/2025) arriva "
        "il 01/07/2026. Shock di compliance di questa scala creano i vincitori di categoria. Sổ Sạch è la "
        "nostra candidatura — e a differenza di un deck, è già live, in vietnamita, su "
        "<b>so-sach.onrender.com</b>."))

    # ---- 01 The problem/opportunity ----
    sec("01", "The Forced-Demand Event" if E else "L'Evento di Domanda Forzata")
    s.extend(bullets([
        ("<b>5.2M household businesses</b> (hộ kinh doanh) lose the flat-tax shortcut and must record "
         "income and expenses — a population larger than all Italian partite IVA, digitising in one year." if E else
         "<b>5,2M di hộ kinh doanh</b> perdono il forfettario e devono registrare entrate e uscite — una "
         "popolazione più grande di tutte le partite IVA italiane, digitalizzata in un anno."),
        ("<b>They are not accountants.</b> A VCCI survey found 73% report difficulties from lack of "
         "technological knowledge; 49% worry about cost and time. The incumbent tools (MISA, KiotViet, "
         "Sapo) speak accountant; the vendor speaks Zalo." if E else
         "<b>Non sono contabili.</b> Un'indagine VCCI rileva che il 73% dichiara difficoltà per mancanza "
         "di competenze tecnologiche; il 49% teme costi e tempo. Gli strumenti incumbent (MISA, KiotViet, "
         "Sapo) parlano da contabile; il venditore parla Zalo."),
        ("<b>Zalo is the rail:</b> ~78M monthly users, the default messaging surface of Vietnamese "
         "commerce. Sổ Sạch lives there — receipt photo in, ledger entry out, declaration pre-filled." if E else
         "<b>Zalo è il binario:</b> ~78M di utenti mensili, la superficie di messaggistica di default del "
         "commercio vietnamita. Sổ Sạch vive lì — foto dello scontrino in ingresso, voce a libro in "
         "uscita, dichiarazione precompilata."),
        ("<b>Two segments, one product:</b> street retail needs the ledger and the thresholds; online "
         "sellers (tax now withheld at source by Shopee/TikTok) need reconciliation and refund paperwork "
         "— the same engine serves both." if E else
         "<b>Due segmenti, un prodotto:</b> il retail di strada ha bisogno del libro e delle soglie; i "
         "venditori online (ritenuta alla fonte da Shopee/TikTok) di riconciliazione e pratiche di "
         "rimborso — lo stesso motore serve entrambi."),
    ]))

    # ---- 02 Product, live ----
    sec("02", "The Product — Live Today" if E else "Il Prodotto — Live Oggi")
    s.append(table([
        [("Capability" if E else "Funzionalità"), ("Status" if E else "Stato")],
        [("Receipt photo → AI extraction → confirmed ledger entry (Claude vision; deterministic demo "
          "fallback)" if E else "Foto scontrino → estrazione AI → voce confermata a libro (visione Claude; "
          "fallback demo deterministico)"), "LIVE"],
        [("Tax thresholds engine (500M taxable / 1B e-invoice, Circular 40/2021 rates) with plain-language "
          "warnings" if E else "Motore soglie fiscali (500M imponibile / 1B e-fattura, aliquote Circolare "
          "40/2021) con avvisi in linguaggio semplice"), "LIVE"],
        [("Pre-filled quarterly declaration 01/CNKD + print/PDF + Excel export" if E else
          "Dichiarazione trimestrale 01/CNKD precompilata + stampa/PDF + export Excel"), "LIVE"],
        [("Accounts (phone+PIN), household & tax-agent roles, 30-day pilot subscriptions" if E else
          "Account (telefono+PIN), ruoli hộ e đại lý thuế, abbonamenti pilota 30 giorni"), "LIVE"],
        [("Đại lý thuế (tax-agent) dashboard: invite code, client roster, per-client books & quarterly "
          "tax — the reseller channel is IN the product" if E else
          "Cruscotto đại lý thuế: codice invito, portafoglio clienti, libri per cliente e imposte "
          "trimestrali — il canale di rivendita è NEL prodotto"), "LIVE"],
        [("Zalo OA chat bot (webhook + signature verification)" if E else
          "Bot chat Zalo OA (webhook + verifica firma)"), ("LIVE (keys pending)" if E else "LIVE (chiavi in arrivo)")],
        [("VietQR billing via payOS — code shipped, flips on with merchant keys" if E else
          "Incassi VietQR via payOS — codice pronto, si attiva con le chiavi merchant"), ("READY" if E else "PRONTO")],
        [("Postgres persistence — flips on with DATABASE_URL" if E else
          "Persistenza Postgres — si attiva con DATABASE_URL"), ("READY" if E else "PRONTO")],
        [("Zalo Mini App (zero-install distribution inside Zalo)" if E else
          "Zalo Mini App (distribuzione zero-install dentro Zalo)"), ("Q3 2026" if E else "Q3 2026")],
    ], [345, 120]))
    s.append(Spacer(1, 6))
    s.append(Paragraph(
        "Founder execution proof: eight live products shipped solo with AI leverage in 2026 (marketplaces, "
        "SaaS, logistics routing) — this team ships in days, not quarters." if E else
        "Prova di esecuzione del founder: otto prodotti live lanciati in solo con leva AI nel 2026 "
        "(marketplace, SaaS, routing logistico) — questo team rilascia in giorni, non trimestri.", st_small))

    # ---- 03 Business model ----
    sec("03", "Business Model & Unit Economics" if E else "Modello di Business e Unit Economics")
    s.append(table([
        [("Stream" if E else "Linea"), ("Price" if E else "Prezzo"), ("Notes" if E else "Note")],
        [("Core subscription" if E else "Abbonamento core"), "69,000 VND/mo (~$2.7)",
         ("Photo ledger, thresholds, declaration draft. Priced for a street vendor — deliberately under "
          "the incumbents." if E else "Libro fotografico, soglie, bozza dichiarazione. Prezzo da bancarella "
          "— deliberatamente sotto gli incumbent.")],
        ["Pro", "149,000 VND/mo (~$5.9)",
         ("Multi-location, exports, e-invoice issuance via partner API." if E else
          "Multi-sede, export, emissione e-fattura via API partner.")],
        [("Tax-agent channel" if E else "Canale đại lý thuế"), ("30% rev-share" if E else "30% rev-share"),
         ("Agents manage 20–200 clients on our dashboard; the trust channel becomes distribution." if E else
          "Gli agenti gestiscono 20–200 clienti sul nostro cruscotto; il canale di fiducia diventa "
          "distribuzione.")],
    ], [130, 115, 220]))
    s.append(Spacer(1, 6))
    s.append(Paragraph(
        "COGS ≈ $0.2–0.4/user/month (AI vision on ~150 receipts). Payments in VND via the founder's "
        "licensed Vietnamese entity (MoMo/ZaloPay/VietQR) — no western processor needed. Gross margin "
        ">85% at scale." if E else
        "COGS ≈ $0,2–0,4/utente/mese (visione AI su ~150 scontrini). Incassi in VND tramite la società "
        "vietnamita del founder (MoMo/ZaloPay/VietQR) — nessun processore occidentale. Margine lordo >85% "
        "a scala.", st_small))

    # ---- 04 Why we win / competition ----
    sec("04", "Why Sổ Sạch Wins" if E else "Perché Vince Sổ Sạch")
    s.extend(bullets([
        ("<b>MISA gives its software away free to 2M households — and that is fine.</b> Free generic tools "
         "still speak accountant. Our wedge is language, channel and the agent network: vendor-plain "
         "Vietnamese, inside Zalo, sold by the đại lý thuế the vendor already trusts (and pays)." if E else
         "<b>MISA regala il software a 2M di famiglie — e va bene così.</b> Gli strumenti gratuiti generici "
         "parlano ancora da contabile. Il nostro wedge è lingua, canale e rete agenti: vietnamita da "
         "bancarella, dentro Zalo, venduto dal đại lý thuế di cui il venditore già si fida (e che già paga)."),
        ("<b>The agent dashboard is the moat.</b> Every agent who runs 50 clients on Sổ Sạch has switching "
         "costs; every client the agent adds strengthens the channel. Software alone is copyable — a "
         "reseller network with revenue share is not." if E else
         "<b>Il cruscotto agenti è il fossato.</b> Ogni agente con 50 clienti su Sổ Sạch ha costi di "
         "switching; ogni cliente aggiunto rafforza il canale. Il software da solo si copia — una rete di "
         "rivendita con revenue share no."),
        ("<b>Compliance positioning, not 'tax optimization'.</b> We compute the presumptive rates the law "
         "prescribes and disclaim professional advice — the defensible posture in a regulated space (and a "
         "deliberate contrast to competing pitches that promise optimisation schemes)." if E else
         "<b>Posizionamento compliance, non 'ottimizzazione fiscale'.</b> Calcoliamo le aliquote "
         "presuntive che la legge prescrive e rimandiamo al professionista — la postura difendibile in uno "
         "spazio regolato (contrasto deliberato con pitch concorrenti che promettono schemi di "
         "ottimizzazione)."),
        ("<b>Viral by artefact:</b> every shared declaration, receipt confirmation and monthly summary "
         "carries the mark — the customer's own paperwork recruits the next customer." if E else
         "<b>Virale per artefatto:</b> ogni dichiarazione condivisa, conferma di ricevuta e riepilogo "
         "mensile porta il marchio — la burocrazia del cliente recluta il cliente successivo."),
    ]))

    # ---- 05 Financial plan ----
    sec("05", "Financial Plan (Illustrative, Assumption-Led)" if E else "Piano Finanziario (Illustrativo)")
    s.append(table([
        ["", "Y1 (2027)", "Y2 (2028)", "Y3 (2029)"],
        [("Subscribers (paying)" if E else "Abbonati (paganti)"), "2,000", "12,000", "40,000"],
        ["ARR", "$70k", "$450k", "$1.6M"],
        ["EBITDA", "−$90k", "+$60k", "+$520k"],
        [("Gross margin" if E else "Margine lordo"), "85%", "87%", "88%"],
    ], [150, 105, 105, 105]))
    s.append(Spacer(1, 6))
    s.append(Paragraph(
        "Assumptions we will defend in the room: blended ARPU ~$3.3/mo; CAC <$4 through agents and market-"
        "street flyers; churn 3.5%/mo year-1 falling to 2% (quarterly deadlines re-activate lapsed users). "
        "We deliberately reject the hockey-stick versions of this market (200k MAU in 18 months at $7 ARPU "
        "against a free incumbent): our curve is channel-built, not hoped." if E else
        "Assunzioni che difenderemo in sala: ARPU medio ~$3,3/mese; CAC <$4 via agenti e volantini nei "
        "mercati; churn 3,5%/mese nel primo anno che scende al 2% (le scadenze trimestrali riattivano gli "
        "utenti persi). Rifiutiamo deliberatamente le versioni hockey-stick di questo mercato (200k MAU in "
        "18 mesi a $7 di ARPU contro un incumbent gratuito): la nostra curva è costruita sul canale, non "
        "sperata.", st_small))

    # ---- 06 The ask ----
    sec("06", "The Ask" if E else "La Richiesta")
    s.append(note_box(
        "<b>$300,000 for 18 months of runway</b> — SAFE or priced seed, terms open to discussion. "
        "Milestones: 100-household paid pilot (Q3 2026) → 2,000 subscribers + 25 active agents (mid-2027) "
        "→ Series-A-ready or profitable." if E else
        "<b>$300.000 per 18 mesi di runway</b> — SAFE o seed priced, termini da discutere. Milestone: "
        "pilota pagante da 100 hộ (Q3 2026) → 2.000 abbonati + 25 agenti attivi (metà 2027) → pronti per "
        "il Series A o profittevoli."))
    s.append(Spacer(1, 8))
    s.append(table([
        [("Use of funds" if E else "Impiego fondi"), ("Amount" if E else "Importo"), "%"],
        [("Product & AI ops (Zalo Mini App, agent tooling, e-invoice API)" if E else
          "Prodotto e AI ops (Zalo Mini App, strumenti agenti, API e-fattura)"), "$120k", "40%"],
        [("Agent network & field GTM (HCMC → southern provinces)" if E else
          "Rete agenti e GTM sul campo (HCMC → province del sud)"), "$100k", "33%"],
        [("Compliance & legal (licensed tax counsel, data residency)" if E else
          "Compliance e legale (fiscalista abilitato, residenza dati)"), "$40k", "13%"],
        [("Buffer" if E else "Riserva"), "$40k", "13%"],
    ], [305, 105, 55]))

    # ---- 07 Exit ----
    sec("07", "Exit Paths" if E else "Percorsi di Exit")
    s.extend(bullets([
        ("<b>Strategic consolidation:</b> MISA, Citigo/KiotViet, Sapo buying the micro-merchant funnel "
         "they structurally miss. SME-SaaS comparables 4–6× ARR → $6–10M at Y3 scale." if E else
         "<b>Consolidamento strategico:</b> MISA, Citigo/KiotViet, Sapo comprano il funnel di micro-"
         "esercenti che strutturalmente gli manca. Comparabili SME-SaaS 4–6× ARR → $6–10M alla scala Y3."),
        ("<b>Fintech acquisition:</b> a verified longitudinal ledger on tens of thousands of micro-"
         "merchants is the underwriting layer MoMo, VNPay and banks lack for merchant cash advance and "
         "working-capital credit — the data asset is worth more than the subscriptions to the right buyer." if E else
         "<b>Acquisizione fintech:</b> un libro verificato e longitudinale su decine di migliaia di micro-"
         "esercenti è il layer di underwriting che manca a MoMo, VNPay e alle banche per anticipi di cassa "
         "e credito al circolante — per il compratore giusto il data asset vale più degli abbonamenti."),
        ("<b>VNG/Zalo itself:</b> we build engagement and commerce data on their rail; a natural tuck-in." if E else
         "<b>La stessa VNG/Zalo:</b> costruiamo engagement e dati commerciali sul loro binario; un tuck-in "
         "naturale."),
    ]))

    # ---- 08 Risks & honesty ----
    sec("08", "Risks, Stated Plainly" if E else "Rischi, Detti Chiaramente")
    s.extend(bullets([
        ("<b>Free incumbents:</b> MISA's free tier could improve its UX. Our answer: the agent channel and "
         "Zalo-native workflow; we sell hand-holding, not software licenses." if E else
         "<b>Incumbent gratuiti:</b> il piano gratuito di MISA potrebbe migliorare la UX. La risposta: "
         "canale agenti e flusso Zalo-nativo; vendiamo accompagnamento, non licenze."),
        ("<b>Regulatory drift:</b> thresholds and rates move (they moved twice in 2025-26). Our tax engine "
         "is parameterised and validated with licensed tax agents before commercial claims." if E else
         "<b>Deriva regolatoria:</b> soglie e aliquote si muovono (due volte nel 2025-26). Il motore "
         "fiscale è parametrico e validato con đại lý thuế abilitati prima di ogni claim commerciale."),
        ("<b>Kill criteria (we commit to them):</b> pilot week-4 retention <25% or agents unwilling to "
         "resell at 30% → the wedge is wrong; we pivot to agent-only tooling and return remaining capital "
         "discipline to the cap table conversation." if E else
         "<b>Criteri di stop (ci impegniamo):</b> retention settimana-4 del pilota <25% o agenti non "
         "disposti a rivendere al 30% → il wedge è sbagliato; pivot su strumenti solo-agenti e disciplina "
         "sul capitale residuo al tavolo dei soci."),
        ("<b>Platform dependence:</b> Zalo API terms can change; the web app and agent dashboard run "
         "independently of Zalo as structural hedge." if E else
         "<b>Dipendenza da piattaforma:</b> i termini API di Zalo possono cambiare; web app e cruscotto "
         "agenti funzionano indipendentemente da Zalo come copertura strutturale."),
    ]))

    # ---- 09 Process ----
    sec("09", "Diligence Process We Propose" if E else "Processo di Due Diligence Proposto")
    s.extend(bullets([
        ("<b>Meeting 1 (this memo):</b> market, model, live demo at so-sach.onrender.com — try the agent "
         "flow yourself with a test account." if E else
         "<b>Incontro 1 (questo memo):</b> mercato, modello, demo live su so-sach.onrender.com — provate "
         "voi stessi il flusso agente con un account di test."),
        ("<b>Meeting 2:</b> full financial model, cohort assumptions, pilot design and agent pipeline." if E else
         "<b>Incontro 2:</b> modello finanziario completo, assunzioni di coorte, disegno del pilota e "
         "pipeline agenti."),
        ("<b>Diligence:</b> under mutual NDA — codebase walkthrough, tax-engine parameters, extraction "
         "pipeline and infrastructure access. (High-level everything is shareable; the how stays gated "
         "until the MNDA — standard hygiene, applied symmetrically.)" if E else
         "<b>Diligence:</b> sotto NDA reciproco — walkthrough del codice, parametri del motore fiscale, "
         "pipeline di estrazione e accessi infrastruttura. (Tutto l'high-level è condivisibile; il come "
         "resta protetto fino all'MNDA — igiene standard, applicata simmetricamente.)"),
    ]))

    s.append(Spacer(1, 14))
    box = Table([[Paragraph(
        ("<b>Yuri Frassi</b> — Founder<br/>Licensed Vietnamese company (SaaS) · frassiyuri@gmail.com<br/>"
         "Live product: <b>so-sach.onrender.com</b> · Business plan and demo credentials on request.<br/>"
         "Figures marked illustrative are projections, not guarantees; tax parameters to be re-validated "
         "with a licensed đại lý thuế before commercial claims." if E else
         "<b>Yuri Frassi</b> — Founder<br/>Società vietnamita licenziataria (SaaS) · frassiyuri@gmail.com<br/>"
         "Prodotto live: <b>so-sach.onrender.com</b> · Business plan e credenziali demo su richiesta.<br/>"
         "I valori indicati come illustrativi sono proiezioni, non garanzie; parametri fiscali da "
         "rivalidare con un đại lý thuế abilitato prima di claim commerciali."), st_small)]],
        colWidths=[465])
    box.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), CARTA),
                             ("BOX", (0, 0), (-1, -1), 0.75, BORDER),
                             ("TOPPADDING", (0, 0), (-1, -1), 10), ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                             ("LEFTPADDING", (0, 0), (-1, -1), 12), ("RIGHTPADDING", (0, 0), (-1, -1), 12)]))
    s.append(box)

    doc.build(s)
    print("written:", out)

build("en", "SoSach_Maestro_Equity_Memo_EN.pdf")
build("it", "SoSach_Maestro_Equity_Memo_IT.pdf")
