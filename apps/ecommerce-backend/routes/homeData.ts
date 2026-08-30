import express, { Request, Response } from 'express';
import { client } from '../data/DB';
import ShopiCatalogService from '../data/shopiCatalogService';

const router = express.Router();

router.get('/home/banner', async (req: Request, res: Response) => {
    const fetchQuery = `SELECT * FROM banners`;
    try {
        const response = await client.query(fetchQuery);
        res.status(200).json({ data: response.rows });
    } catch (error) {
        // Fallback banner if legacy table query fails
        res.status(200).json({
            data: [
                {
                    bannerid: 1,
                    title: 'Exclusive Fashion & Footwear Deals',
                    subtitle: 'Up to 80% Off on Top Brands',
                    imageurl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8',
                    link: '/categories/Clothing'
                }
            ]
        });
    }
});

router.get('/home/deals', async (req: Request, res: Response) => {
    try {
        const deals = await ShopiCatalogService.getDeals(8);
        res.status(200).json({ data: deals });
    } catch (error) {
        res.sendStatus(500);
    }
});

router.get('/home/trending', async (req: Request, res: Response) => {
    try {
        const data = await ShopiCatalogService.getTrending(8);
        res.status(200).json({ data });
    } catch (error) {
        res.sendStatus(500);
    }
});

router.get('/home/best-sellers', async (req: Request, res: Response) => {
    try {
        const data = await ShopiCatalogService.getBestSellers(4);
        res.status(200).json({ data });
    } catch (error) {
        res.sendStatus(500);
    }
});

router.get('/home/products', async (req: Request, res: Response) => {
    try {
        const data = await ShopiCatalogService.getHomeProducts(12);
        res.status(200).json({ data });
    } catch (error) {
        res.sendStatus(500);
    }
});

export default router;