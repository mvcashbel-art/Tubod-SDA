/**
 * Tubod SDA Church: backend for the church website.
 * Runs inside a Google Sheet (Extensions > Apps Script). Members, posts, comments,
 * files and settings live in the sheet tabs; photos and library files live in Google Drive.
 *
 * Setup: run setup() once, then Deploy > New deployment > Web app
 * (Execute as: Me, Who has access: Anyone). See SETUP.md.
 */

const SCHEMA = {
  Members:   ['id', 'name', 'username', 'hash', 'salt', 'access', 'createdAt', 'title', 'ministries', 'since', 'bio', 'verse', 'avatar', 'cover', 'phone', 'sms', 'bday', 'mstatus', 'mstatusDate', 'mstatusNote', 'baptDate', 'baptBy', 'baptPlace', 'household', 'groups', 'anniv', 'consent'],
  Posts:     ['id', 'authorId', 'cat', 'text', 'photos', 'pinned', 'createdAt', 'sms', 'svc', 'grp'],
  Comments:  ['id', 'postId', 'authorId', 'text', 'createdAt'],
  Reactions: ['id', 'postId', 'uid', 'createdAt'],
  Files:     ['id', 'title', 'cat', 'desc', 'driveId', 'name', 'mime', 'size', 'authorId', 'createdAt'],
  Settings:  ['key', 'value'],
  Sessions:  ['token', 'uid', 'createdAt'],
  SmsOutbox: ['time', 'postId', 'number', 'text', 'status'],
  Program:   ['id', 'svcId', 'date', 'items', 'updatedAt'],
  Events:    ['id', 'title', 'date', 'time', 'place', 'desc', 'remind', 'createdBy', 'createdAt'],
  Scores:    ['id', 'uid', 'mode', 'score', 'correct', 'total', 'week', 'day', 'createdAt'],
  Log:       ['id', 'time', 'by', 'byName', 'kind', 'targetId', 'targetName', 'detail'],
  Attendance: ['id', 'date', 'uids', 'by', 'at'],
  Groups:    ['id', 'name', 'desc', 'createdAt', 'createdBy'],
  Visitors:  ['id', 'name', 'contact', 'heard', 'message', 'createdAt', 'handled', 'handledBy', 'consent'],
  Prayers:   ['id', 'name', 'contact', 'request', 'private', 'createdAt', 'handled', 'handledBy', 'consent'],
  Offerings: ['id', 'date', 'kind', 'amount', 'note', 'recordedBy', 'createdAt'],
  Transfers: ['id', 'name', 'direction', 'church', 'date', 'note', 'recordedBy', 'createdAt'],
  Activity:  ['id', 'time', 'uid', 'name', 'action', 'detail']
};
/* who may do what: admin = everything; clerk = members, records and attendance; editor = announcements, This Sabbath, events, program and attendance */
const LEVELS = ['admin', 'clerk', 'editor', 'member'];
function canMem_(me) { return me.access === 'admin' || me.access === 'clerk'; }
function canPost_(me) { return me.access === 'admin' || me.access === 'editor'; }
function canAttend_(me) { return me.access === 'admin' || me.access === 'clerk' || me.access === 'editor'; }
function needMem_(me) { if (!canMem_(me)) throw err_('Only the church clerk, pastor or an admin can do that.', 'denied'); }
function needPost_(me) { if (!canPost_(me)) throw err_('Only church leaders can do that.', 'denied'); }
/* Sends a phone notification through OneSignal to members who turned it on, even when the site is closed.
   Does nothing until ONESIGNAL_APP_ID and ONESIGNAL_API_KEY are set in Project Settings > Script properties. Best-effort: never blocks posting. */
function osPush_(title, body) {
  try {
    const props = PropertiesService.getScriptProperties();
    const appId = props.getProperty('ONESIGNAL_APP_ID'), key = props.getProperty('ONESIGNAL_API_KEY');
    if (!appId || !key) return;
    UrlFetchApp.fetch('https://onesignal.com/api/v1/notifications', {
      method: 'post', contentType: 'application/json',
      headers: { Authorization: 'Basic ' + key },
      payload: JSON.stringify({ app_id: appId, included_segments: ['Subscribed Users'],
        headings: { en: String(title || 'Tubod SDA Church').slice(0, 80) },
        contents: { en: String(body || '').replace(/\s+/g, ' ').trim().slice(0, 200) || 'New announcement' } }),
      muteHttpExceptions: true
    });
  } catch (e) { /* push is best-effort */ }
}
/* the record of changes, so leaders can always see who changed what */
function log_(me, kind, target, detail) {
  append_('Log', { id: id_('l'), time: String(nowMs_()), by: me ? me.id : 'system', byName: me ? me.name : 'System', kind: kind,
    targetId: target ? target.id || '' : '', targetName: target ? target.name || '' : '', detail: String(detail || '').slice(0, 1000) });
}
const ST_LABEL = { active: 'Active', inactive: 'Inactive', backslidden: 'Backslidden', offshoot: 'Offshoot', deceased: 'Deceased' };
function statusLog_(me, who, st) {
  const from = who.mstatus || 'active', to = st.mstatus || 'active';
  if (from === to && (who.mstatusDate || '') === st.mstatusDate && (who.mstatusNote || '') === st.mstatusNote) return;
  log_(me, 'status', who, ST_LABEL[from] + ' → ' + ST_LABEL[to] + (st.mstatusDate ? ' · ' + st.mstatusDate : '') + (st.mstatusNote ? ' · ' + st.mstatusNote : ''));
}
const POST_CATS = ['share', 'prayer', 'testimony', 'announcement'];
const FILE_CATS = ['sermons', 'sabbath-school', 'music', 'documents', 'media', 'other'];
const SESSION_DAYS = 90;
const MAX_FILE_BASE64 = 21000000;   // about 15 MB of file
const MAX_BIG_BYTES = 50 * 1024 * 1024 * 1024;   // biggest file a member may upload straight to Drive (50 GB)
const DEFAULT_QUOTA_GB = 10;        // storage each member may use in the Library (admins have no limit). Change it in Settings.
const MAX_PHOTO_CHARS = 36000000;   // about 26 MB of photo, saved exactly as sent
const SMS_MAX_CHARS = 320;          // two text parts

/* ---------- run once from the editor ---------- */
function setup() {
  Object.keys(SCHEMA).forEach(function (n) { sh_(n); });
  ensureHeaders_();
  folder_();
  const defaults = {
    churchName: 'Tubod SDA Church', tagline: 'Tubod, Isabel, Leyte',
    schedule: '', verse: '', bgId: '', joinCode: 'TUBODSDA',
    services: JSON.stringify([
      { id: 'wed', name: 'Wednesday worship', day: 3, time: '19:00' },
      { id: 'fri', name: 'Friday worship', day: 5, time: '19:00' }
    ]),
    autoRemind: '1', remindHours: '3', autoSms: '', memberQuotaGB: String(DEFAULT_QUOTA_GB)
  };
  Object.keys(defaults).forEach(function (k) {
    if (getSetting_(k) === null) setSetting_(k, defaults[k]);
  });
  if (readAll_('Posts').length === 0) {
    append_('Posts', {
      id: id_('p'), authorId: 'system', cat: 'announcement', pinned: '1', photos: '', createdAt: String(Date.now()),
      text: 'Happy Sabbath! Welcome to the Tubod SDA Church family page. Share encouragement, prayer requests and testimonies here, keep sermons and Sabbath School lessons in the Library, and add your photo to your profile so everyone knows who you are.'
    });
  }
  bump_();
  Logger.log('To announce worships automatically, run installTriggers once.');
  Logger.log('Setup finished. The church join code is "' + getSetting_('joinCode') + '". Now deploy as a web app.');
  Logger.log('Text alerts mode: ' + smsProvider_() + (smsProvider_() === 'OUTBOX' ? ' (free: you get the numbers and text them yourself). Set SMS_PROVIDER=SEMAPHORE in Script properties for automatic texts.' : '.'));
}

/* Run from the editor to send ONE real text to yourself and check Semaphore works.
   First add Script properties: SMS_PROVIDER=SEMAPHORE, SEMAPHORE_API_KEY=your key, TEST_NUMBER=your own mobile (09171234567).
   Semaphore silently ignores any message that starts with the word "TEST". */
function sendTestSms() {
  const props = PropertiesService.getScriptProperties();
  const number = normPhone_(props.getProperty('TEST_NUMBER'));
  if (!number) throw new Error('Add a valid TEST_NUMBER in Script properties first.');
  if (smsProvider_() !== 'SEMAPHORE') throw new Error('Set SMS_PROVIDER = SEMAPHORE in Script properties first.');
  Logger.log(semaphoreSend_([number], smsText_('Church text alert system check. Please ignore this message.')));
}

/* Run once from the editor. It checks every hour whether a worship is coming up and posts the reminder announcement. */
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'worshipReminders') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('worshipReminders').timeBased().everyHours(1).create();
  Logger.log('Done. The site will now check every hour and announce each worship before it starts.');
}

/* Posts an announcement shortly before each worship. Runs from the hourly trigger. */
function worshipReminders() {
  const now = nowMs_();
  const isOld = function (x) { return x.id.indexOf('wrem') === 0 && now - Number(x.createdAt) > 3 * 864e5; };
  if (readAll_('Posts').some(isOld)) withLock_(function () { remove_('Posts', isOld); bump_(); });
  try {
    const last = Number(PropertiesService.getScriptProperties().getProperty('LAST_BACKUP') || 0);
    if (now - last > 7 * 864e5) backup_();
  } catch (e) { Logger.log('Backup skipped: ' + e.message); }
  eventReminders_(now);
  if (getSetting_('autoRemind') !== '1') return;
  const lead = Math.min(24, Math.max(1, Number(getSetting_('remindHours')) || 3)) * 36e5;
  const props = PropertiesService.getScriptProperties();
  const done = String(props.getProperty('REMINDED') || '').split(',').filter(Boolean);
  const phToday = new Date(now + 8 * 36e5).toISOString().slice(0, 10);
  services_().forEach(function (sv) {
    const start = nextStart_(sv, now);
    if (!start || start - now > lead) return;
    const key = sv.id + '_' + new Date(start + 8 * 36e5).toISOString().slice(0, 10);
    if (done.indexOf(key) >= 0) return;
    const when = new Date(start + 8 * 36e5).toISOString().slice(0, 10) === phToday ? 'today' : 'tomorrow';
    const post = { id: id_('wrem'), authorId: 'system', cat: 'announcement', pinned: '', photos: '', createdAt: String(now), sms: '', svc: sv.id + '|' + phDate_(start),
      text: sv.name + ' ' + when + ' at ' + time12_(sv.time) + '. Everyone is welcome to join us.' };
    withLock_(function () {
      append_('Posts', post);
      done.push(key);
      props.setProperty('REMINDED', done.slice(-30).join(','));
      bump_();
    });
    osPush_(getSetting_('churchName') || 'Tubod SDA Church', post.text);
    if (getSetting_('autoSms') === '1' && smsProvider_() === 'SEMAPHORE') {
      try { smsSend_(post, false); } catch (e) { Logger.log('Reminder text not sent: ' + e.message); }
    }
  });
}

/* Run once from the editor: moves files uploaded before member folders existed into each member's own folder
   (Tubod SDA Church files / Members / Name). Church logos and other files with no owner stay where they are. */
