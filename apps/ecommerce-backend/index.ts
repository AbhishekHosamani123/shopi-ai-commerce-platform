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

  // Bind 0.0.0.0 so the container is reachable on Render.
  app.listen(port, '0.0.0.0', () => {
    console.log(`[server]: Razorpay AI Commerce Server listening on 0.0.0.0:${port}`);
  });
};

startServer();
