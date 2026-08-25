"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailPasswordOtpSchema = exports.EmailSchema = void 0;
const express_validator_1 = require("express-validator");
const EmailSchema = (0, express_validator_1.checkSchema)({
    email: {
        errorMessage: 'The email must be at least 5 characters',
        escape: true,
        isLength: { options: { min: 5, max: 128 } },
        isEmail: { bail: true },
        matches: { options: /[@]/ },
        notEmpty: true,
        isString: true,
        trim: true
    },
});
exports.EmailSchema = EmailSchema;
const EmailPasswordOtpSchema = (0, express_validator_1.checkSchema)({
    email: {
        errorMessage: 'The email must be at least 5 characters',
        escape: true,
        isLength: { options: { min: 5, max: 128 } },
        isEmail: { bail: true },
        matches: { options: /[@]/ },
        notEmpty: true,
        isString: true,
        trim: true
    },
    password: {
        errorMessage: 'The password must be at least 8 characters',
        isLength: { options: { min: 8, max: 32 } },
        escape: true,
        notEmpty: true,
        isString: true,
        trim: true
    },
    otp: {
        in: ['body'],
        isString: true,
        isLength: {
            options: { min: 6, max: 6 },
            errorMessage: 'OTP must be exactly 6 digits'
        },
        errorMessage: 'OTP must be a 6-digit string'
    }
});
exports.EmailPasswordOtpSchema = EmailPasswordOtpSchema;
