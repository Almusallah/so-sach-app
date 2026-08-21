# ============================================================================
#  Sổ Sạch — kit MONOCROMO per i documenti che vanno davanti a un partner.
#
#  PERCHÉ ESISTE. Il kit giada/oro è finito su ogni documento prodotto: business
#  plan, memo, teaser, deck. Ripetuto abbastanza volte, un sistema di colori
#  smette di dire "curato" e comincia a dire "generato dallo stesso stampo".
#  Qui si toglie il colore del tutto: nero, bianco, due grigi. La gerarchia la
#  fanno peso e scala, che è l'unico modo in cui la fa la tipografia seria.
#
#  FONT. Avenir Next dal .ttc di sistema. È stato scelto per un motivo tecnico
#  prima che estetico: su questa macchina solo Avenir Next e Helvetica Neue
#  hanno i glifi VIETNAMITI completi su tutta la scala dei pesi (Futura, Gill
#  Sans, Optima e Avenir "classico" perdono i diacritici in quasi tutti i tagli
#  — un documento che scrive "Sô Sach" non si può mandare a nessuno).
# ============================================================================
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, Table, TableStyle

_AV = "/System/Library/Fonts/Avenir Next.ttc"
for alias, idx in (("AV", 7), ("AV-Md", 5), ("AV-Db", 2), ("AV-Bd", 0), ("AV-It", 4), ("AV-Ul", 10)):
    pdfmetrics.registerFont(TTFont(alias, _AV, subfontIndex=idx))
# senza la famiglia i tag <b> nei Paragraph non fanno NULLA, in silenzio
pdfmetrics.registerFontFamily("AV", normal="AV", bold="AV-Bd", italic="AV-It", boldItalic="AV-Bd")

PAGE = landscape(A4)
W, H = PAGE

INK    = HexColor("#000000")
PAPER  = HexColor("#ffffff")
GREY   = HexColor("#767676")   # testo secondario
GREY_L = HexColor("#a8a8a8")   # etichette
RULE   = HexColor("#dcdcdc")   # filetti
WASH   = HexColor("#f2f2f2")   # riempimenti appena percettibili
WHITE  = HexColor("#ffffff")

MARG = 26 * mm

st_body  = ParagraphStyle("body",  fontName="AV", fontSize=11.5, leading=17.5, textColor=INK)
st_small = ParagraphStyle("small", fontName="AV", fontSize=9.8,  leading=15,   textColor=GREY)
st_smallk= ParagraphStyle("smallk", parent=st_small, textColor=INK)
st_cell  = ParagraphStyle("cell",  fontName="AV", fontSize=10,   leading=14,   textColor=INK)
st_cellg = ParagraphStyle("cellg", parent=st_cell, textColor=GREY)


def _col(c):
    """Accetta sia un Color sia una stringa esadecimale."""
    return HexColor(c) if isinstance(c, str) else c


def tracked(c, text, x, y, font, size, space, color=INK):
    """Testo con crenatura manuale: le maiuscole piccole spaziate e i titoli
    stretti sono l'unica decorazione che resta quando si toglie il colore.
    ⚠️ setCharSpace vive sul TEXT OBJECT, non sul canvas."""
    # ⚠️ Tc (char space) fa parte dello STATO GRAFICO del PDF e sopravvive alla
    #    fine del blocco di testo: senza q/Q ogni paragrafo successivo eredita
    #    la spaziatura e il documento esce con le lettere staccate.
    c.saveState()
    to = c.beginText(x, y)
    to.setFont(font, size)
    to.setCharSpace(space)
    to.setFillColor(_col(color))
    to.textOut(text)
    c.drawText(to)
    c.restoreState()


def kicker(c, text, y, color=GREY_L):
    tracked(c, text.upper(), MARG, y, "AV-Db", 8.2, 1.9, color)


def title(c, text, y, size=30, color=INK, font="AV-Bd"):
    tracked(c, text, MARG, y, font, size, -0.6, color)


def subtitle(c, text, y, size=12, color=GREY):
    c.setFillColor(color); c.setFont("AV", size); c.drawString(MARG, y, text)


