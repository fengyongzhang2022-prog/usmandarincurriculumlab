function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('messages') || SpreadsheetApp.getActiveSpreadsheet().insertSheet('messages');

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['createdAt', 'name', 'email', 'message', 'source']);
  }

  var payload = {};
  try {
    payload = JSON.parse(e.postData.contents || '{}');
  } catch (err) {
    payload = {};
  }

  sheet.appendRow([
    payload.createdAt || new Date().toISOString(),
    payload.name || '',
    payload.email || '',
    payload.message || '',
    payload.source || 'usmandarincurriculumlab'
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
