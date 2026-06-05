// ============================================================
//  POST /api/apply  —  Vercel serverless function (Node runtime)
//  Receives an application (name + email) from the hero modal and
//  emails it via Resend.
//
//  All config is via environment variables — NOTHING is hardcoded:
//    RESEND_API_KEY  — Resend API key
//    RECIPIENT_EMAIL — where applications are delivered
//    FROM_EMAIL      — verified sender. Placeholder for now:
//                      onboarding@resend.dev (Resend's test sender).
//                      Swap to a verified-domain address later — it's
//                      a one-line env change, no code change.
//
//  These are Margin-Control-specific and live on THIS project's own
//  Vercel deployment. Do not reuse values from any other project.
// ============================================================
import { Resend } from 'resend';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Body is auto-parsed for application/json, but be defensive.
  let payload = req.body;
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload); } catch { payload = {}; }
  }
  payload = payload || {};

  const name  = String(payload.name  || '').trim();
  const email = String(payload.email || '').trim();

  if (!name || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'A valid name and email are required.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to     = process.env.RECIPIENT_EMAIL;
  const from   = process.env.FROM_EMAIL || 'onboarding@resend.dev';

  if (!apiKey || !to) {
    console.error('Missing RESEND_API_KEY and/or RECIPIENT_EMAIL environment variable.');
    return res.status(500).json({ error: 'The application form is not configured yet. Please try again later.' });
  }

  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      from: `Margin Control Applications <${from}>`,
      to: [to],
      replyTo: email,
      subject: `New program application — ${name}`,
      text:
        `New application received.\n\n` +
        `Name:  ${name}\n` +
        `Email: ${email}\n\n` +
        `Reply to this email to reach the applicant directly.`,
      html:
        `<h2 style="margin:0 0 12px">New program application</h2>` +
        `<p><strong>Name:</strong> ${escapeHtml(name)}</p>` +
        `<p><strong>Email:</strong> ${escapeHtml(email)}</p>` +
        `<p style="color:#666">Reply to this email to reach the applicant directly.</p>`,
    });

    if (error) {
      console.error('Resend send error:', error);
      return res.status(502).json({ error: 'We could not send your application. Please try again.' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Unexpected send failure:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