function organizeFiles() {
  const members = {};
  readAll_('Members').forEach(function (m) { members[m.id] = m; });
  let moved = 0, skipped = 0;
  const move = function (driveId, uid) {
    if (!driveId || !members[uid]) { skipped++; return; }
    try {
      const f = DriveApp.getFileById(driveId), dest = memberFolder_(members[uid]);
      const parents = f.getParents();
      if (parents.hasNext() && parents.next().getId() === dest.getId()) return;
      f.moveTo(dest); moved++;
    } catch (e) { skipped++; }
  };
  readAll_('Files').forEach(function (x) { move(x.driveId, x.authorId); });
  readAll_('Posts').forEach(function (p) { (p.photos ? p.photos.split(',') : []).forEach(function (id) { move(id, p.authorId); }); });
  Object.keys(members).forEach(function (id) { move(members[id].avatar, id); move(members[id].cover, id); });
  Logger.log('Done. Moved ' + moved + ' files into member folders. ' + skipped + ' were left in the main folder (church files, or files that are gone).');
}

/* ---------- Bible game helpers ---------- */
const GAME_MODES = ['quiz', 'verse', 'who', 'books', 'challenge', 'puzzle', 'wordsearch', 'memory', 'kids', 'cards'];
/* a game week runs Sunday to Sabbath; it is named by the date of its Sabbath (Philippine time) */
function gameWeek_(ms) {
  const d = new Date(ms + 8 * 36e5), add = (6 - d.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + add)).toISOString().slice(0, 10);
}
/* Sabbath afternoon: from 1 PM until a little after sunset (Philippine time, with a few minutes to spare) */
function challengeOpen_(ms) {
  const d = new Date(ms + 8 * 36e5);
  if (d.getUTCDay() !== 6) return false;
  const mins = d.getUTCHours() * 60 + d.getUTCMinutes();
  return mins >= 12 * 60 + 55 && mins <= 18 * 60 + 40;
}

/* Posts a reminder announcement before each event that has reminders turned on. */
function eventReminders_(now) {
  const lead = Math.min(24, Math.max(1, Number(getSetting_('remindHours')) || 3)) * 36e5;
  const props = PropertiesService.getScriptProperties();
  const done = String(props.getProperty('EV_REMINDED') || '').split(',').filter(Boolean);
  const today = phDate_(now);
  readAll_('Events').forEach(function (ev) {
    if (ev.remind !== '1' || ev.date < today) return;
    const hm = (ev.time || '08:00').split(':');
    const d = ev.date.split('-');
    const start = Date.UTC(+d[0], +d[1] - 1, +d[2], +hm[0], +hm[1]) - 8 * 36e5;
    const at = ev.time ? start - lead : start - 2 * 36e5;    // all-day events: remind at 6 AM that day
    if (now < at || now > start + 36e5) return;
    const key = ev.id + '_' + ev.date;
    if (done.indexOf(key) >= 0) return;
    const when = ev.date === today ? 'today' : 'tomorrow';
    const text = ev.title + ' ' + when + (ev.time ? ' at ' + time12_(ev.time) : '') + (ev.place ? ', ' + ev.place : '') + '.' + (ev.desc ? ' ' + ev.desc : '');
    withLock_(function () {
      append_('Posts', { id: id_('wrem'), authorId: 'system', cat: 'announcement', pinned: '', photos: '', createdAt: String(now), sms: '', svc: 'ev|' + ev.date, text: text });
      done.push(key);
      props.setProperty('EV_REMINDED', done.slice(-40).join(','));
      bump_();
    });
    osPush_(getSetting_('churchName') || 'Tubod SDA Church', text);
  });
}

/* Makes a copy of the whole church sheet in "Tubod SDA Church files / Backups" and keeps the newest 8 copies.
   It runs by itself once a week (with the hourly trigger), or run backupNow from the editor any time. */
function backupNow() { Logger.log('Saved backup: ' + backup_()); }
function backup_() {
  const props = PropertiesService.getScriptProperties();
  let folder = null;
  const id = props.getProperty('BACKUP_FOLDER_ID');
  if (id) { try { folder = DriveApp.getFolderById(id); } catch (e) { folder = null; } }
  if (!folder) { folder = folder_().createFolder('Backups'); props.setProperty('BACKUP_FOLDER_ID', folder.getId()); }
  const name = 'Tubod SDA backup ' + phDate_(nowMs_());
  DriveApp.getFileById(SpreadsheetApp.getActiveSpreadsheet().getId()).makeCopy(name, folder);
  const list = [], it = folder.getFiles();
  while (it.hasNext()) list.push(it.next());
  list.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  list.slice(8).forEach(function (f) { try { f.setTrashed(true); } catch (e) {} });
  props.setProperty('LAST_BACKUP', String(nowMs_()));
  return name;
}

/* If you ever change the sheet by hand (edit a post, a setting, a name), run this once so the site notices. */
function refreshSite() {
  bump_();
  Logger.log('Done. The site will show the new data within about 30 seconds.');
}

/* Make someone an admin. Type their username below and run this from the editor. */
function makeAdminFromEditor() {
  const USERNAME = 'your-username';
  const m = readAll_('Members').filter(function (x) { return x.username === USERNAME.toLowerCase(); })[0];
  if (!m) throw new Error('No member with that username. Check the Members tab for the exact username.');
  update_('Members', m.id, { access: 'admin' });
  bump_();
  Logger.log(USERNAME + ' is now an admin. Sign out and sign in again on the website.');
}

/* Forgot the admin password? Fill in the two lines below and run this from the editor. */
function resetPasswordFromEditor() {
  const USERNAME = 'your-username';
  const NEW_PASSWORD = 'choose-a-new-password';
  const m = readAll_('Members').filter(function (x) { return x.username === USERNAME.toLowerCase(); })[0];
  if (!m) throw new Error('No member with that username.');
  const salt = Utilities.getUuid();
  update_('Members', m.id, { salt: salt, hash: hash_(NEW_PASSWORD, salt) });
  Logger.log('Password changed for ' + USERNAME);
}

/* ---------- web app entry points ---------- */
function doGet() {
  return json_({ ok: true, app: 'Tubod SDA Church', rev: rev_(), bigUpload: true, memberFolders: true, memberStatus: true, siteEditor: true, records: true, officers: true, push: true, giving: true, roster: true, anniversaries: true, visitors: true, prayers: true, lesson: true, offerings: true, transfers: true, consent: true, activity: true, photoMonths: true, v: 14 });
}

function doPost(e) {
  let out;
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const fn = ACTIONS[req.action];
    if (!fn) throw err_('Unknown request.', 'bad_action');
    let me = null;
    if (OPEN[req.action] !== true) {
      me = sessionUser_(req.token);
      if (!me) throw err_('Please sign in again.', 'auth');
      if (me.access === 'pending' && PENDING_OK[req.action] !== true) throw err_('Your account is waiting for a church admin to approve it.', 'pending');
    }
    if (WRITE[req.action] === true) {
      const lock = LockService.getScriptLock();
      lock.waitLock(20000);
      try { out = fn(req, me); if (NOBUMP[req.action] !== true) bump_(); } finally { lock.releaseLock(); }
      /* Send the refreshed church data back with this same reply, so the app needs only one trip to the server instead of two. */
      if (req.withSync === true && me && me.access !== 'pending' && req.action !== 'logout') {
        try { out = Object.assign({}, out, { sync: ACTIONS.sync({ token: req.token }, me) }); } catch (e) {}
      }
    } else {
      out = fn(req, me);
    }
    out = Object.assign({ ok: true }, out || {});
  } catch (err) {
    out = { ok: false, error: String(err && err.message || err), code: (err && err.code) || 'error' };
  }
  return json_(out);
}

const OPEN = { ping: true, publicInfo: true, register: true, login: true, visitorCard: true, prayerRequest: true };
/* what a new member may do while waiting for approval */
const PENDING_OK = { sync: true, logout: true, ping: true };
/* these change no shared data, so they must not make everyone reload (and must not throw away the saved copy) */
const NOBUMP = { login: true, logout: true, backupNow: true, saveScore: true, addOffering: true, deleteOffering: true, addTransfer: true, deleteTransfer: true };
const WRITE = {
  register: true, login: true, logout: true, post: true, deletePost: true, pinPost: true, comment: true,
  deleteComment: true, react: true, saveProfile: true, changePassword: true, uploadFile: true, finishUpload: true, deleteFile: true,
  saveSettings: true, setAccess: true, removeMember: true, resetPassword: true, saveProgram: true,
  saveEvent: true, deleteEvent: true, saveSabbath: true, goLive: true, saveScore: true,
  setMemberStatus: true, addPerson: true, adminSaveMember: true, saveSite: true,
  saveAttendance: true, saveGroup: true, deleteGroup: true, joinGroup: true, setGroupMember: true,
  saveOfficers: true, saveGiving: true, saveRoster: true, handleVisitor: true,
  prayerRequest: true, handlePrayer: true, saveLesson: true, addOffering: true, deleteOffering: true, addTransfer: true, deleteTransfer: true
};

