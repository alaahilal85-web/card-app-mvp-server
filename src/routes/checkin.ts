import { Router } from 'express';
import { prisma } from '../db.js';
import { z } from 'zod';
import { requireAuth, AuthedRequest } from '../utils/auth.js';
import { haversineKm } from '../utils/geo.js';

const router = Router();

const checkSchema = z.object({
  listingId: z.string(),
  joinToken: z.string(),
  lat: z.number(),
  lng: z.number()
});

router.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const parse = checkSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid payload' });
  const { listingId, joinToken, lat, lng } = parse.data;

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing || listing.status !== 'RESERVED' || listing.joinToken !== joinToken) {
    return res.status(400).json({ error: 'Invalid listing or token' });
  }
  // time window check
  if (listing.expiresAt < new Date()) {
    return res.status(400).json({ error: 'Listing expired' });
  }
  // geo-fence check (<= 15km & within listing.radiusKm)
  const d = haversineKm(lat, lng, listing.lat, listing.lng);
  if (d > Math.min(15, listing.radiusKm)) {
    return res.status(400).json({ error: 'Out of geo-fence', distanceKm: d });
  }

  // Start session
  const session = await prisma.session.create({
    data: { listingId, startedAt: new Date() }
  });
  await prisma.listing.update({ where: { id: listingId }, data: { status: 'IN_PROGRESS' } });
  return res.json({ ok: true, sessionId: session.id });
});

const finishSchema = z.object({ sessionId: z.string() });
router.post('/finish', requireAuth, async (req: AuthedRequest, res) => {
  const parse = finishSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid payload' });
  const { sessionId } = parse.data;

  const session = await prisma.session.update({
    where: { id: sessionId },
    data: { endedAt: new Date() }
  });
  await prisma.listing.update({ where: { id: session.listingId }, data: { status: 'COMPLETED' } });
  return res.json({ ok: true });
});

export default router;
