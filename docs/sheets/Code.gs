/**
 * Sổ Sạch → Google Sheets — ricevitore Apps Script.
 *
 * PERCHÉ QUESTO PATTERN. Niente OAuth Google sul server, niente Cloud project,
 * niente chiavi da custodire: il FOGLIO ospita un piccolo web-endpoint proprio
 * (questo script) e Sổ Sạch vi SPINGE i dati. L'utente resta proprietario del
 * foglio e del segreto; revocare l'accesso = cancellare il deployment.
 * È lo stesso schema già in produzione nei fogli di ricerca immobiliare.
 *
 * INSTALLAZIONE (una volta, ~2 minuti — istruzioni guidate sul sito):
 *   1. Crea un Google Sheet vuoto.
 *   2. Estensioni → Apps Script → incolla questo file.
 *   3. Imposta SECRET qui sotto (una stringa lunga qualsiasi).
 *   4. Deploy → New deployment → Web app → Execute as: Me →
 *      Who has access: Anyone. Copia l'URL /exec.
 *   5. Incolla URL + SECRET in Sổ Sạch (Tài khoản → Google Sheets).
 */

const SECRET = 'CAMBIAMI-STRINGA-LUNGA-A-CASO';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (!body || body.secret !== SECRET) {
      return _json({ ok: false, error: 'bad secret' });
    }
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Il payload è { sheets: { "Sổ thu chi": [[...]], "Tổng hợp": [[...]] } }.
    // Ogni tab viene RISCRITTA per intero: idempotente, niente stati a metà —
    // un push fallito a metà non lascia il foglio incoerente, il prossimo
    // push lo sistema.
    for (const [name, rows] of Object.entries(body.sheets || {})) {
      if (!Array.isArray(rows) || !rows.length) continue;
      let sh = ss.getSheetByName(name);
      if (!sh) sh = ss.insertSheet(name);
      sh.clearContents();
      const width = Math.max.apply(null, rows.map(r => r.length));
      const norm = rows.map(r => r.concat(Array(width - r.length).fill('')));
      sh.getRange(1, 1, norm.length, width).setValues(norm);
      sh.setFrozenRows(1);
    }
    return _json({ ok: true, at: new Date().toISOString() });
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  }
}

function _json(o) {
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}
