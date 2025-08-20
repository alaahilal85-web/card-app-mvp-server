import { Router } from 'express';
import { prisma } from '../db.js';
import { z } from 'zod';
import { signJwt } from '../utils/auth.js';
import { OTP_BYPASS } from '../config.js';

const router = Router();

const phoneSchema = z.object({
  phone: z.string().min(6).max(20),
});

router.post('/otp/request', async (req, res) => {
  const parse = phoneSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid phone' });
  const { phone } = parse.data;
  // MVP: create user if not exists, issue fake OTP (bypass)
  let user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    user = await prisma.user.create({ data: { phone, phoneVerified: false } });
  }
  // In real app: send SMS; here we return OTP_BYPASS for local testing
  return res.json({ ok: true, otpHint: OTP_BYPASS === '0000' ? 'Use 0000 in dev' : 'Set OTP in env' });
});

router.post('/otp/verify', async (req, res) => {
  try {
    const schema = z.object({ phone: z.string().min(6), code: z.string() });
    const parse = schema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: 'Invalid payload' });
    const { phone, code } = parse.data;

    // DEV OTP check
    if (code !== OTP_BYPASS) {
      return res.status(401).json({ error: 'Invalid code (dev uses OTP_BYPASS)' });
    }

    // Make sure a user exists; create if needed (prevents crash)
    const user = await prisma.user.upsert({
      where: { phone },
      update: { phoneVerified: true },
      create: { phone, phoneVerified: true }
    });

    const token = signJwt(user.id);
    return res.json({ token, user });
  } catch (err: any) {
    console.error('OTP verify error:', err?.message || err);
    return res.status(500).json({ error: 'Server error' });
  }
});


export default router;
