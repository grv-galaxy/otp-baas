// src/services/providers/provider.interface.js
class BaseProvider {
  /**
   * Send the OTP code via the configured channel.
   * @param {string} identifier - User's email or phone number
   * @param {string} otpCode - The numeric OTP code to send
   * @param {string} channel - The channel used (e.g. email, sms, whatsapp)
   * @param {string} requestId - The request tracking ID
   * @returns {Promise<{ success: boolean, messageId?: string }>}
   */
  async send(identifier, otpCode, channel, requestId) {
    throw new Error('Method not implemented.');
  }
}

module.exports = BaseProvider;
