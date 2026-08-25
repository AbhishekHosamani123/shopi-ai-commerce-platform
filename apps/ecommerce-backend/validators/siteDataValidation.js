"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.filterSchema = exports.getProductNameSchema = exports.ProductFilterSchema = exports.MainSubCategorySchema = exports.getCategorySchema = exports.categorySchema = exports.categoryFilterSchema = void 0;
const express_validator_1 = require("express-validator");
const categorySchema = (0, express_validator_1.checkSchema)({
    category: {
        in: ['params'],
        isString: true,
        notEmpty: true,
        toUpperCase: true,
        isLength: { options: { min: 3, max: 50 } },
        errorMessage: 'Category must be a non-empty string'
    }
});
exports.categorySchema = categorySchema;
const filterSchema = (0, express_validator_1.checkSchema)({
    minPrice: {
        in: ['params'],
        isFloat: true,
        toFloat: true,
        custom: {
            options: (value) => value >= 0 && value <= 1000000,
            errorMessage: 'Min Price must be between 0 and 1,000,000'
        },
        errorMessage: 'Min Price must be a float'
    },
    maxPrice: {
        in: ['params'],
        isFloat: true,
        toFloat: true,
        custom: {
            options: (value) => value >= 0 && value <= 1000000,
            errorMessage: 'Max Price must be between 0 and 1,000,000'
        },
        errorMessage: 'Max Price must be a float'
    },
    categoryID: {
        in: ['params'],
        isInt: true,
        toInt: true,
        isLength: { options: { min: 1, max: 50 } },
        errorMessage: 'Category ID must be an integer'
    },
    minRating: {
        in: ['params'],
        isFloat: true,
        toFloat: true,
        custom: {
            options: (value) => value >= 0 && value <= 5,
            errorMessage: 'Min Rating must be between 0 and 5'
        },
        errorMessage: 'Min Rating must be a float'
    },
    categoryName: {
        in: ['params'],
        isString: true,
        notEmpty: true,
        toUpperCase: true,
        isLength: { options: { min: 3, max: 50 } },
        errorMessage: 'Category Name must be a non-empty string'
    }
});
exports.filterSchema = filterSchema;
const getCategorySchema = (0, express_validator_1.checkSchema)({
    categoryID: {
        in: ['params'],
        isInt: true,
        toInt: true,
        isLength: { options: { min: 1, max: 10 } },
        errorMessage: 'Category ID must be an integer',
        escape: true
    },
    categoryName: {
        in: ['params'],
        isString: true,
        notEmpty: true,
        toUpperCase: true,
        isLength: { options: { min: 3, max: 50 } },
        errorMessage: 'Category Name must be a non-empty string',
        escape: true
    }
});
exports.getCategorySchema = getCategorySchema;
const getProductNameSchema = (0, express_validator_1.checkSchema)({
    productName: {
        in: ['params'],
        isString: true,
        notEmpty: true,
        isLength: { options: { min: 1, max: 200 } },
        errorMessage: 'Product Name must be a non-empty string',
        escape: true
    }
});
exports.getProductNameSchema = getProductNameSchema;
const ProductFilterSchema = (0, express_validator_1.checkSchema)({
    productName: {
        in: ['params'],
        isString: true,
        notEmpty: true,
        isLength: { options: { min: 3, max: 200 } },
        errorMessage: 'Product Name must be a non-empty string',
        escape: true
    },
    minPrice: {
        in: ['params'],
        isFloat: true,
        toFloat: true,
        custom: {
            options: (value) => value >= 0 && value <= 1000000,
            errorMessage: 'Min Price must be between 0 and 1,000,000'
        },
        errorMessage: 'Min Price must be a float',
        escape: true
    },
    maxPrice: {
        in: ['params'],
        isFloat: true,
        toFloat: true,
        custom: {
            options: (value) => value >= 0 && value <= 1000000,
            errorMessage: 'Max Price must be between 0 and 1,000,000'
        },
        errorMessage: 'Max Price must be a float',
        escape: true
    },
    rating: {
        in: ['params'],
        isFloat: true,
        toFloat: true,
        custom: {
            options: (value) => value >= 0 && value <= 5,
            errorMessage: 'Rating must be between 0 and 5'
        },
        errorMessage: 'Rating must be a float',
        escape: true
    }
});
exports.ProductFilterSchema = ProductFilterSchema;
const MainSubCategorySchema = (0, express_validator_1.checkSchema)({
    mainCategory: {
        in: ['params'],
        isString: true,
        notEmpty: true,
        isLength: { options: { min: 3, max: 50 } },
        toUpperCase: true,
        errorMessage: 'Main Category must be a non-empty string',
        escape: true
    },
    subCategory: {
        in: ['params'],
        isString: true,
        notEmpty: true,
        isLength: { options: { min: 3, max: 50 } },
        errorMessage: 'Sub Category must be a non-empty string',
        escape: true
    }
});
exports.MainSubCategorySchema = MainSubCategorySchema;
const categoryFilterSchema = (0, express_validator_1.checkSchema)({
    categoryID: {
        in: ['params'],
        isInt: true,
        toInt: true,
        isLength: { options: { min: 1, max: 50 } },
        errorMessage: 'Category ID must be an integer',
        escape: true
    },
    minPrice: {
        in: ['params'],
        isFloat: true,
        toFloat: true,
        custom: {
            options: (value) => value >= 0 && value <= 1000000,
            errorMessage: 'Min Price must be between 0 and 1,000,000'
        },
        errorMessage: 'Min Price must be a float',
        escape: true
    },
    maxPrice: {
        in: ['params'],
        isFloat: true,
        toFloat: true,
        custom: {
            options: (value) => value >= 0 && value <= 1000000,
            errorMessage: 'Max Price must be between 0 and 1,000,000'
        },
        errorMessage: 'Max Price must be a float',
        escape: true
    },
    rating: {
        in: ['params'],
        isFloat: true,
        toFloat: true,
        custom: {
            options: (value) => value >= 0 && value <= 5,
            errorMessage: 'Rating must be between 0 and 5'
        },
        errorMessage: 'Rating must be a float',
        escape: true
    }
});
exports.categoryFilterSchema = categoryFilterSchema;
