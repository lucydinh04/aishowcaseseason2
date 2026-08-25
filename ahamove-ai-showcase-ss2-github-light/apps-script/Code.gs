/**
 * Ahamove AI Showcase 2026 — Registration Backend
 * Google Apps Script Web App
 *
 * Architecture:
 * Vercel browser -> /api/register -> Apps Script -> Google Sheet + MailApp
 */

const SPREADSHEET_ID = '15sGXELGvwmnTBJXLErU0L6qF8KWDYCt-3A8oPk0eLOM';
const REG_SHEET = 'Registrations';
const EMAIL_LOG_SHEET = 'Email Log';
const CONFIG_SHEET = 'Config';
const TZ = 'Asia/Ho_Chi_Minh';

const REG_HEADERS = [
  'submitted_at',
  'registration_id',
  'status',
  'mode',
  'contact_email',
  'individual_name',
  'individual_department',
  'individual_region',
  'individual_telegram',
  'team_name',
  'team_lead_name',
  'team_lead_department',
  'team_lead_region',
  'team_lead_telegram',
  'member_2_name',
  'member_2_email',
  'member_3_name',
  'member_3_email',
  'usecase_name',
  'usecase_description',
  'support_requested',
  'running_status',
  'commitment_solution_owner',
  'commitment_data_security',
  'commitment_schedule',
  'participant_keys',
  'email_status',
  'email_sent_at',
  'source',
  'user_agent',
  'website_url',
  'raw_payload',
  'notes',
  'review_status'
];

const EMAIL_LOG_HEADERS = [
  'timestamp',
  'registration_id',
  'recipient',
  'email_type',
  'status',
  'message_id',
  'error',
  'subject',
  'trigger',
  'notes'
];

const DEFAULT_CONFIG = [
  ['FORM_OPEN', 'TRUE', 'Bật/tắt nhận đăng ký mới', 'YES'],
  ['FORM_DEADLINE', '2026-09-21 23:59:59', 'Hạn chót theo Asia/Ho_Chi_Minh', 'YES'],
  ['SHOWCASE_DATE', '25/09/2026', 'Ngày dự kiến AI Showcase', 'YES'],
  ['ALLOWED_EMAIL_DOMAIN', 'ahamove.com', 'Chỉ nhận email công ty. Để trống nếu không muốn giới hạn.', 'YES'],
  ['REJECT_DUPLICATE', 'TRUE', 'Chặn một email xuất hiện ở nhiều bài đăng ký', 'YES'],
  ['ADMIN_EMAILS', '', 'Email BTC nhận thông báo, phân tách bằng dấu phẩy; có thể để trống', 'YES'],
  ['EMAIL_FROM_NAME', 'Ahamove AI Showcase 2026', 'Tên hiển thị người gửi email xác nhận', 'YES'],
  ['EMAIL_REPLY_TO', '', 'Reply-to của BTC; để trống để dùng email tài khoản Apps Script', 'YES'],
  ['EVENT_SITE_URL', '', 'URL Vercel sau khi deploy', 'YES'],
  ['SOURCE_NAME', 'vercel_web', 'Nguồn submission', 'NO']
];

/**
 * Run ONCE after pasting the files into Apps Script.
 * - Verifies workbook tabs / headers.
 * - Generates API_SECRET if absent.
 * - Prints the secret in the execution log so it can be copied to Vercel.
 */
function setupProduction() {
  ensureWorkbook_();

  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty('API_SECRET');

  if (!secret) {
    secret = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 16);
    props.setProperty('API_SECRET', secret);
  }

  const result = {
    ok: true,
    spreadsheetId: SPREADSHEET_ID,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID + '/edit',
    apiSecret: secret,
    nextStep: 'Deploy as Web App, then set APPS_SCRIPT_WEB_APP_URL and REGISTRATION_SHARED_SECRET in Vercel.'
  };

  console.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * Optional: rotate the Vercel <-> Apps Script shared secret.
 * After running, update REGISTRATION_SHARED_SECRET in Vercel and redeploy.
 */
function rotateApiSecret() {
  const secret = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 16);
  PropertiesService.getScriptProperties().setProperty('API_SECRET', secret);
  console.log('NEW API_SECRET=' + secret);
  return secret;
}

/**
 * Health endpoint. No registration data is exposed.
 */
