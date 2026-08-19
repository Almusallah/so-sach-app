# ============================================================================
#  Sổ Sạch — kit grafico condiviso dei documenti investitori.
#  Estratto da make_pitch_sosach.py perché ora tre documenti (teaser pre-NDA,
#  deck completo post-NDA, NDA) devono avere lo stesso aspetto: se il teaser e
#  il deck sembrano due aziende diverse, chi legge se ne accorge.
#
#  ⚠ FONT: i built-in di reportlab NON hanno i glifi vietnamiti (né ✓ ✗ ฿ ◆).
#     Si registrano Arial e Times New Roman da /System/Library/Fonts/Supplemental
#     e si usano ● — ≈ al posto dei simboli mancanti. In Paragraph la & va
#     scritta &amp; o reportlab solleva.
# ============================================================================
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, Table, TableStyle

_SUP = "/System/Library/Fonts/Supplemental"
pdfmetrics.registerFont(TTFont("SS-Sans", f"{_SUP}/Arial.ttf"))
pdfmetrics.registerFont(TTFont("SS-Sans-Bold", f"{_SUP}/Arial Bold.ttf"))
pdfmetrics.registerFont(TTFont("SS-Sans-It", f"{_SUP}/Arial Italic.ttf"))
pdfmetrics.registerFont(TTFont("SS-Serif-Bold", f"{_SUP}/Times New Roman Bold.ttf"))

# ⚠ SENZA QUESTO I TAG <b> NEI Paragraph NON FANNO NULLA — in silenzio.
#   reportlab non deduce il grassetto dal nome del font: gli serve la famiglia.
#   Ogni "<b>" nei bullet dei deck precedenti era decorativo e basta.
pdfmetrics.registerFontFamily("SS-Sans", normal="SS-Sans", bold="SS-Sans-Bold",
                              italic="SS-Sans-It", boldItalic="SS-Sans-Bold")

PAGE = landscape(A4)
W, H = PAGE
GIADA = HexColor("#0b3d2e"); GIADA_MID = HexColor("#14523e")
GOLD = HexColor("#c8922a"); GOLD_LT = HexColor("#e9c46a")
CARTA = HexColor("#f7f5ef"); CARTA_DK = HexColor("#eee9dd")
INK = HexColor("#20241f"); MUTED = HexColor("#5f6a5f"); BORDER = HexColor("#d8d2c2")
WHITE = HexColor("#ffffff"); MINT = HexColor("#cfe0d6")
ROSSO = HexColor("#a8352b")

st_cell  = ParagraphStyle("cell",  fontName="SS-Sans", fontSize=10, leading=13.6, textColor=INK)
st_cellb = ParagraphStyle("cellb", parent=st_cell, fontName="SS-Sans-Bold")
st_cellw = ParagraphStyle("cellw", parent=st_cellb, textColor=WHITE)
st_body  = ParagraphStyle("body",  fontName="SS-Sans", fontSize=12, leading=17.5, textColor=INK)
st_small = ParagraphStyle("small", fontName="SS-Sans", fontSize=10, leading=14.5, textColor=MUTED)
st_bodyw = ParagraphStyle("bodyw", parent=st_body, textColor=MINT)

MARG = 22 * mm


def footer(c, idx, total, text, dark=False):
    if dark:
        return
    c.setFillColor(MUTED); c.setFont("SS-Sans", 7.5)
    c.drawString(MARG, 10 * mm, text)
    c.drawRightString(W - MARG, 10 * mm, f"{idx} / {total}")


def kicker(c, text, y, color=GOLD):
    c.setFillColor(color); c.setFont("SS-Sans-Bold", 10.5)
    c.drawString(MARG, y, text.upper())


def title(c, text, y, size=26, color=GIADA):
    c.setFillColor(color); c.setFont("SS-Serif-Bold", size)
    c.drawString(MARG, y, text)


def subtitle(c, text, y, size=12.5, color=MUTED):
    c.setFillColor(color); c.setFont("SS-Sans", size)
    c.drawString(MARG, y, text)


