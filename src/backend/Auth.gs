/**
 * Zugriffskontrolle.
 *
 * Zwei Ebenen:
 *  1. Deployment: appsscript.json → webapp.access = MYSELF, executeAs = USER_DEPLOYING.
 *     Nur das eigene Google-Konto kann die Web-App überhaupt öffnen.
 *  2. Serverseitige Prüfung bei JEDEM Aufruf: Die E-Mail des aktiven Nutzers muss in
 *     der Script-Property ALLOWED_EMAILS (kommagetrennt) stehen. Ist die Property
 *     nicht gesetzt, ist nur der Eigentümer des Skripts zugelassen.
 *  Fail-closed: Ist keine E-Mail ermittelbar, wird der Zugriff verweigert.
 */
function authorize_() {
  var email = '';
  try {
    email = (Session.getActiveUser().getEmail() || '').toLowerCase();
  } catch (e) {
    email = '';
  }
  if (!email) return { ok: false, email: '' };
  var allowed = allowedEmails_();
  return { ok: allowed.indexOf(email) >= 0, email: email };
}

function allowedEmails_() {
  var raw = PropertiesService.getScriptProperties().getProperty('ALLOWED_EMAILS') || '';
  var list = raw.split(',')
    .map(function (s) { return s.trim().toLowerCase(); })
    .filter(function (s) { return s; });
  if (!list.length) {
    var owner = (Session.getEffectiveUser().getEmail() || '').toLowerCase();
    if (owner) list.push(owner);
  }
  return list;
}

/** Für Menüfunktionen im Spreadsheet: bricht ab, wenn nicht autorisiert. */
function assertAuthorized_() {
  if (!authorize_().ok) throw new Error('Kein Zugriff für dieses Konto.');
}
