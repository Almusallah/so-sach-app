#!/usr/bin/env python3
"""
SEA Ventures — master business plan (EN + IT): l'intero stack di opportunità
Vietnam/Thailandia sopra l'asset base dei 6 prodotti live.
"""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table,
    TableStyle, PageBreak, KeepTogether, NextPageTemplate,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

_SUP = "/System/Library/Fonts/Supplemental"
pdfmetrics.registerFont(TTFont("SV-Sans", f"{_SUP}/Arial.ttf"))
pdfmetrics.registerFont(TTFont("SV-Sans-Bold", f"{_SUP}/Arial Bold.ttf"))
pdfmetrics.registerFont(TTFont("SV-Serif-Bold", f"{_SUP}/Times New Roman Bold.ttf"))

INK = HexColor("#101c2c")
BLU = HexColor("#1e4a7a")
CARTA = HexColor("#f8f6f0")
CARTA_DK = HexColor("#ece7da")
ORO = HexColor("#d9a441")
GIADA = HexColor("#0f7a5a")
GREY = HexColor("#6b7280")
BORDER = HexColor("#e1dccb")
TXT = HexColor("#1c242e")

W, H = A4
OUT = os.path.dirname(os.path.abspath(__file__))

def S(name, **kw):
    base = dict(fontName="SV-Sans", fontSize=10, leading=15, textColor=TXT)
    base.update(kw)
    return ParagraphStyle(name, **base)

st_kicker = S("kicker", fontName="SV-Sans-Bold", fontSize=8.5, leading=12, textColor=BLU, spaceBefore=14, spaceAfter=2)
st_h1 = S("h1", fontName="SV-Serif-Bold", fontSize=20, leading=24, textColor=INK, spaceAfter=8)
st_h2 = S("h2", fontName="SV-Serif-Bold", fontSize=13.5, leading=17, textColor=BLU, spaceBefore=8, spaceAfter=4)
st_body = S("body", spaceAfter=6)
st_bullet = S("bullet", leftIndent=12, bulletIndent=2, spaceAfter=3)
st_small = S("small", fontSize=8.5, leading=12, textColor=GREY)
st_cell = S("cell", fontSize=8.8, leading=11.5)
st_cellb = S("cellb", fontName="SV-Sans-Bold", fontSize=8.8, leading=11.5)
st_cellw = S("cellw", fontName="SV-Sans-Bold", fontSize=8.8, leading=11.5, textColor=CARTA)

def bullets(items):
    return [Paragraph(f"<bullet>&bull;</bullet>{t}", st_bullet) for t in items]

def table(data, widths, header=True):
    rows = [[Paragraph(c, st_cellw if (header and i == 0) else (st_cellb if j == 0 else st_cell))
             for j, c in enumerate(r)] for i, r in enumerate(data)]
    t = Table(rows, colWidths=widths, repeatRows=1 if header else 0)
    style = [
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("ROWBACKGROUNDS", (0, 1 if header else 0), (-1, -1), [None, CARTA_DK]),
    ]
    if header:
        style.append(("BACKGROUND", (0, 0), (-1, 0), INK))
    t.setStyle(TableStyle(style))
    return t

