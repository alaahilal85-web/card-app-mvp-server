import cron from 'node-cron';
import { prisma } from '../db.js';

export function startExpiryJob() {
  // Run every minute to expire OPEN/RESERVED listings
  cron.schedule('* * * * *', async () => {
    const now = new Date();
    await prisma.listing.updateMany({
      where: { status: { in: ['OPEN','RESERVED'] }, expiresAt: { lt: now } },
      data: { status: 'EXPIRED' }
    });
  });
}
