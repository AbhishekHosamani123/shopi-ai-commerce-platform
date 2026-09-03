import express, { Request, Response } from 'express';
import { client } from '../data/DB';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomInt } from 'crypto';
import {googleAuth} from '../controller/auth-controller'
import { signInSchema,signUpSchema,tokenSchema,googleAuthSchema, googleAuthSchemaNative, merchantLoginSchema } from '../validators/authenticationValidation';
import { matchedData, validationResult } from 'express-validator';
const saltRounds = 10;
const router = express.Router();
const userTable = 'users';
const JWT_SECRET = process.env.JWT_ENCRYPTION_KEY as string;
const JWT_EXPIRATION = '7d';

if (!JWT_SECRET) {
    throw new Error('JWT_ENCRYPTION_KEY environment variable is not set');
}
interface JwtPayload {
    userID: number;
    iat: number;
    exp: number;
}

// ── DB self-healing for auth endpoints ──────────────────────────────────────
// Render's free Postgres can be wiped while the Node process keeps running.
// If auth queries start failing because the users table lost its columns or
// the schema is missing entirely, kick off the same recovery the merchant
// routes use (single-flight guarded) and tell the client to retry.
// The recovery path is watchdog-guarded (DB.ts) so this always settles; if
// the recovery ran but the users table is STILL missing, we log it loudly
// and tell the client honestly that it is a persistent failure.
async function healDbIfMissingRelation(res: Response, errMsg: string): Promise<boolean> {
    if (!/relation "[a-z_]+" does not exist|column "[a-z_]+" of relation/i.test(errMsg || '')) {
        return false;
    }
    console.warn(`[Auth Self-Heal] Missing relation/column (${errMsg}) — starting recovery...`);
    try {
        const { recoverMerchantDataIfMissing } = await import('../data/DB');
        try {
            await recoverMerchantDataIfMissing();
        } catch (recErr: any) {
            console.error('[Auth Self-Heal] recovery threw:', recErr?.message);
        }
        // Verify the table actually came back before promising "a few seconds".
        try {
            const verify = await (await import('../data/DB')).client.query(
                "SELECT to_regclass('public.users') as exists;"
            );
            if (!verify.rows[0]?.exists) {
                console.error('[Auth Self-Heal] recovery ran but users table STILL missing — persistent DB failure.');
                res.status(503).json({
                    error: 'Account system is being restored — please try again in a few seconds.',
                    recovering: true
                });
                return true;
            }
            console.log('[Auth Self-Heal] users table verified after recovery.');
        } catch (verifyErr: any) {
            console.warn('[Auth Self-Heal] verification probe failed:', verifyErr?.message);
        }
        res.status(503).json({
            error: 'Account system is being restored — please try again in a few seconds.',
            recovering: true
        });
        return true;
    } catch (e: any) {
        return false;
    }
}

router.post('/user/signup/:promotional',signUpSchema, async (req: Request, res: Response) => {
    const result = validationResult(req);
    if(result.isEmpty()){
        const userID = randomInt(1, 2147483647); // max safe postgres int4
        const {promotional} = matchedData(req);
        let dbPromotional:boolean;
        if(promotional!='false') dbPromotional=true
        else dbPromotional=false;
        const creationIP = req.ip;
        const {
            userName,
            email,
            password,
            mobile_number,
            dob
        } = matchedData(req);
        // Emails are case-insensitive identities: browsers/autofill may send
        // mixed case, and a case-sensitive UNIQUE column would then allow
        // duplicate "accounts" while signin (case-insensitive) matched the
        // wrong one. Normalize at the boundary so stored emails are always
        // lowercase and lookups agree.
        const normalizedEmail = String(email).trim().toLowerCase();
        try {
            // Check if email or mobile number already exists (case-insensitive)
            const checkQuery = `
                SELECT * FROM "${userTable}" WHERE LOWER(email) = LOWER($1) OR mobile_number = $2;
            `;
            const checkValues = [normalizedEmail, mobile_number];
            const result = await client.query(checkQuery, checkValues);
    
            if (result.rows.length > 0) {
                // Email or mobile number already exists
                return res.status(409).json({ error: 'Email or mobile number already exists' });
            }
    
            // Hash the password
            const hash = await bcrypt.hash(password, saltRounds);
    
            // Insert the new user
            const insertQuery = `
                INSERT INTO "${userTable}" (userID, userName, email, password, mobile_number, dob, creation_ip, role, update_ip, promotional) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, 'customer', $7, $8);
            `;
            const insertValues = [userID, userName, normalizedEmail, hash, mobile_number, dob, creationIP, dbPromotional];
    
            await client.query(insertQuery, insertValues);
            const token = jwt.sign(
                { userID },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRATION }
            );
            return res.status(200).json({ message: 'User registered successfully',token });
        } catch (error: any) {
            if (await healDbIfMissingRelation(res, error?.message)) return;
            console.error('Signup error:', error?.message);
            res.status(500).json({ error: 'Server error' });
        }
    }else
    {
        res.status(400).json({ message: 'Validation error' });
    }
    
});