def bullets(c, items, x, y, w, gap=8, style=None, dot=GOLD):
    style = style or st_body
    hexdot = "#%02x%02x%02x" % tuple(int(v * 255) for v in (dot.red, dot.green, dot.blue))
    for it in items:
        p = Paragraph(f'<font color="{hexdot}">●</font>&nbsp;&nbsp;{it}', style)
        _, ph = p.wrap(w, 500)
        y -= ph
        p.drawOn(c, x, y)
        y -= gap
    return y


def table(c, data, widths, x, y, header=True, fs=None):
    cs = st_cell if fs is None else ParagraphStyle("c2", parent=st_cell, fontSize=fs, leading=fs * 1.36)
    cb = ParagraphStyle("cb2", parent=cs, fontName="SS-Sans-Bold")
    cw = ParagraphStyle("cw2", parent=cb, textColor=WHITE)
    rows = [[Paragraph(v, cw if (header and i == 0) else (cb if j == 0 else cs))
             for j, v in enumerate(r)] for i, r in enumerate(data)]
    t = Table(rows, colWidths=widths)
    sty = [("GRID", (0, 0), (-1, -1), 0.5, BORDER), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
           ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
           ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
           ("ROWBACKGROUNDS", (0, 1 if header else 0), (-1, -1), [WHITE, CARTA_DK])]
    if header:
        sty.append(("BACKGROUND", (0, 0), (-1, 0), GIADA))
    t.setStyle(TableStyle(sty))
    _, th = t.wrap(sum(widths), H)
    t.drawOn(c, x, y - th)
    return y - th


def stat_cards(c, cards, x, y, cw, ch, gap=14, big_size=22):
    for i, (big, small) in enumerate(cards):
        cx = x + i * (cw + gap)
        c.setFillColor(CARTA_DK); c.roundRect(cx, y - ch, cw, ch, 8, stroke=0, fill=1)
        c.setFillColor(GIADA); c.setFont("SS-Sans-Bold", big_size)
        c.drawCentredString(cx + cw / 2, y - ch / 2 + 2, big)
        c.setFillColor(MUTED); c.setFont("SS-Sans", 9)
        c.drawCentredString(cx + cw / 2, y - ch + 11, small)


def dark_page(c):
    c.setFillColor(GIADA); c.rect(0, 0, W, H, stroke=0, fill=1)
    c.setFillColor(GIADA_MID); c.circle(W - 70, H - 60, 170, stroke=0, fill=1)


def dark_card(c, x, y, w, h, head, lines, lead=13):
    c.setFillColor(GIADA_MID); c.roundRect(x, y - h, w, h, 10, stroke=0, fill=1)
    c.setFillColor(GOLD_LT); c.setFont("SS-Sans-Bold", 12)
    c.drawString(x + 14, y - 20, head)
    yy = y - 34
    c.setFillColor(MINT); c.setFont("SS-Sans", 10)
    for ln in lines:
        c.drawString(x + 14, yy, ln)
        yy -= lead


def stamp(c, text, color=ROSSO):
    """Banda d'angolo: serve a rendere impossibile confondere il teaser
    pubblico con il documento coperto da NDA una volta stampati."""
    c.saveState()
    c.setFillColor(color)
    c.rect(0, H - 7 * mm, W, 7 * mm, stroke=0, fill=1)
    c.setFillColor(WHITE); c.setFont("SS-Sans-Bold", 8)
    c.drawCentredString(W / 2, H - 5 * mm, text.upper())
    c.restoreState()


def _check(c, cx, cy, r=5.5):
    """Il ✅ del messaggio vero. Disegnato: Arial non ha glifi emoji e
    stamperebbe un quadratino — lo stesso motivo per cui nei testi si usa ●."""
    c.setFillColor(HexColor("#1a9b5a")); c.circle(cx, cy, r, stroke=0, fill=1)
    c.setStrokeColor(WHITE); c.setLineWidth(1.3); c.setLineCap(1)
    c.line(cx - r * 0.42, cy + r * 0.02, cx - r * 0.08, cy - r * 0.33)
    c.line(cx - r * 0.08, cy - r * 0.33, cx + r * 0.45, cy + r * 0.38)