def rule(c, y, x0=None, x1=None, color=RULE, w=0.6):
    c.saveState(); c.setStrokeColor(color); c.setLineWidth(w)
    c.line(x0 or MARG, y, x1 or (W - MARG), y); c.restoreState()


def footer(c, idx, total, text, dark=False):
    col = GREY_L if not dark else HexColor("#8a8a8a")
    tracked(c, text.upper(), MARG, 12 * mm, "AV", 7, 1.1, col)
    c.setFillColor(col); c.setFont("AV-Db", 7.5)
    c.drawRightString(W - MARG, 12 * mm, f"{idx:02d} / {total:02d}")


def bullets(c, items, x, y, w, gap=9, style=None):
    """Niente pallini colorati: un filetto corto a sinistra. Più silenzioso e
    non introduce un colore dalla porta di servizio."""
    style = style or st_body
    for it in items:
        p = Paragraph(it, style)
        _, ph = p.wrap(w - 16, 500)
        y -= ph
        c.saveState(); c.setStrokeColor(INK); c.setLineWidth(1.6)
        c.line(x, y + ph - 6, x, y + ph - 6 - min(ph, 13)); c.restoreState()
        p.drawOn(c, x + 16, y)
        y -= gap
    return y


def table(c, data, widths, x, y, fs=None, emphasise=None):
    """Tabella editoriale: filetti sopra e sotto l'intestazione e in fondo.
    Nessuna griglia, nessun riempimento a righe alterne, nessun blocco scuro."""
    cs = st_cell if fs is None else ParagraphStyle("c2", parent=st_cell, fontSize=fs, leading=fs * 1.4)
    cg = ParagraphStyle("cg2", parent=cs, textColor=GREY)
    hd = ParagraphStyle("hd2", parent=cs, fontName="AV-Db", fontSize=(fs or 10) - 1.4, textColor=GREY_L)
    rows = []
    for i, r in enumerate(data):
        st = hd if i == 0 else (cs if (emphasise is not None and i == emphasise) else cg)
        first = ParagraphStyle("f", parent=st, fontName="AV-Db", textColor=INK if i else GREY_L)
        rows.append([Paragraph(v, first if j == 0 else st) for j, v in enumerate(r)])
    t = Table(rows, colWidths=widths)
    sty = [("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
           ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
           ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 12),
           ("LINEABOVE", (0, 0), (-1, 0), 1.1, INK),
           ("LINEBELOW", (0, 0), (-1, 0), 0.6, RULE),
           ("LINEBELOW", (0, -1), (-1, -1), 1.1, INK)]
    if emphasise is not None:
        sty += [("BACKGROUND", (0, emphasise), (-1, emphasise), WASH)]
    t.setStyle(TableStyle(sty))
    _, th = t.wrap(sum(widths), H)
    t.drawOn(c, x, y - th)
    return y - th


def stat_row(c, items, y, big=30):
    """Numeri grandi in fila, separati da filetti verticali sottili."""
    n = len(items)
    cw = (W - 2 * MARG) / n
    for i, (b, s) in enumerate(items):
        cx = MARG + i * cw
        if i:
            c.saveState(); c.setStrokeColor(RULE); c.setLineWidth(0.6)
            c.line(cx - 10, y - big - 4, cx - 10, y + 6); c.restoreState()
        tracked(c, b, cx, y - big + 4, "AV-Bd", big, -0.8, INK)
        tracked(c, s.upper(), cx, y - big - 10, "AV", 7.4, 1.2, GREY_L)
    return y - big - 18


def dark_page(c):
    c.setFillColor(INK); c.rect(0, 0, W, H, stroke=0, fill=1)


def dark_block(c, x, y, w, head, lines, lead=13.5):
    tracked(c, head.upper(), x, y, "AV-Db", 8.2, 1.9, HexColor("#8a8a8a"))
    c.saveState(); c.setStrokeColor(HexColor("#3a3a3a")); c.setLineWidth(0.7)
    c.line(x, y - 8, x + w, y - 8); c.restoreState()
    yy = y - 24
    c.setFillColor(WHITE); c.setFont("AV", 10.2)
    for ln in lines:
        c.drawString(x, yy, ln); yy -= lead
    return yy


