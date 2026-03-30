// HMAC-SHA256 Validation
// src/lib/security/webhook-validator.ts
import crypto from 'crypto';

export function validateWhatsAppSignature(
  payload: string,
  signature: string,
  appSecret: string
): boolean {
  // WhatsApp uses HMAC-SHA256 prefixed with 'sha256='
  const expectedSignature = crypto
    .createHmac('sha256', appSecret)
    .update(payload)
    .digest('hex');

  const signatureHash = signature.replace('sha256=', '');
  
  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signatureHash, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}