const ACTIONS = {
  ping: function () { return { rev: rev_() }; },

  publicInfo: function () {
    return { rev: rev_(), church: { churchName: getSetting_('churchName') || 'Tubod SDA Church', tagline: getSetting_('tagline') || '', bgId: getSetting_('bgId') || '' } };
  },

  /* a first-time visitor introduces themselves without needing an account */
  visitorCard: function (r) {
    const tryAgain = throttle_('vis');
    const name = clean_(r.name, 60), contact = clean_(r.contact, 80), heard = clean_(r.heard, 80), message = clean_(r.message, 500, true);
    if (name.length < 2) { tryAgain(); throw err_('Please enter your name.', 'invalid'); }
    if (!contact) { tryAgain(); throw err_('Please leave a way for the church to reach you.', 'invalid'); }
    append_('Visitors', { id: id_('v'), name: name, contact: contact, heard: heard, message: message, createdAt: String(nowMs_()), handled: '', handledBy: '', consent: phDate_(nowMs_()) });
    bump_();
    return {};
  },

  /* a prayer request — anyone may send one, with or without an account */
  prayerRequest: function (r) {
    const tryAgain = throttle_('pray');
    const name = clean_(r.name, 60), contact = clean_(r.contact, 80), request = clean_(r.request, 1000, true);
    if (request.length < 3) { tryAgain(); throw err_('Please write your prayer request.', 'invalid'); }
    append_('Prayers', { id: id_('pr'), name: name, contact: contact, request: request, private: r.private ? '1' : '', createdAt: String(nowMs_()), handled: '', handledBy: '', consent: phDate_(nowMs_()) });
    bump_();
    return {};
  },

  listPrayers: function (r, me) {
    needMem_(me);
    return { prayers: readAll_('Prayers').map(function (p) {
      return { id: p.id, name: p.name, contact: p.contact, request: p.request, private: p.private === '1', createdAt: Number(p.createdAt) || 0, handled: p.handled === '1', handledBy: p.handledBy };
    }).sort(function (a, b) { return b.createdAt - a.createdAt; }) };
  },

  handlePrayer: function (r, me) {
    needMem_(me);
    const p = readAll_('Prayers').filter(function (x) { return x.id === r.id; })[0];
    if (!p) return {};
    if (r.remove) { remove_('Prayers', function (x) { return x.id === r.id; }); log_(me, 'prayer', null, 'Removed a prayer request'); return {}; }
    update_('Prayers', p.id, { handled: r.handled ? '1' : '', handledBy: r.handled ? me.name : '' });
    log_(me, 'prayer', null, r.handled ? 'Marked a prayer request as prayed for' : 'Marked a prayer request as new again');
    return {};
  },

  listVisitors: function (r, me) {
    needMem_(me);
    return { visitors: readAll_('Visitors').map(function (v) {
      return { id: v.id, name: v.name, contact: v.contact, heard: v.heard, message: v.message, createdAt: Number(v.createdAt) || 0, handled: v.handled === '1', handledBy: v.handledBy };
    }).sort(function (a, b) { return b.createdAt - a.createdAt; }) };
  },

  handleVisitor: function (r, me) {
    needMem_(me);
    const v = readAll_('Visitors').filter(function (x) { return x.id === r.id; })[0];
    if (!v) return {};
    if (r.remove) { remove_('Visitors', function (x) { return x.id === r.id; }); log_(me, 'visitor', null, 'Removed a visitor card: ' + v.name); return {}; }
    update_('Visitors', v.id, { handled: r.handled ? '1' : '', handledBy: r.handled ? me.name : '' });
    log_(me, 'visitor', null, (r.handled ? 'Marked visitor as followed up: ' : 'Marked visitor as new again: ') + v.name);
    return {};
  },

  register: function (r) {
    const name = clean_(r.name, 60), username = String(r.username || '').trim().toLowerCase(), pw = String(r.password || '');
    if (name.length < 2) throw err_('Please enter your full name.', 'invalid');
    if (!/^[a-z0-9._@+-]{3,40}$/.test(username)) throw err_('Choose a username of 3 or more letters or numbers, with no spaces.', 'invalid');
    if (pw.length < 6) throw err_('Your password needs at least 6 characters.', 'invalid');
    const tryAgain = throttle_('reg');
    if (String(r.code || '').trim().toUpperCase() !== String(getSetting_('joinCode') || '').trim().toUpperCase()) {
      tryAgain();
      throw err_('That church join code is not right. Ask the church admin for it.', 'code');
    }
    const members = readAll_('Members');
    if (members.some(function (m) { return m.username === username; })) throw err_('That username is taken. Try another one.', 'taken');
    const salt = Utilities.getUuid();
    const m = {
      id: id_('m'), name: name, username: username, salt: salt, hash: hash_(pw, salt),
      access: members.length === 0 ? 'admin' : (getSetting_('requireApproval') === '0' ? 'member' : 'pending'), createdAt: String(Date.now()),
      title: '', ministries: '', since: '', bio: '', verse: '', avatar: '', cover: '', consent: phDate_(nowMs_())
    };
    append_('Members', m);
    return { token: newSession_(m.id) };
  },

  login: function (r) {
    const username = String(r.username || '').trim().toLowerCase();
    const tryAgain = throttle_('login_' + username);
    const m = username ? readAll_('Members').filter(function (x) { return x.username === username; })[0] : null;
    if (!m || !m.hash || hash_(String(r.password || ''), m.salt) !== m.hash) {
      tryAgain();
      throw err_('Wrong username or password.', 'login');
    }
    if (m.mstatus === 'deceased') throw err_('This account is closed. Talk to the church admin.', 'closed');
    purgeSessions_();
    const tok = newSession_(m.id);
    activity_(m, 'login', 'Signed in');
    let firstSync = null;
    try { firstSync = ACTIONS.sync({ token: tok }, m); } catch (e) {}
    return { token: tok, sync: firstSync };
  },

  logout: function (r) {
    remove_('Sessions', function (s) { return s.token === r.token; });
    CacheService.getScriptCache().remove('s_' + r.token);
    return {};
  },

  sync: function (r, me) {
    if (me.access === 'pending') {
      return { rev: rev_(), pending: true, me: { id: me.id, access: 'pending', name: me.name },
        settings: { churchName: getSetting_('churchName') || 'Tubod SDA Church', tagline: getSetting_('tagline') || '', bgId: getSetting_('bgId') || '' },
        members: [], posts: [], comments: [], reactions: [], files: [], program: [], events: [] };
    }
    const lv = me.access === 'admin' ? 'a' : me.access === 'clerk' ? 'c' : canPost_(me) ? 'e' : 'm';
    const rev = rev_();
    /* Reading every tab of the sheet is the slow part, so the answer is kept for each revision.
       Any change to the site changes the revision, which throws the old copy away. */
    const key = 'sync_' + rev + '_' + lv;
    let body = null;
    const hit = cacheGetBig_(key);
    if (hit) { try { body = JSON.parse(hit); } catch (e) { body = null; } }
    if (!body) {
      body = buildSync_(lv, rev);
      cachePutBig_(key, JSON.stringify(body), 3600);
    }
    body.me = { id: me.id, access: me.access, name: me.name, phone: me.phone, sms: me.sms === '1' };
    return body;
  },

  post: function (r, me) {
    const cat = POST_CATS.indexOf(r.cat) >= 0 ? r.cat : 'share';
    if (cat === 'announcement' && !canPost_(me)) throw err_('Only church leaders can send announcements.', 'denied');
    let grp = '';
    if (r.grp) {
      const g = readAll_('Groups').filter(function (x) { return x.id === r.grp; })[0];
      if (!g) throw err_('That group is gone.', 'missing');
      if (me.access !== 'admin' && String(me.groups || '').split(',').indexOf(g.id) < 0) throw err_('Join the group first to post in it.', 'denied');
      grp = g.id;
    }
    const text = clean_(r.text, 3000, true);
    const photos = (Array.isArray(r.photos) ? r.photos : []).slice(0, 10);
    if (!text && !photos.length) throw err_('Write something or add a photo first.', 'invalid');
    const now = nowMs_();
    const dest = photos.length ? monthFolder_(me, now) : null;
    const stamp = phStamp_(now);
    const ids = photos.map(function (d, i) { return saveImage_(d, stamp + '_' + cat + '_' + (i + 1), dest); });
    let svc = '';
    if (cat === 'announcement' && r.svc) {
      const sv = services_().filter(function (x) { return x.id === r.svc; })[0];
      if (sv) svc = sv.id + '|' + (r.svcDate && validSvcDate_(sv, r.svcDate, nowMs_()) ? r.svcDate : openDate_(sv, nowMs_()));
    }
    const id = id_('p');
    append_('Posts', { id: id, authorId: me.id, cat: cat, text: text, photos: ids.join(','), pinned: (canPost_(me) && r.pinned) ? '1' : '', createdAt: String(Date.now()), svc: svc, grp: grp });
    activity_(me, 'post', (grp ? 'Group post' : cat === 'announcement' ? 'Announcement' : cat) + (text ? ': ' + text.slice(0, 60) : '') + (ids.length ? ' · ' + ids.length + ' photo' + (ids.length > 1 ? 's' : '') : ''));
    if (cat === 'announcement' && !grp) osPush_(getSetting_('churchName') || 'Tubod SDA Church', text);
    return { id: id };
  },

  deletePost: function (r, me) {
    const p = readAll_('Posts').filter(function (x) { return x.id === r.id; })[0];
    if (!p) return {};
    if (p.authorId !== me.id && me.access !== 'admin') throw err_('You can only delete your own posts.', 'denied');
    if (p.authorId !== me.id) log_(me, 'post', { id: p.authorId, name: nameOf_(p.authorId) }, 'Deleted a post: ' + String(p.text || '(photos)').slice(0, 80));
    (p.photos ? p.photos.split(',') : []).forEach(trash_);
    remove_('Comments', function (c) { return c.postId === p.id; });
    remove_('Reactions', function (x) { return x.postId === p.id; });
    remove_('Posts', function (x) { return x.id === p.id; });
    return {};
  },

  pinPost: function (r, me) {
    needPost_(me);
    const p = readAll_('Posts').filter(function (x) { return x.id === r.id; })[0];
    if (p) update_('Posts', p.id, { pinned: p.pinned === '1' ? '' : '1' });
    return {};
  },

  comment: function (r, me) {
    const text = clean_(r.text, 500);
    if (!text) throw err_('Write something first.', 'invalid');
    if (!readAll_('Posts').some(function (p) { return p.id === r.postId; })) throw err_('That post is gone.', 'missing');
    append_('Comments', { id: id_('c'), postId: r.postId, authorId: me.id, text: text, createdAt: String(Date.now()) });
    activity_(me, 'comment', text.slice(0, 80));
    return {};
  },

  deleteComment: function (r, me) {
    const c = readAll_('Comments').filter(function (x) { return x.id === r.id; })[0];
    if (!c) return {};
    if (c.authorId !== me.id && me.access !== 'admin') throw err_('You can only delete your own comments.', 'denied');
    if (c.authorId !== me.id) log_(me, 'post', { id: c.authorId, name: nameOf_(c.authorId) }, 'Deleted a comment: ' + String(c.text || '').slice(0, 80));
    remove_('Comments', function (x) { return x.id === c.id; });
    return {};
  },

  react: function (r, me) {
    const rid = String(r.postId) + '_' + me.id;
    const had = readAll_('Reactions').some(function (x) { return x.id === rid; });
    if (had) remove_('Reactions', function (x) { return x.id === rid; });
    else { append_('Reactions', { id: rid, postId: String(r.postId), uid: me.id, createdAt: String(Date.now()) }); activity_(me, 'like', 'Liked a post'); }
    return {};
  },

  saveProfile: function (r, me) {
    update_('Members', me.id, profilePatch_(r, me, false));
    return {};
  },

  /* An admin edits any member's details, including people listed without an account. */
  adminSaveMember: function (r, me) {
    needMem_(me);
    const who = readAll_('Members').filter(function (m) { return m.id === r.uid; })[0];
    if (!who) throw err_('That member is no longer here.', 'missing');
    const st = Object.prototype.hasOwnProperty.call(r, 'status') ? statusFields_(r) : null;
    const dying = st && st.mstatus === 'deceased' && who.mstatus !== 'deceased';
    if (dying && who.id === me.id) throw err_('You cannot mark yourself as deceased.', 'denied');
    if (dying && who.access === 'admin' && readAll_('Members').filter(function (m) { return m.access === 'admin' && m.mstatus !== 'deceased'; }).length <= 1)
      throw err_('The church needs at least one admin.', 'denied');
    const patch = Object.assign(profilePatch_(r, who, true), st || {});
    if (dying && who.access !== 'member' && who.access !== 'roll') patch.access = 'member';
    update_('Members', who.id, patch);
    const changed = Object.keys(patch).filter(function (k) { return ['mstatus', 'mstatusDate', 'mstatusNote', 'access'].indexOf(k) < 0 && String(patch[k] || '') !== String(who[k] || ''); });
    const NAMES = { name: 'name', title: 'role', ministries: 'ministries', since: 'member since', bio: 'about', verse: 'verse', bday: 'birthday', baptDate: 'baptism date', baptBy: 'baptized by', baptPlace: 'place of baptism', avatar: 'photo', cover: 'cover photo', household: 'family' };
    if (changed.length) log_(me, 'member', { id: who.id, name: patch.name || who.name }, 'Edited: ' + changed.map(function (k) { return NAMES[k] || k; }).join(', ') +
      (changed.some(function (k) { return k.indexOf('bapt') === 0; }) ? ' (baptism: ' + [patch.baptDate, patch.baptBy, patch.baptPlace].filter(String).join(' · ') + ')' : ''));
    if (st) statusLog_(me, { id: who.id, name: patch.name || who.name, mstatus: who.mstatus, mstatusDate: who.mstatusDate, mstatusNote: who.mstatusNote }, st);
    if (dying) remove_('Sessions', function (x) { return x.uid === who.id; });
    return {};
  },

  /* What admins can change about the site itself: texts, logo, colors, menu tabs, roles and library categories. */
  saveSite: function (r, me) {
    if (me.access !== 'admin') throw err_('Only church leaders can edit the site.', 'denied');
    const upd = {};
    log_(me, 'site', null, r.resetLogo && r.site && !Object.keys((r.site || {}).texts || {}).length ? 'Put the site back to how it was' : 'Changed the site' + (r.logo ? ' and the logo' : ''));
    if (r.site) {
      upd.site = JSON.stringify(cleanSite_(r.site));
      if (upd.site.length > 45000) throw err_('That is too much text to save. Make some of the changed texts shorter, or remove a few.', 'too_big');
    }
    if (r.logo) { trash_(getSetting_('logoId')); upd.logoId = saveImage_(r.logo, 'logo'); }
    else if (r.resetLogo) { trash_(getSetting_('logoId')); upd.logoId = ''; }
    setSettings_(upd);
    return {};
  },

  changePassword: function (r, me) {
    if (hash_(String(r.oldPassword || ''), me.salt) !== me.hash) throw err_('Your current password is not right.', 'login');
    if (String(r.newPassword || '').length < 6) throw err_('Your new password needs at least 6 characters.', 'invalid');
    const salt = Utilities.getUuid();
    update_('Members', me.id, { salt: salt, hash: hash_(String(r.newPassword), salt) });
    return {};
  },

  uploadFile: function (r, me) {
    const title = clean_(r.title, 100);
    const data = String(r.data || '');
    if (!title) throw err_('Give the file a title.', 'invalid');
    if (!data || data.length > MAX_FILE_BASE64) throw err_('That file is too big. The limit is 15 MB.', 'too_big');
    const name = clean_(r.name, 120) || 'file';
    const mime = String(r.mime || 'application/octet-stream').slice(0, 100);
    const bytes = Utilities.base64Decode(data);
    checkQuota_(me, bytes.length);
    const f = memberFolder_(me).createFile(Utilities.newBlob(bytes, mime, name));
    f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    append_('Files', {
      id: id_('f'), title: title, cat: fileCats_().indexOf(r.cat) >= 0 ? r.cat : 'other', desc: clean_(r.desc, 300, true),
      driveId: f.getId(), name: name, mime: mime, size: String(bytes.length), authorId: me.id, createdAt: String(Date.now())
    });
    activity_(me, 'upload', 'Uploaded a file: ' + title);
    return {};
  },

  /* Big files go from the member's browser straight to Google Drive. The server only opens an upload
     session (a private one-time web address) and hands that address back. The owner's Google login
     never leaves this script. */
  startUpload: function (r, me) {
    const size = Math.floor(Number(r.size));
    if (!(size > 0)) throw err_('That file is empty.', 'invalid');
    if (size > MAX_BIG_BYTES) throw err_('That file is too big. The limit is 50 GB.', 'too_big');
    checkQuota_(me, size);
    try {
      const free = DriveApp.getStorageLimit() - DriveApp.getStorageUsed();
      if (DriveApp.getStorageLimit() > 0 && size > free) {
        throw err_('The church Google Drive does not have enough space for this file (' + Math.ceil(free / 1048576) + ' MB free). Ask the church admin to free up space or buy more Google storage.', 'no_space');
      }
    } catch (e) { if (e.code === 'no_space') throw e; /* storage figures unavailable: let Drive decide */ }
    const mime = String(r.mime || 'application/octet-stream').replace(/[^\w.+\-\/]/g, '').slice(0, 100) || 'application/octet-stream';
    const origin = String(r.origin || '');
    if (!/^https?:\/\/[\w.\-]+(:\d+)?$/.test(origin)) throw err_('Could not start the upload from this page.', 'invalid');
    const uploadId = Utilities.getUuid().replace(/-/g, '');
    const res = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id', {
      method: 'post',
      contentType: 'application/json; charset=UTF-8',
      headers: {
        Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
        'X-Upload-Content-Type': mime,
        'X-Upload-Content-Length': String(size),
        Origin: origin
      },
      payload: JSON.stringify({ name: 'up_' + uploadId, description: me.id, mimeType: mime, parents: [memberFolder_(me).getId()] }),
      muteHttpExceptions: true
    });
    const code = res.getResponseCode();
    const hdr = res.getAllHeaders() || {};
    const url = hdr.Location || hdr.location || '';
    if (code !== 200 || !url) {
      if (code === 403 || code === 401) throw err_('Google Drive refused the upload. The church admin may need to re-authorize the church script (see SETUP.md).', 'drive');
      throw err_('Could not start the upload (Google Drive said ' + code + '). Try again in a moment.', 'drive');
    }
    return { uploadId: uploadId, url: String(url) };
  },

  finishUpload: function (r, me) {
    const title = clean_(r.title, 100);
    if (!title) throw err_('Give the file a title.', 'invalid');
    const uploadId = String(r.uploadId || '');
    if (!/^[0-9a-f]{32}$/.test(uploadId)) throw err_('That upload could not be found.', 'invalid');
    const want = 'up_' + uploadId;
    let f = null;
    const id = String(r.driveId || '');
    if (/^[\w-]{10,80}$/.test(id)) { try { f = DriveApp.getFileById(id); } catch (e) { f = null; } }
    if (f && f.getName() !== want) f = null;
    for (let i = 0; !f && i < 6; i++) {          // Drive can take a few seconds to list a new file
      const it = memberFolder_(me).getFilesByName(want), it2 = it.hasNext() ? it : folder_().getFilesByName(want);
      if (it2.hasNext()) f = it2.next(); else if (i < 5) Utilities.sleep(2000);
    }
    if (!f) throw err_('Drive has not finished saving the file yet. Wait a moment and try again.', 'not_ready');
    if (f.getDescription() !== me.id) throw err_('That upload belongs to someone else.', 'denied');
    const name = clean_(r.name, 120) || 'file';
    const mime = f.getMimeType() || String(r.mime || 'application/octet-stream').slice(0, 100);
    f.setName(name);
    f.setDescription('');
    f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    append_('Files', {
      id: id_('f'), title: title, cat: fileCats_().indexOf(r.cat) >= 0 ? r.cat : 'other', desc: clean_(r.desc, 300, true),
      driveId: f.getId(), name: name, mime: mime, size: String(f.getSize()), authorId: me.id, createdAt: String(Date.now())
    });
    activity_(me, 'upload', 'Uploaded a file: ' + title);
    return {};
  },

  deleteFile: function (r, me) {
    const f = readAll_('Files').filter(function (x) { return x.id === r.id; })[0];
    if (!f) return {};
    if (f.authorId !== me.id && me.access !== 'admin') throw err_('You can only delete your own files.', 'denied');
    if (f.authorId !== me.id) log_(me, 'file', { id: f.authorId, name: nameOf_(f.authorId) }, 'Deleted a file: ' + f.title);
    trash_(f.driveId);
    remove_('Files', function (x) { return x.id === f.id; });
    return {};
  },

  saveSettings: function (r, me) {
    if (me.access !== 'admin') throw err_('Only church leaders can change settings.', 'denied');
    log_(me, 'settings', null, 'Changed the church settings');
    const upd = {};
    upd.churchName = clean_(r.churchName, 60) || 'Tubod SDA Church';
    upd.tagline = clean_(r.tagline, 80);
    upd.schedule = clean_(r.schedule, 400, true);
    upd.verse = clean_(r.verse, 300, true);
    const code = clean_(r.joinCode, 30);
    if (code) upd.joinCode = code;
    if (Array.isArray(r.services)) {
      const list = r.services.slice(0, 12).map(function (x, i) {
        const day = Number(x && x.day), time = String(x && x.time || '');
        if (!(day >= 0 && day <= 6 && day % 1 === 0 && /^([01]\d|2[0-3]):[0-5]\d$/.test(time))) return null;
        return { id: /^[\w-]{1,20}$/.test(String(x.id || '')) ? String(x.id) : 's' + i + Math.random().toString(36).slice(2, 5), name: clean_(x.name, 60) || 'Worship', day: day, time: time };
      }).filter(Boolean);
      upd.services = JSON.stringify(list);
    }
    if (Object.prototype.hasOwnProperty.call(r, 'autoRemind')) upd.autoRemind = r.autoRemind ? '1' : '';
    if (Object.prototype.hasOwnProperty.call(r, 'autoSms')) upd.autoSms = r.autoSms ? '1' : '';
    if (Object.prototype.hasOwnProperty.call(r, 'requireApproval')) upd.requireApproval = r.requireApproval ? '1' : '0';
    if (Object.prototype.hasOwnProperty.call(r, 'liveUrl')) {
      const u = String(r.liveUrl || '').trim();
      if (u && !/^https:\/\/[^\s"'<>]{4,400}$/.test(u)) throw err_('The livestream link must start with https://', 'invalid');
      upd.liveUrl = u;
    }
    if (Object.prototype.hasOwnProperty.call(r, 'memberQuotaGB')) {
      const q = Math.floor(Number(r.memberQuotaGB));
      if (!(q >= 0 && q <= 10000)) throw err_('Enter a storage limit from 0 to 10000 GB (0 means no limit).', 'invalid');
      upd.memberQuotaGB = String(q);
    }
    if (r.remindHours) upd.remindHours = String(Math.min(24, Math.max(1, parseInt(r.remindHours, 10) || 3)));
    if (r.bg) { trash_(getSetting_('bgId')); upd.bgId = saveImage_(r.bg, 'background'); }
    else if (r.resetBg) { trash_(getSetting_('bgId')); upd.bgId = ''; }
    setSettings_(upd);
    return {};
  },

  setAccess: function (r, me) {
    if (me.access !== 'admin') throw err_('Only church leaders can do that.', 'denied');
    const access = LEVELS.indexOf(r.access) >= 0 ? r.access : 'member';
    const who = readAll_('Members').filter(function (m) { return m.id === r.uid; })[0];
    if (!who) throw err_('That member is no longer here.', 'missing');
    if (who.access === 'roll') throw err_('This person has no account on the site.', 'invalid');
    const admins = readAll_('Members').filter(function (m) { return m.access === 'admin'; });
    if (access !== 'admin' && admins.length === 1 && admins[0].id === r.uid) throw err_('The church needs at least one admin.', 'denied');
    update_('Members', r.uid, { access: access });
    const LV = { admin: 'Church admin', clerk: 'Clerk / pastor', editor: 'Announcements and program', member: 'Member' };
    log_(me, 'access', who, who.access === 'pending' ? 'Approved the account' : 'Changed the role to: ' + LV[access]);
    return {};
  },

  removeMember: function (r, me) {
    if (me.access !== 'admin') throw err_('Only church leaders can do that.', 'denied');
    if (r.uid === me.id) throw err_('You cannot remove yourself.', 'denied');
    const m = readAll_('Members').filter(function (x) { return x.id === r.uid; })[0];
    if (!m) return {};
    trash_(m.avatar); trash_(m.cover);
    log_(me, 'member', m, m.access === 'pending' ? 'Declined the new account' : 'Removed from the list' + (m.mstatus ? ' (was ' + ST_LABEL[m.mstatus] + ')' : ''));
    remove_('Sessions', function (s) { return s.uid === m.id; });
    remove_('Members', function (x) { return x.id === m.id; });
    return {};
  },

  saveSabbath: function (r, me) {
    needPost_(me);
    const link = String(r.link || '').trim();
    if (link && !/^https?:\/\/[^\s"'<>]{4,400}$/.test(link)) throw err_('The lesson link must start with https://', 'invalid');
    const date = String(r.date || '');
    const v = { date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '', lesson: clean_(r.lesson, 120), link: link, speaker: clean_(r.speaker, 80),
      reading: clean_(r.reading, 120), ssTeacher: clean_(r.ssTeacher, 80), note: clean_(r.note, 400, true) };
    setSettings_({ sabbath: JSON.stringify(v) });
    return {};
  },

  goLive: function (r, me) {
    needPost_(me);
    if (r.on && !getSetting_('liveUrl')) throw err_('Add the livestream link in Settings first.', 'invalid');
    setSettings_({ liveUntil: r.on ? String(nowMs_() + 3 * 36e5) : '' });
    return {};
  },

  saveEvent: function (r, me) {
    if (!canPost_(me)) throw err_('Only church leaders can add events.', 'denied');
    const title = clean_(r.title, 100), date = String(r.date || ''), time = String(r.time || '');
    if (!title) throw err_('Give the event a name.', 'invalid');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date + 'T00:00:00Z'))) throw err_('Choose the date of the event.', 'invalid');
    if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw err_('Choose a proper time, or leave it empty.', 'invalid');
    const row = { title: title, date: date, time: time, place: clean_(r.place, 100), desc: clean_(r.desc, 600, true), remind: r.remind ? '1' : '' };
    const id = String(r.id || '');
    if (id && readAll_('Events').some(function (x) { return x.id === id; })) { update_('Events', id, row); return { id: id }; }
    const nid = id_('e');
    row.id = nid; row.createdBy = me.id; row.createdAt = String(Date.now());
    append_('Events', row);
    remove_('Events', function (x) { return x.date < phDate_(nowMs_() - 365 * 864e5); });
    return { id: nid };
  },

  deleteEvent: function (r, me) {
    if (!canPost_(me)) throw err_('Only church leaders can remove events.', 'denied');
    remove_('Events', function (x) { return x.id === r.id; });
    return {};
  },

  /* ---------- member status: active, inactive, backslidden, offshoot, deceased ---------- */
  setMemberStatus: function (r, me) {
    needMem_(me);
    const v = statusFields_(r);
    const who = readAll_('Members').filter(function (m) { return m.id === r.uid; })[0];
    if (!who) throw err_('That member is no longer here.', 'missing');
    if (v.mstatus === 'deceased' && who.id === me.id) throw err_('You cannot mark yourself as deceased.', 'denied');
    if (v.mstatus === 'deceased' && who.access === 'admin') {
      const admins = readAll_('Members').filter(function (m) { return m.access === 'admin' && m.mstatus !== 'deceased'; });
      if (admins.length <= 1) throw err_('The church needs at least one admin.', 'denied');
    }
    update_('Members', who.id, v);
    statusLog_(me, who, v);
    if (v.mstatus === 'deceased') {
      remove_('Sessions', function (s) { return s.uid === who.id; });
      if (who.access !== 'member' && who.access !== 'roll') update_('Members', who.id, { access: 'member' });
    }
    return {};
  },

  /* Adds someone to the church list who has no account (an older member, or someone who passed away). */
  addPerson: function (r, me) {
    needMem_(me);
    const name = clean_(r.name, 60);
    if (name.length < 2) throw err_('Please enter the full name.', 'invalid');
    const v = statusFields_(r);
    const m = { id: id_('m'), name: name, username: '', salt: '', hash: '', access: 'roll', createdAt: String(Date.now()),
      title: clean_(r.role, 60), ministries: '', since: /^\d{4}$/.test(String(r.since || '')) ? String(r.since) : '', bio: '', verse: '', avatar: '', cover: '' };
    append_('Members', Object.assign(m, v));
    log_(me, 'member', m, 'Added to the list (no account)');
    if (v.mstatus) statusLog_(me, { id: m.id, name: m.name, mstatus: '' }, v);
    return { id: m.id };
  },

  /* ---------- records, attendance, groups ---------- */
  getLog: function (r, me) {
    needMem_(me);
    const rows = readAll_('Log').map(function (x) { return { id: x.id, time: Number(x.time) || 0, by: x.byName, kind: x.kind, targetId: x.targetId, target: x.targetName, detail: x.detail }; });
    rows.sort(function (a, b) { return b.time - a.time; });
    return { log: rows.slice(0, 5000) };
  },

  /* Admin-only: every activity of one member (logins, posts, comments, likes, uploads). */
  memberActivity: function (r, me) {
    if (me.access !== 'admin') throw err_('Only the church admin can see a member\'s activity.', 'denied');
    const uid = String(r.uid || '');
    if (!uid) throw err_('Choose a member first.', 'invalid');
    const rows = readAll_('Activity').filter(function (x) { return x.uid === uid; })
      .map(function (x) { return { id: x.id, time: Number(x.time) || 0, action: x.action, detail: x.detail }; });
    rows.sort(function (a, b) { return b.time - a.time; });
    return { activity: rows.slice(0, 500), name: nameOf_(uid) };
  },

  getAttendance: function (r, me) {
    if (!canAttend_(me)) throw err_('Only church leaders can see attendance.', 'denied');
    const since = phDate_(nowMs_() - 400 * 864e5);
    return { days: readAll_('Attendance').filter(function (x) { return x.date >= since; }).map(function (x) {
      return { date: x.date, uids: x.uids ? x.uids.split(',') : [], by: x.by };
    }).sort(function (a, b) { return a.date < b.date ? 1 : -1; }) };
  },

  saveAttendance: function (r, me) {
    if (!canAttend_(me)) throw err_('Only church leaders can take attendance.', 'denied');
    const date = String(r.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date + 'T00:00:00Z'))) throw err_('Choose the date.', 'invalid');
    if (date > phDate_(nowMs_() + 864e5)) throw err_('You cannot take attendance for a day that has not come yet.', 'invalid');
    const ids = {}; readAll_('Members').forEach(function (m) { ids[m.id] = true; });
    const uids = (Array.isArray(r.uids) ? r.uids : []).filter(function (u) { return ids[u]; }).filter(function (u, i, a) { return a.indexOf(u) === i; });
    const row = { id: 'd' + date, date: date, uids: uids.join(','), by: me.name, at: String(nowMs_()) };
    if (readAll_('Attendance').some(function (x) { return x.id === row.id; })) update_('Attendance', row.id, row); else append_('Attendance', row);
    log_(me, 'attend', null, 'Attendance for ' + date + ': ' + uids.length + ' present');
    return { count: uids.length };
  },

  saveGroup: function (r, me) {
    needMem_(me);
    const name = clean_(r.name, 50), desc = clean_(r.desc, 300, true);
    if (name.length < 2) throw err_('Give the group a name.', 'invalid');
    if (r.id && readAll_('Groups').some(function (g) { return g.id === r.id; })) { update_('Groups', r.id, { name: name, desc: desc }); return { id: r.id }; }
    const g = { id: id_('g'), name: name, desc: desc, createdAt: String(nowMs_()), createdBy: me.id };
    append_('Groups', g);
    log_(me, 'group', null, 'Made the group ' + name);
    return { id: g.id };
  },

  deleteGroup: function (r, me) {
    needMem_(me);
    const g = readAll_('Groups').filter(function (x) { return x.id === r.id; })[0];
    if (!g) return {};
    remove_('Groups', function (x) { return x.id === g.id; });
    readAll_('Members').forEach(function (m) {
      const list = String(m.groups || '').split(',').filter(Boolean);
      if (list.indexOf(g.id) >= 0) update_('Members', m.id, { groups: list.filter(function (x) { return x !== g.id; }).join(',') });
    });
    readAll_('Posts').forEach(function (p) { if (p.grp === g.id) update_('Posts', p.id, { grp: '' }); });
    log_(me, 'group', null, 'Removed the group ' + g.name);
    return {};
  },

  /* the church officers elected for the year, shown to everyone */
  saveOfficers: function (r, me) {
    needMem_(me);
    const year = String(r.year || '').replace(/\D/g, '').slice(0, 4);
    const list = (Array.isArray(r.list) ? r.list : []).map(function (x) { return { role: clean_(x.role, 60), name: clean_(x.name, 120) }; })
      .filter(function (x) { return x.role || x.name; }).slice(0, 80);
    setSetting_('officers', JSON.stringify({ year: year, list: list }));
    log_(me, 'officers', null, 'Updated the church officers' + (year ? ' for ' + year : ''));
    return {};
  },

  /* GCash and other giving details the church shows to members */
  saveGiving: function (r, me) {
    if (me.access !== 'admin') throw err_('Only church leaders can edit the giving details.', 'denied');
    let cur = {}; try { cur = JSON.parse(getSetting_('giving') || '{}'); } catch (e) { cur = {}; }
    const g = { name: clean_(r.name, 60), number: clean_(r.number, 40), note: clean_(r.note, 400, true), qrId: cur.qrId || '' };
    if (r.qr) { trash_(g.qrId); g.qrId = saveImage_(r.qr, 'gcash-qr'); }
    else if (r.removeQr) { trash_(g.qrId); g.qrId = ''; }
    setSetting_('giving', JSON.stringify(g));
    log_(me, 'giving', null, 'Updated the giving details');
    return {};
  },

  /* who is assigned to each duty on a given Sabbath */
  saveRoster: function (r, me) {
    needPost_(me);
    const date = String(r.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date + 'T00:00:00Z'))) throw err_('Choose the date.', 'invalid');
    let all = {}; try { all = JSON.parse(getSetting_('roster') || '{}'); } catch (e) { all = {}; }
    const list = (Array.isArray(r.list) ? r.list : []).map(function (x) { return { duty: clean_(x.duty, 50), name: clean_(x.name, 80) }; })
      .filter(function (x) { return x.duty || x.name; }).slice(0, 40);
    if (list.length) all[date] = list; else delete all[date];
    Object.keys(all).sort().slice(0, -16).forEach(function (k) { delete all[k]; });
    setSetting_('roster', JSON.stringify(all));
    log_(me, 'roster', null, 'Updated the duty roster for ' + date);
    return {};
  },

  /* this week's Sabbath School lesson (shown to everyone in a card) */
  saveLesson: function (r, me) {
    if (!canPost_(me)) throw err_('Only church leaders can do that.', 'denied');
    const link = String(r.link || '').trim();
    if (link && !/^https?:\/\/[^\s"'<>]{4,400}$/.test(link)) throw err_('The lesson link must start with https://', 'invalid');
    const v = { quarter: clean_(r.quarter, 60), lesson: clean_(r.lesson, 120), link: link, memory: clean_(r.memory, 400, true), date: /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : '' };
    setSetting_('ssLesson', JSON.stringify(v));
    log_(me, 'site', null, 'Updated the Sabbath School lesson');
    return {};
  },

  /* treasurer's private record of tithes and offerings received (admins only, never shown publicly) */
  addOffering: function (r, me) {
    if (me.access !== 'admin') throw err_('Only the treasurer or an admin can do that.', 'denied');
    const date = /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : phDate_(nowMs_());
    const kind = clean_(r.kind, 40) || 'Offering';
    const amount = Math.max(0, Math.round((Number(r.amount) || 0) * 100) / 100);
    if (!amount) throw err_('Enter the amount received.', 'invalid');
    const row = { id: id_('of'), date: date, kind: kind, amount: String(amount), note: clean_(r.note, 200), recordedBy: me.name, createdAt: String(nowMs_()) };
    append_('Offerings', row);
    log_(me, 'giving', null, 'Recorded a giving entry');
    return { id: row.id };
  },

  listOfferings: function (r, me) {
    if (me.access !== 'admin') throw err_('Only the treasurer or an admin can do that.', 'denied');
    return { offerings: readAll_('Offerings').map(function (o) {
      return { id: o.id, date: o.date, kind: o.kind, amount: Number(o.amount) || 0, note: o.note, recordedBy: o.recordedBy, createdAt: Number(o.createdAt) || 0 };
    }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt; }) };
  },

  deleteOffering: function (r, me) {
    if (me.access !== 'admin') throw err_('Only the treasurer or an admin can do that.', 'denied');
    remove_('Offerings', function (x) { return x.id === r.id; });
    log_(me, 'giving', null, 'Removed a giving record');
    return {};
  },

  /* membership transfers received from, or sent to, other churches (clerk and admins) */
  addTransfer: function (r, me) {
    needMem_(me);
    const name = clean_(r.name, 80);
    if (name.length < 2) throw err_('Enter the member name.', 'invalid');
    const direction = r.direction === 'out' ? 'out' : 'in';
    const row = { id: id_('tr'), name: name, direction: direction, church: clean_(r.church, 120), date: /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : phDate_(nowMs_()), note: clean_(r.note, 200), recordedBy: me.name, createdAt: String(nowMs_()) };
    append_('Transfers', row);
    log_(me, 'member', null, (direction === 'in' ? 'Recorded a member received: ' : 'Recorded a member transferred out: ') + name);
    return { id: row.id };
  },

  listTransfers: function (r, me) {
    needMem_(me);
    return { transfers: readAll_('Transfers').map(function (t) {
      return { id: t.id, name: t.name, direction: t.direction, church: t.church, date: t.date, note: t.note, recordedBy: t.recordedBy, createdAt: Number(t.createdAt) || 0 };
    }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt; }) };
  },

  deleteTransfer: function (r, me) {
    needMem_(me);
    remove_('Transfers', function (x) { return x.id === r.id; });
    log_(me, 'member', null, 'Removed a transfer record');
    return {};
  },

  joinGroup: function (r, me) { return groupSet_(me, me, r.id, !!r.on); },

  setGroupMember: function (r, me) {
    needMem_(me);
    const who = readAll_('Members').filter(function (m) { return m.id === r.uid; })[0];
    if (!who) throw err_('That member is no longer here.', 'missing');
    return groupSet_(me, who, r.id, !!r.on);
  },

  /* ---------- Bible game ---------- */
  saveScore: function (r, me) {
    const mode = String(r.mode || '');
    if (GAME_MODES.indexOf(mode) < 0) throw err_('Unknown game.', 'invalid');
    const total = Math.floor(Number(r.total)), correct = Math.floor(Number(r.correct)), score = Math.floor(Number(r.score));
    if (!(total >= 1 && total <= 60 && correct >= 0 && correct <= total && score >= 0 && score <= 3000)) throw err_('That score does not look right.', 'invalid');
    const now = nowMs_(), week = gameWeek_(now);
    if (mode === 'challenge') {
      if (!challengeOpen_(now)) throw err_('The Sabbath Challenge is open on Sabbath afternoon only.', 'closed');
      if (total !== 10) throw err_('That score does not look right.', 'invalid');
      if (readAll_('Scores').some(function (x) { return x.uid === me.id && x.mode === 'challenge' && x.week === week; })) throw err_('You already played this week\'s Sabbath Challenge.', 'already');
    }
    append_('Scores', { id: id_('g'), uid: me.id, mode: mode, score: String(score), correct: String(correct), total: String(total), week: week, day: phDate_(now), createdAt: String(now) });
    if (Math.random() < 0.05) remove_('Scores', function (x) { return Number(x.createdAt) < now - 180 * 864e5; });
    return { week: week };
  },

  gameInfo: function (r, me) {
    const now = nowMs_(), week = gameWeek_(now), lastWeek = gameWeek_(now - 7 * 864e5);
    const names = {};
    readAll_('Members').forEach(function (m) { if (m.access !== 'pending') names[m.id] = m.name; });
    const rows = readAll_('Scores').filter(function (x) { return names[x.uid]; });
    const board = function (list, key) {
      const by = {};
      list.forEach(function (x) { by[x.uid] = (by[x.uid] || 0) + Number(x[key] || 0); });
      return Object.keys(by).map(function (u) { return { uid: u, name: names[u], points: by[u] }; }).sort(function (a, b) { return b.points - a.points; });
    };
    const ch = function (wk) {
      return rows.filter(function (x) { return x.mode === 'challenge' && x.week === wk; })
        .map(function (x) { return { uid: x.uid, name: names[x.uid], score: Number(x.score), correct: Number(x.correct) }; })
        .sort(function (a, b) { return b.score - a.score; });
    };
    const mine = rows.filter(function (x) { return x.uid === me.id; });
    const stats = { games: {}, perfect: {}, correct: 0, days: [], challenges: 0, wins: 0, memoryGood: 0 };
    const days = {};
    mine.forEach(function (x) {
      stats.games[x.mode] = (stats.games[x.mode] || 0) + 1;
      if (x.correct === x.total) stats.perfect[x.mode] = (stats.perfect[x.mode] || 0) + 1;
      stats.correct += Number(x.correct) || 0;
      days[x.day] = true;
      if (x.mode === 'challenge') stats.challenges++;
      if (x.mode === 'memory' && Number(x.correct) >= 0.8 * Number(x.total)) stats.memoryGood++;
    });
    stats.days = Object.keys(days).sort().slice(-120);
    const weeks = {};
    rows.forEach(function (x) { if (x.mode === 'challenge' && x.week < week) weeks[x.week] = true; });
    Object.keys(weeks).forEach(function (wk) { const top = ch(wk)[0]; if (top && top.uid === me.id) stats.wins++; });
    const thisCh = ch(week), myCh = thisCh.filter(function (x) { return x.uid === me.id; })[0] || null;
    return {
      me: { id: me.id, name: me.name, access: me.access },
      services: services_(), week: week, verse: getSetting_('verse') || '',
      weekly: board(rows.filter(function (x) { return x.week === week && x.mode !== 'kids' && x.mode !== 'cards'; }), 'score').slice(0, 10),
      challenge: thisCh.slice(0, 10), lastChallenge: ch(lastWeek).slice(0, 3), myChallenge: myCh, stats: stats
    };
  },

  backupNow: function (r, me) {
    if (me.access !== 'admin') throw err_('Only church leaders can do that.', 'denied');
    return { name: backup_() };
  },

  saveProgram: function (r, me) {
    if (!canPost_(me)) throw err_('Only church leaders can set participants.', 'denied');
    const sv = services_().filter(function (x) { return x.id === r.svcId; })[0];
    if (!sv) throw err_('That worship is not on the schedule.', 'missing');
    if (!validSvcDate_(sv, r.date, nowMs_())) throw err_('Choose a worship date within the next two weeks.', 'invalid');
    const items = (Array.isArray(r.items) ? r.items : []).slice(0, 30).map(function (x) {
      return { role: clean_(x && x.role, 40), name: clean_(x && x.name, 80) };
    }).filter(function (x) { return x.role || x.name; });
    const id = sv.id + '_' + r.date;
    const row = { id: id, svcId: sv.id, date: r.date, items: JSON.stringify(items), updatedAt: String(nowMs_()) };
    if (readAll_('Program').some(function (x) { return x.id === id; })) update_('Program', id, row);
    else append_('Program', row);
    remove_('Program', function (x) { return x.date < phDate_(nowMs_() - 60 * 864e5); });
    return {};
  },

  sendSms: function (r, me) {
    if (!canPost_(me)) throw err_('Only church leaders can send texts.', 'denied');
    const p = readAll_('Posts').filter(function (x) { return x.id === r.postId; })[0];
    if (!p || p.cat !== 'announcement') throw err_('Only announcements can be texted.', 'invalid');
    return smsSend_(p, !!r.force);
  },

  smsInfo: function (r, me) {
    if (!canPost_(me)) throw err_('Only church leaders can see this.', 'denied');
    const rows = readAll_('SmsOutbox').filter(function (x) { return x.postId === r.postId; });
    if (!rows.length) throw err_('No text was prepared for this announcement.', 'missing');
    return { mode: /^SENT/.test(rows[0].status) ? 'SEMAPHORE' : 'OUTBOX', recipients: rows.length, text: rows[0].text, numbers: rows.map(function (x) { return x.number; }).join(',') };
  },

  resetPassword: function (r, me) {
    if (me.access !== 'admin') throw err_('Only church leaders can do that.', 'denied');
    const who = readAll_('Members').filter(function (m) { return m.id === r.uid; })[0];
    if (!who || who.access === 'roll' || !who.username) throw err_('This person has no account on the site.', 'invalid');
    if (String(r.password || '').length < 6) throw err_('The new password needs at least 6 characters.', 'invalid');
    const salt = Utilities.getUuid();
    update_('Members', r.uid, { salt: salt, hash: hash_(String(r.password), salt) });
    remove_('Sessions', function (s) { return s.uid === r.uid; });
    return {};
  }
};

