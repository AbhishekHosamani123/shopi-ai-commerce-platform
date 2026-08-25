"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SMTP = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const SMTP_Creds = { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS, host: process.env.SMTP_HOST };
const SMTP = nodemailer_1.default.createTransport({
    host: SMTP_Creds.host,
    port: 587,
    secure: false, // Use `true` for port 465, `false` for all other ports
    auth: {
        user: SMTP_Creds.user,
        pass: SMTP_Creds.pass,
    },
});
exports.SMTP = SMTP;
