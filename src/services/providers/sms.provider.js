// src/services/providers/sms.provider.js
const twilio = require('twilio');
const BaseProvider = require('./provider.interface');
const env = require('../../config/env');

class SmsProvider extends BaseProvider {
  async send(identifier, otpCode, channel, requestId) {
    const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

    const message = await client.messages.create({
      body: `Your OTP code is ${otpCode}. Valid for 5 minutes. Do not share this with anyone.`,
      from: env.TWILIO_PHONE_NUMBER,
      to: identifier,
    });

    console.log('Twilio SMS sent:', message.sid);
    return { success: true, messageId: message.sid };
  }
}

module.exports = SmsProvider;