/* ---------- helpers ---------- */
/* Everything in the answer to 'sync' that is the same for every admin (or every member). */
function buildSync_(lv, rev) {
  const admin = lv === 'a';
  const post = lv === 'a' || lv === 'e';
  const mem = lv === 'a' || lv === 'c';
  const settings = {};
  readAll_('Settings').forEach(function (s) { if (s.key !== 'joinCode' || admin) settings[s.key] = s.value; });
  const byTime = function (a, b) { return b.createdAt - a.createdAt; };
  const memberRows = readAll_('Members');
  return {
    rev: rev,
    program: readAll_('Program').map(function (x) {
      let items = [];
      try { items = JSON.parse(x.items || '[]'); } catch (e) { items = []; }
      return { svcId: x.svcId, date: x.date, items: items };
    }),
    sms: post ? { provider: smsProvider_(), count: smsRecipientsFrom_(memberRows).length, prefix: smsPrefix_(), max: SMS_MAX_CHARS } : null,
    settings: settings,
    members: memberRows.filter(function (m) { return admin || m.access !== 'pending'; }).map(pub_),
    events: readAll_('Events').filter(function (x) { return x.date >= phDate_(nowMs_() - 30 * 864e5); }).map(function (x) {
      return { id: x.id, title: x.title, date: x.date, time: x.time, place: x.place, desc: x.desc, remind: x.remind === '1' };
    }).sort(function (a, b) { return (a.date + a.time) < (b.date + b.time) ? -1 : 1; }),
    groups: readAll_('Groups').map(function (g) { return { id: g.id, name: g.name, desc: g.desc, createdAt: Number(g.createdAt) || 0 }; }),
    newVisitors: mem ? readAll_('Visitors').filter(function (v) { return v.handled !== '1'; }).length : 0,
    newPrayers: mem ? readAll_('Prayers').filter(function (p) { return p.handled !== '1'; }).length : 0,
    posts: readAll_('Posts').filter(function (p) {
      if (p.authorId !== 'system') return true;
      const m = /(\d{4}-\d{2}-\d{2})\s*$/.exec(p.svc || '');
      return !m || m[1] >= phDate_(nowMs_());
    }).map(function (p) {
      return { id: p.id, authorId: p.authorId, cat: p.cat, text: p.text, pinned: p.pinned === '1', createdAt: Number(p.createdAt) || 0, photos: p.photos ? p.photos.split(',') : [], sms: post ? p.sms : '', svc: p.svc, grp: p.grp || '' };
    }).sort(byTime).slice(0, 300),
    comments: readAll_('Comments').map(function (c) {
      return { id: c.id, postId: c.postId, authorId: c.authorId, text: c.text, createdAt: Number(c.createdAt) || 0 };
    }).sort(function (a, b) { return a.createdAt - b.createdAt; }).slice(-1500),
    reactions: readAll_('Reactions').map(function (x) { return { id: x.id, postId: x.postId, uid: x.uid }; }).slice(-3000),
    files: readAll_('Files').map(function (f) {
      return { id: f.id, title: f.title, cat: f.cat, desc: f.desc, driveId: f.driveId, name: f.name, mime: f.mime, size: Number(f.size) || 0, authorId: f.authorId, createdAt: Number(f.createdAt) || 0 };
    }).sort(byTime).slice(0, 2000)
  };
}
/* Google's cache holds at most 100 KB per item, so a big answer is stored in pieces. */
const CACHE_CHUNK = 30000;
function cachePutBig_(key, str, ttl) {
  const n = Math.ceil(str.length / CACHE_CHUNK);
  if (n < 1 || n > 40) return;
  const o = {};
  for (let i = 0; i < n; i++) o[key + '_' + i] = str.slice(i * CACHE_CHUNK, (i + 1) * CACHE_CHUNK);
  o[key + '_n'] = String(n);
  try { CacheService.getScriptCache().putAll(o, ttl); } catch (e) { /* the site still works, just slower */ }
}
function cacheGetBig_(key) {
  try {
    const cache = CacheService.getScriptCache();
    const n = Number(cache.get(key + '_n') || 0);
    if (!n) return null;
    const keys = [];
    for (let i = 0; i < n; i++) keys.push(key + '_' + i);
    const got = cache.getAll(keys);
    let out = '';
    for (let i = 0; i < n; i++) {
      const v = got[key + '_' + i];
      if (v == null) return null;
      out += v;
    }
    return out;
  } catch (e) { return null; }
}
/* A member's row, kept for the current revision so most requests never open the Members tab. */
function userRow_(uid, rev) {
  const cache = CacheService.getScriptCache(), k = 'u_' + rev + '_' + uid;
  const hit = cache.get(k);
  if (hit) { try { return JSON.parse(hit); } catch (e) { /* read it again below */ } }
  const m = readAll_('Members').filter(function (x) { return x.id === uid; })[0] || null;
  if (m) { try { cache.put(k, JSON.stringify(m), 3600); } catch (e) {} }
  return m;
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function err_(msg, code) { const e = new Error(msg); e.code = code; return e; }
function id_(p) { return p + Utilities.getUuid().replace(/-/g, '').slice(0, 12); }
function clean_(v, max, multiline) {
  let s = String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  if (!multiline) s = s.replace(/[\r\n]+/g, ' ');
  return s.trim().slice(0, max);
}
function pub_(m) {
  return { id: m.id, name: m.name, access: m.access, role: m.title, ministries: m.ministries, since: m.since, bio: m.bio, verse: m.verse, avatar: m.avatar, cover: m.cover, bday: m.bday || '', createdAt: Number(m.createdAt) || 0,
    status: MSTATUS[m.mstatus] ? m.mstatus : 'active', statusDate: m.mstatusDate || '', statusNote: m.mstatusNote || '',
    baptDate: m.baptDate || '', baptBy: m.baptBy || '', baptPlace: m.baptPlace || '', household: m.household || '', groups: m.groups ? String(m.groups).split(',') : [], anniv: m.anniv || '' };
}
function nameOf_(uid) { const m = readAll_('Members').filter(function (x) { return x.id === uid; })[0]; return m ? m.name : ''; }
function groupSet_(me, who, gid, on) {
  if (!readAll_('Groups').some(function (g) { return g.id === gid; })) throw err_('That group is gone.', 'missing');
  const list = String(who.groups || '').split(',').filter(Boolean).filter(function (x) { return x !== gid; });
  if (on) list.push(gid);
  update_('Members', who.id, { groups: list.join(',') });
  return {};
}
function profilePatch_(r, who, byAdmin) {
  const has = function (k) { return Object.prototype.hasOwnProperty.call(r, k); };
  const patch = {
    name: clean_(r.name, 60), title: clean_(r.role, 60), ministries: clean_(r.ministries, 100),
    since: String(r.since || '').replace(/\D/g, '').slice(0, 4), bio: clean_(r.bio, 500, true), verse: clean_(r.verse, 300, true)
  };
  if (patch.name.length < 2) throw err_(byAdmin ? 'Please enter the full name.' : 'Please enter your name.', 'invalid');
  if (has('phone') && !byAdmin) {
    const raw = String(r.phone || '').trim(), ph = raw ? normPhone_(raw) : '';
    if (raw && !ph) throw err_('Enter a Philippine mobile number like 09171234567.', 'invalid');
    if (r.sms && !ph) throw err_('Add your mobile number to get text alerts.', 'invalid');
    patch.phone = ph;
    patch.sms = (r.sms && ph) ? '1' : '';
  }
  if (has('bday')) {
    const b = String(r.bday || '').trim();
    if (b && !/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(b)) throw err_('Choose the birthday month and day.', 'invalid');
    patch.bday = b;
  }
  if (has('anniv')) {
    const a = String(r.anniv || '').trim();
    if (a && !/^(\d{4}-)?(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(a)) throw err_('Choose the wedding anniversary date.', 'invalid');
    patch.anniv = a;
  }
  /* baptism is part of the church record, so only admins change it */
  if (has('household')) patch.household = clean_(r.household, 60);
  if ((byAdmin || canMem_(who)) && has('baptDate')) {
    const d = String(r.baptDate || '').trim();
    if (d && !/^\d{4}(-\d{2}-\d{2})?$/.test(d)) throw err_('Enter the baptism date, or just the year.', 'invalid');
    if (d.length === 10 && isNaN(new Date(d + 'T00:00:00Z'))) throw err_('Enter the baptism date, or just the year.', 'invalid');
    patch.baptDate = d; patch.baptBy = clean_(r.baptBy, 80); patch.baptPlace = clean_(r.baptPlace, 120);
  }
  const dest = who.access === 'roll' ? folder_() : memberFolder_(who);
  if (r.avatar) { trash_(who.avatar); patch.avatar = saveImage_(r.avatar, 'avatar', dest); }
  else if (byAdmin && r.removeAvatar) { trash_(who.avatar); patch.avatar = ''; }
  if (r.cover) { trash_(who.cover); patch.cover = saveImage_(r.cover, 'cover', dest); }
  else if (byAdmin && r.removeCover) { trash_(who.cover); patch.cover = ''; }
  return patch;
}
const SITE_TABS = ['home', 'news', 'library', 'members', 'groups', 'game', 'me'];
const SITE_ICONS = ['home', 'bell', 'folder', 'users', 'user', 'heart', 'chat', 'book', 'music', 'image', 'church', 'file', 'pin'];
const SITE_COLORS = ['blue', 'navy', 'teal', 'green', 'purple', 'maroon', 'brown'];
function cleanSite_(v) {
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = {}; } }
  v = v && typeof v === 'object' ? v : {};
  const out = { texts: {}, color: SITE_COLORS.indexOf(v.color) >= 0 ? v.color : 'blue', tabs: [], roles: [], libCats: [] };
  let n = 0;
  Object.keys(v.texts || {}).forEach(function (k) {
    const key = clean_(k, 300), t = v.texts[k] || {}, en = clean_(t.en, 500), bis = clean_(t.bis, 500);
    if (key && (en || bis) && n < 200) { out.texts[key] = { en: en, bis: bis }; n++; }
  });
  const seen = {};
  (Array.isArray(v.tabs) ? v.tabs : []).forEach(function (t) {
    if (!t || SITE_TABS.indexOf(t.key) < 0 || seen[t.key]) return;
    seen[t.key] = true;
    out.tabs.push({ key: t.key, label: clean_(t.label, 30), bis: clean_(t.bis, 30), icon: SITE_ICONS.indexOf(t.icon) >= 0 ? t.icon : '',
      hidden: !!t.hidden && t.key !== 'home' && t.key !== 'me' });
  });
  (Array.isArray(v.roles) ? v.roles : []).forEach(function (x) { const t = clean_(x, 60); if (t && out.roles.length < 60 && out.roles.indexOf(t) < 0) out.roles.push(t); });
  const keys = {};
  (Array.isArray(v.libCats) ? v.libCats : []).forEach(function (c) {
    if (!c || out.libCats.length >= 30) return;
    const label = clean_(c.label, 40);
    let key = String(c.key || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30);
    if (!label) return;
    if (!key) key = 'c-' + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
    if (keys[key]) return;
    keys[key] = true;
    out.libCats.push({ key: key, label: label });
  });
  return out;
}
/* library categories: the built-in ones plus any the admins added on the Edit the site page */
function fileCats_() {
  let extra = [];
  try { extra = (JSON.parse(getSetting_('site') || '{}').libCats || []).map(function (c) { return c.key; }); } catch (e) { extra = []; }
  return FILE_CATS.concat(extra);
}
const MSTATUS = { active: true, inactive: true, backslidden: true, offshoot: true, deceased: true };
function statusFields_(r) {
  const st = String(r.status || 'active');
  if (!MSTATUS[st]) throw err_('Choose a status from the list.', 'invalid');
  const d = String(r.date || '');
  if (d && (!/^\d{4}-\d{2}-\d{2}$/.test(d) || isNaN(new Date(d + 'T00:00:00Z')))) throw err_('Choose a proper date, or leave it empty.', 'invalid');
  return { mstatus: st === 'active' ? '' : st, mstatusDate: st === 'active' ? '' : d, mstatusNote: st === 'active' ? '' : clean_(r.note, 400, true) };
}
function hash_(pw, salt) {
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + pw, Utilities.Charset.UTF_8);
  return raw.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}
