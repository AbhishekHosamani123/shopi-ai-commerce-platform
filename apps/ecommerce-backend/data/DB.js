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
exports.connectDB = exports.client = void 0;
const pg_1 = require("pg");
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
// Resolve .env from ecommerce-backend directory as well as process cwd
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../.env') });
dotenv_1.default.config();
const client = new pg_1.Pool({
    user: String(process.env.DB_USER || 'postgres'),
    password: String(process.env.DB_PASS || '1234'),
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'razorpay_ecommerce',
    max: 10, // maximum pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});
exports.client = client;
const connectDB = () => __awaiter(void 0, void 0, void 0, function* () {
    const maxRetries = 10;
    const retryDelayMs = 3000;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            yield client.query('SELECT 1');
            console.log('Connected to the database');
            return;
        }
        catch (err) {
            console.error(`DB connection attempt ${attempt}/${maxRetries} failed:`, err.message);
            if (attempt === maxRetries) {
                console.error('Could not connect to database after max retries. Exiting.');
                process.exit(1);
            }
            yield new Promise(res => setTimeout(res, retryDelayMs));
        }
    }
});
exports.connectDB = connectDB;
