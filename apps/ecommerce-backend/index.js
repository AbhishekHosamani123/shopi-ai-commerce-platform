"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const routes_1 = __importDefault(require("./routes"));
require("dotenv/config");
const helmet_1 = __importDefault(require("helmet"));
const DB_1 = require("./data/DB"); // Import the connectDB function
const rateLimit_1 = __importDefault(require("./middleware/rateLimit"));
const header_auth_1 = __importDefault(require("./middleware/header_auth"));
const app = (0, express_1.default)();
app.set('trust proxy', true);
const port = process.env.PORT || 3500;
app.use(rateLimit_1.default);
app.use(express_1.default.json({ limit: '10mb' }));
app.use((0, helmet_1.default)());
const origin_url = process.env.FRONTEND_SERVER_ORIGIN;
const corsOptions = {
    origin: origin_url || 'http://localhost:3000',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true, // Enable cookies and authentication headers
};
app.use(express_1.default.urlencoded({ extended: false }));
app.use((0, cors_1.default)(corsOptions));
// Public health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'Razorpay AI Commerce Target API', timestamp: new Date().toISOString() });
});
app.get('/', (req, res) => {
    res.status(200).json({ message: 'Razorpay AI Commerce Target Backend Running' });
});
// Authenticate API token for all /api routes
app.use('/api', header_auth_1.default, routes_1.default);
// Function to start the server
const startServer = () => __awaiter(void 0, void 0, void 0, function* () {
    yield (0, DB_1.connectDB)();
    app.listen(port, () => {
        console.log(`[server]: Razorpay AI Commerce Server is running at http://localhost:${port}`);
    });
});
startServer();
