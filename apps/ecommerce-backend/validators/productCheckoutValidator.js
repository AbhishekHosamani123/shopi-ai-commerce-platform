"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPaymentIntent = exports.OrderIDSchema = exports.checkoutSchema = exports.orderCreationSchema2 = exports.orderCreationSchema = void 0;
const express_validator_1 = require("express-validator");
const orderCreationSchema = (0, express_validator_1.checkSchema)({
    userid: {
        in: ['body'],
        errorMessage: 'The userID must be provided',
        isInt: true,
        isLength: { options: { min: 1, max: 10 } },
        notEmpty: true,
        isNumeric: true,
        trim: true,
        escape: true
    },
    productid: {
        in: ['body'],
        errorMessage: 'The productid must be provided correctly',
        isInt: true,
        toInt: true,
        isLength: { options: { min: 1, max: 10 } },
        notEmpty: true,
        trim: true,
        escape: true
    },
    colorid: {
        in: ['body'],
        errorMessage: 'The colorid must be provided correctly',
        isInt: true,
        toInt: true,
        isLength: { options: { min: 1, max: 10 } },
        notEmpty: true,
        trim: true,
        escape: true
    },
    sizeid: {
        in: ['body'],
        errorMessage: 'The sizeid must be provided correctly',
        isInt: true,
        toInt: true,
        isLength: { options: { min: 1, max: 10 } },
        notEmpty: true,
        trim: true,
        escape: true
    }
});
exports.orderCreationSchema = orderCreationSchema;
const orderCreationSchema2 = (0, express_validator_1.checkSchema)({
    userid: {
        in: ['body'],
        errorMessage: 'The userID must be provided',
        isInt: true,
        isLength: { options: { min: 1, max: 10 } },
        notEmpty: true,
        isNumeric: true,
        trim: true,
        escape: true
    },
    productid: {
        in: ['body'],
        errorMessage: 'The productid must be provided correctly',
        isInt: true,
        toInt: true,
        isLength: { options: { min: 1, max: 10 } },
        notEmpty: true,
        trim: true,
        escape: true
    },
    colorid: {
        in: ['body'],
        errorMessage: 'The colorid must be provided correctly',
        isInt: true,
        toInt: true,
        isLength: { options: { min: 1, max: 10 } },
        notEmpty: true,
        trim: true,
        escape: true
    },
    sizeid: {
        in: ['body'],
        errorMessage: 'The sizeid must be provided correctly',
        isInt: true,
        toInt: true,
        isLength: { options: { min: 1, max: 10 } },
        notEmpty: true,
        trim: true,
        escape: true
    },
    paymentid: {
        in: ['body'],
        errorMessage: 'The paymentID must be provided',
        isLength: { options: { min: 1, max: 255 } },
        notEmpty: true,
        trim: true,
        escape: true
    },
    paymentStatus: {
        in: ['body'],
        errorMessage: 'The paymentStatus must be provided correctly',
        isString: true,
        isLength: { options: { min: 1, max: 10 } },
        notEmpty: true,
        trim: true,
        escape: true
    }
});
exports.orderCreationSchema2 = orderCreationSchema2;
const OrderIDSchema = (0, express_validator_1.checkSchema)({
    orderID: {
        in: ['params'],
        errorMessage: 'The productid must be provided correctly',
        isInt: true,
        toInt: true,
        isLength: { options: { min: 1, max: 15 } },
        notEmpty: true,
        trim: true,
        escape: true
    }
});
exports.OrderIDSchema = OrderIDSchema;
const checkoutSchema = (0, express_validator_1.checkSchema)({
    productid: {
        in: ['params'],
        errorMessage: 'The productid must be provided correctly',
        isInt: true,
        toInt: true,
        isLength: { options: { min: 1, max: 10 } },
        notEmpty: true,
        trim: true,
        escape: true
    },
    sizeid: {
        in: ['params'],
        errorMessage: 'The sizeid must be provided correctly',
        isInt: true,
        toInt: true,
        isLength: { options: { min: 1, max: 10 } },
        notEmpty: true,
        trim: true,
        escape: true
    },
    colorid: {
        in: ['params'],
        errorMessage: 'The colorid must be provided correctly',
        isInt: true,
        toInt: true,
        isLength: { options: { min: 1, max: 10 } },
        notEmpty: true,
        trim: true,
        escape: true
    }
});
exports.checkoutSchema = checkoutSchema;
const createPaymentIntent = (0, express_validator_1.checkSchema)({
    item: {
        in: ['body'],
        errorMessage: 'The productid must be provided correctly',
        isInt: true,
        toInt: true,
        isLength: { options: { min: 1, max: 10 } },
        notEmpty: true,
        trim: true,
        escape: true
    },
    userID: {
        in: ['body'],
        errorMessage: 'The userID must be provided',
        isInt: true,
        isLength: { options: { min: 1, max: 10 } },
        notEmpty: true,
        isNumeric: true,
        trim: true,
        escape: true
    }
});
exports.createPaymentIntent = createPaymentIntent;