function throttle_(key) {
  const cache = CacheService.getScriptCache(), k = 'thr_' + key;
  const n = Number(cache.get(k) || 0);
  if (n >= 8) throw err_('Too many tries. Wait 15 minutes and try again.', 'throttled');
  return function () { cache.put(k, String(n + 1), 900); };
}
function newSession_(uid) {
  const token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
  append_('Sessions', { token: token, uid: uid, createdAt: String(Date.now()) });
  CacheService.getScriptCache().put('s_' + token, uid, 21600);
  return token;
}
function purgeSessions_() {
  const cutoff = Date.now() - SESSION_DAYS * 864e5;
  remove_('Sessions', function (s) { return Number(s.createdAt) < cutoff; });
}
function sessionUser_(token) {
  if (!token) return null;
  const cache = CacheService.getScriptCache();
  let uid = cache.get('s_' + token);
  if (!uid) {
    const s = readAll_('Sessions').filter(function (x) { return x.token === token; })[0];
    if (!s || Date.now() - Number(s.createdAt) > SESSION_DAYS * 864e5) return null;
    uid = s.uid;
    cache.put('s_' + token, uid, 21600);
  }
  const m = userRow_(uid, rev_());
  return m && m.mstatus !== 'deceased' && m.access !== 'roll' ? m : null;
}
function rev_() { return PropertiesService.getScriptProperties().getProperty('rev') || '0'; }
/* The revision always goes up, even if two changes land in the same millisecond or the clock steps back,
   so a saved copy of the old data can never be mistaken for the new data. */
