"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderSchema = exports.wishlistRemoveSchema = exports.wishlistActionSchema = exports.cartItemSchema = exports.cartActionSchema = exports.AddressInsertSchema = exports.userTokenSchema = exports.userIDSchema = void 0;
const express_validator_1 = require("express-validator");
const userIDSchema = (0, express_validator_1.checkSchema)({
    userID: {
        errorMessage: 'The userID must be provided',
        isInt: true,
        isLength: { options: { min: 1, max: 10 } },
        notEmpty: true,
        isNumeric: true,
        trim: true,
        escape: true
    }
}, ['body', 'params']);
exports.userIDSchema = userIDSchema;
const userTokenSchema = (0, express_validator_1.checkSchema)({
    userIDToken: {
        errorMessage: 'The token must be provided',
        notEmpty: { bail: true },
        isJWT: { bail: true },
    }
}, ['body']);
exports.userTokenSchema = userTokenSchema;
const AddressInsertSchema = (0, express_validator_1.checkSchema)({
    userID: {
        in: ['body'],
        isInt: true,
        isLength: { options: { min: 1, max: 10 } },
        notEmpty: true,
        isNumeric: true,
        trim: true,
        escape: true
    },
    addressType: {
        in: ['body'],
        isString: true,
        notEmpty: true,
        escape: true,
        isLength: { options: { min: 4, max: 4 } },
        trim: true,
        errorMessage: 'Address type must be a non-empty string'
    },
    userName: {
        in: ['body'],
        errorMessage: 'The userName must be at least 4 characters',
        isLength: { options: { min: 4, max: 64 } },
        escape: true,
        notEmpty: true,
        isString: true,
        trim: true
    },
    contactNumber: {
        in: ['body'],
        errorMessage: 'The number must be at least 10 digit and max 10 digit',
        isLength: { options: { min: 10, max: 10 } },
        escape: true,
        notEmpty: true,
        isInt: true,
        isMobilePhone: true,
        trim: true
    },
    addressLine1: {
        in: ['body'],
        isString: true,
        notEmpty: true,
        escape: true,
        isLength: { options: { min: 2, max: 128 } },
        trim: true,
        errorMessage: 'address must be a non-empty string'
    },
    addressLine2: {
        in: ['body'],
        isString: true,
        notEmpty: true,
        escape: true,
        optional: true,
        isLength: { options: { min: 2, max: 128 } },
        trim: true,
        errorMessage: 'address must be a non-empty string'
    },
    city: {
        in: ['body'],
        isString: true,
        notEmpty: true,
        escape: true,
        isLength: { options: { min: 2, max: 60 } },
        trim: true,
        errorMessage: 'City must be a non-empty string'
    },
    state: {
        in: ['body'],
        isString: true,
        notEmpty: true,
        escape: true,
        isLength: { options: { min: 2, max: 16 } },
        trim: true,
        errorMessage: 'State must be a non-empty string'
    },
    country: {
        in: ['body'],
        isString: true,
        notEmpty: true,
        escape: true,
        isLength: { options: { min: 2, max: 56 } },
        trim: true,
        errorMessage: 'Country must be a non-empty string'
    },
    postalCode: {
        in: ['body'],
        isPostalCode: true,
        isString: true,
        notEmpty: true,
        escape: true,
        isLength: { options: { min: 6, max: 8 } },
        trim: true,
        errorMessage: 'Postal code must be a non-empty string'
    },
});
exports.AddressInsertSchema = AddressInsertSchema;
const cartItemSchema = (0, express_validator_1.checkSchema)({
    userID: {
        in: ['body'],
        isInt: true,
        errorMessage: 'The userID must be provided',
        isLength: { options: { min: 1, max: 10 } },
        notEmpty: true,
        isNumeric: true,
        trim: true,
        escape: true
    },
    productID: {
        in: ['body'],
        isInt: true,
        isLength: { options: { min: 1, max: 15 } },
        errorMessage: 'The productID must be provided',
        notEmpty: true,
        isNumeric: true,
        trim: true,
        escape: true
    },
    quantity: {
        in: ['body'],
        isInt: true,
        isLength: { options: { min: 1, max: 2 } },
        errorMessage: 'The quantity must be provided',
        notEmpty: true,
        isNumeric: true,
        trim: true,
        escape: true
    },
    sizeID: {
        in: ['body'],
        isInt: true,
        isLength: { options: { min: 1, max: 10 } },
        errorMessage: 'The sizeID must be provided',
        notEmpty: true,
        isNumeric: true,
        trim: true,
        escape: true
    },
    colorID: {
        in: ['body'],
        isInt: true,
        errorMessage: 'The colorID must be provided',
        isLength: { options: { min: 1, max: 10 } },
        notEmpty: true,
        isNumeric: true,
        trim: true,
        escape: true
    }
});
exports.cartItemSchema = cartItemSchema;
const cartActionSchema = (0, express_validator_1.checkSchema)({
    userID: {
        in: ['body'],
        isInt: true,
        errorMessage: 'The user ID must be provided',
        isLength: { options: { min: 1, max: 10 } },
        notEmpty: true,
        isNumeric: true,
        trim: true,
        escape: true
    },
    cartItemID: {
        in: ['body'],
        errorMessage: 'The cart item id must be provided',
        isInt: true,
        isLength: { options: { min: 1, max: 10 } },
        notEmpty: true,
        isNumeric: true,
        trim: true,
        escape: true
    }
});
exports.cartActionSchema = cartActionSchema;
const wishlistActionSchema = (0, express_validator_1.checkSchema)({
    userID: {
        in: ['body'],
        isInt: true,
        errorMessage: 'The wishlist item id must be provided',
        isLength: { options: { min: 1, max: 10 } },
        notEmpty: true,
        isNumeric: true,
        trim: true,
        escape: true
    },
    wishlistItemID: {
        in: ['body'],
        optional: true,
        isInt: true,
        errorMessage: 'The wishlist item id must be provided',
        isLength: { options: { min: 1, max: 10 } },
        trim: true,
        escape: true
    },
    productID: {
        in: ['body'],
        errorMessage: 'The product id must be provided',
        isInt: true,
        isLength: { options: { min: 1, max: 15 } },
        notEmpty: true,
        isNumeric: true,
        trim: true,
        escape: true
    }
});
exports.wishlistActionSchema = wishlistActionSchema;
const wishlistRemoveSchema = (0, express_validator_1.checkSchema)({
    userID: {
        in: ['body'],
        errorMessage: 'The Wishlist ID must be provided',
        isInt: true,
        isLength: { options: { min: 1, max: 10 } },
        notEmpty: true,
        isNumeric: true,
        trim: true,
        escape: true
    },
    wishlistItemID: {
        in: ['body'],
        errorMessage: 'The Wishlist ID must be provided',
        isInt: true,
        isLength: { options: { min: 1, max: 10 } },
        notEmpty: true,
        isNumeric: true,
        trim: true,
        escape: true
    }
});
exports.wishlistRemoveSchema = wishlistRemoveSchema;
const orderSchema = (0, express_validator_1.checkSchema)({
    userIDToken: {
        in: ['params'],
        errorMessage: 'The token must be provided',
        notEmpty: { bail: true },
        isJWT: { bail: true },
        escape: true,
    },
    orderID: {
        in: ['params'],
        isInt: true,
        errorMessage: 'The OrderID must be provided',
        isLength: { options: { min: 1, max: 15 } },
        notEmpty: true,
        isNumeric: true,
        trim: true,
        escape: true
    }
});
exports.orderSchema = orderSchema;
