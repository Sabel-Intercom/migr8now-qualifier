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
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 315 105" style="height:32px;width:auto;display:block" aria-label="Sabel">
      <g fill="#FFFFFF">
        <path d="M28.99,66.25c-2.91,0-5.54-.5-7.82-1.5-4.35-1.9-6.82-5.54-7.34-10.81-.02-.21.05-.41.19-.57.14-.16.33-.24.54-.24h7.13c.07,1.21.37,2.78.93,3.73.58,1.01,1.43,1.81,2.52,2.37,1.08.56,2.38.84,3.85.84,1.23,0,2.34-.2,3.28-.6.95-.41,1.71-1,2.24-1.78.53-.78.8-1.71.8-2.76s-.27-2-.8-2.82c-.52-.81-1.28-1.51-2.24-2.09-.94-.57-2.05-1.11-3.31-1.59-1.25-.49-2.61-.95-4.05-1.38-3.45-1.03-6.06-2.45-7.75-4.2-1.68-1.73-2.53-4.06-2.53-6.9,0-2.39.59-4.47,1.74-6.17,1.16-1.71,2.78-3.03,4.83-3.94,2.06-.92,4.44-1.38,7.08-1.38s5.14.47,7.2,1.41c2.05.93,3.69,2.29,4.86,4.03,1,1.48,1.61,3.21,1.81,5.13.02.2-.04.4-.18.55-.14.16-.34.25-.55.25h-7.24c-.04-.85-.3-1.66-.76-2.42-.51-.83-1.21-1.51-2.1-2.01-.89-.51-1.95-.76-3.16-.76-.09,0-.2,0-.3,0-.92,0-1.78.17-2.54.49-.85.37-1.55.91-2.06,1.63-.51.72-.77,1.62-.77,2.68s.25,1.89.74,2.59c.49.69,1.19,1.28,2.1,1.77.88.47,1.91.92,3.07,1.33,1.15.41,2.4.85,3.77,1.31,2.05.66,3.93,1.47,5.59,2.41,1.65.93,2.99,2.16,3.97,3.66.98,1.49,1.48,3.48,1.48,5.91,0,2.09-.55,4.05-1.63,5.83-1.08,1.78-2.69,3.25-4.78,4.35-2.1,1.11-4.73,1.67-7.83,1.67Z"/>
        <path d="M83.19,65.68c-.27,0-.51-.17-.6-.43l-2.97-8.62h-15.78l-2.98,8.62c-.09.25-.33.42-.6.42h-7.12c-.21,0-.4-.1-.52-.27-.12-.17-.15-.38-.08-.58l14.35-39.38c.09-.25.33-.41.59-.41h8.65c.26,0,.5.17.59.42l14.29,39.38c.07.2.04.41-.08.58s-.31.27-.52.27h-7.24ZM66,50.42h11.5l-5.73-16.67-5.76,16.67Z"/>
        <path d="M103.21,65.68c-.35,0-.63-.28-.63-.63V25.67c0-.35.28-.63.63-.63h16.58c2.78,0,5.16.45,7.1,1.33,1.92.88,3.4,2.1,4.39,3.64.99,1.53,1.49,3.35,1.49,5.42s-.43,3.68-1.28,5.04c-.85,1.37-2.01,2.43-3.46,3.17l-1.22.63c-.19.1-.3.3-.28.51.02.21.16.38.36.45.8.25,1.55.6,2.23,1.04,1.41.92,2.54,2.13,3.35,3.59.82,1.46,1.23,3.09,1.23,4.85,0,2.18-.52,4.11-1.55,5.75-1.03,1.63-2.54,2.93-4.51,3.85-1.97.92-4.42,1.39-7.27,1.39h-17.16ZM110.73,59.17h8.23c2.05,0,3.66-.48,4.8-1.44,1.15-.96,1.73-2.34,1.73-4.09s-.6-3.22-1.79-4.24c-1.11-.95-3.11-1.52-5.35-1.52h-3.24s-.08-.04-.08-.08v-5.71s.04-.08.08-.08h2.66c2.21,0,4.12-.52,5.12-1.38,1.07-.93,1.61-2.24,1.61-3.91s-.54-2.99-1.61-3.92c-1.06-.92-2.64-1.38-4.68-1.38h-7.47v27.74Z"/>
        <path d="M147.37,65.68c-.35,0-.63-.28-.63-.63V25.67c0-.35.28-.63.63-.63h26.18c.35,0,.63.28.63.63v5.82h-19.28v10.41h17.52v6.21h-17.52v11.12h19.28v5.82c0,.35-.28.63-.63.63h-26.18Z"/>
        <path d="M189.61,65.68c-.35,0-.63-.28-.63-.63V25.67c0-.35.28-.63.63-.63h7.52v34.43h18.77v5.59c0,.35-.28.63-.63.63h-25.66Z"/>
        <circle cx="261.72" cy="32.47" r="7.19"/>
        <path d="M255.01,37.59h0c2.48,0,4.49,2.01,4.49,4.49v21.83c0,.1-.08.19-.19.19h-6.29c-1.38,0-2.51-1.12-2.51-2.51v-19.51c0-2.48,2.01-4.49,4.49-4.49Z" transform="translate(38.74 195.21) rotate(-45)"/>
        <path d="M275.61,29.85h0c2.48,0,4.49,2.01,4.49,4.49v20.75c0,.1-.08.19-.19.19h-8.61c-.1,0-.19-.08-.19-.19v-20.75c0-2.48,2.01-4.49,4.49-4.49Z" transform="translate(110.82 -182.42) rotate(45)"/>
      </g>
      <path fill="#C70204" d="M288.29,19.98c4.55,0,8.24,3.7,8.24,8.24v31.1c0,4.55-3.7,8.24-8.24,8.24h-21.32l-1.32,1.33-15.83,15.97c-.09.09-.21.14-.34.14-.25,0-.46-.2-.47-.46v-16.98h-7.07c-4.55,0-8.24-3.7-8.24-8.24v-31.1c0-4.55,3.7-8.24,8.24-8.24h46.35M288.29,15.49h-46.35c-7.03,0-12.73,5.7-12.73,12.73v31.1c0,7.03,5.7,12.73,12.73,12.73h2.58v12.53c.03,2.72,2.24,4.91,4.96,4.91,1.32,0,2.59-.53,3.52-1.47l15.83-15.97h19.45c7.03,0,12.73-5.7,12.73-12.73v-31.1c0-7.03-5.7-12.73-12.73-12.73h0Z"/>
    </svg>
    <div style="font-size:10px;color:#64748B;letter-spacing:0.15em;text-transform:uppercase;font-family:monospace;margin-top:8px">Migr8Now Qualifier · New Submission</div>
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

  ${data.estimate ? `
  <div style="background:#161618;border:1px solid #2A3547;border-left:3px solid #E10600;border-radius:4px;padding:18px 20px;margin-bottom:24px">
    <div style="color:#E10600;font-family:monospace;font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:10px">Estimate<span style="color:#E10600">*</span></div>
    <table style="width:100%;border-collapse:collapse">
      <tr>
        <td style="padding:0;vertical-align:top">
          <div style="color:#94A3B8;font-size:10px;font-family:monospace;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:4px">Hours</div>
          <div style="color:#FFFFFF;font-size:22px;font-weight:700;line-height:1.1">${data.estimate.hours}<span style="color:#94A3B8;font-size:13px;font-weight:500;margin-left:4px">hrs</span></div>
        </td>
        <td style="padding:0;vertical-align:top;text-align:right">
          <div style="color:#94A3B8;font-size:10px;font-family:monospace;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:4px">${verdict === 'BESPOKE' ? 'Starting from' : 'Total'}</div>
          <div style="color:#FFFFFF;font-size:18px;font-weight:600;font-family:monospace">$${data.estimate.cost.toLocaleString('en-US')} USD</div>
        </td>
      </tr>
    </table>
    <div style="margin-top:12px;padding-top:12px;border-top:1px solid #2A3547;color:#64748B;font-size:11px;line-height:1.5">
      Based on ${data.estimate.exactProvided ? `an exact count of ${data.estimate.qty.toLocaleString('en-US')}` : `band midpoint of ${data.estimate.qty.toLocaleString('en-US')}`} tickets${verdict === 'BESPOKE' ? '. Final bespoke pricing requires a scoping call with Sabel.' : '.'}
    </div>
  </div>
  ` : ''}

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

  ${data.estimate ? `
  <div style="padding:12px 16px;margin-bottom:16px;color:#64748B;font-size:11px;line-height:1.5;border-left:2px solid #2A3547">
    <span style="color:#E10600">*</span> Estimated hours and cost are based on the information provided and are subject to change with further discovery. Final scope, hours, and pricing are confirmed in a formal proposal following a scoping call.
  </div>
  ` : ''}

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

    const estSuffix = data.estimate
      ? ` · ${data.estimate.hours}hrs / $${data.estimate.cost.toLocaleString('en-US')}${data.verdict === 'BESPOKE' ? '+' : ''}`
      : '';
    const subject = `[Migr8Now] ${data.verdict} — ${data.company}${estSuffix}`;
    const html = buildEmailHtml(payload);
    await sendEmail({ to: recipients, subject, html });

    res.status(200).json({ ok: true, id, verdict: data.verdict });
  } catch (err) {
    console.error('Submission error:', err);
    res.status(500).json({ error: 'Internal error', detail: err.message });
  }
};
