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
const port = process.env.PORT || 3500;

app.use(rateLimiterMiddleware);
app.use(express.json({ limit: '10mb' }));
app.use(helmet());

const origin_url: string = process.env.FRONTEND_SERVER_ORIGIN as string;
const corsOptions = {
  origin: origin_url || 'http://localhost:3000',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true, // Enable cookies and authentication headers
};
app.use(express.urlencoded({ extended: false }));
app.use(cors(corsOptions));

// Public health check endpoint
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
    console.warn('[DB Warning] Local PostgreSQL connection deferred/offline:', err.message);
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

  app.listen(port, () => {
    console.log(`[server]: Razorpay AI Commerce Server is running at http://localhost:${port}`);
  });
};

startServer();