function bump_() {
  const p = PropertiesService.getScriptProperties();
  p.setProperty('rev', String(Math.max(Date.now(), (Number(p.getProperty('rev')) || 0) + 1)));
}

/* ---------- worship times ---------- */
function nowMs_() { return Date.now(); }
function services_() {
  let list;
  try { list = JSON.parse(getSetting_('services') || '[]'); } catch (e) { list = []; }
  return (Array.isArray(list) ? list : []).filter(function (x) {
    return x && x.day >= 0 && x.day <= 6 && x.day % 1 === 0 && /^([01]\d|2[0-3]):[0-5]\d$/.test(String(x.time));
  });
}
/* Next start time (in ms) of a weekly worship, using Philippine time (UTC+8). */
function nextStart_(sv, now) {
  const ph = new Date(now + 8 * 36e5), hm = String(sv.time).split(':');
  for (let off = 0; off <= 7; off++) {
    const t = new Date(Date.UTC(ph.getUTCFullYear(), ph.getUTCMonth(), ph.getUTCDate() + off));
    if (t.getUTCDay() !== Number(sv.day)) continue;
    const start = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), Number(hm[0]), Number(hm[1])) - 8 * 36e5;
    if (start > now) return start;
  }
  return 0;
}
/* The date (Philippine time) of the worship that is open right now. */
function openDate_(sv, now) {
  const nx = nextStart_(sv, now);
  return now - (nx - 7 * 864e5) < 90 * 60000 ? phDate_(nx - 7 * 864e5) : phDate_(nx);
}
/* Is this a date (YYYY-MM-DD, Philippine time) on which the weekly worship falls, within the next two weeks? */
function validSvcDate_(sv, date, now) {
  date = String(date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  if (new Date(date + 'T00:00:00Z').getUTCDay() !== Number(sv.day)) return false;
  return date >= phDate_(now - 864e5) && date <= phDate_(now + 15 * 864e5);
}
/* "Speaker: Elder Cruz, Song leader: Maria" for the participants of a worship announcement (svc = 'id|date'). */
function programText_(svc) {
  const parts = String(svc || '').split('|');
  if (parts.length !== 2) return '';
  const row = readAll_('Program').filter(function (x) { return x.id === parts[0] + '_' + parts[1]; })[0];
  if (!row) return '';
  let items = [];
  try { items = JSON.parse(row.items || '[]'); } catch (e) { items = []; }
  return items.filter(function (i) { return i.name; }).map(function (i) { return (i.role ? i.role + ': ' : '') + i.name; }).join(', ');
}
function phDate_(ms) { return new Date(ms + 8 * 36e5).toISOString().slice(0, 10); }
var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function phStamp_(ms) { const iso = new Date((Number(ms) || nowMs_()) + 8 * 36e5).toISOString(); return iso.slice(0, 10) + '_' + iso.slice(11, 19).replace(/:/g, ''); }
function phMonthLabel_(ms) { const d = new Date((Number(ms) || nowMs_()) + 8 * 36e5); return d.toISOString().slice(0, 7) + ' ' + MONTH_NAMES[d.getUTCMonth()]; }
function monthFolder_(me, ms) { const base = memberFolder_(me), label = phMonthLabel_(ms); const it = base.getFoldersByName(label); return it.hasNext() ? it.next() : base.createFolder(label); }
/* quiet per-person activity trail (admins only can read it) */
function activity_(me, action, detail) { if (!me) return; try { append_('Activity', { id: id_('ac'), time: String(nowMs_()), uid: me.id, name: me.name, action: action, detail: String(detail || '').slice(0, 300) }); } catch (e) {} }
function time12_(hhmm) {
  const hm = String(hhmm).split(':'); let h = Number(hm[0]);
  const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
  return h + ':' + hm[1] + ' ' + ap;
}

/* ---------- text alerts ---------- */
function normPhone_(v) {
  let d = String(v || '').replace(/[^\d+]/g, '').replace(/^\+/, '');
  if (/^09\d{9}$/.test(d)) return d;
  if (/^639\d{9}$/.test(d)) return '0' + d.slice(2);
  if (/^9\d{9}$/.test(d)) return '0' + d;
  return '';
}
function smsProvider_() {
  return String(PropertiesService.getScriptProperties().getProperty('SMS_PROVIDER') || '').toUpperCase() === 'SEMAPHORE' ? 'SEMAPHORE' : 'OUTBOX';
}
function smsPrefix_() { return PropertiesService.getScriptProperties().getProperty('SMS_PREFIX') || 'TUBOD SDA'; }
function smsText_(text) {
  let t = '[' + smsPrefix_() + '] ' + String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length > SMS_MAX_CHARS) t = t.slice(0, SMS_MAX_CHARS - 3) + '...';
  return t;
}
function smsRecipients_() { return smsRecipientsFrom_(readAll_('Members')); }
function smsRecipientsFrom_(rows) {
  const seen = {}, out = [];
  rows.forEach(function (m) {
    const n = m.sms === '1' && m.mstatus !== 'deceased' && m.access !== 'roll' ? normPhone_(m.phone) : '';
    if (n && !seen[n]) { seen[n] = true; out.push(n); }
  });
  return out;
}
/* Texts an announcement to everyone who opted in. Free mode only queues it; Semaphore mode sends it. */
function smsSend_(p, force) {
  if (/^(SENT|QUEUED)/.test(p.sms) && !force) throw err_('This announcement was already texted.', 'already');
  const numbers = smsRecipients_();
  if (!numbers.length) throw err_('No one has turned on text alerts yet. Members can do this in Edit profile.', 'nobody');
  const extra = programText_(p.svc);
  const text = smsText_(p.text + (extra ? ' ' + extra : '')), provider = smsProvider_();
  const status = provider === 'SEMAPHORE' ? semaphoreSend_(numbers, text) : 'QUEUED_MANUAL';
  const failed = status.indexOf('FAILED') === 0;
  withLock_(function () {
    appendMany_('SmsOutbox', numbers.map(function (n) { return { time: String(nowMs_()), postId: p.id, number: n, text: text, status: status }; }));
    update_('Posts', p.id, { sms: failed ? status : (provider === 'SEMAPHORE' ? 'SENT:' : 'QUEUED:') + numbers.length });
    remove_('SmsOutbox', function (x) { return Number(x.time) < nowMs_() - 60 * 864e5; });
    bump_();
  });
  if (failed) throw err_('The text service did not accept the message. ' + status.slice(8), 'sms_failed');
  return { mode: provider, recipients: numbers.length, text: text, numbers: numbers.join(',') };
}
/* Semaphore (Philippines). Returns 'SENT' or 'FAILED: reason'. */
function semaphoreSend_(numbers, text) {
  const props = PropertiesService.getScriptProperties();
  const key = props.getProperty('SEMAPHORE_API_KEY');
  if (!key) return 'FAILED: SEMAPHORE_API_KEY is not set in Script properties.';
  const sender = props.getProperty('SEMAPHORE_SENDER');
  for (let i = 0; i < numbers.length; i += 500) {
    const payload = { apikey: key, number: numbers.slice(i, i + 500).join(','), message: text };
    if (sender) payload.sendername = sender;
    let resp;
    try { resp = UrlFetchApp.fetch('https://api.semaphore.co/api/v4/messages', { method: 'post', payload: payload, muteHttpExceptions: true }); }
    catch (e) { return 'FAILED: could not reach Semaphore.'; }
    const code = resp.getResponseCode();
    if (code < 200 || code >= 300) return 'FAILED: Semaphore replied ' + code + ' ' + String(resp.getContentText()).slice(0, 120);
  }
  return 'SENT';
}

