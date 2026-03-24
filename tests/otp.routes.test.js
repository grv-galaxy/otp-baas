const request = require('supertest');
const app = require('../src/server');
const otpService = require('../src/services/otp.service');

jest.mock('../src/services/otp.service');

describe('OTP Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /health returns 200 with db status', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('db');
  });

  it('POST /v1/otp/send returns 200 on valid request', async () => {
    otpService.sendOtp.mockResolvedValue({
      success: true,
      message: 'OTP sent',
      channel: 'email',
      expiresIn: 300
    });

    const res = await request(app)
      .post('/v1/otp/send')
      .send({ identifier: 'test@example.com', channel: 'email' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /v1/otp/send returns 422 on missing identifier', async () => {
    const res = await request(app)
      .post('/v1/otp/send')
      .send({ channel: 'email' });

    expect(res.statusCode).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('POST /v1/otp/send returns 429 after rate limit exceeded', async () => {
    // Exceed max (default 3 inside generic code)
    // To cleanly test rate limit without waiting 15 mins, we just hit it 4 times
    let res;
    for (let i = 0; i < 4; i++) {
        res = await request(app)
          .post('/v1/otp/send')
          .send({ identifier: 'ratelimit@example.com', channel: 'email' });
    }
    expect(res.statusCode).toBe(429);
    expect(res.body.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('POST /v1/otp/verify returns 200 + JWT on correct code', async () => {
    otpService.verifyOtp.mockResolvedValue({
      success: true,
      verificationToken: 'jwt-token-123'
    });

    const res = await request(app)
      .post('/v1/otp/verify')
      .send({ identifier: 'test@example.com', code: '123456' });

    expect(res.statusCode).toBe(200);
    expect(res.body.verificationToken).toBe('jwt-token-123');
  });

  it('POST /v1/otp/verify returns 401 on wrong code', async () => {
    const error = new Error('Invalid OTP code');
    error.code = 'OTP_INVALID';
    error.status = 401;
    otpService.verifyOtp.mockRejectedValue(error);

    const res = await request(app)
      .post('/v1/otp/verify')
      .send({ identifier: 'test@example.com', code: '000000' });

    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('OTP_INVALID');
  });
});
