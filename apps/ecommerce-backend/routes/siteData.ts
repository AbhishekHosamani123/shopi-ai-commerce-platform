import express, { Request, Response } from 'express';
import { client } from '../data/DB';
import { categoryFilterSchema, categorySchema, filterSchema, getCategorySchema, getProductNameSchema, MainSubCategorySchema } from '../validators/siteDataValidation';
import { matchedData, validationResult } from 'express-validator';
import ShopiCatalogService from '../data/shopiCatalogService';

const router = express.Router();
const articleTable = 'articles';

router.get('/articles', async (req: Request, res: Response) => {
    const query = `SELECT * FROM ${articleTable}`;
    try {
        const response = await client.query(query);
        res.status(200).json({ data: response.rows });
    } catch (error) {
        res.status(200).json({ data: [] });
    }
});

router.get('/category/:category', categorySchema, async (req: Request, res: Response) => {
    if (validationResult(req).isEmpty()) {
        const { category } = matchedData(req);
        try {
            const sub = (req.query.sub as string) || '';
            const products = await ShopiCatalogService.getByCategory(category, sub);
            // Get all subcategories for this main category
            const allCategoryProducts = await ShopiCatalogService.getByCategory(category);
            const categories = Array.from(new Set(allCategoryProducts.map(p => p.categories.subcategory))).map((name, idx) => ({
                categoryid: idx + 1,
                name
            }));
            res.status(200).json({
                data: {
                    categories,
                    products
                }
            });
        } catch (error) {
            console.error('Error in /category/:category', error);
            res.status(500).json({ error: 'Server Error', details: String(error) });
        }
    } else {
        res.status(500).json({ error: 'Validation Error' });
    }
});

router.get('/filter/category/:minPrice/:maxPrice/:categoryID/:minRating/:categoryName', filterSchema, async (req: Request, res: Response) => {
    const result = validationResult(req);
    if (result.isEmpty()) {
        const { minPrice, maxPrice, categoryName, minRating } = matchedData(req);
        const sub = (req.query.sub as string) || '';
        try {
            const products = await ShopiCatalogService.getByCategory(
                categoryName && categoryName !== '0' ? categoryName : '',
                sub,
                {
                    minPrice: parseFloat(minPrice),
                    maxPrice: parseFloat(maxPrice),
                    minRating: parseFloat(minRating)
                }
            );
            res.status(200).json({ data: products });
        } catch (error) {
            res.status(500).json({ error: 'Failed' });
        }
    } else {
        res.status(500).json({ error: 'Validation Error' });
    }
});

router.get('/filter/category-only/:categoryID/:categoryName', getCategorySchema, async (req: Request, res: Response) => {
    if (validationResult(req).isEmpty()) {
        const { categoryName } = matchedData(req);
        const sub = (req.query.sub as string) || '';
        try {
            const products = await ShopiCatalogService.getByCategory(categoryName, sub);
            res.status(200).json({ data: products });
        } catch (error) {
            res.status(500).json({ error: 'Failed' });
        }
    } else {
        res.status(500).json({ error: 'Validation Error' });
    }
});

router.get('/search/product/:productName', getProductNameSchema, async (req: Request, res: Response) => {
    if (validationResult(req).isEmpty()) {
        const { productName } = matchedData(req);
        try {
            const cleanQuery = (productName as string).replace(/-/g, ' ');
            const products = await ShopiCatalogService.searchProducts(cleanQuery);
            res.status(200).json({ data: products });
        } catch (error) {
            res.status(500).json({ error: 'Server Error' });
        }
    } else {
        res.status(500).json({ error: 'Validation Error' });
    }
});

router.get('/search/filtered-product/:productName/:minPrice/:maxPrice/:rating', async (req: Request, res: Response) => {
    const { productName, minPrice, maxPrice, rating } = req.params as { productName: string, minPrice: string, maxPrice: string, rating: string };
    try {
        const cleanQuery = (productName || '').replace(/-/g, ' ');
        const products = await ShopiCatalogService.searchProducts(
            cleanQuery,
            parseFloat(minPrice),
            parseFloat(maxPrice),
            parseFloat(rating)
        );
        return res.status(200).json({ data: products });
    } catch (error) {
        return res.sendStatus(500);
    }
});

router.get('/sub-category/:category', categorySchema, async (req: Request, res: Response) => {
    if (validationResult(req).isEmpty()) {
        const { category: mainCategory } = matchedData(req);
        try {
            const subCategory = (req.query.sub as string) || '';
            const cleanSub = subCategory ? subCategory.replace(/-/g, ' ') : '';
            const products = await ShopiCatalogService.getByCategory(mainCategory, cleanSub);
            return res.status(200).json({ data: products, categoryid: 1 });
        } catch (error) {
            return res.status(500).json({ error: 'Failed to fetch data' });
        }
    } else {
        res.status(500).json({ error: 'Validation Error' });
    }
});

router.get('/sub-category/:mainCategory/:subCategory', MainSubCategorySchema, async (req: Request, res: Response) => {
    if (validationResult(req).isEmpty()) {
        const { mainCategory, subCategory } = matchedData(req);
        try {
            const cleanSub = (subCategory as string).replace(/-/g, ' ');
            const products = await ShopiCatalogService.getByCategory(mainCategory, cleanSub);
            return res.status(200).json({ data: products, categoryid: 1 });
        } catch (error) {
            return res.status(500).json({ error: 'Failed to fetch data' });
        }
    } else {
        res.status(500).json({ error: 'Validation Error' });
    }
});

router.get('/sub-category/filtered-product/:categoryID/:minPrice/:maxPrice/:rating', categoryFilterSchema, async (req: Request, res: Response) => {
    if (validationResult(req).isEmpty()) {
        const { minPrice, maxPrice, rating } = matchedData(req);
        const mainCategory = (req.query.mainCategory as string) || '';
        const subCategory = (req.query.subCategory as string) || '';
        try {
            const cleanSub = subCategory ? subCategory.replace(/-/g, ' ') : '';
            const products = await ShopiCatalogService.getByCategory(
                mainCategory,
                cleanSub,
                {
                    minPrice: parseFloat(minPrice),
                    maxPrice: parseFloat(maxPrice),
                    minRating: parseFloat(rating)
                }
            );
            res.status(200).json({ data: products });
        } catch (error) {
            res.status(500).json({ error: 'Server Error' });
        }
    } else {
        res.status(500).json({ error: 'Validation Error' });
    }
});

export default router;