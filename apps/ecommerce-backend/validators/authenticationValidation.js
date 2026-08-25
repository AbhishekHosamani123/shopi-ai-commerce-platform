"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.googleAuthSchemaNative = exports.googleAuthSchema = exports.tokenSchema = exports.signUpSchema = exports.signInSchema = void 0;
const express_validator_1 = require("express-validator");
const signUpSchema = (0, express_validator_1.checkSchema)({
    userName: {
        errorMessage: 'The userName must be at least 4 characters',
        isLength: { options: { min: 4, max: 64 } },
        escape: true,
        notEmpty: true,
        isString: true,
        trim: true
    },
    email: {
        errorMessage: 'The email must be at least 5 characters',
        isLength: { options: { min: 5, max: 128 } },
        escape: true,
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
    mobile_number: {
        errorMessage: 'The number must be at least 10 digit and max 10 digit',
        isLength: { options: { min: 10, max: 10 } },
        escape: true,
        notEmpty: true,
        isInt: true,
        isMobilePhone: true,
        trim: true
    },
    dob: {
        errorMessage: 'The number must be at least 10 digit and max 10 digit',
        isLength: { options: { min: 10, max: 10 } },
        matches: { options: /[-]/ },
        escape: true,
        notEmpty: true,
        isString: true,
        isDate: true,
        trim: true
    },
    promotional: {
        errorMessage: 'The parameter must be either true or false',
        notEmpty: { bail: true },
        escape: true,
        isString: true,
        isLength: { options: { min: 4, max: 5 } },
        trim: true
    }
}, ['body', 'params']);
exports.signUpSchema = signUpSchema;
const signInSchema = (0, express_validator_1.checkSchema)({
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
    remember: {
        errorMessage: 'The parameter must be either true or false',
        notEmpty: { bail: true },
        escape: true,
        isString: true,
        isLength: { options: { min: 4, max: 5 } },
        trim: true
    }
}, ['body', 'params']);
exports.signInSchema = signInSchema;
const tokenSchema = (0, express_validator_1.checkSchema)({
    token: {
        errorMessage: 'The token must be provided',
        notEmpty: { bail: true },
        isJWT: { bail: true },
        escape: true,
    }
}, ['body']);
exports.tokenSchema = tokenSchema;
const googleAuthSchema = (0, express_validator_1.checkSchema)({
    code: {
        errorMessage: 'The code must be provided',
        isString: true,
        exists: true,
        trim: true,
    }
}, ['body']);
exports.googleAuthSchema = googleAuthSchema;
const googleAuthSchemaNative = (0, express_validator_1.checkSchema)({
    email: {
        errorMessage: 'The email must be provided',
        isString: true,
        exists: true,
        trim: true,
        isEmail: true,
        matches: { options: /[@]/ },
    }
}, ['body']);
exports.googleAuthSchemaNative = googleAuthSchemaNative;
