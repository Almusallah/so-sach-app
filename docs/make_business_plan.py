#!/usr/bin/env python3
"""
Sổ Sạch — Investor Business Plan generator (EN + IT).
Brand: giada (VN green) / oro / carta calda.
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

GIADA_INK = HexColor("#073527")
GIADA = HexColor("#0f7a5a")
GIADA_DK = HexColor("#0a5540")
CARTA = HexColor("#f9f7f1")
CARTA_DK = HexColor("#efeadd")
ORO = HexColor("#d9a441")
ZALO = HexColor("#0a6cff")
GREY = HexColor("#6a7570")
BORDER = HexColor("#e2ddcd")
TXT = HexColor("#1d2a24")

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

_SUP = "/System/Library/Fonts/Supplemental"
pdfmetrics.registerFont(TTFont("SS-Sans", f"{_SUP}/Arial.ttf"))
pdfmetrics.registerFont(TTFont("SS-Sans-Bold", f"{_SUP}/Arial Bold.ttf"))
pdfmetrics.registerFont(TTFont("SS-Serif-Bold", f"{_SUP}/Times New Roman Bold.ttf"))

W, H = A4
OUT = os.path.dirname(os.path.abspath(__file__))

def S(name, **kw):
    base = dict(fontName="SS-Sans", fontSize=10, leading=15, textColor=TXT)
    base.update(kw)
    return ParagraphStyle(name, **base)

st_kicker = S("kicker", fontName="SS-Sans-Bold", fontSize=8.5, leading=12, textColor=GIADA, spaceBefore=14, spaceAfter=2)
st_h1 = S("h1", fontName="SS-Serif-Bold", fontSize=20, leading=24, textColor=GIADA_INK, spaceAfter=8)
st_body = S("body", spaceAfter=6)
st_bullet = S("bullet", leftIndent=12, bulletIndent=2, spaceAfter=3)
st_small = S("small", fontSize=8.5, leading=12, textColor=GREY)
st_cell = S("cell", fontSize=9, leading=12)
st_cellb = S("cellb", fontName="SS-Sans-Bold", fontSize=9, leading=12)
st_cellw = S("cellw", fontName="SS-Sans-Bold", fontSize=9, leading=12, textColor=CARTA)

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
        ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("ROWBACKGROUNDS", (0, 1 if header else 0), (-1, -1), [None, CARTA_DK]),
    ]
    if header:
        style.append(("BACKGROUND", (0, 0), (-1, 0), GIADA_INK))
    t.setStyle(TableStyle(style))
    return t

def make_decorators(lang):
    conf = "Confidential — for investor use only" if lang == "en" else "Riservato — a uso esclusivo degli investitori"

    def cover(canv, doc):
        canv.saveState()
        canv.setFillColor(GIADA_INK); canv.rect(0, 0, W, H, fill=1, stroke=0)
        canv.setFillColor(GIADA_DK); canv.rect(0, 0, W, H * 0.42, fill=1, stroke=0)
        canv.setFillColor(GIADA)
        p = canv.beginPath(); p.moveTo(0, H * 0.34)
        p.curveTo(W * 0.3, H * 0.44, W * 0.6, H * 0.30, W, H * 0.40)
        p.lineTo(W, 0); p.lineTo(0, 0); p.close(); canv.drawPath(p, fill=1, stroke=0)
        canv.setFillColor(ORO); canv.circle(W * 0.78, H * 0.72, 34, fill=1, stroke=0)
        # icona libro
        canv.setFillColor(ORO)
        canv.roundRect(24 * mm, H - 50 * mm, 18 * mm, 13 * mm, 2 * mm, fill=0, stroke=1)
        canv.setLineWidth(1.2); canv.setStrokeColor(ORO)
        canv.line(33 * mm, H - 50 * mm, 33 * mm, H - 37 * mm)
        canv.setFillColor(CARTA); canv.setFont("SS-Serif-Bold", 42)
        canv.drawString(24 * mm, H - 70 * mm, "Sổ Sạch" if lang == "it" else "So Sach")
        canv.setFont("SS-Sans", 13); canv.setFillColor(ORO)
        tag = ("Snap the receipt. The books do themselves." if lang == "en"
               else "Fotografa la fattura. Il libro si compila da solo.")
        canv.drawString(24 * mm, H - 80 * mm, tag)
        canv.setFont("SS-Sans", 10.5); canv.setFillColor(HexColor("#cfe0d5"))
        canv.drawString(24 * mm, H - 88 * mm, "AI bookkeeper on Zalo — Vietnam's 5.2M household businesses"
                        if lang == "en" else "Kế toán AI trên Zalo — 5,2 milioni di hộ kinh doanh in Vietnam")
        canv.setFont("SS-Sans-Bold", 15); canv.setFillColor(CARTA)
        canv.drawString(24 * mm, H - 104 * mm, "Business Plan" if lang == "en" else "Piano Industriale")
        canv.setFont("SS-Sans", 10.5); canv.setFillColor(HexColor("#cfe0d5"))
        canv.drawString(24 * mm, H - 112 * mm, "July 2026 · Pre-seed" if lang == "en" else "Luglio 2026 · Pre-seed")
        canv.setFont("SS-Sans", 8.5)
        canv.drawString(24 * mm, 16 * mm, conf)
        canv.drawRightString(W - 24 * mm, 16 * mm, "so-sach.onrender.com — LIVE")
        canv.restoreState()

    def page(canv, doc):
        canv.saveState()
        canv.setFillColor(CARTA); canv.rect(0, 0, W, H, fill=1, stroke=0)
        canv.setFillColor(GIADA_INK); canv.rect(0, H - 14 * mm, W, 14 * mm, fill=1, stroke=0)
        canv.setFillColor(ORO); canv.setFont("SS-Serif-Bold", 12)
        canv.drawString(20 * mm, H - 9.5 * mm, "Sổ Sạch")
        canv.setFillColor(HexColor("#cfe0d5")); canv.setFont("SS-Sans", 8)
        canv.drawRightString(W - 20 * mm, H - 9.5 * mm, "Business Plan · 2026" if lang == "en" else "Piano Industriale · 2026")
        canv.setFillColor(GREY); canv.setFont("SS-Sans", 8)
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
                          title="So Sach — Business Plan", author="Yuri Frassi")
    frame = Frame(20 * mm, 20 * mm, W - 40 * mm, H - 42 * mm, id="main")
    doc.addPageTemplates([
        PageTemplate(id="cover", frames=[Frame(0, 0, W, H)], onPage=cover),
        PageTemplate(id="page", frames=[frame], onPage=page),
    ])
    E = lang == "en"
    s = [Spacer(1, 1), NextPageTemplate("page"), PageBreak()]

    def sec(k, t):
        s.append(Paragraph(k, st_kicker)); s.append(Paragraph(t, st_h1))

    # 01 Executive summary
    sec("01", "Executive Summary" if E else "Sintesi Esecutiva")
    s.append(Paragraph(
        ("Vietnam has manufactured a once-in-a-decade compliance shock: from 1 January 2026 the lump-sum "
         "(khoán) tax regime is abolished and ~5.2 million household businesses (hộ kinh doanh) must keep "
         "books and self-declare — first quarterly filing due 30 April 2026. Since June 2025, businesses "
         "above 1B VND revenue must also issue e-invoices from tax-connected cash registers (Decree 70/2025). "
         "Incumbent software (MISA, KiotViet, Sapo) records transactions; nobody explains and files in the "
         "language of a street vendor. Sổ Sạch does: photograph a receipt in Zalo — Vietnam's default app "
         "with ~80M monthly users — and the AI writes the ledger, watches the tax thresholds and pre-fills "
         "the quarterly declaration (form 01/CNKD).") if E else
        ("Il Vietnam ha fabbricato lo shock di compliance del decennio: dal 1° gennaio 2026 il regime "
         "forfettario (khoán) è abolito e ~5,2 milioni di imprese familiari (hộ kinh doanh) devono tenere i "
         "libri e autodichiarare — prima scadenza trimestrale il 30 aprile 2026. Da giugno 2025, sopra 1 "
         "miliardo di VND di ricavi è inoltre obbligatoria l'e-fattura da registratore di cassa collegato al "
         "fisco (Decreto 70/2025). I software incumbent (MISA, KiotViet, Sapo) registrano le transazioni; "
         "nessuno spiega e dichiara nella lingua di un venditore di strada. Sổ Sạch sì: fotografi lo "
         "scontrino in Zalo — l'app di default del Vietnam, ~80M di utenti mensili — e l'AI compila il "
         "libro, sorveglia le soglie fiscali e precompila la dichiarazione trimestrale (mod. 01/CNKD)."), st_body))
    s.extend(bullets([
        ("<b>Product LIVE today</b> at so-sach.onrender.com: photo→ledger→thresholds→declaration, "
         "Zalo OA bot ready (env-gated), Vietnamese-first UI." if E else
         "<b>Prodotto già LIVE</b> su so-sach.onrender.com: foto→libro→soglie→dichiarazione, bot Zalo OA "
         "pronto (attivabile via env), interfaccia vietnamita-first."),
        ("<b>Model:</b> 69,000 VND/month (~$2.7) consumer-simple SaaS + 30% reseller share to tax agents; "
         "COGS pennies per user (Haiku vision) → >85% gross margin." if E else
         "<b>Modello:</b> SaaS semplice da 69.000 VND/mese (~$2,7) + 30% ai rivenditori (đại lý thuế); "
         "COGS di centesimi per utente (visione Haiku) → margine lordo >85%."),
        ("<b>Founder edge:</b> licensed Vietnamese company (SaaS sales) already operating; e-invoice "
         "issuance is a first-party obligation we live ourselves." if E else
         "<b>Vantaggio del founder:</b> società vietnamita licenziataria (vendita SaaS) già operativa; "
         "l'e-fattura è un obbligo che viviamo in prima persona."),
        ("<b>Ask:</b> $300k pre-seed for 18 months: 12,000 subscribers and the tax-agent reseller network." if E else
         "<b>Richiesta:</b> $300k pre-seed per 18 mesi: 12.000 abbonati e la rete di rivendita dei đại lý thuế."),
    ]))

    # 02 Problem
    sec("02", "The Problem" if E else "Il Problema")
    s.extend(bullets([
        ("<b>A forced march, not a choice.</b> Millions of micro-businesses that never kept a ledger must now "
         "produce quarterly declarations. State media reports persistent confusion; the tax authority itself "
         "urged simpler software." if E else
         "<b>Una marcia forzata, non una scelta.</b> Milioni di micro-imprese che non hanno mai tenuto un "
         "libro devono ora produrre dichiarazioni trimestrali. La stampa di Stato riporta confusione "
         "persistente; la stessa agenzia fiscale ha invocato software più semplici."),
        ("<b>The tools speak accountant, not vendor.</b> MISA/KiotViet/Sapo assume double-entry literacy, "
         "desktop workflows and 160–600k VND price points designed for shops with staff." if E else
         "<b>Gli strumenti parlano da contabile, non da venditore.</b> MISA/KiotViet/Sapo presuppongono "
         "alfabetizzazione contabile, flussi desktop e prezzi 160–600k VND pensati per negozi con personale."),
        ("<b>The trusted channel is a cousin with a calculator.</b> Tax agents (đại lý thuế) are drowning in "
         "new mandates — they need leverage, not competition." if E else
         "<b>Il canale di fiducia è un cugino con la calcolatrice.</b> I đại lý thuế stanno annegando nei "
         "nuovi mandati — hanno bisogno di leva, non di concorrenza."),
    ]))

    # 03 Solution
    sec("03", "The Solution" if E else "La Soluzione")
    s.extend(bullets([
        ("<b>Zalo-native.</b> No new app, no password: follow the OA, send a photo. The bot replies with the "
         "recorded entry; 'sổ' returns the running summary." if E else
         "<b>Nativo Zalo.</b> Nessuna nuova app, nessuna password: segui l'OA, mandi una foto. Il bot "
         "risponde con la voce registrata; \"sổ\" restituisce il riepilogo."),
        ("<b>Threshold radar.</b> Live bars toward the 500M taxable threshold and the 1B e-invoice mandate, "
         "with plain-language alerts before crossing." if E else
         "<b>Radar delle soglie.</b> Barre live verso la soglia di tassabilità (500M) e l'obbligo e-fattura "
         "(1 mld), con avvisi in linguaggio semplice prima del superamento."),
        ("<b>Declaration, pre-filled.</b> Form 01/CNKD (Circular 40/2021) with the correct presumptive rates "
         "per business category, exemption logic, and a print/PDF view a tax agent can file." if E else
         "<b>Dichiarazione precompilata.</b> Mod. 01/CNKD (Circolare 40/2021) con le aliquote presuntive "
         "corrette per categoria, logica di esenzione e vista stampa/PDF che il đại lý thuế può depositare."),
        ("<b>Built to rent the moat.</b> E-invoice transmission stays with GDT-accredited providers — we "
         "integrate one (MISA/Viettel/VNPT) and sell the intelligence layer above." if E else
         "<b>Il fossato si affitta.</b> La trasmissione e-fattura resta ai provider accreditati GDT — ne "
         "integriamo uno (MISA/Viettel/VNPT) e vendiamo il livello di intelligenza sopra."),
    ]))

    # 04 Market
    sec("04", "Market" if E else "Mercato")
    s.append(table([
        ["", "Value" if E else "Valore", "Notes" if E else "Note"],
        ["TAM", "5.2M", ("household businesses forced into bookkeeping from 2026" if E else
                          "imprese familiari obbligate ai libri dal 2026")],
        ["SAM", "~1.8M", ("smartphone-active hộ with 200M–3B VND revenue (bookkeeping duty)" if E else
                          "hộ attivi su smartphone con ricavi 200M–3 mld VND (obbligo libri)")],
        ["SOM (Y3)", "40k subs", ("~2.2% of SAM via HCMC → southern provinces" if E else
                                  "~2,2% del SAM via HCMC → province del sud")],
    ], [70, 90, 355]))
    s.append(Spacer(1, 6))
    s.append(Paragraph(
        ("Context: Vietnam's digital economy reached ~$39B GMV in 2025; QR payments are ubiquitous down to "
         "street stalls (street-vendor QR usage +85% YoY). The rails exist — the back office doesn't." if E else
        "Contesto: l'economia digitale vietnamita ha toccato ~$39 mld di GMV nel 2025; i pagamenti QR sono "
        "ubiqui fino alle bancarelle (+85% l'uso tra i venditori di strada in un anno). I binari esistono — "
        "il back office no."), st_body))

    # 05 Business model
    sec("05", "Business Model" if E else "Modello di Business")
    s.append(table([
        [("Stream" if E else "Linea"), ("Mechanics" if E else "Meccanica"), ("Y3 share" if E else "Quota Y3")],
        [("Core subscription" if E else "Abbonamento core"),
         ("69k VND/mo — photo ledger, thresholds, declaration draft" if E else
          "69k VND/mese — libro fotografico, soglie, bozza dichiarazione"), "62%"],
        ["Pro 149k",
         ("multi-location, exports, e-invoice issuance via partner API" if E else
          "multi-sede, export, emissione e-fattura via API partner"), "23%"],
        [("Tax-agent tier" if E else "Canale đại lý thuế"),
         ("agent dashboard for 20–200 clients; 30% rev-share to the agent" if E else
          "cruscotto agente per 20–200 clienti; 30% di rev-share all'agente"), "15%"],
    ], [110, 285, 120]))
    s.append(Spacer(1, 6))
    s.append(Paragraph(
        ("Unit economics: COGS ≈ $0.2–0.4/user/month (Haiku vision on ~150 receipts). Payments via "
         "MoMo/ZaloPay/VietQR from the Vietnamese entity — no western MoR needed." if E else
        "Unit economics: COGS ≈ $0,2–0,4/utente/mese (visione Haiku su ~150 scontrini). Pagamenti via "
        "MoMo/ZaloPay/VietQR dall'entità vietnamita — nessun MoR occidentale necessario."), st_body))

    # 06 Competition
    sec("06", "Competitive Landscape" if E else "Panorama Competitivo")
    s.append(table([
        ["", ("Street-vendor language" if E else "Lingua da bancarella"), "Zalo-native",
         ("Explains & files" if E else "Spiega e dichiara"), ("Price fits hộ" if E else "Prezzo da hộ")],
        ["MISA / KiotViet / Sapo", "—", "≈", "—", "≈"],
        [("Tax agents (manual)" if E else "Đại lý thuế (manuale)"), "●", "≈", "●", "—"],
        [("Excel / notebook" if E else "Excel / quaderno"), "●", "—", "—", "●"],
        ["<b>Sổ Sạch</b>", "●", "●", "●", "●"],
    ], [105, 105, 80, 105, 90]))
    s.append(Spacer(1, 6))
    s.append(Paragraph(
        ("We don't compete with tax agents — we arm them. The reseller tier turns the incumbent trust channel "
         "into our distribution." if E else
        "Non competiamo con i đại lý thuế — li armiamo. Il canale di rivendita trasforma il canale di fiducia "
        "incumbente nella nostra distribuzione."), st_body))

    # 07 GTM
    sec("07", "Go-to-Market" if E else "Go-to-Market")
    s.extend(bullets([
        ("<b>Phase 1 (0–3 mo):</b> 100-household pilot in 2 HCMC districts via 3–5 tax-agent partners; "
         "200 QR flyers per market street; Zalo OA live." if E else
         "<b>Fase 1 (0–3 mesi):</b> pilota da 100 hộ in 2 distretti di HCMC via 3–5 đại lý thuế partner; "
         "200 volantini QR per strada di mercato; Zalo OA attivo."),
        ("<b>Phase 2 (3–9 mo):</b> quarterly-deadline campaigns (the product sells itself each filing "
         "season); agent dashboard; e-invoice partner API." if E else
         "<b>Fase 2 (3–9 mesi):</b> campagne sulle scadenze trimestrali (il prodotto si vende da solo a ogni "
         "stagione di deposito); cruscotto agenti; API partner e-fattura."),
        ("<b>Phase 3 (9–18 mo):</b> southern provinces via agent network; MoMo/ZaloPay bundles; "
         "'verified compliant vendor' public profile as the marketing hook." if E else
         "<b>Fase 3 (9–18 mesi):</b> province del sud via rete agenti; bundle MoMo/ZaloPay; profilo "
         "pubblico 'venditore in regola verificato' come gancio di marketing."),
    ]))

    # 08 Financials
    sec("08", "Financial Projections" if E else "Proiezioni Finanziarie")
    s.append(table([
        ["", "Y1 (2027)", "Y2 (2028)", "Y3 (2029)"],
        [("Subscribers" if E else "Abbonati"), "2,000", "12,000", "40,000"],
        ["ARR", "$70k", "$450k", "$1.6M"],
        [("Gross margin" if E else "Margine lordo"), "85%", "87%", "88%"],
        ["EBITDA", "−$90k", "+$60k", "+$520k"],
    ], [150, 105, 105, 105]))
    s.append(Spacer(1, 6))
    s.append(Paragraph(
        ("Assumptions: blended ARPU ~$3.3/mo incl. Pro and agent tiers; churn 3.5%/mo year-1 falling to 2% "
         "(deadline seasonality drives re-activation); CAC <$4 via agents and flyers. Illustrative, not a "
         "guarantee." if E else
        "Assunzioni: ARPU medio ~$3,3/mese inclusi Pro e canale agenti; churn 3,5%/mese nel primo anno che "
        "scende al 2% (la stagionalità delle scadenze guida la riattivazione); CAC <$4 via agenti e "
        "volantini. Valori illustrativi, non una garanzia."), st_small))

    # 09 Ask + exit
    sec("09", "The Ask & The Exit" if E else "Richiesta ed Exit")
    s.append(table([
        [("Use of funds ($300k, 18 mo)" if E else "Impiego fondi ($300k, 18 mesi)"), ("Amount" if E else "Importo"), "%"],
        [("Product & AI ops (Zalo mini-app, agent dashboard, e-invoice API)" if E else
          "Prodotto e AI ops (mini-app Zalo, cruscotto agenti, API e-fattura)"), "$120k", "40%"],
        [("Agent network & field GTM" if E else "Rete agenti e GTM sul campo"), "$100k", "33%"],
        [("Compliance/legal (tax counsel, data residency)" if E else
          "Compliance/legale (fiscalista, residenza dati)"), "$40k", "13%"],
        [("Buffer" if E else "Riserva"), "$40k", "13%"],
    ], [305, 105, 105]))
    s.append(Spacer(1, 8))
    s.extend(bullets([
        ("<b>Strategic buyers:</b> MISA, Citigo/KiotViet, Sapo (distribution into the segment they miss), "
         "MoMo/ZaloPay (SME services push), VNG/Zalo itself. SME-SaaS comparables 4–6× ARR → $6–10M outcome "
         "at Y3 scale." if E else
         "<b>Compratori strategici:</b> MISA, Citigo/KiotViet, Sapo (distribuzione nel segmento che gli "
         "manca), MoMo/ZaloPay (spinta sui servizi SME), la stessa VNG/Zalo. Comparabili SME-SaaS 4–6× ARR "
         "→ esito $6–10M alla scala Y3."),
        ("<b>Kill criteria (honest):</b> if pilot week-4 retention <25% or agents won't resell at 30%, the "
         "wedge is wrong — pivot to agent-only tooling." if E else
         "<b>Criteri di stop (onesti):</b> se la retention alla settimana 4 del pilota è <25% o gli agenti "
         "non rivendono al 30%, il wedge è sbagliato — pivot su strumenti solo-agenti."),
    ]))

    # Contact
    s.append(Spacer(1, 12))
    box = Table([[Paragraph(
        ("<b>Contact</b><br/>Yuri Frassi — Founder (licensed Vietnamese company, SaaS)<br/>"
         "frassiyuri@gmail.com · Live demo: so-sach.onrender.com<br/>"
         "Tax rates/thresholds encoded from cited regulations; to be validated with a licensed tax agent "
         "before commercial launch." if E else
         "<b>Contatti</b><br/>Yuri Frassi — Founder (società vietnamita licenziataria, SaaS)<br/>"
         "frassiyuri@gmail.com · Demo live: so-sach.onrender.com<br/>"
         "Aliquote e soglie codificate dalle norme citate; da validare con un đại lý thuế abilitato prima "
         "del lancio commerciale."), st_body)]], colWidths=[515])
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
    for lang, fname in [("en", "SoSach_Business_Plan_EN.pdf"),
                        ("it", "SoSach_Piano_Industriale_IT.pdf")]:
        print("written:", build(lang, fname))
