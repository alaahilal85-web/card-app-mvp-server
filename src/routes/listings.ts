import { Router } from 'express';
import { prisma } from '../db.js';
import { z } from 'zod';
import { requireAuth, AuthedRequest } from '../utils/auth.js';

const router = Router();

const createSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  game: z.enum(['Trix','Baloot','Tarneeb','Hand','Banakel']),
  skill: z.string().optional(),
  language: z.string().optional(),
  venueId: z.string().optional(),
  radiusKm: z.number().min(1).max(15).default(15),
  ttlMinutes: z.number().min(5).max(60).default(15)
});

router.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const parse = createSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid payload', details: parse.error.flatten() });
  const { lat, lng, game, skill, language, venueId, radiusKm, ttlMinutes } = parse.data;
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  const listing = await prisma.listing.create({
    data: {
      hostId: req.userId!,
      lat, lng, game, skill, language,
      venueId: venueId || null,
      radiusKm, expiresAt, status: 'OPEN'
    }
  });
  return res.json({ listing });
});

// discovery
const discoverSchema = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  radiusKm: z.coerce.number().min(1).max(15).default(15),
  game: z.enum(['Trix','Baloot','Tarneeb','Hand','Banakel']).optional()
});

router.get('/', async (req, res) => {
  const parse = discoverSchema.safeParse(req.query);
  if (!parse.success) return res.status(400).json({ error: 'Invalid query' });
  const { lat, lng, radiusKm, game } = parse.data;

  // Fetch OPEN listings and filter by Haversine in app (simpler than PostGIS for MVP)
  const listings = await prisma.listing.findMany({
    where: { status: 'OPEN', expiresAt: { gt: new Date() }, ...(game ? { game } : {}) },
    include: { venue: true }
  });

  // Compute distance and filter
  const filtered = listings.map(l => {
    const d = haversineKm(lat, lng, l.lat, l.lng);
    return { ...l, distanceKm: d };
  }).filter(l => l.distanceKm <= Math.min(radiusKm, l.radiusKm))
    .sort((a,b) => a.distanceKm - b.distanceKm);

  return res.json({ listings: filtered });
});

// import function dynamically to avoid top-level cycle in ESM
import { haversineKm } from '../utils/geo.js';

export default router;
