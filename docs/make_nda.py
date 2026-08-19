# ============================================================================
#  Sổ Sạch — ACCORDO DI RISERVATEZZA (NDA), legge italiana.
#  Unilaterale: divulga solo Yuri Frassi. Versione IT (che fa fede) + EN di
#  cortesia. A4 verticale, Platypus perché è testo che scorre, non slide.
#
#  SCELTE FATTE E PERCHÉ:
#  · Divulgante è la PERSONA, non la società (scelta del cliente): una sola
#    firma, nessun timbro societario da procurare in Vietnam. Il buco che
#    questo apre — le informazioni sono asset della società, quindi la
#    legittimazione ad agire del singolo è discutibile — è chiuso con l'art.
#    1411 c.c.: la società è terzo beneficiario e può agire in proprio.
#  · Durata 3 anni, MA i segreti commerciali restano protetti finché tali:
#    far scadere la protezione dei segreti con il contratto sarebbe un
#    autogol, perché l'art. 98 CPI protegge a prescindere e più a lungo.
#  · Nessuna penale e nessun patto di non concorrenza: un fondo li fa
#    cassare dal proprio legale e si perdono due settimane. L'obiettivo di
#    questo documento è essere firmato, non vinto.
#  · Blocco di approvazione specifica ex artt. 1341-1342 c.c.: senza la
#    seconda firma il foro esclusivo di Milano è inefficace.
#
#  ⚠ NON È UN PARERE LEGALE. Va letto da un avvocato italiano prima dell'uso.
#  Rigenera: python3 make_nda.py
# ============================================================================
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_JUSTIFY, TA_CENTER
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
                                KeepTogether)
from reportlab.lib.colors import HexColor
from deck_kit import GIADA, GOLD, INK, MUTED, BORDER, CARTA_DK, WHITE  # registra anche i font

H1 = ParagraphStyle("H1", fontName="SS-Serif-Bold", fontSize=17, leading=21,
                    textColor=GIADA, alignment=TA_CENTER, spaceAfter=2)
H2 = ParagraphStyle("H2", fontName="SS-Sans", fontSize=9.5, leading=13,
                    textColor=MUTED, alignment=TA_CENTER, spaceAfter=14)
ART = ParagraphStyle("ART", fontName="SS-Sans-Bold", fontSize=10, leading=13,
                     textColor=GIADA, spaceBefore=9, spaceAfter=3)
BODY = ParagraphStyle("BODY", fontName="SS-Sans", fontSize=9.3, leading=13.2,
                      textColor=INK, alignment=TA_JUSTIFY, spaceAfter=4)
SUB = ParagraphStyle("SUB", parent=BODY, leftIndent=13, spaceAfter=3)
PARTY = ParagraphStyle("PARTY", parent=BODY, leftIndent=13, spaceAfter=3, alignment=0)
NOTE = ParagraphStyle("NOTE", fontName="SS-Sans-It", fontSize=8.2, leading=11.5,
                      textColor=MUTED, alignment=TA_JUSTIFY)
SIGN = ParagraphStyle("SIGN", fontName="SS-Sans", fontSize=9, leading=13, textColor=INK)


def art(n, heading, *paras):
    """Un articolo tenuto insieme al proprio primo comma: un titolo di
    articolo orfano in fondo alla pagina è il tipo di dettaglio che fa
    sembrare improvvisato un documento legale."""
    out = [KeepTogether([Paragraph(f"{n}. {heading}", ART), Paragraph(paras[0], BODY)])]
    out += [Paragraph(p, BODY) for p in paras[1:]]
    return out


def signature_block(it):
    lab = ("Il Divulgante", "La Ricevente", "Luogo e data", "Nome e qualifica del firmatario") if it else \
          ("The Discloser", "The Recipient", "Place and date", "Name and title of signatory")
    who = ("Yuri Frassi" if it else "Yuri Frassi")
    t = Table([
        [Paragraph(f"<b>{lab[0]}</b>", SIGN), Paragraph(f"<b>{lab[1]}</b>", SIGN)],
        [Paragraph(who, SIGN), Paragraph("_________________________________", SIGN)],
        [Paragraph("_________________________________", SIGN), Paragraph("_________________________________", SIGN)],
        [Paragraph(f"<font size=7.5 color='#5f6a5f'>{lab[2]}</font>", SIGN),
         Paragraph(f"<font size=7.5 color='#5f6a5f'>{lab[3]}</font>", SIGN)],
    ], colWidths=[82 * mm, 82 * mm])
    t.setStyle(TableStyle([("TOPPADDING", (0, 0), (-1, -1), 7),
                           ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                           ("LEFTPADDING", (0, 0), (-1, -1), 0)]))
    return t