/* ---------- sheets ---------- */
let SS_ = null;
const SHEETS_ = {};
function sh_(name) {
  if (SHEETS_[name]) return SHEETS_[name];
  const ss = SS_ || (SS_ = SpreadsheetApp.getActiveSpreadsheet());
  let s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    const cols = SCHEMA[name];
    s.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    s.setFrozenRows(1);
  }
  const want = SCHEMA[name];
  if (want && s.getLastColumn() < want.length) s.getRange(1, 1, 1, want.length).setValues([want]).setFontWeight('bold');
  SHEETS_[name] = s;
  return s;
}
function readAll_(name) {
  const s = sh_(name), n = s.getLastRow(), cols = SCHEMA[name];
  if (n < 2) return [];
  return s.getRange(2, 1, n - 1, cols.length).getValues().map(function (row, i) {
    const o = { _row: i + 2 };
    cols.forEach(function (c, j) { o[c] = row[j] === '' || row[j] == null ? '' : String(row[j]); });
    return o;
  });
}
function ensureHeaders_() {
  Object.keys(SCHEMA).forEach(function (n) {
    const cols = SCHEMA[n];
    sh_(n).getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
  });
}
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}
function appendMany_(name, objs) {
  if (!objs.length) return;
  const s = sh_(name), cols = SCHEMA[name], r = s.getLastRow() + 1;
  const rng = s.getRange(r, 1, objs.length, cols.length);
  rng.setNumberFormat('@');
  rng.setValues(objs.map(function (o) { return cols.map(function (c) { return o[c] == null ? '' : String(o[c]); }); }));
}
function append_(name, obj) {
  const s = sh_(name), cols = SCHEMA[name], r = s.getLastRow() + 1;
  const rng = s.getRange(r, 1, 1, cols.length);
  rng.setNumberFormat('@');
  rng.setValues([cols.map(function (c) { return obj[c] == null ? '' : String(obj[c]); })]);
}
function update_(name, id, patch) {
  const cols = SCHEMA[name], s = sh_(name), n = s.getLastRow();
  let r = -1;
  if (n >= 2) {
    const ids = s.getRange(2, 1, n - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) { if (String(ids[i][0]) === id) { r = i + 2; break; } }
  }
  if (r < 0) throw err_('That item no longer exists.', 'missing');
  const rng = s.getRange(r, 1, 1, cols.length);
  const vals = rng.getValues()[0].map(function (v) { return v == null ? '' : String(v); });
  Object.keys(patch).forEach(function (k) {
    const j = cols.indexOf(k);
    if (j >= 0) vals[j] = String(patch[k]);
  });
  rng.setNumberFormat('@');
  rng.setValues([vals]);
}
function remove_(name, pred) {
  const s = sh_(name), rows = readAll_(name).filter(pred).map(function (x) { return x._row; }).sort(function (a, b) { return b - a; });
  rows.forEach(function (r) { s.deleteRow(r); });
}
function getSetting_(k) {
  const r = readAll_('Settings').filter(function (x) { return x.key === k; })[0];
  return r ? r.value : null;
}
function setSetting_(k, v) { const o = {}; o[k] = v; setSettings_(o); }
/* Save several settings with one read and one write. */
function setSettings_(map) {
  const s = sh_('Settings'), n = s.getLastRow();
  const rows = n < 2 ? [] : s.getRange(2, 1, n - 1, 2).getValues().map(function (r) { return [String(r[0]), r[1] == null ? '' : String(r[1])]; });
  Object.keys(map).forEach(function (k) {
    const row = rows.filter(function (x) { return x[0] === k; })[0];
    if (row) row[1] = String(map[k]); else rows.push([k, String(map[k])]);
  });
  if (!rows.length) return;
  const rng = s.getRange(2, 1, rows.length, 2);
  rng.setNumberFormat('@');
  rng.setValues(rows);
}

