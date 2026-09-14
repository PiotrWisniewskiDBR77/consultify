/** @vitest-environment node */
import net from 'node:net';
import nodemailer from 'nodemailer';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('initiative work report email — real local SMTP transport', () => {
  let server: net.Server;
  let port = 0;
  let transcript = '';

  beforeAll(async () => {
    server = net.createServer((socket) => {
      socket.setEncoding('utf8');
      let input = '';
      let dataMode = false;
      socket.write('220 local.test ESMTP\r\n');
      socket.on('data', (chunk) => {
        transcript += chunk;
        input += chunk;
        if (dataMode) {
          const end = input.indexOf('\r\n.\r\n');
          if (end >= 0) {
            input = input.slice(end + 5);
            dataMode = false;
            socket.write('250 2.0.0 queued\r\n');
          }
          return;
        }
        for (;;) {
          const lineEnd = input.indexOf('\r\n');
          if (lineEnd < 0) break;
          const line = input.slice(0, lineEnd);
          input = input.slice(lineEnd + 2);
          if (/^EHLO/i.test(line))
            socket.write('250-local.test\r\n250-AUTH PLAIN\r\n250 SIZE 10485760\r\n');
          else if (/^AUTH PLAIN/i.test(line)) socket.write('235 2.7.0 authenticated\r\n');
          else if (/^(MAIL FROM|RCPT TO)/i.test(line)) socket.write('250 2.1.0 ok\r\n');
          else if (/^DATA/i.test(line)) {
            dataMode = true;
            socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
            if (input) {
              const end = input.indexOf('\r\n.\r\n');
              if (end >= 0) {
                input = input.slice(end + 5);
                dataMode = false;
                socket.write('250 2.0.0 queued\r\n');
              }
            }
          } else if (/^QUIT/i.test(line)) {
            socket.end('221 2.0.0 bye\r\n');
          } else socket.write('250 ok\r\n');
        }
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as net.AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  });

  it('receives provider acknowledgement for a PDF attachment', async () => {
    const transporter = nodemailer.createTransport({
      host: '127.0.0.1',
      port,
      secure: false,
      auth: { user: 'sender@example.test', pass: 'secret' },
    });
    const accepted = await transporter.sendMail({
      from: 'sender@example.test',
      to: 'recipient@example.test',
      subject: 'Initiative work report',
      text: 'Attached report',
      html: '<p>Attached report</p>',
      attachments: [
        {
          filename: 'work-report.pdf',
          content: Buffer.from('%PDF-test'),
          contentType: 'application/pdf',
        },
      ],
    });

    expect(accepted.accepted).toContain('recipient@example.test');
    expect(transcript).toContain('recipient@example.test');
    expect(transcript).toContain('filename=work-report.pdf');
    expect(transcript).toContain('Content-Type: application/pdf');
  });
});
