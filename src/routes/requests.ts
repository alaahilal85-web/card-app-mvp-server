import { Router } from 'express';
import { prisma } from '../db.js';
import { z } from 'zod';
import { requireAuth, AuthedRequest } from '../utils/auth.js';

const router = Router();

router.post('/:listingId/requests', requireAuth, async (req: AuthedRequest, res) => {
  const { listingId } = req.params;
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing || listing.status !== 'OPEN') return res.status(404).json({ error: 'Listing not open' });
  const jr = await prisma.joinRequest.create({
    data: { listingId, seekerId: req.userId! }
  });
  return res.json({ request: jr });
});

router.post('/requests/:requestId/accept', requireAuth, async (req: AuthedRequest, res) => {
  const { requestId } = req.params;
  const jr = await prisma.joinRequest.findUnique({ where: { id: requestId }, include: { listing: true } });
  if (!jr) return res.status(404).json({ error: 'Request not found' });
  if (jr.listing.hostId !== req.userId) return res.status(403).json({ error: 'Not your listing' });
  if (jr.listing.status !== 'OPEN') return res.status(400).json({ error: 'Listing not open' });

  // reserve listing and create join token
  const token = crypto.randomUUID();
  const listing = await prisma.listing.update({
    where: { id: jr.listingId },
    data: { status: 'RESERVED', joinToken: token }
  });
  await prisma.joinRequest.update({ where: { id: requestId }, data: { status: 'ACCEPTED' } });
  // decline others
  await prisma.joinRequest.updateMany({ where: { listingId: listing.id, id: { not: requestId } }, data: { status: 'DECLINED' } });
  return res.json({ listingId: listing.id, joinToken: token });
});

// polyfill crypto.randomUUID in Node <= 18 (not needed in >=19)
import crypto from 'crypto';
if (!('randomUUID' in crypto)) {
  (crypto as any).randomUUID = () => crypto.randomBytes(16).toString('hex');
}

export default router;
