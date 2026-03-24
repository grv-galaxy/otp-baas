// src/services/providers/email.provider.js
const nodemailer = require('nodemailer');
const BaseProvider = require('./provider.interface');
const env = require('../../config/env');

class EmailProvider extends BaseProvider {
  constructor() {
    super();
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS
      }
    });
  }

  async send(identifier, otpCode, channel, requestId) {
    const info = await this.transporter.sendMail({
      from: env.EMAIL_FROM,
      to: identifier,
      subject: 'Your OTP Verification Code',
      text: `Your verification code is: ${otpCode}. It expires in ${env.OTP_EXPIRY_MINUTES} minutes.`
    });
    return { success: true, messageId: info.messageId };
  }
}

module.exports = EmailProvider;
