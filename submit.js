// api/submit.js — Vercel serverless function
// Receives Migr8Now qualifier submissions, saves to Upstash, emails summary via Resend

const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const RESEND_KEY    = process.env.RESEND_API_KEY;
const FROM_EMAIL    = process.env.FROM_EMAIL || 'Sabel Qualifier <noreply@sabelcustomersuccess.com>';
const RICHARD_EMAIL = 'richard@sabelcustomersuccess.com';
const AKBUR_EMAIL   = 'akbur.ghafoor@intercom.io';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function slug(str) {
  return (str || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function shortId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function saveToUpstash(key, payload) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    console.warn('Upstash not configured; skipping save');
    return;
  }
  const url = `${UPSTASH_URL}/set/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upstash save failed: ${res.status} ${text}`);
  }
}

function buildEmailHtml(data) {
  const verdict = data.verdict || 'UNKNOWN';
  const verdictColor = verdict === 'AUTOMATED' ? '#22C55E' : '#E10600';
  const reasons = (data.reasons && data.reasons.length) ? data.reasons : ['All triggers clear'];
  const notes = data.notes && data.notes.length ? data.notes : [];

  const row = (label, value) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #2A3547;color:#94A3B8;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;font-family:monospace;width:40%;vertical-align:top">${label}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #2A3547;color:#E2E8F0;font-size:14px">${value || '<span style="color:#64748B">—</span>'}</td>
    </tr>
  `;

  return `
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#0B0B0C;font-family:-apple-system,Segoe UI,sans-serif">
<div style="max-width:640px;margin:0 auto;padding:32px 24px;background:#0B0B0C;color:#E2E8F0">

  <div style="border-bottom:1px solid #2A3547;padding-bottom:16px;margin-bottom:24px">
    <div style="font-size:20px;font-weight:700;color:#FFFFFF">SABEL<span style="color:#E10600">.</span></div>
    <div style="font-size:10px;color:#64748B;letter-spacing:0.15em;text-transform:uppercase;font-family:monospace;margin-top:4px">Migr8Now Qualifier · New Submission</div>
  </div>

  <div style="background:#161618;border:1px solid #2A3547;border-left:3px solid ${verdictColor};border-radius:4px;padding:20px;margin-bottom:24px">
    <div style="display:inline-block;background:${verdictColor};color:${verdict === 'AUTOMATED' ? '#0B0B0C' : '#FFFFFF'};padding:6px 12px;border-radius:4px;font-family:monospace;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:12px">
      ${verdict}
    </div>
    <div style="color:#FFFFFF;font-size:16px;font-weight:600;margin-bottom:8px">
      ${data.company} — ${verdict === 'AUTOMATED' ? 'qualifies for automated Migr8Now' : 'requires bespoke scoping'}
    </div>
    <ul style="margin:0;padding-left:20px;color:#E2E8F0;font-size:13px">
      ${reasons.map(r => `<li style="margin-bottom:4px">${r}</li>`).join('')}
    </ul>
    ${notes.length ? `
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid #2A3547">
        <div style="color:#94A3B8;font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px">Planning notes</div>
        <ul style="margin:0;padding-left:20px;color:#94A3B8;font-size:12px">
          ${notes.map(n => `<li style="margin-bottom:3px">${n}</li>`).join('')}
        </ul>
      </div>
    ` : ''}
  </div>

  <div style="background:#161618;border:1px solid #2A3547;border-radius:4px;overflow:hidden;margin-bottom:24px">
    <div style="padding:12px 16px;background:#0B0B0C;border-bottom:1px solid #2A3547;color:#E10600;font-family:monospace;font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase">
      Deal
    </div>
    <table style="width:100%;border-collapse:collapse">
      ${row('Company', data.company)}
      ${row('AE', `${data.ae_name}${data.ae_email ? ` · ${data.ae_email}` : ''}`)}
      ${row('Submitted', new Date(data.submitted_at).toLocaleString('en-AU', { timeZone: 'Australia/Melbourne' }) + ' Melbourne')}
    </table>
  </div>

  <div style="background:#161618;border:1px solid #2A3547;border-radius:4px;overflow:hidden;margin-bottom:24px">
    <div style="padding:12px 16px;background:#0B0B0C;border-bottom:1px solid #2A3547;color:#E10600;font-family:monospace;font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase">
      Source &amp; volume
    </div>
    <table style="width:100%;border-collapse:collapse">
      ${row('Source platform', data.source)}
      ${row('Migrating as', data.migrate_as)}
      ${row('Ticket volume', data.ticket_volume)}
      ${row('Agents', data.agent_count)}
      ${row('Timeframe', data.timeframe === 'Filtered' ? `Filtered · ${data.timeframe_detail || ''}` : data.timeframe)}
    </table>
  </div>

  <div style="background:#161618;border:1px solid #2A3547;border-radius:4px;overflow:hidden;margin-bottom:24px">
    <div style="padding:12px 16px;background:#0B0B0C;border-bottom:1px solid #2A3547;color:#E10600;font-family:monospace;font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase">
      Structure &amp; mappings
    </div>
    <table style="width:100%;border-collapse:collapse">
      ${row('Inbox structure', data.inbox_structure)}
      ${row('Statuses', data.statuses)}
      ${row('Ticket attributes', data.ticket_attributes)}
    </table>
  </div>

  <div style="background:#161618;border:1px solid #2A3547;border-radius:4px;overflow:hidden;margin-bottom:24px">
    <div style="padding:12px 16px;background:#0B0B0C;border-bottom:1px solid #2A3547;color:#E10600;font-family:monospace;font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase">
      Contacts &amp; companies
    </div>
    <table style="width:100%;border-collapse:collapse">
      ${row('Contacts scope', data.contacts_scope)}
      ${row('Contact attributes', data.contact_attributes)}
      ${row('Companies', data.companies === 'Migrate' ? `Migrate · ${data.company_attributes || ''} attributes` : 'Skip')}
    </table>
  </div>

  <div style="background:#161618;border:1px solid #2A3547;border-radius:4px;overflow:hidden;margin-bottom:24px">
    <div style="padding:12px 16px;background:#0B0B0C;border-bottom:1px solid #2A3547;color:#E10600;font-family:monospace;font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase">
      Compliance &amp; complexity
    </div>
    <table style="width:100%;border-collapse:collapse">
      ${row('Regulatory', data.regulatory)}
      ${row('Attachments', data.attachments)}
      ${row('Custom logic', data.custom_logic === 'Yes' ? `Yes — ${data.custom_logic_detail || ''}` : 'None')}
    </table>
  </div>

  <div style="padding-top:16px;border-top:1px solid #2A3547;text-align:center;color:#64748B;font-family:monospace;font-size:10px;letter-spacing:0.15em;text-transform:uppercase">
    Perfect Made Possible · sabelcustomersuccess.com
  </div>

</div>
</body></html>
  `;
}

async function sendEmail({ to, subject, html }) {
  if (!RESEND_KEY) {
    console.warn('Resend not configured; skipping email');
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`Resend failed (${to.join(', ')}): ${res.status} ${text}`);
  }
}

module.exports = async (req, res) => {
  cors(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const data = req.body || {};

    if (!data.company || !data.ae_name) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const id = `${slug(data.company)}-${shortId()}`;
    const key = `migr8now-lead-${id}`;
    const payload = { id, key, ...data, received_at: new Date().toISOString() };

    await saveToUpstash(key, payload);

    // Build recipient list
    const recipients = [RICHARD_EMAIL, AKBUR_EMAIL];
    if (data.ae_email && /\S+@\S+\.\S+/.test(data.ae_email)) {
      recipients.push(data.ae_email);
    }

    const subject = `[Migr8Now] ${data.verdict} — ${data.company}`;
    const html = buildEmailHtml(payload);
    await sendEmail({ to: recipients, subject, html });

    res.status(200).json({ ok: true, id, verdict: data.verdict });
  } catch (err) {
    console.error('Submission error:', err);
    res.status(500).json({ error: 'Internal error', detail: err.message });
  }
};
