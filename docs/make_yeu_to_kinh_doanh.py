#!/usr/bin/env python3
"""Build the "yếu tố kinh doanh" (business-evidence) file for Zalo OA verification.

Zalo verifies an OA whose name differs from the company name via Cách 3, and asks
for ONE document proving the link between the company and the OA name. Our first
attempt was rejected 06/08/2026 with "Yếu tố kinh doanh chưa hợp lệ". Their
accept/reject criteria live inside an image on the Cách 3 guide page; two entries
in the invalid column described exactly what we sent:

  - "Tên OA không khớp với tên miền"  (we filed so-sach.onrender.com)
  - "Không có thông tin doanh nghiệp sở hữu website" / "không khớp với Giấy
    chứng nhận ĐKDN"  (footer named the company but carried no MST or address)

This build answers both, leading with the item that is on their VALID list —
"Hình ảnh website đã đăng ký VNNIC" — because sosach.com.vn is registered to
Officine Gặp and the national registry says so on a .gov.vn page.

Images are captured separately (headless Chrome) and read from IMG_DIR.

    python3 docs/make_yeu_to_kinh_doanh.py
"""
from datetime import date
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.pdfgen import canvas as canvasmod
from PIL import Image

DOSSIER = Path.home() / "Library/Mobile Documents/com~apple~CloudDocs/SoSach-Zalo-OA"
IMG_DIR = DOSSIER / "2-Ho-so-da-nop-va-bi-tu-choi" / "anh-bang-chung"
OUT = DOSSIER / "1-IN-KY-DONG-DAU" / "Yeu_to_kinh_doanh_SoSach_v2.pdf"

# reportlab's built-ins have no Vietnamese glyphs — Arial Supplemental does.
SUP = Path("/System/Library/Fonts/Supplemental")
pdfmetrics.registerFont(TTFont("Ar", SUP / "Arial.ttf"))
pdfmetrics.registerFont(TTFont("ArB", SUP / "Arial Bold.ttf"))
pdfmetrics.registerFont(TTFont("ArI", SUP / "Arial Italic.ttf"))

W, H = A4
MARG = 20 * mm
CW = W - 2 * MARG

INK = colors.HexColor("#1a1a1a")
MUTED = colors.HexColor("#6b7280")
GIADA = colors.HexColor("#0f5c46")
RULE = colors.HexColor("#d8d8d2")

OA_NAME = "Sổ Sạch"
OA_ID = "764694199561771441"
COMPANY = "CÔNG TY TNHH OFFICINE GẶP"
MST = "0316904153"
SITE = "https://sosach.com.vn"
# The footer states when the screenshots were taken, so it must track the day the
# images are actually captured — a hardcoded date silently goes stale, and a
# regulator reading "ảnh chụp ngày X" on a capture from another day is a needless
# thing to be caught on. Re-run the capture and this build on the same day.
TODAY = date.today().strftime("%d/%m/%Y")


def style(size=10, leading=None, font="Ar", color=INK, space=0):
    return ParagraphStyle(
        f"s{size}{font}{color}", fontName=font, fontSize=size,
        leading=leading or size * 1.45, textColor=color, spaceAfter=space,
    )


def para(c, text, x, y, width, st):
    p = Paragraph(text, st)
    _, h = p.wrap(width, H)
    p.drawOn(c, x, y - h)
    return y - h


def image_block(c, path, x, y, width, caption, cap_style):
    """Draw an image scaled to `width`, with a hairline frame and a caption."""
    im = Image.open(path)
    h = width * im.size[1] / im.size[0]
    c.drawImage(str(path), x, y - h, width=width, height=h, mask="auto")
    c.setStrokeColor(RULE)
    c.setLineWidth(0.5)
    c.rect(x, y - h, width, h, stroke=1, fill=0)
    return para(c, caption, x, y - h - 3 * mm, width, cap_style)


def footer(c, page, total):
    c.setStrokeColor(RULE)
    c.setLineWidth(0.5)
    c.line(MARG, 20 * mm, W - MARG, 20 * mm)
    c.setFont("Ar", 7.5)
    c.setFillColor(MUTED)
    c.drawString(MARG, 15.5 * mm,
                 f"Official Account: {OA_NAME}  ·  OA ID: {OA_ID}  ·  {COMPANY}  ·  MSDN {MST}")
    c.drawString(MARG, 11.8 * mm,
                 f"Ảnh chụp màn hình ngày {TODAY}  ·  Website chính thức: {SITE}")
    c.drawRightString(W - MARG, 11.8 * mm, f"Trang {page}/{total}")


