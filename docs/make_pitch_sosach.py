# ============================================================================
#  Sổ Sạch — investor PITCH DECK (landscape slides, EN + IT).
#  9 slides, giada/gold brand, Vietnamese-capable system fonts.
#  Regenerate: python3 make_pitch_sosach.py
# ============================================================================
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, Table, TableStyle

_SUP = "/System/Library/Fonts/Supplemental"
pdfmetrics.registerFont(TTFont("SS-Sans", f"{_SUP}/Arial.ttf"))
pdfmetrics.registerFont(TTFont("SS-Sans-Bold", f"{_SUP}/Arial Bold.ttf"))
pdfmetrics.registerFont(TTFont("SS-Serif-Bold", f"{_SUP}/Times New Roman Bold.ttf"))

PAGE = landscape(A4)  # 842 x 595 pt
W, H = PAGE
GIADA = HexColor("#0b3d2e"); GIADA_MID = HexColor("#14523e")
GOLD = HexColor("#c8922a"); GOLD_LT = HexColor("#e9c46a")
CARTA = HexColor("#f7f5ef"); CARTA_DK = HexColor("#eee9dd")
INK = HexColor("#20241f"); MUTED = HexColor("#5f6a5f"); BORDER = HexColor("#d8d2c2")
WHITE = HexColor("#ffffff"); MINT = HexColor("#cfe0d6")

st_cell  = ParagraphStyle("cell",  fontName="SS-Sans", fontSize=10.5, leading=14.5, textColor=INK)
st_cellb = ParagraphStyle("cellb", parent=st_cell, fontName="SS-Sans-Bold")
st_cellw = ParagraphStyle("cellw", parent=st_cellb, textColor=WHITE)
st_body  = ParagraphStyle("body",  fontName="SS-Sans", fontSize=12.5, leading=18, textColor=INK)
st_bodyw = ParagraphStyle("bodyw", parent=st_body, textColor=MINT)

MARG = 22 * mm

def chrome(c, idx, total, lang, dark=False):
    """Footer + slide number on light slides."""
    if dark: return
    c.setFillColor(MUTED); c.setFont("SS-Sans", 7.5)
    c.drawString(MARG, 10 * mm, "Sổ Sạch — investor pitch · Maestro Equity Partners · July 2026"
                 if lang == "en" else "Sổ Sạch — pitch investitori · Maestro Equity Partners · Luglio 2026")
    c.drawRightString(W - MARG, 10 * mm, f"{idx} / {total}")

def kicker(c, text, y, color=GOLD):
    c.setFillColor(color); c.setFont("SS-Sans-Bold", 10.5)
    c.drawString(MARG, y, text.upper())

def title(c, text, y, size=30, color=GIADA):
    c.setFillColor(color); c.setFont("SS-Serif-Bold", size)
    c.drawString(MARG, y, text)

def bullets(c, items, x, y, w, gap=8, style=st_body):
    for it in items:
        p = Paragraph(f'<font color="#c8922a">●</font>&nbsp;&nbsp;{it}', style)
        pw, ph = p.wrap(w, 400)
        y -= ph
        p.drawOn(c, x, y)
        y -= gap
    return y

def draw_table(c, data, widths, x, y, header=True, fs=None):
    rows = [[Paragraph(v, st_cellw if (header and i == 0) else (st_cellb if j == 0 else st_cell))
             for j, v in enumerate(r)] for i, r in enumerate(data)]
    t = Table(rows, colWidths=widths)
    sty = [("GRID", (0, 0), (-1, -1), 0.5, BORDER), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
           ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
           ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
           ("ROWBACKGROUNDS", (0, 1 if header else 0), (-1, -1), [WHITE, CARTA_DK])]
    if header: sty.append(("BACKGROUND", (0, 0), (-1, 0), GIADA))
    t.setStyle(TableStyle(sty))
    tw, th = t.wrap(sum(widths), H)
    t.drawOn(c, x, y - th)
    return y - th

