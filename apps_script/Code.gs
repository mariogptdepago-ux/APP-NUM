/**
 * Pablo VI Math App — Backend gratuito con Google Apps Script + Google Sheets.
 * Configure Script Properties:
 * SPREADSHEET_ID = ID del Google Sheet maestro
 * SECRET_KEY = clave larga privada para firmar certificados
 */
const SHEETS = {
  USERS: 'Usuarios',
  PROGRESS: 'Progreso',
  ATTEMPTS: 'Intentos',
  CERTIFICATES: 'Certificados',
  EVENTS: 'Eventos',
  BURNED: 'PreguntasQuemadas',
  COMMON_ERRORS: 'ErroresFrecuentes',
  AUDIT: 'Auditoria'
};

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || '{}');
    const action = data.action;
    const routes = {
      login,
      saveAttempt,
      saveProgress,
      saveEvent,
      burnQuestion,
      issueCertificate,
      verifyCertificate,
      listCertificates
    };
    if (!routes[action]) return json({ ok:false, message:'Acción no reconocida.' });
    return json(routes[action](data));
  } catch (err) {
    return json({ ok:false, message:err.message, stack:err.stack });
  }
}

function doGet(e) {
  const code = e.parameter.code;
  if (!code) return HtmlService.createHtmlOutput('Pablo VI Math App backend activo.');
  const res = verifyCertificate({ certificateId: code });
  return HtmlService.createHtmlOutput(`<pre>${JSON.stringify(res, null, 2)}</pre>`);
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function ss() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Falta SPREADSHEET_ID en propiedades del script.');
  return SpreadsheetApp.openById(id);
}

function sheet(name) {
  const sp = ss();
  return sp.getSheetByName(name) || sp.insertSheet(name);
}

function setupSpreadsheet() {
  const headers = {
    [SHEETS.USERS]: ['userId','fullName','grade','username','passwordHash','role','active','createdAt'],
    [SHEETS.PROGRESS]: ['userId','descriptorId','skillId','correct','wrong','attempts','mastery','retrievability','halfLifeHours','lastPracticeAt','nextReviewAt','status','updatedAt'],
    [SHEETS.ATTEMPTS]: ['attemptId','userId','descriptorId','skillId','questionId','familyId','variantIndex','correct','lost','burned','reason','responseMs','selected','expected','masteryAfter','recallBefore','timestamp'],
    [SHEETS.CERTIFICATES]: ['certificateId','studentId','studentName','grade','axisId','axisName','descriptors','mastery','retrievability','issuedAt','issuedBy','status','signatureHash','verificationPayload','verificationUrl'],
    [SHEETS.EVENTS]: ['eventId','userId','descriptorId','questionId','eventType','detail','timestamp'],
    [SHEETS.BURNED]: ['userId','questionId','familyId','reason','replacementQuestionId','timestamp'],
    [SHEETS.COMMON_ERRORS]: ['errorId','skillId','name','shortHint','active'],
    [SHEETS.AUDIT]: ['timestamp','action','userId','detail']
  };
  Object.keys(headers).forEach(name => {
    const sh = sheet(name);
    sh.clear();
    sh.getRange(1,1,1,headers[name].length).setValues([headers[name]]).setFontWeight('bold').setBackground('#26a7ff').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  });
}

function seedDemoUsers() {
  const sh = sheet(SHEETS.USERS);
  const rows = [
    ['stu_demo','Estudiante Demo','9B','demo', hashPassword('1234'), 'student', true, new Date()],
    ['admin_demo','Superusuario Demo','','admin', hashPassword('admin123'), 'superuser', true, new Date()]
  ];
  sh.getRange(sh.getLastRow()+1,1,rows.length,rows[0].length).setValues(rows);
}

function hashPassword(password) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password, Utilities.Charset.UTF_8);
  return bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

