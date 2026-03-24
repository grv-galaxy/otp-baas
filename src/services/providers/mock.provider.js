// src/services/providers/mock.provider.js
const BaseProvider = require('./provider.interface');

class MockProvider extends BaseProvider {
  async send(identifier, otpCode, channel, requestId) {
    // Only place the raw OTP code may appear, and only in non-production.
    console.log(`[MOCK OTP] requestId=${requestId} identifier=${identifier} channel=${channel} code=${otpCode}`);
    return { success: true, messageId: `mock-${Date.now()}` };
  }
}

module.exports = MockProvider;
