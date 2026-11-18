/**
 * Token service for the Live Translator's Cloud mic (ElevenLabs Scribe Realtime).
 *
 * Why this exists: the realtime speech API must not be called from a web page with your
 * secret API key. This tiny web app keeps the key on Google's server and hands the page a
 * short-lived, single-use token (valid ~15 minutes) instead.
 *
 * SETUP
 * 1. Go to script.google.com → New project → paste this whole file.
 * 2. Project Settings (gear icon) → Script properties → add:
 *      ELEVEN_KEY  = your ElevenLabs API key
 *      PASSCODE    = any word you choose (optional but recommended)
 * 3. Deploy → New deployment → type: Web app
 *      Execute as: Me
 *      Who has access: Anyone
 *    Copy the Web app URL (ends in /exec).
 * 4. In the translator page: ⚙ Cloud mic setup → paste the URL (and the passcode) → Save.
 *
 * If you change this code later, use Deploy → Manage deployments → Edit → New version.
 */
function doGet(e) {
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty('ELEVEN_KEY');
  var pass = props.getProperty('PASSCODE');

  if (!key) return json_({ error: 'ELEVEN_KEY script property is not set' });
  if (pass && (!e || !e.parameter || e.parameter.pass !== pass)) {
    return json_({ error: 'wrong passcode' });
  }

  var res = UrlFetchApp.fetch('https://api.elevenlabs.io/v1/single-use-token/realtime_scribe', {
    method: 'post',
    headers: { 'xi-api-key': key },
    muteHttpExceptions: true
  });

  if (res.getResponseCode() !== 200) {
    return json_({ error: 'ElevenLabs said ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 200) });
  }
  return ContentService.createTextOutput(res.getContentText())
    .setMimeType(ContentService.MimeType.JSON);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