function doGet() {
  return json_({
    ok: true,
    service: 'Ahamove AI Showcase 2026 Registration Backend',
    time: Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ssXXX")
  });
}

/**
 * Production registration endpoint.
 */
function doPost(e) {
  try {
    ensureWorkbook_();

    const body = parseJsonBody_(e);
    if (!body) {
      return json_({ ok: false, code: 'INVALID_JSON', message: 'Request không hợp lệ.' });
    }

    const expectedSecret = PropertiesService.getScriptProperties().getProperty('API_SECRET');
    if (!expectedSecret) {
      return json_({
        ok: false,
        code: 'CONFIG_NOT_READY',
        message: 'Backend chưa hoàn tất setupProduction().'
      });
    }

    if (String(body.secret || '') !== String(expectedSecret)) {
      return json_({ ok: false, code: 'UNAUTHORIZED', message: 'Unauthorized.' });
    }

    if (body.action === 'health') {
      return json_({ ok: true, service: 'registration-backend', status: 'ready' });
    }

    const payload = body.payload || {};
    const meta = body.meta || {};

    // Honeypot: bot submissions get a generic success and are discarded.
    if (clean_(payload._website, 200)) {
      return json_({ ok: true, registrationId: 'RECEIVED', message: 'Đã ghi nhận.' });
    }

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(15000)) {
      return json_({
        ok: false,
        code: 'BUSY',
        message: 'Hệ thống đang xử lý nhiều đăng ký. Vui lòng thử lại sau ít phút.'
      });
    }

    try {
      return processRegistration_(payload, meta);
    } finally {
      lock.releaseLock();
    }

  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    return json_({
      ok: false,
      code: 'SERVER_ERROR',
      message: 'Hệ thống chưa thể ghi nhận đăng ký. Vui lòng thử lại hoặc liên hệ BTC.'
    });
  }
}

function processRegistration_(payload, meta) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(REG_SHEET);
  const config = readConfig_(ss);

  const now = new Date();

  if (!asBool_(config.FORM_OPEN, true)) {
    return json_({ ok: false, code: 'FORM_CLOSED', message: 'Cổng đăng ký hiện đã đóng.' });
  }

  if (config.FORM_DEADLINE) {
    const deadline = Utilities.parseDate(
      String(config.FORM_DEADLINE),
      TZ,
      'yyyy-MM-dd HH:mm:ss'
    );
    if (now.getTime() > deadline.getTime()) {
      return json_({
        ok: false,
        code: 'FORM_CLOSED',
        message: 'Cổng đăng ký AI Showcase 2026 đã kết thúc.'
      });
    }
  }

  const normalized = normalizePayload_(payload, config);
  if (!normalized.ok) return json_(normalized);

  if (asBool_(config.REJECT_DUPLICATE, true)) {
    const duplicate = findDuplicateParticipant_(sheet, normalized.participantEmails);
    if (duplicate) {
      return json_({
        ok: false,
        code: 'DUPLICATE_PARTICIPANT',
        message: duplicate + ' đã xuất hiện trong một đăng ký trước đó. Mỗi cá nhân chỉ tham gia 1 đội duy nhất.'
      });
    }
  }

  const registrationId = makeRegistrationId_(now);
  const participantKeys = normalized.participantEmails.join(',');

  const row = [
    now,
    registrationId,
    'Received',
    normalized.mode,
    normalized.contactEmail,
    normalized.individual.name,
    normalized.individual.department,
    normalized.individual.region,
    normalized.individual.telegram,
    normalized.team.name,
    normalized.team.leadName,
    normalized.team.leadDepartment,
    normalized.team.leadRegion,
    normalized.team.leadTelegram,
    normalized.team.member2Name,
    normalized.team.member2Email,
    normalized.team.member3Name,
    normalized.team.member3Email,
    normalized.usecaseName,
    normalized.usecaseDescription,
    normalized.supportRequested,
    normalized.runningStatus,
    true,
    true,
    true,
    participantKeys,
    'pending',
    '',
    clean_(meta.source || config.SOURCE_NAME || 'vercel_web', 100),
    clean_(meta.userAgent, 500),
    clean_(meta.websiteUrl || config.EVENT_SITE_URL, 500),
    safeJson_(payload, 45000),
    '',
    'New'
  ];

  const rowIndex = Math.max(sheet.getLastRow() + 1, 2);
  sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  sheet.getRange(rowIndex, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');

  const emailResult = sendConfirmationEmails_(
    ss,
    registrationId,
    normalized,
    config,
    rowIndex,
    'new_registration'
  );

  sendAdminNotification_(ss, registrationId, normalized, config);

  sheet.getRange(rowIndex, 27).setValue(emailResult.allSent ? 'sent' : 'failed');
  if (emailResult.anySent) {
    sheet.getRange(rowIndex, 28).setValue(new Date()).setNumberFormat('dd/MM/yyyy HH:mm:ss');
  }

  return json_({
    ok: true,
    registrationId: registrationId,
    emailSent: emailResult.allSent,
    message: emailResult.allSent
      ? 'Đăng ký thành công. Email xác nhận đã được gửi.'
      : 'Đăng ký đã được ghi nhận. Email xác nhận có thể đến chậm; BTC vẫn đã nhận dữ liệu của bạn.'
  });
}

