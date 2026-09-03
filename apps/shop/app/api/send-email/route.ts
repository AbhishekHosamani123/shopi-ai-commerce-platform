import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KNOWN_API_SECRETS = new Set([
  'razorpay_ai_commerce_shared_secret_2026',
  'razorpay_ai_commerce_jwt_supersecret_key_2026',
  (process.env.API_SECRET || '').trim(),
  (process.env.JWT_ENCRYPTION_KEY || '').trim()
].filter(Boolean));

export async function POST(req: NextRequest) {
  try {
    const apiSecret = (req.headers.get('x-api-secret') || req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();

    // Allow internal service-to-service calls matching any known platform secret
    const isAuthorized = !process.env.API_SECRET
      || apiSecret === 'razorpay_ai_commerce_shared_secret_2026'
      || KNOWN_API_SECRETS.has(apiSecret);

    if (!isAuthorized) {
      console.warn(`[Vercel Email Relay] Rejected call with secret: "${apiSecret.substring(0, 4)}..."`);
      return NextResponse.json({ success: false, error: 'Unauthorized: Invalid API Secret' }, { status: 401 });
    }

    const body = await req.json();
    const { to, subject, text, html, fromName, attachments, replyTo } = body;

    if (!to || !subject || (!text && !html)) {
      return NextResponse.json({ success: false, error: 'Missing required email fields (to, subject, text/html)' }, { status: 400 });
    }

    const user = (process.env.EMAIL || process.env.SMTP_USER || 'abhishekhosamani522@gmail.com').trim();
    const pass = (process.env.PASSWORD || process.env.SMTP_PASS || 'exro pabj zmuy oveo').trim();
    const sender = `"${fromName || process.env.SMTP_SENDERNAME || 'Shopi Store'}" <${user}>`;

    // Vercel Serverless runs on AWS Lambda which has full outbound access on port 587
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user, pass },
      tls: { servername: 'smtp.gmail.com', rejectUnauthorized: true },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000
    });

    const parsedAttachments = Array.isArray(attachments)
      ? attachments.map((att: any) => ({
          filename: att.filename,
          content: typeof att.content === 'string' ? Buffer.from(att.content, 'base64') : att.content,
          contentType: att.contentType,
          cid: att.cid,
          contentDisposition: (att.cid ? 'inline' : 'attachment') as 'inline' | 'attachment'
        }))
      : undefined;

    const mailOptions = {
      from: sender,
      to,
      replyTo: replyTo || user,
      subject,
      text: text || '',
      html: html || `<p>${text}</p>`,
      attachments: parsedAttachments
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Vercel Email Relay] Email sent to ${to}: ${info.messageId}`);

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      provider: 'VERCEL_GMAIL_RELAY'
    });
  } catch (error: any) {
    console.error('[Vercel Email Relay] Error sending email:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to send email via Vercel Relay'
      },
      { status: 500 }
    );
  }
}
