# OTP Backend-as-a-Service (BaaS) Documentation

## Project Overview
A production-ready, security-hardened OTP (One-Time Password) management system built with Node.js, Express, and MongoDB. This system provides a robust API for sending, verifying, and revoking OTPs across multiple channels (Email, SMS, WhatsApp) with native support for Twilio and Message Central.

## Tech Stack
- **Runtime**: Node.js (>=18.0.0)
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Caching & Rate Limiting**: Redis (IORedis) with graceful MemoryStore fallback
- **Security**: 
  - `helmet`: Secure HTTP headers
  - `bcryptjs`: Secure OTP hashing (never stored in plaintext)
  - `jsonwebtoken`: Secure verification tokens
  - `express-rate-limit`: multi-layered rate limiting (IP, Identifier, and Global)
- **Validation**: `zod` for request payload validation
- **Logging**: `winston` for structured JSON logging and `morgan` for HTTP request logging
- **Communication Providers**:
  - `nodemailer`: Email delivery (SMTP)
  - `twilio`: Native SMS integration
  - `axios`: Message Central (SMS/WhatsApp) integration
- **Documentation**: `swagger-ui-express` for OpenAPI 3.0 specs
- **Testing**: `jest` and `supertest` for unit and integration tests
- **Deployment**: `Dockerfile`, `docker-compose.yml`, and `render.yaml` (Optimized for Render Free Tier)

## Project Structure
```text
src/
├── config/             # Database, Logger, Env validation
├── controllers/        # Thin controllers for OTP logic
├── middleware/         # Security, Validation, Rate limiting, Error handling
├── models/             # Mongoose schemas (OTP with TTL)
├── routes/             # API routing
├── services/           # Business logic and Provider Strategy
│   └── providers/      # Concrete implementations (Email, Twilio, etc.)
└── utils/              # JWT and other utility functions
tests/                  # Jest test suite (service and route tests)
```

## API Endpoints

### 1. Health Check
`GET /health`
- **Purpose**: Verifies server uptime and database connectivity.
- **Response**: `200 OK` with JSON `{ status, db, uptime }`.

### 2. API Documentation
`GET /docs`
- **Purpose**: Serves an interactive Swagger UI for testing and exploring the API.

### 3. Send OTP
`POST /v1/otp/send`
- **Purpose**: Generates a cryptographically secure 6-digit OTP, hashes it, and sends it via the requested channel.
- **Request Body**:
  ```json
  {
    "identifier": "user@example.com" or "+1234567890",
    "channel": "email" | "sms" | "whatsapp",
    "idempotencyKey": "uuid-v4-optional"
  }
  ```
- **Security Features**:
  - **Idempotency**: Prevents duplicate sends within the expiry window.
  - **Rate Limiting**: Applied per IP and per Identifier.
  - **Hashing**: OTPs are never stored in plaintext.

### 4. Verify OTP
`POST /v1/otp/verify`
- **Purpose**: Validates the provided OTP code against the stored hash.
- **Request Body**:
  ```json
  {
    "identifier": "user@example.com" or "+1234567890",
    "code": "123456"
  }
  ```
- **Response**: On success, returns a signed JWT `verificationToken`.
- **Security Features**:
  - **Maximum Attempts**: Invalidates the OTP after 3 failed attempts (configurable).
  - **Expiry**: OTPs automatically expire and are purged by MongoDB TTL.

### 5. Revoke OTP/Token
`POST /v1/otp/revoke`
- **Purpose**: Invalidates all active OTPs for an identifier and blocklists the provided JWT.
- **Request Body**:
  ```json
  {
    "identifier": "user@example.com",
    "token": "<jwt-verification-token>"
  }
  ```

## Security Best Practices Implemented
1. **Never Log Secrets**: Raw OTP codes and JWT secrets are never logged (except in `MOCK_MODE` for development).
2. **Brute-Force Protection**: Multi-layered rate limiting and maximum attempt thresholds.
3. **Data Privacy**: Logs use SHA-256 hashes of identifiers (PII) to remain compliant while allowing auditability.
4. **Environment Isolation**: Mandatory environment variable validation via `envalid` at bootstrap.
5. **Secure Headers**: `helmet()` enforced across all routes.
6. **Token Blocklisting**: Redis-based short-lived blocklist for revoked JWTs.

## Installation & Setup

1. **Clone & Install**:
   ```bash
   git clone <repo-url>
   npm install
   ```
2. **Environment Configuration**:
   ```bash
   cp .env.example .env
   # Update .env with your MongoDB, Redis, and Provider keys
   ```
3. **Run Locally**:
   ```bash
   npm run dev
   ```
4. **Test**:
   ```bash
   npm run test
   ```

## Production Deployment (Render)
This project includes a `render.yaml` file. Simply connect the repository to Render, and it will automatically provision the Node.js Web Service with all necessary environment variable placeholders.