function normalizePayload_(p, config) {
  const contactEmail = normalizeEmail_(p.email);
  const modeRaw = clean_(p.mode, 30);

  if (!contactEmail || !isEmail_(contactEmail)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Email nhận xác nhận không hợp lệ.' };
  }

  const allowedDomain = clean_(config.ALLOWED_EMAIL_DOMAIN, 100).toLowerCase().replace(/^@/, '');
  if (allowedDomain && !contactEmail.endsWith('@' + allowedDomain)) {
    return {
      ok: false,
      code: 'INVALID_DOMAIN',
      message: 'Vui lòng sử dụng email @' + allowedDomain + ' để đăng ký.'
    };
  }

  if (modeRaw !== 'ca_nhan' && modeRaw !== 'doi_nhom') {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Vui lòng chọn hình thức tham gia.' };
  }

  const usecaseName = clean_(p.usecase_ten, 300);
  const usecaseDescription = clean_(p.usecase_mota, 12000);
  const supportRequested = clean_(p.support, 6000);
  const runningStatus = clean_(p.trangthai, 100);

  if (!usecaseName || !usecaseDescription) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Vui lòng điền đầy đủ thông tin Use Case.' };
  }

  if (runningStatus !== 'da_chay_2tuan') {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'Use Case cần đáp ứng điều kiện đã vận hành tối thiểu 2 tuần.'
    };
  }

  if (!checked_(p.cam_ket_r4) || !checked_(p.cam_ket_r5) || !checked_(p.cam_ket_1doi)) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'Vui lòng xác nhận đầy đủ các cam kết trước khi gửi.'
    };
  }

  const result = {
    ok: true,
    mode: modeRaw === 'ca_nhan' ? 'Cá nhân' : 'Đội nhóm',
    contactEmail: contactEmail,
    participantEmails: [],
    individual: { name: '', department: '', region: '', telegram: '' },
    team: {
      name: '',
      leadName: '',
      leadDepartment: '',
      leadRegion: '',
      leadTelegram: '',
      member2Name: '',
      member2Email: '',
      member3Name: '',
      member3Email: ''
    },
    usecaseName: usecaseName,
    usecaseDescription: usecaseDescription,
    supportRequested: supportRequested,
    runningStatus: runningStatus
  };

  if (modeRaw === 'ca_nhan') {
    result.individual = {
      name: clean_(p.cn_hoten, 300),
      department: clean_(p.cn_phongban, 200),
      region: clean_(p.cn_khuvuc, 30),
      telegram: clean_(p.cn_tele, 200)
    };

    if (!result.individual.name || !result.individual.department || !result.individual.region || !result.individual.telegram) {
      return { ok: false, code: 'VALIDATION_ERROR', message: 'Vui lòng điền đầy đủ thông tin cá nhân.' };
    }

    result.participantEmails = [contactEmail];

  } else {
    result.team = {
      name: clean_(p.doi_ten, 300),
      leadName: clean_(p.dd_hoten, 300),
      leadDepartment: clean_(p.dd_phongban, 200),
      leadRegion: clean_(p.dd_khuvuc, 30),
      leadTelegram: clean_(p.dd_tele, 200),
      member2Name: clean_(p.tv2_hoten, 300),
      member2Email: normalizeEmail_(p.tv2_email),
      member3Name: clean_(p.tv3_hoten, 300),
      member3Email: normalizeEmail_(p.tv3_email)
    };

    if (!result.team.name || !result.team.leadName || !result.team.leadDepartment || !result.team.leadRegion || !result.team.leadTelegram) {
      return { ok: false, code: 'VALIDATION_ERROR', message: 'Vui lòng điền đầy đủ thông tin Team Lead.' };
    }

    // Team must have at least 2 people.
    if (!result.team.member2Name || !result.team.member2Email) {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'Đội nhóm cần tối thiểu 2 thành viên. Vui lòng điền Thành viên 2.'
      };
    }

    if (!isEmail_(result.team.member2Email)) {
      return { ok: false, code: 'VALIDATION_ERROR', message: 'Email Thành viên 2 không hợp lệ.' };
    }

    if (allowedDomain && !result.team.member2Email.endsWith('@' + allowedDomain)) {
      return {
        ok: false,
        code: 'INVALID_DOMAIN',
        message: 'Email Thành viên 2 cần sử dụng @' + allowedDomain + '.'
      };
    }

    // Member 3 is optional, but name/email must be a complete pair.
    if (Boolean(result.team.member3Name) !== Boolean(result.team.member3Email)) {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'Nếu có Thành viên 3, vui lòng điền đủ Họ tên và Email.'
      };
    }

    if (result.team.member3Email) {
      if (!isEmail_(result.team.member3Email)) {
        return { ok: false, code: 'VALIDATION_ERROR', message: 'Email Thành viên 3 không hợp lệ.' };
      }
      if (allowedDomain && !result.team.member3Email.endsWith('@' + allowedDomain)) {
        return {
          ok: false,
          code: 'INVALID_DOMAIN',
          message: 'Email Thành viên 3 cần sử dụng @' + allowedDomain + '.'
        };
      }
    }

    result.participantEmails = [
      contactEmail,
      result.team.member2Email,
      result.team.member3Email
    ].filter(Boolean);
  }

  const unique = {};
  for (let i = 0; i < result.participantEmails.length; i++) {
    const email = result.participantEmails[i];
    if (unique[email]) {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'Một email đang được nhập cho nhiều thành viên trong cùng đội.'
      };
    }
    unique[email] = true;
  }

  return result;
}

