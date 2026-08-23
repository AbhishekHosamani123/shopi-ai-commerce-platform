import { checkSchema } from 'express-validator';
const productIDSchema = checkSchema({
    productID: {
        in: ['params'],
        errorMessage: 'The productid must be provided correctly',
        isInt:true,
        toInt:true,
        isLength:{options:{min:1,max:10}},
        notEmpty:true,
        trim:true,
        escape:true
    }
});
const createReviewSchema = checkSchema({
    userID: {
        in: ['body'],
        errorMessage: 'The userID must be provided',
        isInt:true,
        isLength:{options:{min:1,max:10}},
        notEmpty:true,
        isNumeric:true,
        trim:true,
        escape:true
    },
    productID: {
        in: ['body'],
        errorMessage: 'The productid must be provided correctly',
        isInt:true,
        toInt:true,
        isLength:{options:{min:1,max:10}},
        notEmpty:true,
        trim:true,
        escape:true
    },
    rating: {
        in: ['body'],
        isFloat:true,
        toFloat:true,
        errorMessage: 'Rating must be an integer',
        custom: {
            options: (value) => value >= 1 && value <= 5,
            errorMessage: 'Rating must be between 1 and 5'
        }
    },
    title: {
        in: ['body'],
        isString: true,
        notEmpty: true,
        isLength:{options:{min:2,max:50}},
        escape:true,
        errorMessage: 'Title must be a non-empty string'
    },
    comment: {
        in: ['body'],
        isString: true,
        isLength:{options:{min:2,max:500}},
        optional: true, // Allow comment to be optional
        errorMessage: 'Comment must be a string',
        escape:true,
    }
});