def build():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvasmod.Canvas(str(OUT), pagesize=A4)
    c.setTitle("Yếu tố kinh doanh — Sổ Sạch — CÔNG TY TNHH OFFICINE GẶP")

    body = style(9.6, 14.5)
    cap = style(8.2, 11.5, "ArI", MUTED)
    lead = style(11, 16, "ArB", GIADA)

    # ---------------- page 1 ----------------
    y = H - MARG
    c.setFont("ArB", 19)
    c.setFillColor(INK)
    c.drawString(MARG, y - 6 * mm, "YẾU TỐ KINH DOANH")
    y -= 12 * mm
    c.setFont("Ar", 10)
    c.setFillColor(MUTED)
    c.drawString(MARG, y, "Xác thực OA theo Cách 3 — tên Official Account là tên sản phẩm/dịch vụ")
    y -= 4 * mm
    c.setStrokeColor(RULE)
    c.line(MARG, y, W - MARG, y)
    y -= 8 * mm

    y = para(c,
             f'“{OA_NAME}” là tên sản phẩm/dịch vụ do <b>{COMPANY}</b> (MSDN {MST}) phát triển, '
             'sở hữu và vận hành — phần mềm trợ lý kế toán ứng dụng AI dành cho hộ kinh doanh. '
             f'Sản phẩm được giới thiệu công khai tại website chính thức <b>{SITE}</b>.',
             MARG, y, CW, body) - 6 * mm

    y = para(c, "Bằng chứng 1 — Tên miền quốc gia .VN do chính doanh nghiệp đứng tên chủ thể",
             MARG, y, CW, lead) - 3 * mm
    y = para(c,
             'Tra cứu công khai trên Hệ thống thông tin tra cứu tên miền của Trung tâm Internet Việt Nam '
             '(VNNIC) — Bộ Khoa học và Công nghệ, tại <b>tracuutenmien.gov.vn</b>. '
             f'Chủ thể đăng ký sử dụng tên miền <b>sosach.com.vn</b> là <b>{COMPANY}</b>, '
             'trùng khớp với Giấy chứng nhận đăng ký doanh nghiệp. '
             'Tên Official Account “Sổ Sạch” trùng khớp với tên miền của website chính thức.',
             MARG, y, CW, body) - 5 * mm
    y = image_block(c, IMG_DIR / "ev_vnnic.png", MARG, y, CW,
                    "Ảnh 1 — tracuutenmien.gov.vn: tên miền quốc gia .VN “sosach.com.vn”, "
                    f"chủ thể đăng ký sử dụng {COMPANY}, Nhà đăng ký quản lý Công ty TNHH Phần mềm iNET.",
                    cap) - 7 * mm

    y = para(c, "Bằng chứng 2 — Chân trang website ghi thông tin doanh nghiệp sở hữu website",
             MARG, y, CW, lead) - 3 * mm
    y = para(c,
             'Chân trang của website chính thức ghi đầy đủ tên doanh nghiệp, mã số doanh nghiệp, '
             'cơ quan cấp, địa chỉ trụ sở chính, người đại diện theo pháp luật và thông tin liên hệ — '
             'toàn bộ trùng khớp với Giấy chứng nhận đăng ký doanh nghiệp.',
             MARG, y, CW, body) - 5 * mm
    image_block(c, IMG_DIR / "ev_footer.png", MARG, y, CW,
                "Ảnh 2 — Chân trang sosach.com.vn: tên doanh nghiệp, MSDN 0316904153, "
                "địa chỉ trụ sở chính, người đại diện theo pháp luật và liên hệ.",
                cap)

    footer(c, 1, 2)
    c.showPage()

    # ---------------- page 2 ----------------
    y = H - MARG
    y = para(c, "Bằng chứng 3 — Sản phẩm đang hoạt động công khai tại website chính thức",
             MARG, y, CW, lead) - 3 * mm
    y = para(c,
             f'Trang chủ <b>{SITE}</b> giới thiệu sản phẩm “{OA_NAME}” — trợ lý kế toán AI cho hộ kinh doanh: '
             'chụp ảnh hoá đơn, phần mềm tự ghi sổ thu chi, canh ngưỡng doanh thu chịu thuế '
             'và soạn sẵn tờ khai mẫu 01/CNKD theo quý.',
             MARG, y, CW, body) - 5 * mm
    y = image_block(c, IMG_DIR / "ev_hero.png", MARG, y, CW,
                    f"Ảnh 3 — Trang chủ {SITE}: sản phẩm “{OA_NAME}” đang hoạt động.",
                    cap) - 9 * mm

    y = para(c, "Tổng hợp hồ sơ", MARG, y, CW, lead) - 4 * mm

    rows = [
        ("Tên Official Account", OA_NAME),
        ("Official Account ID", OA_ID),
        ("Chủ thể sở hữu / vận hành", COMPANY),
        ("Mã số doanh nghiệp", MST),
        ("Địa chỉ trụ sở chính",
         "Lầu 1, Tòa nhà H3, 384 Hoàng Diệu, Phường Khánh Hội, Thành phố Hồ Chí Minh, Việt Nam"),
        ("Người đại diện theo pháp luật", "YURI FRASSI — Chủ tịch Hội đồng thành viên"),
        ("Website chính thức", "sosach.com.vn (tên miền quốc gia .VN, chủ thể là doanh nghiệp)"),
        ("Hình thức xác thực", "Cách 3 — tên OA là tên sản phẩm/dịch vụ của doanh nghiệp"),
    ]
    lab = style(9, 12.5, "Ar", MUTED)
    val = style(9, 12.5, "ArB")
    lw = 52 * mm
    for k, v in rows:
        pk, pv = Paragraph(k, lab), Paragraph(v, val)
        _, hk = pk.wrap(lw - 4 * mm, H)
        _, hv = pv.wrap(CW - lw, H)
        rh = max(hk, hv) + 3.4 * mm
        pk.drawOn(c, MARG, y - hk - 1.2 * mm)
        pv.drawOn(c, MARG + lw, y - hv - 1.2 * mm)
        c.setStrokeColor(RULE)
        c.setLineWidth(0.4)
        c.line(MARG, y - rh, W - MARG, y - rh)
        y -= rh

    footer(c, 2, 2)
    c.showPage()
    c.save()
    print("wrote", OUT)


if __name__ == "__main__":
    build()
