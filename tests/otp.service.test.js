const otpService = require('../src/services/otp.service');
const OtpModel = require('../src/models/otp.model');
const bcrypt = require('bcryptjs');

jest.mock('../src/models/otp.model');
jest.mock('bcryptjs');
jest.mock('../src/utils/jwt.utils', () => ({
  signToken: jest.fn().mockReturnValue('mock-jwt-token'),
  revokeToken: jest.fn().mockResolvedValue(true)
}));

jest.mock('../src/services/providers/email.provider');
jest.mock('../src/services/providers/sms.provider');
jest.mock('../src/services/providers/whatsapp.provider');

jest.mock('../src/services/providers/mock.provider', () => {
  return jest.fn().mockImplementation(() => {
    return { send: jest.fn() };
  });
});
const MockProvider = require('../src/services/providers/mock.provider');

describe('OTP Service', () => {
  let mockProviderInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockProviderInstance = new MockProvider();
    MockProvider.mockClear();
    
    mockProviderInstance.send.mockResolvedValue({ success: true });
    MockProvider.mockImplementation(() => mockProviderInstance);
  });

  describe('sendOtp', () => {
    it('Generates a 6-digit numeric OTP and stores bcrypt hash, not plaintext', async () => {
      bcrypt.hash.mockResolvedValue('hashed-123456');
      OtpModel.create.mockResolvedValue({
        identifier: 'test@example.com',
        save: jest.fn().mockResolvedValue(true)
      });
      OtpModel.findOne.mockResolvedValue(null);

      const res = await otpService.sendOtp({ identifier: 'test@example.com', channel: 'email' });
      
      expect(res.success).toBe(true);
      expect(bcrypt.hash).toHaveBeenCalled();
      
      const createCallArgs = OtpModel.create.mock.calls[0][0];
      expect(createCallArgs.hashedCode).toBe('hashed-123456');
      expect(createCallArgs.hashedCode).not.toMatch(/^\d{6}$/);
    });

    it('Idempotency key deduplicates send requests', async () => {
      const futureDate = new Date();
      futureDate.setMinutes(futureDate.getMinutes() + 5);
      
      OtpModel.findOne.mockResolvedValue({
        idempotencyKey: 'idem-123',
        channel: 'email',
        expiresAt: futureDate,
        getTime: () => futureDate.getTime()
      });

      const res = await otpService.sendOtp({ identifier: 'test@example.com', channel: 'email', idempotencyKey: 'idem-123' });
      expect(res.message).toContain('OTP sent'); // Idempotency hit
      expect(OtpModel.create).not.toHaveBeenCalled();
    });

    it('deliveryStatus set to failed when provider throws', async () => {
      mockProviderInstance.send.mockRejectedValue(new Error('Provider API Down'));
      
      const mockOtpDoc = { save: jest.fn().mockResolvedValue(true) };
      OtpModel.create.mockResolvedValue(mockOtpDoc);
      OtpModel.findOne.mockResolvedValue(null);

      await expect(otpService.sendOtp({ identifier: 'test', channel: 'email' })).rejects.toThrow('Failed to send OTP');
      expect(mockOtpDoc.deliveryStatus).toBe('failed');
      expect(mockOtpDoc.save).toHaveBeenCalled();
    });
  });

  describe('verifyOtp', () => {
    it('Returns OTP_NOT_FOUND when no doc exists', async () => {
      const mockSort = jest.fn().mockResolvedValue(null);
      OtpModel.findOne.mockReturnValue({ sort: mockSort });

      await expect(otpService.verifyOtp({ identifier: 'test', code: '123' }))
        .rejects.toMatchObject({ code: 'OTP_NOT_FOUND' });
    });

    it('Returns OTP_INVALIDATED after maxAttempts failures', async () => {
      const mockSave = jest.fn();
      const mockSort = jest.fn().mockResolvedValue({ identifier: 'test', attempts: 3, maxAttempts: 3, save: mockSave });
      OtpModel.findOne.mockReturnValue({ sort: mockSort });

      await expect(otpService.verifyOtp({ identifier: 'test', code: '123' }))
        .rejects.toMatchObject({ code: 'OTP_INVALIDATED' });
    });

    it('Increments attempts on each wrong code', async () => {
      const mockSave = jest.fn();
      const mockDoc = { identifier: 'test', attempts: 0, maxAttempts: 3, hashedCode: 'hash', save: mockSave };
      
      const mockSort = jest.fn().mockResolvedValue(mockDoc);
      OtpModel.findOne.mockReturnValue({ sort: mockSort });
      bcrypt.compare.mockResolvedValue(false);

      await expect(otpService.verifyOtp({ identifier: 'test', code: '123' }))
        .rejects.toMatchObject({ code: 'OTP_INVALID' });
      
      expect(mockDoc.attempts).toBe(1);
      expect(mockSave).toHaveBeenCalled();
    });

    it('Returns a valid JWT on correct code', async () => {
      const mockSave = jest.fn();
      const mockDoc = { identifier: 'test', channel: 'email', attempts: 0, maxAttempts: 3, hashedCode: 'hash', save: mockSave };
      
      const mockSort = jest.fn().mockResolvedValue(mockDoc);
      OtpModel.findOne.mockReturnValue({ sort: mockSort });
      bcrypt.compare.mockResolvedValue(true);

      const res = await otpService.verifyOtp({ identifier: 'test', code: '123456' });
      
      expect(res.success).toBe(true);
      expect(res.verificationToken).toBe('mock-jwt-token');
      expect(mockDoc.isVerified).toBe(true);
      expect(mockSave).toHaveBeenCalled();
    });
  });
});
