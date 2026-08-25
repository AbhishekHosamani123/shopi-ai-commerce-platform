"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentCreationSchema = exports.userIDSchema = void 0;
const express_validator_1 = require("express-validator");
const userIDSchema = (0, express_validator_1.checkSchema)({
    userID: {
        errorMessage: 'The userID must be provided',
        isInt: true,
        isLength: { options: { min: 1, max: 10 } },
        notEmpty: true,
        isNumeric: true,
        trim: true
    }
}, ['body', 'params']);
exports.userIDSchema = userIDSchema;
const paymentCreationSchema = (0, express_validator_1.checkSchema)({
    userID: {
        errorMessage: 'The userID must be provided',
        isInt: true,
        isLength: { options: { min: 1, max: 10 } },
        notEmpty: true,
        isNumeric: true,
        trim: true
    },
    paymentid: {
        errorMessage: 'The paymentID must be provided',
        isString: true,
        isLength: { options: { min: 1, max: 255 } },
        notEmpty: true,
        trim: true
    },
    paymentstatus: {
        errorMessage: 'The paymentStatus must be provided correctly',
        isString: true,
        isLength: { options: { min: 1, max: 10 } },
        notEmpty: true,
        trim: true
    }
}, ['body']);
exports.paymentCreationSchema = paymentCreationSchema;