router.post('/user/signin/:remember',signInSchema, async (req: Request, res: Response) => {
    const result = validationResult(req);
    if(result.isEmpty()){
        const { email, password } = matchedData(req);
        const {remember} = matchedData(req);
        try {
            // Check if the email exists — case-insensitive. Emails are
            // stored lowercase (see signup), but accounts created before that
            // normalization or via other flows may hold mixed case; a
            // case-sensitive = comparison made those users permanently
            // "Invalid credentials" whenever their browser auto-capitalized
            // the address.
            const query = `
                SELECT * FROM "${userTable}" WHERE LOWER(email) = LOWER($1);
            `;
            const values = [String(email).trim()];
            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                // Email does not exist
                return res.status(404).json({ error: 'Email does not exist' });
            }

            const user = result.rows[0];

            // Check if the password matches
            const passwordMatch = await bcrypt.compare(password, user.password);

            if (!passwordMatch) {
                // Password does not match
                return res.status(401).json({ error: 'Incorrect password' });
            }
            const userData = {
                userName:user.username,userID: user.userid, email: user.email, mobile_number: user.mobile_number, dob: user.dob, role: user.role || 'customer'
            }
            if(remember != 'false'){
                const token = jwt.sign(
                    { userID: user.userid },
                    JWT_SECRET,
                    { expiresIn: JWT_EXPIRATION }
                );
                // Successful sign-in
                return res.status(200).json({ message: 'Sign-in successful', token, userData });
            }else{
                // Successful sign-in
                const token = jwt.sign(
                    { userID: user.userid },
                    JWT_SECRET,
                    { expiresIn: '1d' }
                );
                return res.status(200).json({ message: 'Sign-in successful', token, userData });
            }
            
        } catch (error: any) {
            if (await healDbIfMissingRelation(res, error?.message)) return;
            console.error('Sign-in error:', error?.message);
            res.status(500).json({ error: 'Server error' });
        }
    }else
        return res.status(500).json({ error: 'Validation Error' });

});
router.post('/user/session-check',tokenSchema, async (req: Request, res: Response) => {
    const result = validationResult(req);
    if(result.isEmpty()){
        const { token } = matchedData(req);
        try {
            const decodedJWT = jwt.verify(token, JWT_SECRET) as JwtPayload;
    
            const userID = decodedJWT.userID; // Access the userID from the decoded payload
            const query = `
                SELECT * FROM "${userTable}" WHERE userid = $1;
            `;
            const result = await client.query(query, [userID]);
    
            const user = result.rows[0];
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }
    
            const userData = {
                userName:user.username,
                userID: user.userid,
                email: user.email,
                mobile_number: user.mobile_number,
                dob: user.dob,
                role: user.role || 'customer'
            };

            res.status(200).json({ message: 'Sign-in successful', userData });
        } catch (error) {
            res.status(500).json({ message: 'Internal Server Error' });
        }
    }else
        {
            res.status(400).json({ message: 'Validation error' });
        }
    
});
router.post('/user/merchant-login',merchantLoginSchema, async (req: Request, res: Response) => {
    const result = validationResult(req);
    if(!result.isEmpty()){
        return res.status(400).json({ message: 'Validation error' });
    }
    const { identifier, password } = matchedData(req);
    try {
        // Accept either the merchant username or email in a single field
        // (case-insensitive on both).
        const query = `
            SELECT * FROM "${userTable}" WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1) LIMIT 1;
        `;
        const dbResult = await client.query(query, [identifier]);
        const user = dbResult.rows[0];

        // Uniform error for unknown account AND wrong password: never reveal
        // which half failed (prevents user enumeration).
        const invalid = () => res.status(401).json({ error: 'Invalid credentials' });
        if (!user) return invalid();

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) return invalid();

        // Role gate: only merchant/admin accounts may hold a merchant session.
        const role = (user.role || 'customer').toLowerCase();
        if (role !== 'merchant_admin' && role !== 'admin' && role !== 'merchant') {
            return res.status(403).json({ error: 'This account does not have merchant access' });
        }

        const token = jwt.sign(
            { userID: user.userid, role },
            JWT_SECRET,
            { expiresIn: '12h' } // merchant sessions expire same-day; customers keep 7d
        );
        return res.status(200).json({
            message: 'Merchant sign-in successful',
            token,
            userData: {
                userName: user.username,
                userID: user.userid,
                email: user.email,
                role
            }
        });
    } catch (error: any) {
        if (await healDbIfMissingRelation(res, error?.message)) return;
        console.error('Merchant login error:', error?.message);
        return res.status(500).json({ error: 'Server error' });
    }
});
router.post('/auth/google',googleAuthSchema,async (req:Request,res:Response)=>{
    const result = validationResult(req);
    if(result.isEmpty()){
        const {code} = matchedData(req);
        try {
            const user = await googleAuth(code);

            if (!user) {
                // Email does not exist
                return res.status(404).json({ error: 'Email does not exist' });
            }
            const userData = {
                userName:user.username,userID: user.userid, email: user.email, mobile_number: user.mobile_number, dob: user.dob
            }
            const token = jwt.sign(
                { userID: user.userid },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRATION }
            );
            // Successful sign-in
            res.status(200).json({ message: 'Sign-in successful', token, userData });
        } catch (error) {
            res.status(500).json({message:'Server Error'});
        }
    }
    else
        {
            res.status(400).json({ message: 'Validation error' });
        }
    
});
router.post('/native/auth/google',googleAuthSchemaNative,async (req:Request,res:Response)=>{
    const result = validationResult(req);
    if(result.isEmpty()){
        const {email} = matchedData(req);
        try {
            // Check if the email exists (case-insensitive — see signin)
            const query = `
                SELECT * FROM "${userTable}" WHERE LOWER(email) = LOWER($1);
            `;
            const values = [String(email).trim()];
            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                // Email does not exist
                return res.status(404).json({ error: 'Email does not exist' });
            }

            const user = result.rows[0];

            const token = jwt.sign(
                { userID: user.userid },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRATION }
            );
            const userData = {
                userName:user.username,userID: user.userid, email: user.email, mobile_number: user.mobile_number, dob: user.dob
            }
            // Successful sign-in
            res.status(200).json({ message: 'Sign-in successful', token, userData });
        } catch (error) {
            res.status(500).json({message:'Server Error'});
        }
    }
    else
        {
            res.status(400).json({ message: 'Validation error' });
        }
    
});
export default router;
