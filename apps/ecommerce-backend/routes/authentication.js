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
const DB_1 = require("../data/DB");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = require("crypto");
const auth_controller_1 = require("../controller/auth-controller");
const authenticationValidation_1 = require("../validators/authenticationValidation");
const express_validator_1 = require("express-validator");
const saltRounds = 10;
const router = express_1.default.Router();
const userTable = 'users';
const JWT_SECRET = process.env.JWT_ENCRYPTION_KEY;
const JWT_EXPIRATION = '7d';
if (!JWT_SECRET) {
    throw new Error('JWT_ENCRYPTION_KEY environment variable is not set');
}
router.post('/user/signup/:promotional', authenticationValidation_1.signUpSchema, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = (0, express_validator_1.validationResult)(req);
    if (result.isEmpty()) {
        const userID = (0, crypto_1.randomInt)(1, 2147483647); // max safe postgres int4
        const { promotional } = (0, express_validator_1.matchedData)(req);
        let dbPromotional;
        if (promotional != 'false')
            dbPromotional = true;
        else
            dbPromotional = false;
        const creationIP = req.ip;
        const { userName, email, password, mobile_number, dob } = (0, express_validator_1.matchedData)(req);
        try {
            // Check if email or mobile number already exists
            const checkQuery = `
                SELECT * FROM "${userTable}" WHERE email = $1 OR mobile_number = $2;
            `;
            const checkValues = [email, mobile_number];
            const result = yield DB_1.client.query(checkQuery, checkValues);
            if (result.rows.length > 0) {
                // Email or mobile number already exists
                return res.status(409).json({ error: 'Email or mobile number already exists' });
            }
            // Hash the password
            const hash = yield bcryptjs_1.default.hash(password, saltRounds);
            // Insert the new user
            const insertQuery = `
                INSERT INTO "${userTable}" (userID, userName, email, password, mobile_number, dob, creation_ip, role, update_ip, promotional) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, 'customer', $7, $8);
            `;
            const insertValues = [userID, userName, email, hash, mobile_number, dob, creationIP, dbPromotional];
            yield DB_1.client.query(insertQuery, insertValues);
            const token = jsonwebtoken_1.default.sign({ userID }, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
            return res.status(200).json({ message: 'User registered successfully', token });
        }
        catch (error) {
            res.status(500).json({ error: 'Server error' });
        }
    }
    else {
        res.status(400).json({ message: 'Validation error' });
    }
}));
router.post('/user/signin/:remember', authenticationValidation_1.signInSchema, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = (0, express_validator_1.validationResult)(req);
    if (result.isEmpty()) {
        const { email, password } = (0, express_validator_1.matchedData)(req);
        const { remember } = (0, express_validator_1.matchedData)(req);
        try {
            // Check if the email exists
            const query = `
                SELECT * FROM "${userTable}" WHERE email = $1;
            `;
            const values = [email];
            const result = yield DB_1.client.query(query, values);
            if (result.rows.length === 0) {
                // Email does not exist
                return res.status(404).json({ error: 'Email does not exist' });
            }
            const user = result.rows[0];
            // Check if the password matches
            const passwordMatch = yield bcryptjs_1.default.compare(password, user.password);
            if (!passwordMatch) {
                // Password does not match
                return res.status(401).json({ error: 'Incorrect password' });
            }
            const userData = {
                userName: user.username, userID: user.userid, email: user.email, mobile_number: user.mobile_number, dob: user.dob
            };
            if (remember != 'false') {
                const token = jsonwebtoken_1.default.sign({ userID: user.userid }, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
                // Successful sign-in
                return res.status(200).json({ message: 'Sign-in successful', token, userData });
            }
            else {
                // Successful sign-in
                const token = jsonwebtoken_1.default.sign({ userID: user.userid }, JWT_SECRET, { expiresIn: '1d' });
                return res.status(200).json({ message: 'Sign-in successful', token, userData });
            }
        }
        catch (error) {
            res.status(500).json({ error: 'Server error' });
        }
    }
    else
        return res.status(500).json({ error: 'Validation Error' });
}));
router.post('/user/session-check', authenticationValidation_1.tokenSchema, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = (0, express_validator_1.validationResult)(req);
    if (result.isEmpty()) {
        const { token } = (0, express_validator_1.matchedData)(req);
        try {
            const decodedJWT = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            const userID = decodedJWT.userID; // Access the userID from the decoded payload
            const query = `
                SELECT * FROM "${userTable}" WHERE userid = $1;
            `;
            const result = yield DB_1.client.query(query, [userID]);
            const user = result.rows[0];
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }
            const userData = {
                userName: user.username,
                userID: user.userid,
                email: user.email,
                mobile_number: user.mobile_number,
                dob: user.dob
            };
            res.status(200).json({ message: 'Sign-in successful', userData });
        }
        catch (error) {
            res.status(500).json({ message: 'Internal Server Error' });
        }
    }
    else {
        res.status(400).json({ message: 'Validation error' });
    }
}));
router.post('/auth/google', authenticationValidation_1.googleAuthSchema, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = (0, express_validator_1.validationResult)(req);
    if (result.isEmpty()) {
        const { code } = (0, express_validator_1.matchedData)(req);
        try {
            const user = yield (0, auth_controller_1.googleAuth)(code);
            if (!user) {
                // Email does not exist
                return res.status(404).json({ error: 'Email does not exist' });
            }
            const userData = {
                userName: user.username, userID: user.userid, email: user.email, mobile_number: user.mobile_number, dob: user.dob
            };
            const token = jsonwebtoken_1.default.sign({ userID: user.userid }, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
            // Successful sign-in
            res.status(200).json({ message: 'Sign-in successful', token, userData });
        }
        catch (error) {
            res.status(500).json({ message: 'Server Error' });
        }
    }
    else {
        res.status(400).json({ message: 'Validation error' });
    }
}));
router.post('/native/auth/google', authenticationValidation_1.googleAuthSchemaNative, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = (0, express_validator_1.validationResult)(req);
    if (result.isEmpty()) {
        const { email } = (0, express_validator_1.matchedData)(req);
        try {
            // Check if the email exists
            const query = `
                SELECT * FROM "${userTable}" WHERE email = $1;
            `;
            const values = [email];
            const result = yield DB_1.client.query(query, values);
            if (result.rows.length === 0) {
                // Email does not exist
                return res.status(404).json({ error: 'Email does not exist' });
            }
            const user = result.rows[0];
            const token = jsonwebtoken_1.default.sign({ userID: user.userid }, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
            const userData = {
                userName: user.username, userID: user.userid, email: user.email, mobile_number: user.mobile_number, dob: user.dob
            };
            // Successful sign-in
            res.status(200).json({ message: 'Sign-in successful', token, userData });
        }
        catch (error) {
            res.status(500).json({ message: 'Server Error' });
        }
    }
    else {
        res.status(400).json({ message: 'Validation error' });
    }
}));
exports.default = router;