def _arrow_down(c, cx, cy, w=7, h=7, color=None):
    """Il 📉 della voce di spesa."""
    c.setFillColor(color or ROSSO)
    pth = c.beginPath(); pth.moveTo(cx - w / 2, cy + h / 2); pth.lineTo(cx + w / 2, cy + h / 2)
    pth.lineTo(cx, cy - h / 2); pth.close(); c.drawPath(pth, stroke=0, fill=1)


def chat_mock(c, x, y, w, h, lang="en"):
    """La schermata che vale il pitch: la foto entra, la scrittura contabile
    esce. Disegnata invece che importata — nessun asset esterno, nitida a
    qualsiasi zoom. Il testo è quello VERO restituito dal bot il 19/08/2026."""
    E = lang == "en"
    c.setFillColor(HexColor("#eef2f6")); c.roundRect(x, y - h, w, h, 12, stroke=0, fill=1)

    # intestazione OA
    c.setFillColor(WHITE); c.roundRect(x + 8, y - 27, w - 16, 22, 6, stroke=0, fill=1)
    c.setFillColor(GIADA); c.circle(x + 23, y - 16, 7.5, stroke=0, fill=1)
    c.setFillColor(INK); c.setFont("SS-Sans-Bold", 8.5)
    c.drawString(x + 36, y - 19, "Sổ Sạch - Sosachcomvn")
    _check(c, x + 36 + c.stringWidth("Sổ Sạch - Sosachcomvn", "SS-Sans-Bold", 8.5) + 7, y - 16, 4.2)

    # bolla utente: la foto dello scontrino, a destra
    bw, bh_img = 56, 62
    top = y - 36
    c.setFillColor(HexColor("#d7e7f7")); c.roundRect(x + w - bw - 12, top - bh_img, bw, bh_img, 8, stroke=0, fill=1)
    c.setFillColor(WHITE); c.roundRect(x + w - bw - 6, top - bh_img + 10, bw - 12, bh_img - 18, 3, stroke=0, fill=1)
    c.setStrokeColor(HexColor("#c8d0d8")); c.setLineWidth(0.45)
    for i in range(6):
        yy = top - bh_img + 18 + i * 6
        c.line(x + w - bw + 1, yy, x + w - 13, yy)
    c.setFillColor(MUTED); c.setFont("SS-Sans", 6.5)
    c.drawRightString(x + w - 12, top - bh_img - 9, "12:46")

    # bolla bot: la scrittura contabile, a sinistra
    bwid = w * 0.60
    bhei = 74
    btop = top - 24
    c.setFillColor(WHITE); c.roundRect(x + 12, btop - bhei, bwid, bhei, 8, stroke=0, fill=1)
    _check(c, x + 24, btop - 13, 5)
    c.setFillColor(INK); c.setFont("SS-Sans-Bold", 8)
    c.drawString(x + 33, btop - 16, "Recorded in Sổ Sạch:" if E else "Đã ghi vào Sổ Sạch:")
    _arrow_down(c, x + 25, btop - 29)
    c.setFillColor(GIADA); c.setFont("SS-Sans-Bold", 11)
    c.drawString(x + 33, btop - 33, "CHI 30.000đ")
    c.setFillColor(INK); c.setFont("SS-Sans", 7.8)
    c.drawString(x + 24, btop - 45, "HỆ THỐNG SIÊU THỊ JMART")
    c.setFillColor(MUTED); c.setFont("SS-Sans", 7.8)
    c.drawString(x + 24, btop - 55, "Mua hàng tạp phẩm")
    c.setFillColor(INK); c.setFont("SS-Sans", 7.8)
    c.drawString(x + 24, btop - 63.5, "Ngày: 2026-08-10")
    c.setFillColor(MUTED); c.setFont("SS-Sans", 6.5)
    c.drawString(x + 14, btop - bhei - 8, "12:46")

    c.setFillColor(MUTED); c.setFont("SS-Sans-It", 7.5)
    c.drawCentredString(x + w / 2, y - h + 7,
                        "Actual exchange, 19 August 2026." if E else "Scambio reale, 19 agosto 2026.")