function findDuplicateParticipant_(sheet, participantEmails) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return '';

  // participant_keys = column Z = 26
  const values = sheet.getRange(2, 26, lastRow - 1, 1).getDisplayValues();
  const existing = {};

  values.forEach(function(row) {
    String(row[0] || '')
      .toLowerCase()
      .split(',')
      .map(function(v) { return v.trim(); })
      .filter(Boolean)
      .forEach(function(email) { existing[email] = true; });
  });

  for (let i = 0; i < participantEmails.length; i++) {
    const email = normalizeEmail_(participantEmails[i]);
    if (existing[email]) return email;
  }
  return '';
}

function sendConfirmationEmails_(ss, registrationId, data, config, rowIndex, triggerName) {
  const recipients = participantRecipientModels_(data);
  let anySent = false;
  let allSent = true;

  recipients.forEach(function(recipient) {
    const subject = '[AI SHOWCASE 2026] Xác nhận đăng ký thành công';

    const model = {
      recipientName: recipient.name,
      mode: data.mode,
      usecaseName: data.usecaseName,
      participantSummary: participantSummary_(data),
      showcaseDate: config.SHOWCASE_DATE || '25/09/2026',
      eventSiteUrl: config.EVENT_SITE_URL || ''
    };

    const htmlBody = renderEmailTemplate_(model);

    const plainBody = [
      'Xin chào ' + recipient.name + ',',
      '',
      'BTC đã ghi nhận đăng ký tham gia YES, AI-POWERED ME! — Ahamove AI Showcase 2026 của bạn.',
      '',
      'Cảm ơn bạn đã đăng ký tham gia chương trình. Thông tin chi tiết tiếp theo sẽ được BTC cập nhật qua email và Telegram.',
      '',
      'Hình thức tham gia: ' + data.mode,
      'Use Case: ' + data.usecaseName,
      'Thành viên: ' + participantSummary_(data),
      'AI Showcase dự kiến: ' + (config.SHOWCASE_DATE || '25/09/2026'),
      '',
      'Hẹn gặp bạn tại AI Showcase 2026! 🚀',
      '',
      'YES, AI-POWERED ME!',
      'Real Work. Real AI. Real Impact.',
      'Ahamove AI Showcase 2026'
    ].join('\n');

    try {
      const message = {
        to: recipient.email,
        subject: subject,
        body: plainBody,
        htmlBody: htmlBody,
        name: config.EMAIL_FROM_NAME || 'Ahamove AI Showcase 2026',
        inlineImages: {
          ahamoveLogo: getAhamoveLogoBlob_()
        }
      };

      if (config.EMAIL_REPLY_TO) message.replyTo = config.EMAIL_REPLY_TO;

      MailApp.sendEmail(message);
      anySent = true;
      logEmail_(ss, registrationId, recipient.email, 'participant_confirmation', 'sent', '', subject, triggerName, '');

    } catch (err) {
      allSent = false;
      logEmail_(ss, registrationId, recipient.email, 'participant_confirmation', 'failed', String(err), subject, triggerName, '');
    }
  });

  return { anySent: anySent, allSent: allSent };
}