# ============================== TESTO ITALIANO ==============================
def italiano():
    F = []
    F.append(Paragraph("ACCORDO DI RISERVATEZZA", H1))
    F.append(Paragraph("(Non-Disclosure Agreement — unilaterale) — Progetto «Sổ Sạch»", H2))

    F.append(Paragraph("<b>TRA</b>", BODY))
    F.append(Paragraph(
        "<b>Yuri Frassi</b>, nato a ______________ il ___/___/______, codice fiscale ____________________, "
        "residente in ______________________________________, di seguito il <b>«Divulgante»</b>;", PARTY))
    F.append(Paragraph("<b>E</b>", BODY))
    F.append(Paragraph(
        "________________________________________, con sede legale in ______________________________________, "
        "codice fiscale / partita IVA ____________________, in persona del legale rappresentante pro tempore, "
        "di seguito la <b>«Ricevente»</b>;", PARTY))
    F.append(Paragraph("di seguito, congiuntamente, le <b>«Parti»</b> e, singolarmente, la <b>«Parte»</b>.", BODY))
    F.append(Spacer(1, 6))

    F.append(Paragraph("<b>PREMESSO CHE</b>", BODY))
    for lettera, testo in [
        ("A", "il Divulgante ha ideato e sviluppa <b>«Sổ Sạch»</b>, un servizio di tenuta contabile assistita da "
              "intelligenza artificiale destinato alle imprese familiari vietnamite (<i>hộ kinh doanh</i>) ed erogato "
              "attraverso la piattaforma di messaggistica Zalo (il <b>«Progetto»</b>);"),
        ("B", "il Progetto è esercitato da <b>CÔNG TY TNHH OFFICINE GẶP</b>, società di diritto vietnamita con codice "
              "d'impresa 0316904153 e sede in Hồ Chí Minh City, Vietnam (la <b>«Società»</b>), della quale il "
              "Divulgante è socio e legale rappresentante; il Divulgante dichiara di avere titolo a disporre delle "
              "informazioni oggetto del presente Accordo e di agire, per quanto occorrer possa, anche nell'interesse "
              "della Società;"),
        ("C", "la Ricevente ha manifestato interesse a valutare un possibile investimento nel capitale della Società, "
              "ovvero altra operazione di finanziamento o di collaborazione avente ad oggetto il Progetto "
              "(l'<b>«Operazione»</b>);"),
        ("D", "ai fini esclusivi di tale valutazione il Divulgante è disposto a mettere a disposizione della Ricevente "
              "informazioni di carattere riservato, alle condizioni che seguono."),
    ]:
        F.append(Paragraph(f"({lettera})&nbsp;&nbsp;{testo}", SUB))
    F.append(Paragraph("<b>TUTTO CIÒ PREMESSO, LE PARTI CONVENGONO QUANTO SEGUE.</b>", BODY))

    F += art(1, "Premesse",
             "Le premesse costituiscono parte integrante e sostanziale del presente Accordo.")

    F += art(2, "Informazioni Riservate",
             "Per <b>«Informazioni Riservate»</b> si intende ogni informazione, in qualunque forma comunicata — orale, "
             "scritta, elettronica, grafica o mediante dimostrazione del prodotto — che il Divulgante renda nota alla "
             "Ricevente in relazione all'Operazione, sia essa o meno espressamente contrassegnata come riservata, e "
             "in particolare, a titolo esemplificativo e non esaustivo:",
             "(i) il piano industriale, il modello economico, le proiezioni finanziarie, i dati di costo unitario, i "
             "prezzi, i margini e le metriche di acquisizione e di abbandono della clientela; (ii) il codice sorgente, "
             "l'architettura del sistema, le istruzioni impartite ai modelli di intelligenza artificiale, gli schemi "
             "dati e i risultati dei collaudi; (iii) la metodologia del punteggio di affidabilità creditizia e il "
             "modello di attribuzione della provenienza dei dati contabili; (iv) l'identità e i termini economici dei "
             "partner, dei consulenti fiscali e degli agenti del canale distributivo; (v) i dati, anche aggregati o "
             "anonimizzati, relativi alle imprese utenti; (vi) le informazioni relative ai procedimenti autorizzativi "
             "presso la piattaforma Zalo e presso le autorità vietnamite; (vii) l'esistenza e il contenuto delle "
             "trattative relative all'Operazione.")

    F += art(3, "Esclusioni",
             "Non costituiscono Informazioni Riservate le informazioni per le quali la Ricevente dimostri, con prova "
             "documentale, che: (i) erano di pubblico dominio al momento della comunicazione, o lo sono divenute "
             "successivamente senza inadempimento del presente Accordo; (ii) erano già legittimamente in suo possesso, "
             "libere da obblighi di riservatezza, anteriormente alla comunicazione; (iii) le sono state comunicate da "
             "un terzo legittimato a farlo e non vincolato da obblighi di riservatezza; (iv) sono state da essa "
             "sviluppate in modo autonomo, senza utilizzo delle Informazioni Riservate.",
             "Qualora la Ricevente sia tenuta a divulgare Informazioni Riservate in forza di legge, regolamento, ordine "
             "dell'autorità giudiziaria o amministrativa, essa ne darà — ove consentito e con ragionevole anticipo — "
             "comunicazione scritta al Divulgante, limitando la divulgazione a quanto strettamente richiesto e "
             "cooperando, a spese del Divulgante, a ogni iniziativa volta a ottenere un provvedimento di riservatezza.")

    F += art(4, "Scopo Consentito",
             "La Ricevente potrà utilizzare le Informazioni Riservate <b>esclusivamente</b> ai fini della valutazione "
             "dell'Operazione (lo <b>«Scopo Consentito»</b>). È espressamente escluso ogni altro utilizzo, diretto o "
             "indiretto, e in particolare l'utilizzo per lo sviluppo, per sé o per terzi, di prodotti o servizi "
             "concorrenti con il Progetto, ovvero a beneficio di società partecipate dalla Ricevente o da essa "
             "altrimenti collegate.")

    F += art(5, "Obblighi della Ricevente",
             "La Ricevente si obbliga a: (i) mantenere strettamente riservate le Informazioni Riservate, adottando "
             "misure di protezione non inferiori a quelle usate per le proprie informazioni riservate di pari "
             "importanza e comunque non inferiori all'ordinaria diligenza professionale; (ii) non riprodurre, "
             "decompilare, sottoporre a reverse engineering né altrimenti analizzare i materiali ricevuti se non nella "
             "misura strettamente necessaria allo Scopo Consentito; (iii) non divulgare le Informazioni Riservate a "
             "terzi senza il preventivo consenso scritto del Divulgante.")

    F += art(6, "Rappresentanti",
             "La Ricevente potrà comunicare le Informazioni Riservate esclusivamente ai propri amministratori, "
             "dipendenti e consulenti professionali che ne abbiano effettiva necessità ai fini dello Scopo Consentito "
             "(i <b>«Rappresentanti»</b>), previa informazione del carattere riservato e purché essi siano vincolati "
             "da obblighi di riservatezza almeno equivalenti a quelli del presente Accordo, per legge o per contratto. "
             "La Ricevente risponde in via diretta di ogni condotta dei propri Rappresentanti che, se posta in essere "
             "dalla Ricevente, costituirebbe inadempimento del presente Accordo. Su richiesta scritta del Divulgante, "
             "la Ricevente fornirà l'elenco dei Rappresentanti ai quali le Informazioni Riservate siano state "
             "comunicate.")

    F += art(7, "Segreti commerciali",
             "Le Parti danno atto che le Informazioni Riservate costituiscono, in tutto o in parte, segreti commerciali "
             "ai sensi degli articoli 98 e 99 del Codice della Proprietà Industriale (D.lgs. 10 febbraio 2005, n. 30) e "
             "che il presente Accordo integra una delle misure ragionevolmente adeguate a mantenerle segrete richieste "
             "dall'articolo 98, comma 1, lettera c) del medesimo Codice. La tutela accordata dal presente Accordo si "
             "aggiunge, e non si sostituisce, a quella prevista dalla normativa sui segreti commerciali e dall'articolo "
             "2598 del codice civile in materia di concorrenza sleale.")

    F += art(8, "Conoscenze residuali",
             "Nulla nel presente Accordo impedisce ai Rappresentanti persone fisiche di utilizzare le conoscenze di "
             "carattere generale rimaste nella loro memoria non assistita a seguito dell'accesso alle Informazioni "
             "Riservate. La presente disposizione non autorizza in alcun caso la riproduzione, la conservazione o la "
             "consultazione di documenti, dati o materiali del Divulgante, né la divulgazione di dati specifici quali "
             "cifre, elenchi di partner, metodologie o codice, e non attribuisce alcuna licenza sui diritti di "
             "proprietà intellettuale del Divulgante o della Società.")

    F += art(9, "Assenza di licenze e di obbligo a contrarre",
             "La comunicazione delle Informazioni Riservate non attribuisce alla Ricevente alcun diritto, licenza, "
             "titolo o interesse, espresso o implicito, sulle stesse o sui relativi diritti di proprietà intellettuale, "
             "che restano di esclusiva titolarità del Divulgante e della Società. Il presente Accordo non obbliga "
             "alcuna delle Parti a concludere l'Operazione né a proseguire le trattative, che ciascuna Parte resta "
             "libera di interrompere in qualsiasi momento, fermi restando gli obblighi di riservatezza qui assunti e "
             "il dovere di buona fede di cui agli articoli 1337 e 1375 del codice civile.",
             "Le Informazioni Riservate sono fornite nello stato in cui si trovano. Il Divulgante non presta garanzie "
             "espresse o implicite circa la loro completezza o accuratezza, fermo restando l'obbligo di correttezza "
             "nelle trattative.")

    F += art(10, "Durata",
             "Il presente Accordo ha efficacia dalla data della sua sottoscrizione e gli obblighi di riservatezza "
             "permangono per <b>3 (tre) anni</b> da tale data, indipendentemente dal fatto che l'Operazione sia o meno "
             "conclusa. Per le Informazioni Riservate che costituiscano segreti commerciali ai sensi dell'articolo 98 "
             "del Codice della Proprietà Industriale, gli obblighi qui assunti permangono per tutta la durata in cui "
             "esse conservino tale qualificazione, anche oltre il termine triennale.")

    F += art(11, "Restituzione e distruzione",
             "Su richiesta scritta del Divulgante, e in ogni caso entro 30 (trenta) giorni dalla cessazione delle "
             "trattative, la Ricevente restituirà o distruggerà le Informazioni Riservate e ogni relativa copia, "
             "confermandolo per iscritto. La Ricevente potrà conservare una copia nella misura strettamente imposta da "
             "obblighi di legge, di regolamento o di procedure interne di conservazione, restando tale copia soggetta "
             "agli obblighi del presente Accordo per tutta la durata della conservazione.")

    F += art(12, "Riservatezza delle trattative",
             "Ciascuna Parte si astiene dal divulgare a terzi l'esistenza, il contenuto e lo stato delle trattative "
             "relative all'Operazione, nonché dall'utilizzare il nome, il marchio o i segni distintivi dell'altra Parte "
             "o della Società in comunicazioni pubbliche, senza il preventivo consenso scritto dell'altra Parte.")

    F += art(13, "Dati personali",
             "Le Parti tratteranno i dati personali eventualmente scambiati in esecuzione del presente Accordo nel "
             "rispetto del Regolamento (UE) 2016/679 e del D.lgs. 30 giugno 2003, n. 196, come modificato dal D.lgs. "
             "10 agosto 2018, n. 101, limitatamente alle finalità connesse allo Scopo Consentito e per il tempo "
             "necessario al medesimo, ciascuna in qualità di autonomo titolare del trattamento.")

    F += art(14, "Rimedi",
             "Le Parti riconoscono che la violazione degli obblighi di riservatezza può cagionare al Divulgante e alla "
             "Società un pregiudizio non integralmente riparabile per equivalente. Resta pertanto impregiudicato il "
             "diritto del Divulgante e della Società di agire, oltre che per il risarcimento del danno, per l'adozione "
             "di provvedimenti inibitori e cautelari, ivi compresi quelli di cui all'articolo 700 del codice di "
             "procedura civile e agli articoli 129 e 131 del Codice della Proprietà Industriale.")

    F += art(15, "Beneficiario terzo",
             "Ai sensi e per gli effetti dell'<b>articolo 1411 del codice civile</b>, gli obblighi assunti dalla "
             "Ricevente con il presente Accordo sono stipulati anche a favore di <b>CÔNG TY TNHH OFFICINE GẶP</b>, che "
             "potrà pertanto farli valere in proprio nei confronti della Ricevente. Il Divulgante non potrà revocare "
             "né modificare tale stipulazione a favore di terzo una volta che la Società abbia dichiarato di volerne "
             "profittare.")

    F += art(16, "Varie",
             "Il presente Accordo costituisce l'intero accordo fra le Parti sulla materia che ne forma oggetto e "
             "sostituisce ogni precedente intesa, verbale o scritta. Ogni modifica richiede la forma scritta. La "
             "Ricevente non può cedere il presente Accordo, nemmeno parzialmente, senza il preventivo consenso scritto "
             "del Divulgante. L'eventuale invalidità o inefficacia di una singola clausola non pregiudica la validità "
             "delle restanti, che le Parti si impegnano a integrare in buona fede. La tolleranza di un inadempimento "
             "non costituisce rinuncia ai diritti nascenti dalla clausola violata.")

    F += art(17, "Legge applicabile e foro competente",
             "Il presente Accordo è regolato dalla <b>legge italiana</b>. Per ogni controversia relativa alla sua "
             "validità, interpretazione, esecuzione o risoluzione sarà <b>esclusivamente competente il Foro di "
             "Milano</b>, con espressa esclusione di ogni foro alternativo o concorrente.")

    F.append(Spacer(1, 10))
    F.append(KeepTogether([
        Paragraph("Luogo e data: ______________________________, ___/___/__________", BODY),
        Spacer(1, 6), signature_block(True)]))

    F.append(Spacer(1, 10))
    F.append(Paragraph(
        "Ai sensi e per gli effetti degli <b>articoli 1341, secondo comma, e 1342 del codice civile</b>, la Ricevente "
        "dichiara di aver letto, compreso e di approvare specificamente le seguenti clausole: <b>art. 4</b> (Scopo "
        "Consentito e divieto di utilizzo concorrenziale); <b>art. 6</b> (responsabilità diretta per i Rappresentanti); "
        "<b>art. 10</b> (durata e ultrattività per i segreti commerciali); <b>art. 11</b> (restituzione e distruzione); "
        "<b>art. 14</b> (rimedi inibitori e cautelari); <b>art. 15</b> (beneficiario terzo); <b>art. 16</b> (divieto di "
        "cessione); <b>art. 17</b> (legge applicabile e foro esclusivo di Milano).", BODY))
    F.append(Spacer(1, 8))
    t = Table([[Paragraph("<b>La Ricevente — approvazione specifica</b>", SIGN)],
               [Paragraph("_________________________________", SIGN)]], colWidths=[164 * mm])
    t.setStyle(TableStyle([("TOPPADDING", (0, 0), (-1, -1), 8), ("LEFTPADDING", (0, 0), (-1, -1), 0)]))
    F.append(t)
    return F


