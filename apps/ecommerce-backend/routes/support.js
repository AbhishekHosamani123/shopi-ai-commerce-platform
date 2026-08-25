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
const supportValidation_1 = require("../validators/supportValidation");
const express_validator_1 = require("express-validator");
const crypto_1 = require("crypto");
const router = express_1.default.Router();
router.post('/contact', supportValidation_1.contactSchema, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = (0, express_validator_1.validationResult)(req);
    if (result.isEmpty()) {
        const { name, email, phone, method, message } = (0, express_validator_1.matchedData)(req);
        const queryID = (0, crypto_1.randomUUID)();
        const date = new Date().toUTCString();
        try {
            yield DB_1.client.query(`INSERT INTO contact_queries(queryid,name,email,number,method,message) VALUES ($1,$2,$3,$4,$5,$6)`, [queryID, name, email, phone, method, message]);
            yield SMTP_1.SMTP.sendMail({
                from: process.env.SMTP_USER,
                to: process.env.SMTP_SUPPORT,
                subject: `Site Contact ${queryID}`,
                html: `<div style=" max-width: 680px; margin: 0 auto; padding: 45px 30px 60px; background: #ffffff; background-image: url(https://archisketch-resources.s3.ap-northeast-2.amazonaws.com/vrstyler/1661497957196_595865/email-template-background-banner); background-repeat: no-repeat; background-size: 800px 452px; background-position: top center; font-size: 14px; color: #434343; " > <header> <table style="width: 100%;"> <tbody> <tr style="height: 0;"> <td> <img alt="" src="https://cdn3d.iconscout.com/3d/premium/thumb/schedule-time-6020499-4995379.png" height="60px" /> </td> <td style="text-align: right;"> <span style="font-size: 16px; line-height: 30px; color: #ffffff;" >${date}</span > </td> </tr> </tbody> </table> </header> <main> <div style="background-color: #fbe3fc; margin: 0; margin-top: 70px; padding: 92px 30px 115px; border-radius: 30px; text-align: center; " > <div style="width: 100%; max-width: 489px; margin: 0 auto;"> <h1 style=" margin: 0; font-size: 24px; font-weight: 500; color: #1f1f1f; " > Message </h1> <p style=" margin: 0; margin-top: 17px; font-size: 16px; font-weight: 500; " > By ${name},Email ${email},Phone ${phone},Contact Method ${method} </p> <p style=" margin: 0; margin-top: 17px; font-weight: 500; letter-spacing: 0.56px; " >Subject:- ${'Contact'} => Message:- ${message}</p> </div> </div> <p style=" max-width: 400px; margin: 0 auto; margin-top: 90px; text-align: center; font-weight: 500; color: #8c8c8c; " > Need help? Ask at <a href="mailto:harmanpreetsingh@programmer.net" style="color: #499fb6; text-decoration: none;" >harmanpreetsingh@programmer.net</a > or visit our <a href="" target="_blank" style="color: #499fb6; text-decoration: none;" >Help Center</a > </p> </main> <footer style=" width: 100%; max-width: 490px; margin: 20px auto 0; text-align: center; border-top: 1px solid #e6ebf1; " > <p style=" margin: 0; margin-top: 40px; font-size: 16px; font-weight: 600; color: #434343; " > Notes-Todo App </p> <p style="margin: 0; margin-top: 8px; color: #434343;"> Github Project </p> <div style="margin: 0; margin-top: 16px;"> <a href="" target="_blank" style="display: inline-block;"> <img width="36px" alt="Facebook" src="https://archisketch-resources.s3.ap-northeast-2.amazonaws.com/vrstyler/1661502815169_682499/email-template-icon-facebook" /> </a> <a href="" target="_blank" style="display: inline-block; margin-left: 8px;" > <img width="36px" alt="Instagram" src="https://archisketch-resources.s3.ap-northeast-2.amazonaws.com/vrstyler/1661504218208_684135/email-template-icon-instagram" /></a> <a href="" target="_blank" style="display: inline-block; margin-left: 8px;" > <img width="36px" alt="Twitter" src="https://archisketch-resources.s3.ap-northeast-2.amazonaws.com/vrstyler/1661503043040_372004/email-template-icon-twitter" /> </a> <a href="" target="_blank" style="display: inline-block; margin-left: 8px;" > <img width="36px" alt="Youtube" src="https://archisketch-resources.s3.ap-northeast-2.amazonaws.com/vrstyler/1661503195931_210869/email-template-icon-youtube" /></a> </div> <p style="margin: 0; margin-top: 16px; color: #434343;"> Open-Source 2023 </p> </footer> </div>`
            });
            res.status(200).json({ id: queryID });
        }
        catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Server error' });
        }
    }
    else {
        console.log(result);
        res.status(500).json({ message: 'Validation error' });
    }
}));
exports.default = router;