function sendAdminNotification_(ss, registrationId, data, config) {
  const adminEmails = String(config.ADMIN_EMAILS || '')
    .split(',')
    .map(function(v) { return v.trim(); })
    .filter(Boolean);

  if (!adminEmails.length) return;

  const subject = '[NEW AI SHOWCASE] ' + registrationId + ' · ' + data.usecaseName;
  const body =
    'Có đăng ký AI Showcase 2026 mới.\n\n' +
    'Mã: ' + registrationId + '\n' +
    'Hình thức: ' + data.mode + '\n' +
    'Đại diện: ' + (data.mode === 'Cá nhân' ? data.individual.name : data.team.leadName) + '\n' +
    'Email: ' + data.contactEmail + '\n' +
    'Use Case: ' + data.usecaseName + '\n\n' +
    'Google Sheet: https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID + '/edit';

  adminEmails.forEach(function(email) {
    try {
      MailApp.sendEmail({
        to: email,
        subject: subject,
        body: body,
        name: config.EMAIL_FROM_NAME || 'Ahamove AI Showcase 2026'
      });
      logEmail_(ss, registrationId, email, 'admin_notification', 'sent', '', subject, 'new_registration', '');
    } catch (err) {
      logEmail_(ss, registrationId, email, 'admin_notification', 'failed', String(err), subject, 'new_registration', '');
    }
  });
}

function participantRecipientModels_(data) {
  if (data.mode === 'Cá nhân') {
    return [{ email: data.contactEmail, name: data.individual.name }];
  }

  const list = [
    { email: data.contactEmail, name: data.team.leadName },
    { email: data.team.member2Email, name: data.team.member2Name }
  ];

  if (data.team.member3Email) {
    list.push({ email: data.team.member3Email, name: data.team.member3Name });
  }

  return list;
}

function participantSummary_(data) {
  if (data.mode === 'Cá nhân') {
    return data.individual.name + ' · ' + data.individual.department + ' · ' + data.individual.region;
  }

  const members = [
    data.team.leadName + ' (Team Lead)',
    data.team.member2Name,
    data.team.member3Name
  ].filter(Boolean);

  return data.team.name + ' · ' + members.join(' · ');
}

function renderEmailTemplate_(data) {
  const template = HtmlService.createTemplateFromFile('EmailTemplate');
  template.data = data;
  return template.evaluate().getContent();
}

