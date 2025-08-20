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
  try {
    const schema = z.object({ phone: z.string().min(6) });
    const parse = schema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    const { phone } = parse.data;

    // In dev: always accept, no SMS needed
    await prisma.user.upsert({
      where: { phone },
      update: {},
      create: { phone }
    });

    // Return hint for dev OTP
    return res.json({ ok: true, otpHint: `Use ${OTP_BYPASS}` });
  } catch (err: any) {
    console.error('OTP request error:', err?.message || err);
    return res.status(500).json({ error: 'Server error' });
  }
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