def stat_cards(c, cards, x, y, cw, ch, gap=14):
    for i, (big, small) in enumerate(cards):
        cx = x + i * (cw + gap)
        c.setFillColor(CARTA_DK); c.roundRect(cx, y - ch, cw, ch, 8, stroke=0, fill=1)
        c.setFillColor(GIADA); c.setFont("SS-Sans-Bold", 23)
        c.drawCentredString(cx + cw / 2, y - ch / 2 + 2, big)
        c.setFillColor(MUTED); c.setFont("SS-Sans", 9.5)
        c.drawCentredString(cx + cw / 2, y - ch + 12, small)

def build(lang, out):
    E = lang == "en"
    c = canvas.Canvas(out, pagesize=PAGE)
    c.setTitle("Sổ Sạch — Investor Pitch")
    TOTAL = 9

    # ---------------- 1 · COVER (dark) ----------------
    c.setFillColor(GIADA); c.rect(0, 0, W, H, stroke=0, fill=1)
    c.setFillColor(GIADA_MID); c.circle(W - 70, H - 60, 170, stroke=0, fill=1)
    c.setFillColor(GOLD_LT); c.setFont("SS-Sans-Bold", 13)
    c.drawString(MARG, H - 38 * mm, "INVESTOR PITCH · JULY 2026" if E else "PITCH INVESTITORI · LUGLIO 2026")
    c.setFillColor(WHITE); c.setFont("SS-Serif-Bold", 64)
    c.drawString(MARG, H - 62 * mm, "Sổ Sạch")
    c.setFillColor(MINT); c.setFont("SS-Sans", 17)
    c.drawString(MARG, H - 76 * mm, "The AI bookkeeper on Zalo for Vietnam's 5.2 million household businesses."
                 if E else "Il commercialista AI su Zalo per i 5,2 milioni di hộ kinh doanh del Vietnam.")
    c.setFillColor(GOLD_LT); c.setFont("SS-Sans-Bold", 14)
    c.drawString(MARG, H - 92 * mm, ("LIVE at so-sach.onrender.com  ·  Raising $300k"
                                     if E else "LIVE su so-sach.onrender.com  ·  Raccolta $300k"))
    c.setFillColor(MINT); c.setFont("SS-Sans", 11)
    c.drawString(MARG, 18 * mm, "Yuri Frassi · frassiyuri@gmail.com · licensed Vietnamese company (SaaS)"
                 if E else "Yuri Frassi · frassiyuri@gmail.com · società vietnamita licenziataria (SaaS)")
    chrome(c, 1, TOTAL, lang, dark=True); c.showPage()

    # ---------------- 2 · THE SHOCK ----------------
    kicker(c, "01 · The forced-demand event" if E else "01 · L'evento di domanda forzata", H - 24 * mm)
    title(c, "On 01/01/2026, 5.2 million businesses lost their tax shortcut."
          if E else "Il 01/01/2026, 5,2 milioni di attività hanno perso il forfettario.", H - 36 * mm, size=25)
    stat_cards(c, [
        ("5.2M", "households must keep books" if E else "hộ devono tenere i libri"),
        ("73%", "report tech difficulties (VCCI)" if E else "dichiara difficoltà tech (VCCI)"),
        ("30/04/26", "first filing already due" if E else "primo deposito già scaduto"),
        ("01/07/26", "seller-verification wave" if E else "ondata verifica venditori"),
    ], MARG, H - 48 * mm, (W - 2 * MARG - 3 * 14) / 4, 30 * mm)
    bullets(c, [
        ("Lump-sum (khoán) tax is abolished: every hộ kinh doanh must record income & expenses and self-declare quarterly — most for the first time in their lives."
         if E else "La tassa forfettaria (khoán) è abolita: ogni hộ kinh doanh deve registrare entrate e uscite e autodichiarare ogni trimestre — per lo più per la prima volta nella vita."),
        ("The incumbents (MISA, KiotViet, Sapo) speak accountant. The street vendor speaks <b>Zalo</b> — 78M monthly users, where Vietnamese commerce already happens."
         if E else "Gli incumbent (MISA, KiotViet, Sapo) parlano da contabile. Il venditore parla <b>Zalo</b> — 78M utenti mensili, dove il commercio vietnamita già vive."),
        ("Compliance shocks of this scale create category winners — the window is open <b>now</b>, between the first filing and full enforcement."
         if E else "Shock di compliance di questa scala creano i vincitori di categoria — la finestra è aperta <b>adesso</b>, tra il primo deposito e l'enforcement pieno."),
    ], MARG, H - 88 * mm, W - 2 * MARG)
    chrome(c, 2, TOTAL, lang); c.showPage()

    # ---------------- 3 · THE PRODUCT ----------------
    kicker(c, "02 · The product — live today" if E else "02 · Il prodotto — live oggi", H - 24 * mm)
    title(c, "Snap the receipt. The books do themselves." if E else "Scatti la foto. I libri si fanno da soli.", H - 36 * mm, size=25)
    # left: 3-step flow
    steps = [
        ("1", "Photo → Zalo" if E else "Foto → Zalo",
         "Receipt, bill or bank-transfer screenshot — sent like a message to a friend."
         if E else "Scontrino, bolletta o screenshot di bonifico — inviato come un messaggio a un amico."),
        ("2", "AI writes the ledger" if E else "L'AI scrive il libro",
         "Claude vision reads it, classifies thu/chi, files the entry. One tap to fix."
         if E else "La visione AI legge, classifica thu/chi, registra. Un tocco per correggere."),
        ("3", "Declaration pre-filled" if E else "Dichiarazione precompilata",
         "Thresholds watched all year; form 01/CNKD ready every quarter — print, file, or send to your tax agent."
         if E else "Soglie monitorate tutto l'anno; modulo 01/CNKD pronto ogni trimestre — stampa, deposita o invia al tuo đại lý thuế."),
    ]
    y = H - 50 * mm
    for n, t_, d in steps:
        c.setFillColor(GOLD); c.circle(MARG + 9, y - 4, 9, stroke=0, fill=1)
        c.setFillColor(WHITE); c.setFont("SS-Sans-Bold", 11); c.drawCentredString(MARG + 9, y - 7.5, n)
        c.setFillColor(GIADA); c.setFont("SS-Sans-Bold", 13.5); c.drawString(MARG + 26, y - 8, t_)
        p = Paragraph(d, st_body); pw, ph = p.wrap(W / 2 - MARG - 30, 200)
        p.drawOn(c, MARG + 26, y - 12 - ph)
        y -= (ph + 26)
    # right: capability box
    bx = W / 2 + 8 * mm; bw = W - MARG - bx
    c.setFillColor(CARTA); c.roundRect(bx, 26 * mm, bw, H - 26 * mm - 44 * mm, 10, stroke=0, fill=1)
    c.setFillColor(GIADA); c.setFont("SS-Sans-Bold", 12)
    c.drawString(bx + 14, H - 52 * mm, "Already shipped (verified live):" if E else "Già rilasciato (verificato live):")
    cap = [
        "AI receipt extraction + confirm flow" if E else "Estrazione AI scontrini + conferma",
        "Threshold engine 500M / 1B + plain-language alerts" if E else "Motore soglie 500M / 1B + avvisi semplici",
        "Pre-filled 01/CNKD + print + Excel export" if E else "01/CNKD precompilato + stampa + export Excel",
        "Accounts & roles (household / tax agent)" if E else "Account e ruoli (hộ / đại lý thuế)",
        "Tax-agent dashboard w/ client roster — the reseller channel in software" if E else "Cruscotto đại lý thuế con portafoglio clienti — il canale di rivendita in software",
        "VietQR billing rails (payOS) + 30-day pilot plans" if E else "Incassi VietQR (payOS) + piani pilota 30gg",
        "Zalo OA bot + PWA; Postgres-ready" if E else "Bot Zalo OA + PWA; Postgres-ready",
    ]
    yy = H - 58 * mm
    for it in cap:
        p = Paragraph(f'<font color="#0b3d2e"><b>●</b></font>&nbsp;&nbsp;{it}',
                      ParagraphStyle("cap", parent=st_cell, fontSize=10.8, leading=14.5))
        pw, ph = p.wrap(bw - 28, 100); yy -= ph
        p.drawOn(c, bx + 14, yy); yy -= 5
    c.setFillColor(GOLD); c.setFont("SS-Sans-Bold", 11)
    c.drawString(bx + 14, 30 * mm, "→ so-sach.onrender.com — try it in the meeting" if E else "→ so-sach.onrender.com — provatelo in riunione")
    chrome(c, 3, TOTAL, lang); c.showPage()

    # ---------------- 4 · MARKET ----------------
    kicker(c, "03 · Market" if E else "03 · Mercato", H - 24 * mm)
    title(c, "A country-sized segment the incumbents can't reach down to."
          if E else "Un segmento grande quanto un paese, fuori portata per gli incumbent.", H - 36 * mm, size=24)
    draw_table(c, [
        ["", ("Size" if E else "Dimensione"), ("Note" if E else "Nota")],
        ["TAM", "5.2M", ("household businesses forced into bookkeeping from 2026" if E else "hộ kinh doanh obbligati ai libri dal 2026")],
        ["SAM", "~1.8M", ("smartphone-active hộ with 200M–3B VND revenue (real bookkeeping duty)" if E else "hộ smartphone-attivi con ricavi 200M–3B VND (obbligo reale di libri)")],
        ["SOM (Y3)", "40k " + ("subscribers" if E else "abbonati"), ("~2.2% of SAM via HCMC → southern provinces" if E else "~2,2% del SAM via HCMC → province del sud")],
    ], [90, 120, 470], MARG, H - 46 * mm)
    bullets(c, [
        ("<b>Segment A — online sellers</b> (Shopee/TikTok, tax withheld at source): need reconciliation and refund paperwork."
         if E else "<b>Segmento A — venditori online</b> (Shopee/TikTok, ritenuta alla fonte): servono riconciliazione e pratiche di rimborso."),
        ("<b>Segment B — street retail</b> (eateries, kiosks, market stalls): need the ledger, the thresholds and a human-language warning before tax bites."
         if E else "<b>Segmento B — retail di strada</b> (trattorie, chioschi, bancarelle): servono il libro, le soglie e un avviso in linguaggio umano prima che il fisco morda."),
        ("One engine serves both; the QR flyer on a market street and the đại lý thuế reach them where software marketing can't."
         if E else "Un solo motore serve entrambi; il volantino QR al mercato e il đại lý thuế li raggiungono dove il marketing software non arriva."),
    ], MARG, H - 105 * mm, W - 2 * MARG)
    chrome(c, 4, TOTAL, lang); c.showPage()

    # ---------------- 5 · BUSINESS MODEL ----------------
    kicker(c, "04 · Business model" if E else "04 · Modello di business", H - 24 * mm)
    title(c, "Priced for a street vendor. Sold by the person they already trust."
          if E else "Prezzo da bancarella. Venduto da chi ha già la loro fiducia.", H - 36 * mm, size=24)
    draw_table(c, [
        [("Stream" if E else "Linea"), ("Price" if E else "Prezzo"), ("Y3 share" if E else "Quota Y3"), ("What it buys" if E else "Cosa compra")],
        [("Core" if E else "Core"), "69k VND/mo (~$2.7)", "62%", ("photo ledger, thresholds, declaration draft" if E else "libro fotografico, soglie, bozza dichiarazione")],
        ["Pro", "149k VND/mo (~$5.9)", "23%", ("multi-location, exports, e-invoice via partner API" if E else "multi-sede, export, e-fattura via API partner")],
        [("Tax-agent channel" if E else "Canale đại lý thuế"), ("30% rev-share" if E else "30% rev-share"), "15%", ("agent dashboard for 20–200 clients — trust channel becomes distribution" if E else "cruscotto agenti per 20–200 clienti — il canale di fiducia diventa distribuzione")],
    ], [125, 135, 75, 345], MARG, H - 46 * mm)
    stat_cards(c, [
        ("$0.2–0.4", "COGS / user / month" if E else "COGS / utente / mese"),
        (">85%", "gross margin at scale" if E else "margine lordo a scala"),
        ("<$4", "CAC via agents + flyers" if E else "CAC via agenti + volantini"),
        ("VND", "billed by our VN entity" if E else "incassato dalla società VN"),
    ], MARG, H - 96 * mm, (W - 2 * MARG - 3 * 14) / 4, 28 * mm)
    c.setFillColor(MUTED); c.setFont("SS-Sans", 10)
    c.drawString(MARG, H - 132 * mm, "Quarterly filing deadlines re-activate lapsed users four times a year — churn has a built-in counterweight."
                 if E else "Le scadenze trimestrali riattivano gli utenti persi quattro volte l'anno — il churn ha un contrappeso strutturale.")
    chrome(c, 5, TOTAL, lang); c.showPage()

    # ---------------- 6 · WHY WE WIN ----------------
    kicker(c, "05 · Why we win" if E else "05 · Perché vinciamo", H - 24 * mm)
    title(c, "MISA gives software away free. We still win the vendor."
          if E else "MISA regala il software. Noi vinciamo comunque il venditore.", H - 36 * mm, size=24)
    draw_table(c, [
        ["", ("Vendor language" if E else "Lingua da bancarella"), "Zalo-native", ("Explains & files" if E else "Spiega e dichiara"), ("Agent channel" if E else "Canale agenti")],
        ["MISA / KiotViet / Sapo", "No", ("Partial" if E else "Parziale"), "No", "No"],
        [("Tax agents (manual)" if E else "Đại lý thuế (manuale)"), ("Yes" if E else "Sì"), ("Partial" if E else "Parziale"), ("Yes" if E else "Sì"), "—"],
        ["<b>Sổ Sạch</b>", ("<b>Yes</b>" if E else "<b>Sì</b>"), ("<b>Yes</b>" if E else "<b>Sì</b>"), ("<b>Yes</b>" if E else "<b>Sì</b>"), ("<b>Built-in, 30%</b>" if E else "<b>Integrato, 30%</b>")],
    ], [150, 130, 110, 130, 160], MARG, H - 46 * mm)
    bullets(c, [
        ("<b>The moat is the agent network, not the code.</b> Every đại lý thuế running 50 clients on our dashboard has switching costs; software is copyable, a paid reseller channel is not."
         if E else "<b>Il fossato è la rete agenti, non il codice.</b> Ogni đại lý thuế con 50 clienti sul cruscotto ha costi di switching; il software si copia, un canale di rivendita pagato no."),
        ("<b>Compliance, never 'tax optimization'.</b> We compute what the law prescribes and disclaim advice — the only defensible posture in a regulated space."
         if E else "<b>Compliance, mai 'ottimizzazione fiscale'.</b> Calcoliamo ciò che la legge prescrive e rimandiamo al professionista — l'unica postura difendibile in uno spazio regolato."),
        ("<b>Viral by artefact:</b> every declaration and receipt shared on Zalo carries the Sổ Sạch mark — the customer's paperwork recruits the next customer."
         if E else "<b>Virale per artefatto:</b> ogni dichiarazione e ricevuta condivisa su Zalo porta il marchio Sổ Sạch — la burocrazia del cliente recluta il prossimo cliente."),
    ], MARG, H - 92 * mm, W - 2 * MARG)
    chrome(c, 6, TOTAL, lang); c.showPage()

    # ---------------- 7 · ROADMAP ----------------
    kicker(c, "06 · Traction & roadmap" if E else "06 · Traction e roadmap", H - 24 * mm)
    title(c, "Live product now. Channel-built growth next." if E else "Prodotto live ora. Crescita costruita sul canale.", H - 36 * mm, size=25)
    draw_table(c, [
        [("When" if E else "Quando"), ("Milestone" if E else "Milestone"), ("Proof" if E else "Prova")],
        [("Today" if E else "Oggi"), ("Product live: ledger, declarations, agent dashboard, billing rails" if E else "Prodotto live: libro, dichiarazioni, cruscotto agenti, incassi"), "so-sach.onrender.com"],
        ["Q3 2026", ("100-household PAID pilot in 2 HCMC districts via 3–5 tax agents; Zalo OA keys live" if E else "Pilota PAGANTE da 100 hộ in 2 distretti HCMC via 3–5 đại lý thuế; chiavi Zalo OA attive"), ("week-4 retention ≥25%" if E else "retention sett.4 ≥25%")],
        ["Q4 2026", ("Zalo Mini App (zero-install) + Q4 filing campaign" if E else "Zalo Mini App (zero-install) + campagna deposito Q4"), ("500 paying" if E else "500 paganti")],
        ["Mid-2027", ("2,000 subscribers · 25 active agents · e-invoice partner API" if E else "2.000 abbonati · 25 agenti attivi · API partner e-fattura"), ("$70k ARR run-rate" if E else "run-rate ARR $70k")],
        ["2029", ("40k subscribers via southern provinces + agent network" if E else "40k abbonati via province del sud + rete agenti"), "$1.6M ARR · EBITDA +$520k"],
    ], [90, 420, 170], MARG, H - 46 * mm)
    c.setFillColor(MUTED); c.setFont("SS-Sans", 10)
    c.drawString(MARG, 30 * mm, ("Founder execution proof: eight live products shipped solo with AI leverage in 2026. This team ships in days, not quarters."
                                 if E else "Prova di esecuzione: otto prodotti live lanciati in solo con leva AI nel 2026. Questo team rilascia in giorni, non trimestri."))
    chrome(c, 7, TOTAL, lang); c.showPage()

    # ---------------- 8 · THE NUMBERS ----------------
    kicker(c, "07 · The numbers (illustrative)" if E else "07 · I numeri (illustrativi)", H - 24 * mm)
    title(c, "Channel-built, not hoped." if E else "Costruiti sul canale, non sperati.", H - 36 * mm, size=25)
    draw_table(c, [
        ["", "Y1 (2027)", "Y2 (2028)", "Y3 (2029)"],
        [("Paying subscribers" if E else "Abbonati paganti"), "2,000", "12,000", "40,000"],
        ["ARR", "$70k", "$450k", "$1.6M"],
        ["EBITDA", "−$90k", "+$60k", "+$520k"],
        [("Gross margin" if E else "Margine lordo"), "85%", "87%", "88%"],
    ], [200, 140, 140, 140], MARG, H - 46 * mm)
    bullets(c, [
        ("Assumptions on the table: blended ARPU ~$3.3/mo · CAC <$4 · churn 3.5%→2%/mo. We deliberately reject the hockey-stick pitch of this market (200k MAU in 18 months at $7 ARPU against a free incumbent)."
         if E else "Assunzioni sul tavolo: ARPU medio ~$3,3/mese · CAC <$4 · churn 3,5%→2%/mese. Rifiutiamo deliberatamente il pitch hockey-stick di questo mercato (200k MAU in 18 mesi a $7 ARPU contro un incumbent gratuito)."),
        ("<b>Kill criteria, committed:</b> pilot week-4 retention <25% or agents unwilling at 30% rev-share → the wedge is wrong, we pivot to agent-only tooling."
         if E else "<b>Criteri di stop, sottoscritti:</b> retention settimana-4 <25% o agenti non disposti al 30% → il wedge è sbagliato, pivot su strumenti solo-agenti."),
    ], MARG, H - 105 * mm, W - 2 * MARG)
    chrome(c, 8, TOTAL, lang); c.showPage()

    # ---------------- 9 · ASK + EXIT (dark) ----------------
    c.setFillColor(GIADA); c.rect(0, 0, W, H, stroke=0, fill=1)
    c.setFillColor(GOLD_LT); c.setFont("SS-Sans-Bold", 11)
    c.drawString(MARG, H - 26 * mm, "08 · THE ASK & THE EXIT" if E else "08 · RICHIESTA ED EXIT")
    c.setFillColor(WHITE); c.setFont("SS-Serif-Bold", 40)
    c.drawString(MARG, H - 44 * mm, "$300k · 18 " + ("months" if E else "mesi"))
    c.setFillColor(MINT); c.setFont("SS-Sans", 13)
    c.drawString(MARG, H - 55 * mm, "SAFE or priced seed — terms open. Milestones above are the covenant."
                 if E else "SAFE o seed priced — termini aperti. Le milestone sopra sono il patto.")
    # use of funds (left) + exit (right), white cards
    def dark_card(x, y, w, h, title_, lines):
        c.setFillColor(GIADA_MID); c.roundRect(x, y - h, w, h, 10, stroke=0, fill=1)
        c.setFillColor(GOLD_LT); c.setFont("SS-Sans-Bold", 12.5)
        c.drawString(x + 14, y - 20, title_)
        yy = y - 30
        for ln in lines:
            p = Paragraph(f'<font color="#e9c46a">●</font>&nbsp;&nbsp;{ln}',
                          ParagraphStyle("d", parent=st_bodyw, fontSize=11, leading=15.5))
            pw, ph = p.wrap(w - 28, 200); yy -= ph
            p.drawOn(c, x + 14, yy); yy -= 6
    colw = (W - 2 * MARG - 12 * mm) / 2
    dark_card(MARG, H - 66 * mm, colw, 62 * mm,
              "Use of funds" if E else "Impiego fondi",
              [("<b>40%</b> product & AI ops — Zalo Mini App, agent tooling, e-invoice API" if E else "<b>40%</b> prodotto e AI ops — Zalo Mini App, strumenti agenti, API e-fattura"),
               ("<b>33%</b> agent network & field GTM (HCMC → south)" if E else "<b>33%</b> rete agenti e GTM sul campo (HCMC → sud)"),
               ("<b>13%</b> compliance & legal (licensed tax counsel)" if E else "<b>13%</b> compliance e legale (fiscalista abilitato)"),
               ("<b>13%</b> buffer" if E else "<b>13%</b> riserva")])
    dark_card(MARG + colw + 12 * mm, H - 66 * mm, colw, 62 * mm,
              "Exit paths" if E else "Percorsi di exit",
              [("<b>Consolidation:</b> MISA / KiotViet / Sapo — 4–6× ARR comparables → $6–10M at Y3 scale" if E else "<b>Consolidamento:</b> MISA / KiotViet / Sapo — comparabili 4–6× ARR → $6–10M a scala Y3"),
               ("<b>Fintech:</b> the verified merchant ledger is the underwriting layer MoMo/VNPay/banks lack for merchant credit" if E else "<b>Fintech:</b> il libro verificato degli esercenti è il layer di underwriting che manca a MoMo/VNPay/banche per il credito"),
               ("<b>VNG/Zalo:</b> we build commerce data on their rail — a natural tuck-in" if E else "<b>VNG/Zalo:</b> costruiamo dati commerciali sul loro binario — tuck-in naturale")])
    c.setFillColor(GOLD_LT); c.setFont("SS-Sans-Bold", 13)
    c.drawString(MARG, 24 * mm, "Try it before you decide: so-sach.onrender.com" if E else "Provatelo prima di decidere: so-sach.onrender.com")
    c.setFillColor(MINT); c.setFont("SS-Sans", 10)
    c.drawString(MARG, 17 * mm, "Yuri Frassi · frassiyuri@gmail.com · full memo, financial model and demo credentials on request (MNDA for code access)"
                 if E else "Yuri Frassi · frassiyuri@gmail.com · memo completo, modello finanziario e credenziali demo su richiesta (MNDA per l'accesso al codice)")
    c.showPage()

    c.save()
    print("written:", out)

build("en", "SoSach_Pitch_EN.pdf")
build("it", "SoSach_Pitch_IT.pdf")