function logEmail_(ss, registrationId, recipient, emailType, status, error, subject, triggerName, notes) {
  const sheet = ss.getSheetByName(EMAIL_LOG_SHEET);
  const row = Math.max(sheet.getLastRow() + 1, 2);
  sheet.getRange(row, 1, 1, 10).setValues([[
    new Date(),
    registrationId,
    recipient,
    emailType,
    status,
    '',
    clean_(error, 5000),
    subject,
    triggerName,
    notes || ''
  ]]);
  sheet.getRange(row, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
}

function readConfig_(ss) {
  const sheet = ss.getSheetByName(CONFIG_SHEET);
  const lastRow = sheet.getLastRow();
  const config = {};

  if (lastRow < 2) return config;

  const rows = sheet.getRange(2, 1, lastRow - 1, 2).getDisplayValues();
  rows.forEach(function(row) {
    const key = String(row[0] || '').trim();
    if (key) config[key] = String(row[1] || '').trim();
  });
  return config;
}

function ensureWorkbook_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  let reg = ss.getSheetByName(REG_SHEET);
  if (!reg) reg = ss.insertSheet(REG_SHEET);

  let emailLog = ss.getSheetByName(EMAIL_LOG_SHEET);
  if (!emailLog) emailLog = ss.insertSheet(EMAIL_LOG_SHEET);

  let config = ss.getSheetByName(CONFIG_SHEET);
  if (!config) config = ss.insertSheet(CONFIG_SHEET);

  ensureHeaders_(reg, REG_HEADERS);
  ensureHeaders_(emailLog, EMAIL_LOG_HEADERS);

  if (config.getLastRow() === 0) {
    config.getRange(1, 1, 1, 4).setValues([['key', 'value', 'description', 'editable']]);
    config.getRange(2, 1, DEFAULT_CONFIG.length, 4).setValues(DEFAULT_CONFIG);
  }
}

function ensureHeaders_(sheet, headers) {
  const current = sheet.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
  let mismatch = false;

  for (let i = 0; i < headers.length; i++) {
    if (String(current[i] || '') !== headers[i]) {
      mismatch = true;
      break;
    }
  }

  if (mismatch) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  sheet.setFrozenRows(1);
}

function parseJsonBody_(e) {
  if (!e || !e.postData || !e.postData.contents) return null;
  try {
    return JSON.parse(e.postData.contents);
  } catch (err) {
    return null;
  }
}

function makeRegistrationId_(date) {
  const datePart = Utilities.formatDate(date, TZ, 'yyMMdd');
  const randomPart = Utilities.getUuid().replace(/-/g, '').slice(0, 6).toUpperCase();
  return 'AIS26-' + datePart + '-' + randomPart;
}

function normalizeEmail_(value) {
  return String(value || '').trim().toLowerCase();
}

function isEmail_(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''));
}

function checked_(value) {
  if (value === true || value === 1) return true;
  const v = String(value || '').toLowerCase();
  return v === 'true' || v === '1' || v === 'on' || v === 'yes';
}

function asBool_(value, fallback) {
  if (value === '' || value === null || typeof value === 'undefined') return fallback;
  return ['true', '1', 'yes', 'on'].indexOf(String(value).toLowerCase()) !== -1;
}

function clean_(value, maxLen) {
  const v = String(value || '').trim();
  return maxLen ? v.slice(0, maxLen) : v;
}

function safeJson_(obj, maxLen) {
  let value = '';
  try {
    value = JSON.stringify(obj);
  } catch (err) {
    value = '{}';
  }
  return value.slice(0, maxLen || 45000);
}


function getAhamoveLogoBlob_() {
  const bytes = Utilities.base64Decode('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');
  return Utilities.newBlob(bytes, 'image/png', 'ahamove_logo_email_new.png');
}


/**
 * Run this once after updating Code.gs + EmailTemplate.html
 * to verify that the Ahamove logo renders correctly in a real email.
 */
function testConfirmationEmail() {
  const recipient =
    Session.getActiveUser().getEmail() ||
    Session.getEffectiveUser().getEmail();

  if (!recipient) {
    throw new Error('Không xác định được email tài khoản Apps Script để gửi test.');
  }

  const model = {
    recipientName: 'Ahamover',
    mode: 'Đội nhóm',
    usecaseName: 'AI Showcase Test Use Case',
    participantSummary: 'Team Test · Ahamover 1 · Ahamover 2',
    showcaseDate: '25/09/2026',
    eventSiteUrl: ''
  };

  const htmlBody = renderEmailTemplate_(model);

  MailApp.sendEmail({
    to: recipient,
    subject: '[TEST] [AI SHOWCASE 2026] Xác nhận đăng ký thành công',
    body:
      'Đây là email test để kiểm tra template xác nhận đăng ký AI Showcase 2026.',
    htmlBody: htmlBody,
    name: 'Ahamove AI Showcase 2026',
    inlineImages: {
      ahamoveLogo: getAhamoveLogoBlob_()
    }
  });

  console.log('Test email sent to: ' + recipient);
  return recipient;
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