def make_decorators(lang):
    conf = "Confidential — for investor use only" if lang == "en" else "Riservato — a uso esclusivo degli investitori"

    def cover(canv, doc):
        canv.saveState()
        canv.setFillColor(INK); canv.rect(0, 0, W, H, fill=1, stroke=0)
        canv.setFillColor(BLU); canv.rect(0, 0, W, H * 0.40, fill=1, stroke=0)
        canv.setFillColor(GIADA)
        p = canv.beginPath(); p.moveTo(0, H * 0.32)
        p.curveTo(W * 0.3, H * 0.42, W * 0.6, H * 0.28, W, H * 0.38)
        p.lineTo(W, 0); p.lineTo(0, 0); p.close(); canv.drawPath(p, fill=1, stroke=0)
        canv.setFillColor(ORO); canv.circle(W * 0.80, H * 0.74, 32, fill=1, stroke=0)
        canv.setFillColor(CARTA); canv.setFont("SV-Serif-Bold", 40)
        canv.drawString(24 * mm, H - 66 * mm, "SEA Ventures")
        canv.setFont("SV-Sans", 13); canv.setFillColor(ORO)
        canv.drawString(24 * mm, H - 76 * mm,
                        "Vietnam & Thailand playbook on a live 6-product stack" if lang == "en"
                        else "Il playbook Vietnam & Thailandia su uno stack di 6 prodotti live")
        canv.setFont("SV-Sans-Bold", 15); canv.setFillColor(CARTA)
        canv.drawString(24 * mm, H - 94 * mm, "Master Business Plan" if lang == "en" else "Piano Industriale Master")
        canv.setFont("SV-Sans", 10.5); canv.setFillColor(HexColor("#c7d2e2"))
        canv.drawString(24 * mm, H - 102 * mm,
                        "July 2026 · Operating entity: licensed Vietnamese company (SaaS)" if lang == "en"
                        else "Luglio 2026 · Entità operativa: società vietnamita licenziataria (SaaS)")
        canv.setFont("SV-Sans", 8.5)
        canv.drawString(24 * mm, 16 * mm, conf)
        canv.drawRightString(W - 24 * mm, 16 * mm, "Yuri Frassi · frassiyuri@gmail.com")
        canv.restoreState()

    def page(canv, doc):
        canv.saveState()
        canv.setFillColor(CARTA); canv.rect(0, 0, W, H, fill=1, stroke=0)
        canv.setFillColor(INK); canv.rect(0, H - 14 * mm, W, 14 * mm, fill=1, stroke=0)
        canv.setFillColor(ORO); canv.setFont("SV-Serif-Bold", 12)
        canv.drawString(20 * mm, H - 9.5 * mm, "SEA Ventures")
        canv.setFillColor(HexColor("#c7d2e2")); canv.setFont("SV-Sans", 8)
        canv.drawRightString(W - 20 * mm, H - 9.5 * mm, "Master Plan · 2026")
        canv.setFillColor(GREY); canv.setFont("SV-Sans", 8)
        canv.drawString(20 * mm, 11 * mm, conf)
        canv.drawRightString(W - 20 * mm, 11 * mm, str(canv.getPageNumber()))
        canv.setStrokeColor(BORDER); canv.line(20 * mm, 15 * mm, W - 20 * mm, 15 * mm)
        canv.restoreState()

    return cover, page

