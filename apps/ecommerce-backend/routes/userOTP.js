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
const SMTP_1 = require("../data/SMTP");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = require("crypto");
const userOTPValidation_1 = require("../validators/userOTPValidation");
const express_validator_1 = require("express-validator");
const router = express_1.default.Router();
const userTable = 'users';
const totalDigits = 6;
const saltRounds = 10;
const senderEmail = process.env.SMTP_USER;
const senderName = process.env.SMTP_SENDERNAME;
const generateOTP = (totalDigit) => {
    const OTP = [];
    for (let x = 0; x < totalDigit; x++) {
        OTP[x] = (0, crypto_1.randomInt)(0, 10); // 0–9 inclusive, cryptographically secure
    }
    ;
    return OTP.join("");
};
router.post('/user/send-forgot-otp', userOTPValidation_1.EmailSchema, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
            // Register OTP in DB — store as "CODE:expiryEpochMs" so no schema change is needed
            const GeneratedOTP = generateOTP(totalDigits);
            const expiryMs = Date.now() + 5 * 60 * 1000; // 5 minutes from now
            const randomOTP = `${GeneratedOTP}:${expiryMs}`;
            try {
                const query2 = `UPDATE "${userTable}" SET otp = $1 WHERE email = $2`;
                const values2 = [randomOTP, email];
                yield DB_1.client.query(query2, values2);
            }
            catch (error) {
                return res.status(500).json({ error: 'Server error' });
            }
            // Sending Email SMTP
            try {
                const date = new Date();
                const today = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
                yield SMTP_1.SMTP.sendMail({
                    from: `"${senderName}" <${senderEmail}>`, // sender address
                    to: email, // list of receivers
                    subject: "Verification OTP", // Subject line
                    html: `<div style=" max-width: 680px; margin: 0 auto; padding: 45px 30px 60px; background: #ffffff; background-image: url(https://archisketch-resources.s3.ap-northeast-2.amazonaws.com/vrstyler/1661497957196_595865/email-template-background-banner); background-repeat: no-repeat; background-size: 800px 452px; background-position: top center; font-size: 14px; color: #434343; " > <header> <table style="width: 100%;"> <tbody> <tr style="height: 0;"> <td> <img alt="" src="https://cdn3d.iconscout.com/3d/premium/thumb/schedule-time-6020499-4995379.png" height="60px" /> </td> <td style="text-align: right;"> <span style="font-size: 16px; line-height: 30px; color: #ffffff;" >${today}</span > </td> </tr> </tbody> </table> </header> <main> <div style="background-color: #fbe3fc; margin: 0; margin-top: 70px; padding: 92px 30px 115px; border-radius: 30px; text-align: center; " > <div style="width: 100%; max-width: 489px; margin: 0 auto;"> <h1 style=" margin: 0; font-size: 24px; font-weight: 500; color: #1f1f1f; " > Your OTP </h1> <p style=" margin: 0; margin-top: 17px; font-size: 16px; font-weight: 500; " > Hey ${result.rows[0].username}, </p> <p style=" margin: 0; margin-top: 17px; font-weight: 500; letter-spacing: 0.56px; " > Thank you for choosing our Ecommerce Services. Use the following OTP to login with your email address. OTP is valid for <span style="font-weight: 600; color: #1f1f1f;">5 minutes</span>. Do not share this code with others. </p> <p style=" margin: 0; margin-top: 60px; font-size: 40px; font-weight: 600; letter-spacing: 25px; color: #ba3d4f; " > ${GeneratedOTP} </p> </div> </div> <p style=" max-width: 400px; margin: 0 auto; margin-top: 90px; text-align: center; font-weight: 500; color: #8c8c8c; " > Need help? Ask at <a href="mailto:harmanpreetsingh@programmer.net" style="color: #499fb6; text-decoration: none;" >harmanpreetsingh@programmer.net</a > or visit our <a href="" target="_blank" style="color: #499fb6; text-decoration: none;" >Help Center</a > </p> </main> <footer style=" width: 100%; max-width: 490px; margin: 20px auto 0; text-align: center; border-top: 1px solid #e6ebf1; " > <p style=" margin: 0; margin-top: 40px; font-size: 16px; font-weight: 600; color: #434343; " > Ecommerce Site </p> <p style="margin: 0; margin-top: 8px; color: #434343;"> Github Project </p> <div style="margin: 0; margin-top: 16px;"> <a href="" target="_blank" style="display: inline-block;"> <img width="36px" alt="Facebook" src="https://archisketch-resources.s3.ap-northeast-2.amazonaws.com/vrstyler/1661502815169_682499/email-template-icon-facebook" /> </a> <a href="" target="_blank" style="display: inline-block; margin-left: 8px;" > <img width="36px" alt="Instagram" src="https://archisketch-resources.s3.ap-northeast-2.amazonaws.com/vrstyler/1661504218208_684135/email-template-icon-instagram" /></a> <a href="" target="_blank" style="display: inline-block; margin-left: 8px;" > <img width="36px" alt="Twitter" src="https://archisketch-resources.s3.ap-northeast-2.amazonaws.com/vrstyler/1661503043040_372004/email-template-icon-twitter" /> </a> <a href="" target="_blank" style="display: inline-block; margin-left: 8px;" > <img width="36px" alt="Youtube" src="https://archisketch-resources.s3.ap-northeast-2.amazonaws.com/vrstyler/1661503195931_210869/email-template-icon-youtube" /></a> </div> <p style="margin: 0; margin-top: 16px; color: #434343;"> Open-Source 2024 </p> </footer> </div>`, // html body
                });
            }
            catch (error) {
                return res.status(500).json({ error: 'Server error' });
            }
            res.status(200).json({ message: 'OTP sent successfully' });
        }
        catch (error) {
            res.status(500).json({ error: 'Server error' });
        }
    }
    else {
        console.log(result);
        res.status(500).json({ message: 'Validation error' });
    }
}));
router.post('/user/reset-password', userOTPValidation_1.EmailPasswordOtpSchema, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = (0, express_validator_1.validationResult)(req);
    if (result.isEmpty()) {
        const { email, password, otp } = (0, express_validator_1.matchedData)(req);
        // Stored OTP format is "CODE:expiryEpochMs"
        const query = `SELECT otp FROM "${userTable}" WHERE email = $1`;
        const values = [email];
        try {
            const result = yield DB_1.client.query(query, values);
            if (result.rows.length === 0) {
                return res.status(400).json({ message: 'Incorrect OTP' });
            }
            const stored = result.rows[0].otp;
            if (!stored || !stored.includes(':')) {
                return res.status(400).json({ message: 'Incorrect OTP' });
            }
            const [storedCode, expiryStr] = stored.split(':');
            if (storedCode !== otp) {
                return res.status(400).json({ message: 'Incorrect OTP' });
            }
            if (Date.now() > parseInt(expiryStr, 10)) {
                return res.status(410).json({ message: 'Expired OTP' });
            }
        }
        catch (error) {
            return res.status(500).json({ error: 'Server error' });
        }
        const query2 = `UPDATE "${userTable}" SET password = $1 WHERE email = $2`;
        try {
            const hash = yield bcryptjs_1.default.hash(password, saltRounds);
            const values2 = [hash, email];
            yield DB_1.client.query(query2, values2);
            return res.status(200).json({ message: 'Successfully Changed Password' });
        }
        catch (error) {
            return res.status(500).json({ error: 'Server error' });
        }
    }
    else {
        console.log(result);
        res.status(500).json({ message: 'Validation error' });
    }
}));
exports.default = router;
