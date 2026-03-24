// src/services/providers/whatsapp.provider.js
const axios = require('axios');
const BaseProvider = require('./provider.interface');
const env = require('../../config/env');

class WhatsappProvider extends BaseProvider {
  async send(identifier, otpCode, channel, requestId) {
    let countryCode = '91';
    let mobileNumber = identifier;

    if (identifier.startsWith('+')) {
      const match = identifier.match(/^\+(\d{1,3})(\d+)$/);
      if (match) {
        countryCode = match[1];
        mobileNumber = match[2];
      }
    }

    const response = await axios.post(
      'https://cpaas.messagecentral.com/verification/v3/send',
      null,
      {
        headers: { authToken: env.MC_AUTH_TOKEN },
        params: {
          countryCode,
          customerId: env.MC_CUSTOMER_ID,
          flowType: 'WHATSAPP',
          mobileNumber,
          senderId: env.MC_SENDER_ID,
          type: 'SMS',
          message: `Your code is ${otpCode}`
        }
      }
    );

    return { success: true, messageId: response.data?.messageId || 'unknown' };
  }
}

module.exports = WhatsappProvider;