/* ---------- Google Drive ---------- */
function folder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* recreate below */ } }
  const f = DriveApp.createFolder('Tubod SDA Church files');
  props.setProperty('FOLDER_ID', f.getId());
  return f;
}
/* Each member gets their own folder inside the church folder: Tubod SDA Church files / Members / Name (username) */
function memberFolder_(me) {
  const props = PropertiesService.getScriptProperties(), key = 'MF_' + me.id;
  const id = props.getProperty(key);
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* make it again below */ } }
  const lock = LockService.getScriptLock(), mine = lock.hasLock && lock.hasLock();
  if (!mine) lock.waitLock(20000);
  try {
    const again = props.getProperty(key);
    if (again && again !== id) { try { return DriveApp.getFolderById(again); } catch (e) {} }
    const root = folder_();
    let members = null;
    const mid = props.getProperty('MEMBERS_FOLDER_ID');
    if (mid) { try { members = DriveApp.getFolderById(mid); } catch (e) { members = null; } }
    if (!members) { members = root.createFolder('Members'); props.setProperty('MEMBERS_FOLDER_ID', members.getId()); }
    const label = (clean_(me.name, 60) || 'Member') + ' (' + (me.username || me.id) + ')';
    const f = members.createFolder(label);
    props.setProperty(key, f.getId());
    return f;
  } finally { if (!mine) lock.releaseLock(); }
}
function quotaBytes_() {
  const v = getSetting_('memberQuotaGB');
  const gb = v === null || v === '' ? DEFAULT_QUOTA_GB : Number(v);
  return gb > 0 ? gb * 1073741824 : 0;   // 0 means no limit
}
function usedBytes_(uid) {
  return readAll_('Files').reduce(function (n, f) { return f.authorId === uid ? n + (Number(f.size) || 0) : n; }, 0);
}
function checkQuota_(me, add) {
  if (me.access === 'admin') return;
  const max = quotaBytes_();
  if (!max) return;
  const used = usedBytes_(me.id);
  if (used + add > max) {
    const gb = function (b) { return (b / 1073741824).toFixed(1); };
    throw err_('This would go over your ' + gb(max) + ' GB storage limit. You have used ' + gb(used) + ' GB. Delete some of your files, or ask a church admin for more space.', 'quota');
  }
}
function saveImage_(dataUrl, name, dest) {
  dataUrl = String(dataUrl || '');
  const m = /^data:image\/(jpeg|png|webp|gif);base64,/.exec(dataUrl);
  if (!m || dataUrl.length > MAX_PHOTO_CHARS) throw err_('That photo could not be saved. Try a different one.', 'bad_image');
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const blob = Utilities.newBlob(Utilities.base64Decode(dataUrl.slice(m[0].length)), 'image/' + m[1], name + '.' + ext);
  const f = (dest || folder_()).createFile(blob);
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return f.getId();
}
function trash_(id) {
  if (!id) return;
  try { DriveApp.getFileById(id).setTrashed(true); } catch (e) { /* already gone */ }
}