/**
 * Same-origin Vercel proxy for the AI Showcase registration form.
 * Keeps the Apps Script URL and shared secret out of browser code
 * and avoids cross-origin issues between Vercel and Apps Script.
 */

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' });
  }

  const appsScriptUrl = process.env.APPS_SCRIPT_WEB_APP_URL;
  const secret = process.env.REGISTRATION_SHARED_SECRET;

  if (!appsScriptUrl || !secret) {
    return res.status(500).json({
      ok: false,
      code: 'CONFIG_MISSING',
      message: 'Backend chưa được cấu hình đầy đủ trên Vercel.'
    });
  }

  let payload = req.body || {};
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch (_) {
      return res.status(400).json({ ok: false, code: 'INVALID_JSON', message: 'Dữ liệu gửi lên không hợp lệ.' });
    }
  }

  // Limit unexpected payload size.
  const serialized = JSON.stringify(payload);
  if (Buffer.byteLength(serialized, 'utf8') > 80 * 1024) {
    return res.status(413).json({ ok: false, code: 'PAYLOAD_TOO_LARGE', message: 'Nội dung đăng ký vượt giới hạn cho phép.' });
  }

  // Honeypot: silently discard obvious bot submission.
  if (payload && payload._website) {
    return res.status(200).json({ ok: true, registrationId: 'RECEIVED', message: 'Đã ghi nhận.' });
  }

  const forwarded = {
    secret,
    payload,
    meta: {
      source: 'vercel_web',
      userAgent: req.headers['user-agent'] || '',
      websiteUrl:
        req.headers.origin ||
        (req.headers.host ? `https://${req.headers.host}` : '')
    }
  };

  try {
    const response = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(forwarded),
      redirect: 'follow'
    });

    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch (_) {
      console.error('Apps Script non-JSON response:', text.slice(0, 1000));
      return res.status(502).json({
        ok: false,
        code: 'UPSTREAM_INVALID_RESPONSE',
        message: 'Backend phản hồi không hợp lệ.'
      });
    }

    if (data.ok) {
      return res.status(200).json(data);
    }

    const statusByCode = {
      UNAUTHORIZED: 401,
      FORM_CLOSED: 403,
      DUPLICATE_PARTICIPANT: 409,
      INVALID_DOMAIN: 422,
      VALIDATION_ERROR: 422,
      BUSY: 503,
      CONFIG_NOT_READY: 503,
      SERVER_ERROR: 500
    };

    return res.status(statusByCode[data.code] || 400).json(data);

  } catch (error) {
    console.error('Registration proxy error:', error);
    return res.status(502).json({
      ok: false,
      code: 'UPSTREAM_UNAVAILABLE',
      message: 'Chưa thể kết nối tới hệ thống đăng ký. Vui lòng thử lại sau.'
    });
  }
};