# ============================== TESTO INGLESE ==============================
def english():
    F = []
    F.append(Paragraph("NON-DISCLOSURE AGREEMENT", H1))
    F.append(Paragraph("(unilateral) — «Sổ Sạch» project — <b>courtesy translation</b>", H2))
    F.append(Paragraph(
        "This English text is provided for convenience only. The parties have executed the Italian version, which is "
        "the sole binding text; in the event of any discrepancy, the Italian version prevails.", NOTE))
    F.append(Spacer(1, 10))

    F.append(Paragraph("<b>BETWEEN</b>", BODY))
    F.append(Paragraph(
        "<b>Yuri Frassi</b>, born in ______________ on ___/___/______, Italian tax code ____________________, "
        "resident at ______________________________________ (the <b>“Discloser”</b>);", PARTY))
    F.append(Paragraph("<b>AND</b>", BODY))
    F.append(Paragraph(
        "________________________________________, having its registered office at "
        "______________________________________, tax code / VAT number ____________________, represented by its legal "
        "representative pro tempore (the <b>“Recipient”</b>);", PARTY))
    F.append(Paragraph("together the <b>“Parties”</b> and individually a <b>“Party”</b>.", BODY))
    F.append(Spacer(1, 6))

    F.append(Paragraph("<b>WHEREAS</b>", BODY))
    for l, t in [
        ("A", "the Discloser has conceived and is developing <b>“Sổ Sạch”</b>, an AI-assisted bookkeeping service for "
              "Vietnamese household businesses (<i>hộ kinh doanh</i>) delivered through the Zalo messaging platform "
              "(the <b>“Project”</b>);"),
        ("B", "the Project is operated by <b>CÔNG TY TNHH OFFICINE GẶP</b>, a company incorporated under the laws of "
              "Vietnam, enterprise code 0316904153, having its office in Hồ Chí Minh City, Vietnam (the "
              "<b>“Company”</b>), of which the Discloser is a member and legal representative; the Discloser warrants "
              "that he is entitled to dispose of the information covered by this Agreement and acts, to the extent "
              "required, also in the interest of the Company;"),
        ("C", "the Recipient has expressed an interest in evaluating a possible investment in the Company, or another "
              "financing or collaboration transaction concerning the Project (the <b>“Transaction”</b>);"),
        ("D", "for the sole purpose of such evaluation the Discloser is willing to make confidential information "
              "available to the Recipient on the terms set out below."),
    ]:
        F.append(Paragraph(f"({l})&nbsp;&nbsp;{t}", SUB))
    F.append(Paragraph("<b>NOW THEREFORE THE PARTIES AGREE AS FOLLOWS.</b>", BODY))

    F += art(1, "Recitals", "The recitals form an integral and substantive part of this Agreement.")
    F += art(2, "Confidential Information",
             "<b>“Confidential Information”</b> means any information, however communicated — orally, in writing, "
             "electronically, graphically or by product demonstration — disclosed by the Discloser to the Recipient in "
             "connection with the Transaction, whether or not expressly marked as confidential, including without "
             "limitation:",
             "(i) the business plan, economic model, financial projections, unit-cost data, pricing, margins and "
             "customer acquisition and churn metrics; (ii) source code, system architecture, instructions given to "
             "artificial-intelligence models, data schemas and test results; (iii) the credit-readiness scoring "
             "methodology and the data-provenance model; (iv) the identity and commercial terms of partners, tax "
             "advisers and distribution-channel agents; (v) data, including aggregated or anonymised data, relating to "
             "user businesses; (vi) information concerning authorisation proceedings before the Zalo platform and "
             "before Vietnamese authorities; (vii) the existence and content of negotiations regarding the Transaction.")
    F += art(3, "Exclusions",
             "Confidential Information does not include information which the Recipient proves by documentary evidence: "
             "(i) was in the public domain at the time of disclosure, or subsequently entered it without breach of this "
             "Agreement; (ii) was already lawfully in its possession, free of any duty of confidence, before "
             "disclosure; (iii) was disclosed to it by a third party entitled to do so and not bound by any duty of "
             "confidence; (iv) was independently developed by it without use of the Confidential Information.",
             "Where the Recipient is required to disclose Confidential Information by law, regulation or order of a "
             "judicial or administrative authority, it shall — where permitted and with reasonable notice — notify the "
             "Discloser in writing, limit disclosure to what is strictly required, and cooperate, at the Discloser's "
             "expense, in any effort to obtain protective treatment.")
    F += art(4, "Permitted Purpose",
             "The Recipient may use the Confidential Information <b>solely</b> to evaluate the Transaction (the "
             "<b>“Permitted Purpose”</b>). Any other use, direct or indirect, is expressly excluded, and in particular "
             "any use for the development, for itself or for third parties, of products or services competing with the "
             "Project, or for the benefit of companies in which the Recipient holds an interest or to which it is "
             "otherwise connected.")
    F += art(5, "Obligations of the Recipient",
             "The Recipient undertakes to: (i) keep the Confidential Information strictly confidential, applying "
             "protective measures no less stringent than those applied to its own confidential information of "
             "comparable importance and in any event no less than ordinary professional care; (ii) not reproduce, "
             "decompile, reverse engineer or otherwise analyse the materials received save strictly as necessary for "
             "the Permitted Purpose; (iii) not disclose the Confidential Information to third parties without the "
             "Discloser's prior written consent.")
    F += art(6, "Representatives",
             "The Recipient may disclose the Confidential Information only to those of its directors, employees and "
             "professional advisers who genuinely need it for the Permitted Purpose (the <b>“Representatives”</b>), "
             "having informed them of its confidential nature and provided they are bound by confidentiality "
             "obligations at least equivalent to those in this Agreement, whether by law or by contract. The Recipient "
             "is directly liable for any act of its Representatives which, if done by the Recipient, would breach this "
             "Agreement. On the Discloser's written request the Recipient shall provide a list of the Representatives "
             "to whom Confidential Information has been disclosed.")
    F += art(7, "Trade secrets",
             "The Parties acknowledge that the Confidential Information constitutes, in whole or in part, trade secrets "
             "within the meaning of articles 98 and 99 of the Italian Industrial Property Code (Legislative Decree "
             "no. 30 of 10 February 2005), and that this Agreement constitutes one of the reasonable steps to keep such "
             "information secret required by article 98(1)(c) thereof. The protection afforded by this Agreement is "
             "additional to, and does not replace, that provided by trade-secret law and by article 2598 of the Italian "
             "Civil Code on unfair competition.")
    F += art(8, "Residual knowledge",
             "Nothing in this Agreement prevents individual Representatives from using general knowledge retained in "
             "their unaided memory as a result of access to the Confidential Information. This provision does not in "
             "any circumstances authorise the reproduction, retention or consultation of the Discloser's documents, "
             "data or materials, nor the disclosure of specific data such as figures, partner lists, methodologies or "
             "code, and grants no licence over the intellectual property rights of the Discloser or the Company.")
    F += art(9, "No licence and no obligation to contract",
             "Disclosure of the Confidential Information grants the Recipient no right, licence, title or interest, "
             "express or implied, in it or in the related intellectual property rights, which remain the exclusive "
             "property of the Discloser and of the Company. This Agreement obliges neither Party to enter into the "
             "Transaction nor to continue negotiations, which either Party remains free to terminate at any time, "
             "without prejudice to the confidentiality obligations assumed here and to the duty of good faith under "
             "articles 1337 and 1375 of the Italian Civil Code.",
             "The Confidential Information is provided as is. The Discloser gives no express or implied warranty as to "
             "its completeness or accuracy, without prejudice to the duty of fair dealing in negotiations.")
    F += art(10, "Term",
             "This Agreement takes effect on the date of signature and the confidentiality obligations survive for "
             "<b>3 (three) years</b> from that date, whether or not the Transaction is completed. In respect of "
             "Confidential Information constituting trade secrets under article 98 of the Industrial Property Code, "
             "the obligations assumed here survive for as long as such information retains that status, including "
             "beyond the three-year term.")
    F += art(11, "Return and destruction",
             "On the Discloser's written request, and in any event within 30 (thirty) days of the end of negotiations, "
             "the Recipient shall return or destroy the Confidential Information and all copies, confirming this in "
             "writing. The Recipient may retain one copy strictly to the extent required by law, regulation or internal "
             "retention procedures, such copy remaining subject to this Agreement for the duration of its retention.")
    F += art(12, "Confidentiality of negotiations",
             "Each Party shall refrain from disclosing to third parties the existence, content and status of the "
             "negotiations concerning the Transaction, and from using the name, trade marks or distinctive signs of the "
             "other Party or of the Company in public communications, without the other Party's prior written consent.")
    F += art(13, "Personal data",
             "The Parties shall process any personal data exchanged under this Agreement in compliance with Regulation "
             "(EU) 2016/679 and Legislative Decree no. 196 of 30 June 2003 as amended by Legislative Decree no. 101 of "
             "10 August 2018, solely for purposes connected with the Permitted Purpose and for as long as necessary "
             "for it, each Party acting as an independent data controller.")
    F += art(14, "Remedies",
             "The Parties acknowledge that breach of the confidentiality obligations may cause the Discloser and the "
             "Company harm that cannot be fully remedied in damages. The Discloser and the Company therefore retain the "
             "right to seek, in addition to damages, injunctive and interim relief, including under article 700 of the "
             "Italian Code of Civil Procedure and articles 129 and 131 of the Industrial Property Code.")
    F += art(15, "Third-party beneficiary",
             "Pursuant to <b>article 1411 of the Italian Civil Code</b>, the obligations assumed by the Recipient under "
             "this Agreement are also stipulated for the benefit of <b>CÔNG TY TNHH OFFICINE GẶP</b>, which may "
             "accordingly enforce them in its own name against the Recipient. The Discloser may not revoke or amend "
             "that stipulation in favour of a third party once the Company has declared its intention to take the "
             "benefit of it.")
    F += art(16, "Miscellaneous",
             "This Agreement constitutes the entire agreement between the Parties on its subject matter and supersedes "
             "any prior understanding, oral or written. Any amendment must be in writing. The Recipient may not assign "
             "this Agreement, in whole or in part, without the Discloser's prior written consent. The invalidity or "
             "ineffectiveness of any single clause shall not affect the validity of the remainder, which the Parties "
             "undertake to supplement in good faith. Tolerance of a breach does not constitute a waiver of the rights "
             "arising from the clause breached.")
    F += art(17, "Governing law and jurisdiction",
             "This Agreement is governed by <b>Italian law</b>. The <b>Courts of Milan shall have exclusive "
             "jurisdiction</b> over any dispute concerning its validity, interpretation, performance or termination, to "
             "the express exclusion of any alternative or concurrent forum.")

    F.append(Spacer(1, 10))
    F.append(KeepTogether([
        Paragraph("Place and date: ______________________________, ___/___/__________", BODY),
        Spacer(1, 6), signature_block(False)]))
    F.append(Spacer(1, 10))
    F.append(Paragraph(
        "Pursuant to <b>articles 1341(2) and 1342 of the Italian Civil Code</b>, the Recipient declares that it has "
        "read, understood and specifically approves the following clauses: <b>art. 4</b> (Permitted Purpose and "
        "prohibition of competing use); <b>art. 6</b> (direct liability for Representatives); <b>art. 10</b> (term and "
        "survival for trade secrets); <b>art. 11</b> (return and destruction); <b>art. 14</b> (injunctive and interim "
        "relief); <b>art. 15</b> (third-party beneficiary); <b>art. 16</b> (prohibition of assignment); <b>art. 17</b> "
        "(governing law and exclusive jurisdiction of Milan).", BODY))
    F.append(Spacer(1, 8))
    t = Table([[Paragraph("<b>The Recipient — specific approval</b>", SIGN)],
               [Paragraph("_________________________________", SIGN)]], colWidths=[164 * mm])
    t.setStyle(TableStyle([("TOPPADDING", (0, 0), (-1, -1), 8), ("LEFTPADDING", (0, 0), (-1, -1), 0)]))
    F.append(t)
    return F


def stamp_page(canv, doc):
    canv.saveState()
    canv.setFillColor(MUTED); canv.setFont("SS-Sans", 7.5)
    canv.drawString(23 * mm, 12 * mm, "Sổ Sạch — Accordo di riservatezza / Non-Disclosure Agreement")
    canv.drawRightString(A4[0] - 23 * mm, 12 * mm, "%d" % doc.page)
    canv.restoreState()


def build(flow, out, title_):
    doc = SimpleDocTemplate(out, pagesize=A4, title=title_, author="Yuri Frassi",
                            leftMargin=23 * mm, rightMargin=23 * mm,
                            topMargin=20 * mm, bottomMargin=20 * mm)
    doc.build(flow, onFirstPage=stamp_page, onLaterPages=stamp_page)
    print("wrote", out)


if __name__ == "__main__":
    build(italiano(), "SoSach_NDA_IT.pdf", "Sổ Sạch — Accordo di riservatezza")
    build(english(), "SoSach_NDA_EN.pdf", "Sổ Sạch — Non-Disclosure Agreement (courtesy translation)")