function hmac(payload) {
  const secret = PropertiesService.getScriptProperties().getProperty('SECRET_KEY');
  if (!secret) throw new Error('Falta SECRET_KEY en propiedades del script.');
  const sig = Utilities.computeHmacSha256Signature(payload, secret);
  return sig.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

function randomBlock(len) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function login(data) {
  const rows = getRows(SHEETS.USERS);
  const user = rows.find(r => String(r.username) === String(data.username) && String(r.active).toLowerCase() !== 'false');
  if (!user) return { ok:false, message:'Usuario no encontrado.' };
  if (String(user.passwordHash) !== hashPassword(String(data.password))) return { ok:false, message:'Contraseña incorrecta.' };
  const tokenPayload = `${user.userId}|${Date.now()}|${randomBlock(8)}`;
  return { ok:true, token:hmac(tokenPayload).slice(0,32), user:{ userId:user.userId, fullName:user.fullName, grade:user.grade, username:user.username, role:user.role } };
}

function saveAttempt(data) {
  const a = data.attempt;
  append(SHEETS.ATTEMPTS, ['attemptId','userId','descriptorId','skillId','questionId','familyId','variantIndex','correct','lost','burned','reason','responseMs','selected','expected','masteryAfter','recallBefore','timestamp'].map(k => a[k]));
  audit('saveAttempt', a.userId, a.questionId);
  return { ok:true };
}

function saveProgress(data) {
  const p = data.progress;
  append(SHEETS.PROGRESS, [p.userId,p.descriptorId,p.skillId,p.correct,p.wrong,p.attempts,p.mastery,p.retrievability || '',p.halfLifeHours,p.lastPracticeAt,p.nextReviewAt,p.status || 'in_progress',new Date()]);
  return { ok:true };
}

function saveEvent(data) {
  const e = data.event;
  append(SHEETS.EVENTS, [e.eventId,e.userId,e.descriptorId,e.questionId,e.eventType,e.detail,e.timestamp]);
  audit('saveEvent', e.userId, e.eventType);
  return { ok:true };
}

function burnQuestion(data) {
  append(SHEETS.BURNED, [data.userId,data.questionId,data.familyId,data.reason,data.replacementQuestionId,data.timestamp]);
  audit('burnQuestion', data.userId, data.questionId);
  return { ok:true };
}

function issueCertificate(data) {
  const p = data;
  const year = new Date().getFullYear();
  const axisCode = String(p.axisId || 'LIM').split('_').map(x => x[0]).join('').toUpperCase().slice(0,3);
  const payload = [p.studentId,p.studentName,p.grade,p.axisId,p.axisName,(p.descriptors || []).join('|'),p.mastery,p.retrievability,Date.now()].join('|');
  const signature = hmac(payload);
  const certificateId = `PVI-${axisCode}-${year}-${p.grade}-${randomBlock(4)}-${randomBlock(4)}-${signature.slice(0,4).toUpperCase()}`;
  const issuedAt = new Date().toISOString();
  const verificationUrl = `verificar.html?code=${encodeURIComponent(certificateId)}`;
  append(SHEETS.CERTIFICATES, [certificateId,p.studentId,p.studentName,p.grade,p.axisId,p.axisName,(p.descriptors || []).join('|'),p.mastery,p.retrievability,issuedAt,p.issuedBy || 'system','valid',signature,payload,verificationUrl]);
  audit('issueCertificate', p.issuedBy || p.studentId, certificateId);
  return { ok:true, certificate:{ certificateId, studentId:p.studentId, studentName:p.studentName, grade:p.grade, axisId:p.axisId, axisName:p.axisName, descriptors:(p.descriptors || []).join('|'), mastery:p.mastery, retrievability:p.retrievability, issuedAt, issuedBy:p.issuedBy || 'system', status:'valid', signatureHash:signature, verificationUrl } };
}

function verifyCertificate(data) {
  const rows = getRows(SHEETS.CERTIFICATES);
  const c = rows.find(r => String(r.certificateId) === String(data.certificateId));
  if (!c) return { ok:false, message:'Código no registrado.' };
  if (String(c.status) !== 'valid') return { ok:false, message:'Certificado anulado o no vigente.' };
  const expected = hmac(String(c.verificationPayload));
  if (expected !== String(c.signatureHash)) return { ok:false, message:'Firma inválida: el registro fue alterado.' };
  return { ok:true, certificate:c };
}

function listCertificates() {
  return { ok:true, certificates:getRows(SHEETS.CERTIFICATES) };
}

function append(sheetName, row) {
  const sh = sheet(sheetName);
  sh.getRange(sh.getLastRow()+1,1,1,row.length).setValues([row]);
}

function getRows(sheetName) {
  const sh = sheet(sheetName);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).filter(r => r.some(c => c !== '')).map(row => Object.fromEntries(headers.map((h,i)=>[h,row[i]])));
}

function audit(action, userId, detail) {
  append(SHEETS.AUDIT, [new Date(), action, userId || '', detail || '']);
}
