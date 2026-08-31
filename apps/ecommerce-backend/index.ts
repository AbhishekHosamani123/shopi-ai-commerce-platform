import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import routes from './routes';
import 'dotenv/config';
import helmet from 'helmet';
import { connectDB } from './data/DB'; // Import the connectDB function
import rateLimiterMiddleware from './middleware/rateLimit';
import authenticateToken from './middleware/header_auth';

const app: Express = express();
app.set('trust proxy', true);
// Render injects PORT; default 3500 keeps local dev unchanged.
const port = parseInt(process.env.PORT || '3500', 10);

app.use(rateLimiterMiddleware);
app.use(express.json({ limit: '10mb' }));
app.use(helmet());

// CORS: allow multiple origins (prod Vercel URL + any preview URLs) via a
// comma-separated FRONTEND_SERVER_ORIGIN list; never a wildcard because
// credentials are enabled.
const rawOrigins = process.env.FRONTEND_SERVER_ORIGIN || 'http://localhost:3000';
const corsOptions = {
  origin: (origin: string | undefined, cb: (err: Error | null, ok?: boolean) => void) => {
    // Same-origin/server-side calls have no Origin header — allow them.
    if (!origin) return cb(null, true);
    const allowed = rawOrigins.split(',').map(o => o.trim()).filter(Boolean);
    if (allowed.includes(origin)) return cb(null, true);
    return cb(null, false); // reject silently rather than erroring
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
};
app.use(express.urlencoded({ extended: false }));
app.use(cors(corsOptions));

// Public health check endpoint — also the Render wake-up target.
// Deliberately touches NOTHING heavy: no DB round trip, no engine computation.
// It exists so the frontend can wake a sleeping Render service with a request
// that completes in milliseconds even while the DB pool is still connecting.
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', service: 'Razorpay AI Commerce Target API', timestamp: new Date().toISOString() });
});

app.get('/', (req: Request, res: Response) => {
  res.status(200).json({ message: 'Razorpay AI Commerce Target Backend Running' });
});

// Authenticate API token for all /api routes
app.use('/api', authenticateToken, routes);

import ShopiCatalogService from './data/shopiCatalogService';
import { ProductIntelligenceService } from './shopi-assistant/productIntelligence';

// Function to start the server
const startServer = async () => {
  connectDB().catch((err: any) => {
    console.warn('[DB Warning] PostgreSQL connection deferred/offline:', err.message);
  });

  // Pre-warm catalog and review caches for instant sub-30ms AI responses
  Promise.all([
    ShopiCatalogService.listProducts(),
    ProductIntelligenceService.getFullCatalog()
  ]).then(() => {
    console.log('[Cache Warm] Product catalog & intelligence cache pre-warmed successfully.');
  }).catch((err: any) => {
    console.warn('[Cache Warm Warning]:', err.message);
  });

  // Pre-warm the merchant executive overview so the FIRST dashboard request
  // after a cold start doesn't pay the full engine computation (~2s). Runs in
  // the background — startup is never blocked on it.
  //
  // On Render free instances the service sleeps after ~15 min idle. When it
  // wakes, the in-process TTL cache is empty, so a merchant opening the
  // dashboard right after wake-up would otherwise wait for the full engine
  // run (2-8s on free-tier CPU). We therefore:
  //   1. kick off the first warm as soon as the server is listening,
  //   2. retry a few times (the DB seed may still be running on a fresh
  //      database, and the very first attempt can fail while tables are
  //      being created),
  //   3. also warm the other periods merchants commonly switch to.
  const warmOverview = async (attempt: number): Promise<void> => {
    const port0 = parseInt(process.env.PORT || '3500', 10);
    const periods = ['last_30_days', 'last_7_days', 'this_month'];
    for (const period of periods) {
      try {
        const { default: axios } = await import('axios');
        await axios.get(
          `http://127.0.0.1:${port0}/api/merchant/overview?period=${period}`,
          { headers: { 'x-api-secret': process.env.API_SECRET || '' }, timeout: 180000 }
        );
      } catch (err: any) {
        if (attempt < 4) {
          // Retry with backoff — the Phase 11B seed may still be creating
          // tables on a freshly reset database.
          await new Promise(r => setTimeout(r, 8000 * (attempt + 1)));
          return warmOverview(attempt + 1);
        }
        console.warn('[Cache Warm] Merchant overview pre-warm gave up:', err.message);
        return;
      }
    }
    console.log('[Cache Warm] Merchant overview pre-warmed (30d + 7d + month).');
  };

  // Start warming once the DB bootstrap has had a moment to create tables.
  setTimeout(() => { void warmOverview(0); }, 3000);
  // Second pass later: covers the case where the Phase 11B seed finished
  // after the first pass started (fresh database recovery).
  setTimeout(() => { void warmOverview(0); }, 90000);

  // Bind 0.0.0.0 so the container is reachable on Render.
  app.listen(port, '0.0.0.0', () => {
    console.log(`[server]: Razorpay AI Commerce Server listening on 0.0.0.0:${port}`);
  });
};

startServer();
