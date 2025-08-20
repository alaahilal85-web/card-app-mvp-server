import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import { PORT } from './config.js';
import auth from './routes/auth.js';
import listings from './routes/listings.js';
import requests from './routes/requests.js';
import checkin from './routes/checkin.js';
import { startExpiryJob } from './jobs/expiry.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/', (_req, res) => res.json({ ok: true, service: 'card-app-mvp' }));

app.use('/auth', auth);
app.use('/listings', listings);
app.use('/', requests); // /:listingId/requests and /requests/:id/accept
app.use('/checkin', checkin);

startExpiryJob();

app.listen(PORT, () => {
  console.log(`MVP server running on http://localhost:${PORT}`);
});
