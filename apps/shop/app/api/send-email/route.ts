import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
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
          contentType: att.contentType || 'image/png',
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