const editReviewSchema = checkSchema({
    reviewID: {
        in: ['body'],
        isInt:true,
        toInt:true,
        isLength:{options:{min:1,max:10}},
        notEmpty:true,
        trim:true,
        escape:true
    },
    userID: {
        in: ['body'],
        errorMessage: 'The userID must be provided',
        isInt:true,
        isLength:{options:{min:1,max:10}},
        notEmpty:true,
        isNumeric:true,
        trim:true,
        escape:true
    },
    productID: {
        in: ['body'],
        errorMessage: 'The productid must be provided correctly',
        isInt:true,
        toInt:true,
        isLength:{options:{min:1,max:10}},
        notEmpty:true,
        trim:true,
        escape:true
    },
    rating: {
        in: ['body'],
        isFloat:true,
        toFloat:true,
        errorMessage: 'Rating must be an integer',
        custom: {
            options: (value) => value >= 1 && value <= 5,
            errorMessage: 'Rating must be between 1 and 5'
        }
    },
    title: {
        in: ['body'],
        isString: true,
        notEmpty: true,
        isLength:{options:{min:2,max:50}},
        errorMessage: 'Title must be a non-empty string',
        escape:true,
    },
    comment: {
        in: ['body'],
        isString: true,
        isLength:{options:{min:2,max:500}},
        optional: true, // Allow comment to be optional
        errorMessage: 'Comment must be a string',
        escape:true,
    }
});
const deleteReviewSchema = checkSchema({
    reviewID: {
        in: ['body'],
        isInt:true,
        toInt:true,
        isLength:{options:{min:1,max:10}},
        notEmpty:true,
        trim:true,
        escape:true
    },
    userID: {
        in: ['body'],
        errorMessage: 'The userID must be provided',
        isInt:true,
        isLength:{options:{min:1,max:10}},
        notEmpty:true,
        isNumeric:true,
        trim:true,
        escape:true
    },
    productID: {
        in: ['body'],
        errorMessage: 'The productid must be provided correctly',
        isInt:true,
        toInt:true,
        isLength:{options:{min:1,max:10}},
        notEmpty:true,
        trim:true,
        escape:true
    }
});
const getReviewSchema = checkSchema({
    productID: {
        in: ['params'],
        errorMessage: 'The productid must be provided correctly',
        isInt:true,
        toInt:true,
        isLength:{options:{min:1,max:10}},
        notEmpty:true,
        trim:true,
        escape:true
    }
});
const createProductSchema = checkSchema({
    title: { in: ['body'], isString: true, notEmpty: true, isLength: { options: { min: 2, max: 200 } }, escape: true, errorMessage: 'Title must be 2–200 chars' },
    description: { in: ['body'], isString: true, notEmpty: true, isLength: { options: { min: 2, max: 2000 } }, escape: true, errorMessage: 'Description must be 2–2000 chars' },
    price: { in: ['body'], isFloat: true, toFloat: true, custom: { options: (v) => v >= 0 && v <= 1000000, errorMessage: 'Price out of range' }, errorMessage: 'Price must be a number' },
    discount: { in: ['body'], isFloat: true, toFloat: true, custom: { options: (v) => v >= 0 && v <= 1000000, errorMessage: 'Discount out of range' }, errorMessage: 'Discount must be a number' },
    stock: { in: ['body'], isInt: true, toInt: true, custom: { options: (v) => v >= 0 && v <= 100000, errorMessage: 'Stock out of range' }, errorMessage: 'Stock must be an integer' },
    tags: { in: ['body'], isString: true, optional: true, isLength: { options: { max: 500 } }, escape: true, errorMessage: 'Tags too long' },
    imgLink: { in: ['body'], isString: true, notEmpty: true, isLength: { options: { min: 5, max: 500 } }, errorMessage: 'imgLink required' },
    imgAlt: { in: ['body'], isString: true, notEmpty: true, isLength: { options: { min: 2, max: 200 } }, escape: true, errorMessage: 'imgAlt required' },
    isSale: { in: ['body'], isBoolean: true, toBoolean: true, errorMessage: 'isSale must be boolean' },
    isNew: { in: ['body'], isBoolean: true, toBoolean: true, errorMessage: 'isNew must be boolean' },
    isDiscount: { in: ['body'], isBoolean: true, toBoolean: true, errorMessage: 'isDiscount must be boolean' },
    categoryID: { in: ['body'], isInt: true, toInt: true, notEmpty: true, errorMessage: 'categoryID required' },
});
const createProductImageSchema = checkSchema({
    productID: { in: ['body'], isString: true, notEmpty: true, isLength: { options: { min: 1, max: 50 } }, escape: true, errorMessage: 'productID required' },
    imgLink: { in: ['body'], isString: true, notEmpty: true, isLength: { options: { min: 5, max: 500 } }, errorMessage: 'imgLink required' },
    imgAlt: { in: ['body'], isString: true, notEmpty: true, isLength: { options: { min: 2, max: 200 } }, escape: true, errorMessage: 'imgAlt required' },
});
const createProductSizeSchema = checkSchema({
    productID: { in: ['body'], isString: true, notEmpty: true, isLength: { options: { min: 1, max: 50 } }, escape: true, errorMessage: 'productID required' },
    sizeName: { in: ['body'], isString: true, notEmpty: true, isLength: { options: { min: 1, max: 50 } }, escape: true, errorMessage: 'sizeName required' },
    inStock: { in: ['body'], isBoolean: true, toBoolean: true, errorMessage: 'inStock must be boolean' },
});
const createProductColorSchema = checkSchema({
    productID: { in: ['body'], isString: true, notEmpty: true, isLength: { options: { min: 1, max: 50 } }, escape: true, errorMessage: 'productID required' },
    colorName: { in: ['body'], isString: true, notEmpty: true, isLength: { options: { min: 1, max: 50 } }, escape: true, errorMessage: 'colorName required' },
    colorClass: { in: ['body'], isString: true, notEmpty: true, isLength: { options: { min: 1, max: 100 } }, escape: true, errorMessage: 'colorClass required' },
});
export {getReviewSchema,deleteReviewSchema,editReviewSchema,createReviewSchema,productIDSchema,createProductSchema,createProductImageSchema,createProductSizeSchema,createProductColorSchema};