def build(lang, filename):
    cover, page = make_decorators(lang)
    doc = BaseDocTemplate(os.path.join(OUT, filename), pagesize=A4,
                          leftMargin=20 * mm, rightMargin=20 * mm,
                          topMargin=22 * mm, bottomMargin=20 * mm,
                          title="SEA Ventures — Master Plan", author="Yuri Frassi")
    frame = Frame(20 * mm, 20 * mm, W - 40 * mm, H - 42 * mm, id="main")
    doc.addPageTemplates([
        PageTemplate(id="cover", frames=[Frame(0, 0, W, H)], onPage=cover),
        PageTemplate(id="page", frames=[frame], onPage=page),
    ])
    E = lang == "en"
    s = [Spacer(1, 1), NextPageTemplate("page"), PageBreak()]

    def sec(k, t):
        s.append(Paragraph(k, st_kicker)); s.append(Paragraph(t, st_h1))

    # 01 Thesis
    sec("01", "Thesis & Why Now" if E else "Tesi e Perché Ora")
    s.append(Paragraph(
        ("Southeast Asia's front office is digitized — QR payments reach street stalls, Zalo/LINE reach "
         "~80% of their populations, e-commerce GMV grows double-digit ($39B Vietnam, $56B Thailand in "
         "2025). The back office is not. Meanwhile Vietnam has created a regulatory forcing function "
         "(khoán abolition + e-invoice mandate) that pushes 5.2M micro-businesses into bookkeeping in a "
         "single year. We enter with three unfair advantages: (1) a licensed Vietnamese company already "
         "able to sell SaaS locally; (2) a proven AI stack — six live products whose engines (email triage, "
         "receipt extraction, carrier routing, registry+map, compliance-by-code) port directly; (3) "
         "founder presence between HCMC and the Gulf.") if E else
        ("Il front office del Sud-Est asiatico è digitalizzato — i pagamenti QR arrivano alle bancarelle, "
         "Zalo/LINE raggiungono ~80% delle popolazioni, il GMV e-commerce cresce a doppia cifra ($39 mld "
         "Vietnam, $56 mld Thailandia nel 2025). Il back office no. Intanto il Vietnam ha creato un forcing "
         "regolatorio (abolizione khoán + obbligo e-fattura) che spinge 5,2M di micro-imprese alla "
         "contabilità in un solo anno. Entriamo con tre vantaggi: (1) una società vietnamita licenziataria "
         "già abilitata a vendere SaaS; (2) uno stack AI provato — sei prodotti live i cui motori (triage "
         "email, estrazione scontrini, routing corrieri, registro+mappa, compliance-by-code) si portano "
         "direttamente; (3) presenza del founder tra HCMC e il Golfo."), st_body))

    # 02 Asset base
    sec("02", "The Asset Base (all live)" if E else "L'Asset Base (tutto live)")
    s.append(table([
        [("Product" if E else "Prodotto"), ("Engine it contributes" if E else "Motore che contribuisce"), "URL"],
        ["Sổ Sạch", ("receipt→ledger→tax pipeline, Zalo bot" if E else "pipeline scontrino→libro→fisco, bot Zalo"), "so-sach.onrender.com"],
        ["NINE2FIVE", ("email triage, carry-forward, drafts; MoR checkout" if E else "triage email, riporto, bozze; checkout MoR"), "jarvis-app-pzfc.onrender.com"],
        ["Grapes", ("story-first marketplace, discovery map, registry" if E else "marketplace story-first, mappa scoperta, registro"), "grapes-pxsm.onrender.com"],
        ["Bottega", ("carrier-routing engine by zone/cold-chain" if E else "motore routing corrieri per zona/freddo"), "bottega-zah4.onrender.com"],
        ["Chiavi / Stanza", ("compliance-by-code playbook" if E else "playbook compliance-by-code"), "chiavi.onrender.com"],
    ], [95, 285, 135]))

    # 03 Portfolio of plays
    sec("03", "The Portfolio of Plays" if E else "Il Portafoglio di Scommesse")
    s.append(table([
        [("Play" if E else "Scommessa"), ("Market" if E else "Mercato"), ("Price" if E else "Prezzo"),
         ("Status" if E else "Stato"), ("Y3 ARR" if E else "ARR Y3")],
        [("1 · Sổ Sạch — AI bookkeeper (LEAD)" if E else "1 · Sổ Sạch — kế toán AI (LEAD)"),
         "VN · 5.2M hộ", "69–149k VND/mo", ("LIVE + BP" if E else "LIVE + BP"), "$1.6M"],
        ["2 · NINE2FIVE Expats", ("HCMC 200k+ / BKK 250-300k expats" if E else "HCMC 200k+ / BKK 250-300k expat"),
         "$10–15/mo", ("LIVE (checkout ready)" if E else "LIVE (checkout pronto)"), "$0.5M"],
        [("3 · Innkeeper — guesthouse copilot" if E else "3 · Innkeeper — copilot guesthouse"),
         ("TH boutique hotels/tour ops" if E else "TH boutique hotel/tour op"), "THB 990–1,990/mo",
         ("spec (port of #2)" if E else "spec (port del n.2)"), "$0.6M"],
        [("4 · Routing engine B2B license" if E else "4 · Licenza B2B motore routing"),
         ("VN D2C brands (GHTK/GHN/Viettel)" if E else "brand D2C VN (GHTK/GHN/Viettel)"), "1.5M VND/mo",
         ("engine live (Bottega)" if E else "motore live (Bottega)"), "$0.3M"],
        [("5 · Làng Nghề / OTOP Direct" if E else "5 · Làng Nghề / OTOP Direct"),
         ("VN craft villages · TH OTOP" if E else "villaggi artigiani VN · OTOP TH"), ("8–12% take" if E else "take 8–12%"),
         ("LATER — file MoIT early" if E else "DOPO — registrazione MoIT subito"), "$0 (Y4+)"],
    ], [150, 130, 80, 90, 65]))
    s.append(Spacer(1, 4))
    s.append(Paragraph(
        ("Traps we will not walk into: consumer marketplaces against Shopee/TikTok Shop (97% of VN GMV), "
         "food delivery (25–30% commissions, subsidy war), street-food POS in Thailand (LINE MAN Wongnai: "
         "500k of 700k restaurants), and direct ports of Italian legal constructs (Chiavi/Stanza products)." if E else
        "Trappole in cui non entreremo: marketplace consumer contro Shopee/TikTok Shop (97% del GMV VN), "
        "food delivery (commissioni 25–30%, guerra di sussidi), POS street-food in Thailandia (LINE MAN "
        "Wongnai: 500k dei 700k ristoranti), e porting diretti di costruzioni giuridiche italiane "
        "(prodotti Chiavi/Stanza)."), st_small))

    # 04 Play details
    sec("04", "Play-by-Play" if E else "Scommessa per Scommessa")
    s.append(Paragraph("1 · Sổ Sạch (VN) — LEAD", st_h2))
    s.append(Paragraph(
        ("Full plan in the dedicated document (SoSach_Business_Plan). Wedge: 100-household pilot via 3–5 "
         "tax agents in HCMC; $300k ask; Y3 $1.6M ARR at >85% margin. Riskiest assumption: households pay "
         "anything rather than lean on a relative — tested with 200 QR flyers for <$500." if E else
        "Piano completo nel documento dedicato (SoSach_Piano_Industriale). Wedge: pilota da 100 hộ via 3–5 "
        "đại lý thuế a HCMC; richiesta $300k; Y3 $1,6M ARR con margine >85%. Assunzione più rischiosa: gli "
        "hộ pagano qualcosa invece di appoggiarsi a un parente — testata con 200 volantini QR per <$500."), st_body))

    s.append(Paragraph("2 · NINE2FIVE — HCMC/Bangkok internationals", st_h2))
    s.extend(bullets([
        ("<b>Who:</b> founders, agency directors, consultants, senior expats — Gmail-native, card-paying. "
         "CAC near zero via chambers (EuroCham/BritCham), coworking (Dreamplex, True Digital Park), "
         "founder communities." if E else
         "<b>Chi:</b> founder, direttori d'agenzia, consulenti, expat senior — nativi Gmail, pagano con "
         "carta. CAC quasi zero via camere di commercio (EuroCham/BritCham), coworking (Dreamplex, True "
         "Digital Park), community di founder."),
        ("<b>90 days:</b> 20 design partners from own network → 'Vietnam/Thailand layer' (visa & TRC "
         "deadlines, local-holiday awareness in the brief) → 150 paying. Checkout already shipped (MoR)." if E else
         "<b>90 giorni:</b> 20 design partner dalla rete personale → 'strato Vietnam/Thailandia' (scadenze "
         "visto/TRC, festività locali nel brief) → 150 paganti. Checkout già consegnato (MoR)."),
        ("<b>Riskiest assumption:</b> strangers connect Gmail read-only to a new brand → $200 ad test "
         "measuring OAuth completion, not clicks." if E else
         "<b>Assunzione più rischiosa:</b> sconosciuti collegano Gmail in sola lettura a un brand nuovo → "
         "test ads da $200 misurando i completamenti OAuth, non i click."),
    ]))

    s.append(Paragraph(("3 · Innkeeper — Thailand guesthouse/tour-operator copilot" if E else
                        "3 · Innkeeper — copilot guesthouse/tour operator (Thailandia)"), st_h2))
    s.extend(bullets([
        ("<b>What:</b> the NINE2FIVE engine pointed at a property's Gmail + LINE OA: OTA emails parsed into "
         "a unified calendar, guest replies drafted EN/TH, a daily owner brief. PMS vendors ignore LINE; "
         "this rides it." if E else
         "<b>Cosa:</b> il motore NINE2FIVE puntato su Gmail + LINE OA della struttura: email OTA parse in "
         "un calendario unificato, risposte agli ospiti in bozza EN/TH, brief quotidiano al proprietario. "
         "I PMS ignorano LINE; questo lo cavalca."),
        ("<b>Wedge & entity:</b> 10 Chiang Mai guesthouses via hotelier groups; THB 990–1,990/mo; sold "
         "cross-border from the VN entity — Thai VES registration only above THB 1.8M B2C/yr; PDPA local "
         "representative appointed at scale." if E else
         "<b>Wedge ed entità:</b> 10 guesthouse a Chiang Mai via gruppi di albergatori; THB 990–1.990/mese; "
         "venduto cross-border dall'entità VN — registrazione VES thailandese solo sopra THB 1,8M B2C/anno; "
         "rappresentante PDPA locale quando si scala."),
        ("<b>90 days:</b> LINE-connected pilot, charge from day one; the OTA-parser reuses Sổ Sạch's "
         "extraction pipeline." if E else
         "<b>90 giorni:</b> pilota collegato a LINE, a pagamento dal giorno uno; il parser OTA riusa la "
         "pipeline di estrazione di Sổ Sạch."),
    ]))

    s.append(Paragraph(("4 · Carrier-routing engine — B2B license (VN)" if E else
                        "4 · Motore routing corrieri — licenza B2B (VN)"), st_h2))
    s.extend(bullets([
        ("<b>What:</b> Bottega's routing engine mapped to GHTK/GHN/Viettel Post/J&amp;T: white-label routing + "
         "story-first storefront for specialty D2C brands (coffee, Đà Lạt produce). Never run the "
         "marketplace — license the picks." if E else
         "<b>Cosa:</b> il motore di routing di Bottega mappato su GHTK/GHN/Viettel Post/J&amp;T: routing "
         "white-label + vetrina story-first per brand D2C specialty (caffè, ortofrutta di Đà Lạt). Mai "
         "gestire il marketplace — si licenzia la scelta del corriere."),
        ("<b>Proof for <$500:</b> re-price one roaster's last 100 shipments across couriers; show the % "
         "saved. 90 days: courier API map + 3 design-partner roasters + a 'which courier wins per "
         "province' lead-gen report." if E else
         "<b>Prova a <$500:</b> riprezzare le ultime 100 spedizioni di un torrefattore su tutti i "
         "corrieri; mostrare il % risparmiato. 90 giorni: mappa API corrieri + 3 torrefattori design "
         "partner + report lead-gen 'quale corriere vince per provincia'."),
    ]))

    s.append(Paragraph(("5 · Làng Nghề / OTOP Direct — the patient play" if E else
                        "5 · Làng Nghề / OTOP Direct — la scommessa paziente"), st_h2))
    s.append(Paragraph(
        ("Grapes/Bottega playbook on craft villages (17,068 OCOP products, 9,195 makers) and Thai OTOP: "
         "story-first, direct-from-maker, routing-powered. Gated by Vietnam's MoIT platform registration "
         "(Decree 52/85 — months) and Thailand's ETDA/DPS notification — start filings early, launch as a "
         "curated catalog (not a platform) to stay under thresholds while validating demand. No UGC "
         "features anywhere (Decree 147 licensing trap)." if E else
        "Il playbook Grapes/Bottega sui villaggi artigiani (17.068 prodotti OCOP, 9.195 produttori) e "
        "sull'OTOP thailandese: story-first, diretto-dal-produttore, con routing. Vincolata dalla "
        "registrazione piattaforme MoIT (Decreto 52/85 — mesi) e dalla notifica ETDA/DPS thailandese — "
        "avviare le pratiche subito, lanciare come catalogo curato (non 'piattaforma') per restare sotto "
        "le soglie mentre si valida la domanda. Nessuna funzione UGC ovunque (trappola licenze Decreto "
        "147)."), st_body))

    # 05 Sequencing + numbers
    sec("05", "Sequencing & Consolidated Numbers" if E else "Sequenza e Numeri Consolidati")
    s.append(table([
        [("Quarter" if E else "Trimestre"), ("Milestones" if E else "Traguardi")],
        ["Q3 2026", ("Sổ Sạch pilot (100 hộ) · NINE2FIVE founding 100 via MoR · flyer & OAuth tests" if E else
                     "Pilota Sổ Sạch (100 hộ) · 100 founding NINE2FIVE via MoR · test volantini e OAuth")],
        ["Q4 2026", ("Sổ Sạch agent dashboard · Innkeeper pilot (10 guesthouses) · routing re-pricing proof" if E else
                     "Cruscotto agenti Sổ Sạch · pilota Innkeeper (10 guesthouse) · prova re-pricing routing")],
        ["2027", ("Sổ Sạch 2k subs · NINE2FIVE 1k · Innkeeper 150 properties · 3 routing licensees · MoIT filed" if E else
                  "Sổ Sạch 2k abbonati · NINE2FIVE 1k · Innkeeper 150 strutture · 3 licenze routing · pratica MoIT")],
        ["2028–29", ("Provinces + agent network · OTOP/Làng Nghề launch if filings cleared · consolidated ~$3M ARR" if E else
                     "Province + rete agenti · lancio OTOP/Làng Nghề a pratiche ottenute · ~$3M ARR consolidato")],
    ], [70, 445]))
    s.append(Spacer(1, 6))
    s.append(table([
        ["", "Y1 (2027)", "Y2 (2028)", "Y3 (2029)"],
        [("Consolidated ARR" if E else "ARR consolidato"), "$0.25M", "$1.1M", "$3.0M"],
        [("Gross margin" if E else "Margine lordo"), "82%", "85%", "86%"],
        [("EBITDA" if E else "EBITDA"), "−$180k", "+$90k", "+$900k"],
        [("Headcount" if E else "Organico"), "4", "9", "18"],
    ], [150, 105, 105, 105]))
    s.append(Paragraph(
        ("Sum of play-level projections with 20% haircut for focus cost. Illustrative, not a guarantee." if E else
         "Somma delle proiezioni per scommessa con haircut del 20% per costo di focalizzazione. Valori "
         "illustrativi, non una garanzia."), st_small))

    # 06 Regulatory map
    sec("06", "Entity & Regulatory Map" if E else "Mappa Entità e Regolatoria")
    s.append(table([
        [("Topic" if E else "Tema"), ("Position" if E else "Posizione")],
        [("VN — selling SaaS" if E else "VN — vendita SaaS"),
         ("Local licensed company sells with 10% VAT + own e-invoices. Clean." if E else
          "La società locale licenziataria vende con IVA 10% ed e-fatture proprie. Pulito.")],
        [("VN — marketplace" if E else "VN — marketplace"),
         ("MoIT registration (Decree 52/85) required for third-party platforms — months of lead time." if E else
          "Registrazione MoIT (Decreto 52/85) per piattaforme terze — mesi di lead time.")],
        [("VN — UGC" if E else "VN — UGC"),
         ("Decree 147/2024: social features trigger licensing at 10k visits/mo — keep products transactional." if E else
          "Decreto 147/2024: funzioni social fanno scattare licenze a 10k visite/mese — prodotti solo transazionali.")],
        [("TH — cross-border SaaS" if E else "TH — SaaS cross-border"),
         ("Legal & lightweight: VES registration + 7% VAT only above THB 1.8M/yr B2C; B2B reverse-charged (15% WHT watch)." if E else
          "Legale e leggero: registrazione VES + IVA 7% solo sopra THB 1,8M/anno B2C; B2B in reverse charge (attenzione WHT 15%).")],
        [("TH — local ops" if E else "TH — operazioni locali"),
         ("FBA caps foreign ownership at 49% (services) unless BOI-promoted; PDPA local representative; ETDA/DPS for platforms." if E else
          "Il FBA limita la proprietà straniera al 49% (servizi) salvo promozione BOI; rappresentante PDPA; ETDA/DPS per le piattaforme.")],
    ], [110, 405]))

    # 07 Risks
    sec("07", "Risks & Kill Criteria" if E else "Rischi e Criteri di Stop")
    s.extend(bullets([
        ("<b>Willingness-to-pay (Sổ Sạch):</b> week-4 retention <25% or agents refuse 30% share → pivot to "
         "agent-only tooling." if E else
         "<b>Disponibilità a pagare (Sổ Sạch):</b> retention settimana-4 <25% o agenti che rifiutano il 30% "
         "→ pivot su strumenti solo-agenti."),
        ("<b>Trust barrier (NINE2FIVE):</b> OAuth completion <15% on warm traffic → double down on "
         "in-person/community onboarding, drop paid ads." if E else
         "<b>Barriera di fiducia (NINE2FIVE):</b> completamento OAuth <15% su traffico caldo → puntare su "
         "onboarding in presenza/community, stop alle ads."),
        ("<b>Regulatory drift:</b> thresholds and rates are env-configurable in code; quarterly legal "
         "review budgeted in every plan." if E else
         "<b>Deriva regolatoria:</b> soglie e aliquote sono configurabili via env nel codice; revisione "
         "legale trimestrale a budget in ogni piano."),
        ("<b>Founder bandwidth:</b> the sequencing above is serial by design — one launch per quarter, "
         "kill or scale before the next." if E else
         "<b>Banda del founder:</b> la sequenza sopra è seriale per disegno — un lancio a trimestre, kill "
         "o scala prima del successivo."),
    ]))

    # Contact
    s.append(Spacer(1, 12))
    box = Table([[Paragraph(
        ("<b>Contact</b><br/>Yuri Frassi — Founder · frassiyuri@gmail.com<br/>"
         "All six referenced products are live and demoable today. Market figures per cited 2024–26 "
         "sources (e-Conomy SEA, national press, official regulations); projections illustrative." if E else
         "<b>Contatti</b><br/>Yuri Frassi — Founder · frassiyuri@gmail.com<br/>"
         "Tutti e sei i prodotti citati sono live e dimostrabili oggi. Dati di mercato da fonti 2024–26 "
         "citate (e-Conomy SEA, stampa nazionale, norme ufficiali); proiezioni illustrative."), st_body)]],
        colWidths=[515])
    box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CARTA_DK),
        ("BOX", (0, 0), (-1, -1), 1, ORO),
        ("TOPPADDING", (0, 0), (-1, -1), 10), ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
    ]))
    s.append(KeepTogether(box))

    doc.build(s)
    return os.path.join(OUT, filename)

if __name__ == "__main__":
    for lang, fname in [("en", "SEA_Ventures_Master_Plan_EN.pdf"),
                        ("it", "SEA_Ventures_Piano_Master_IT.pdf")]:
        print("written:", build(lang, fname))