def chat_mock(c, x, y, w, h, lang="en"):
    """Lo scambio vero del 19/08/2026, ridisegnato in bianco e nero: la foto
    entra, la scrittura contabile esce."""
    E = lang == "en"
    c.saveState()
    c.setStrokeColor(RULE); c.setLineWidth(0.8)
    c.rect(x, y - h, w, h, stroke=1, fill=0)

    # intestazione
    c.setFillColor(INK); c.circle(x + 20, y - 17, 6.5, stroke=0, fill=1)
    c.setFillColor(INK); c.setFont("AV-Db", 8.4)
    c.drawString(x + 32, y - 20, "Sổ Sạch")
    tracked(c, "OFFICIAL ACCOUNT", x + 32 + c.stringWidth("Sổ Sạch", "AV-Db", 8.4) + 8, y - 20, "AV", 6.6, 1.2, GREY_L)
    rule(c, y - 27, x, x + w)

    # bolla utente: lo scontrino
    bw, bh = 52, 58
    top = y - 38
    c.setFillColor(WASH); c.rect(x + w - bw - 14, top - bh, bw, bh, stroke=0, fill=1)
    c.setFillColor(WHITE); c.rect(x + w - bw - 8, top - bh + 8, bw - 12, bh - 16, stroke=0, fill=1)
    c.setStrokeColor(GREY_L); c.setLineWidth(0.4)
    for i in range(6):
        yy = top - bh + 15 + i * 6
        c.line(x + w - bw - 2, yy, x + w - 16, yy)
    tracked(c, "12:46", x + w - bw - 14, top - bh - 10, "AV", 6.4, 0.6, GREY_L)

    # bolla bot: la scrittura
    bx, bwid, bhei = x + 14, w * 0.62, 66
    btop = top - 20
    c.setStrokeColor(INK); c.setLineWidth(0.9)
    c.rect(bx, btop - bhei, bwid, bhei, stroke=1, fill=0)
    tracked(c, ("RECORDED" if E else "ĐÃ GHI VÀO SỔ"), bx + 12, btop - 16, "AV-Db", 6.8, 1.4, GREY_L)
    c.setFillColor(INK); c.setFont("AV-Bd", 15)
    c.drawString(bx + 12, btop - 34, "− 30.000đ")
    c.setFillColor(INK); c.setFont("AV", 7.8)
    c.drawString(bx + 12, btop - 46, "HỆ THỐNG SIÊU THỊ JMART")
    c.setFillColor(GREY); c.setFont("AV", 7.8)
    c.drawString(bx + 12, btop - 56, "Mua hàng tạp phẩm · 10/08/2026")
    # ⚠️ niente orario sotto la bolla del bot: cadeva esattamente sulla
    #    didascalia in fondo al riquadro. Uno dei due bastava.

    rule(c, y - h + 18, x + 14, x + w - 14)
    tracked(c, ("ACTUAL EXCHANGE, 19 AUGUST 2026" if E else "SCAMBIO REALE, 19 AGOSTO 2026"),
            x + 14, y - h + 8, "AV", 6.4, 1.1, GREY_L)
    c.restoreState()


# ---- immagini reali ---------------------------------------------------------
import os
SHOTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "shots")

def photo(c, path, x, y, w, caption=None, border=True):
    """Uno screenshot vero, incorniciato da un filetto. Torna l'altezza usata.
    y è il BORDO SUPERIORE."""
    from reportlab.lib.utils import ImageReader
    img = ImageReader(path)
    iw, ih = img.getSize()
    h = w * ih / iw
    c.drawImage(img, x, y - h, width=w, height=h)
    if border:
        c.saveState(); c.setStrokeColor(RULE); c.setLineWidth(0.8)
        c.rect(x, y - h, w, h, stroke=1, fill=0); c.restoreState()
    if caption:
        tracked(c, caption.upper(), x, y - h - 11, "AV", 6.6, 1.2, GREY_L)
        return h + 16
    return h
