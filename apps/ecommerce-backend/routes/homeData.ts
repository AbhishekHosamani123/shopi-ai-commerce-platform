import express, { Request, Response } from 'express';
import { client } from '../data/DB';
import ShopiCatalogService from '../data/shopiCatalogService';

const router = express.Router();

router.get('/home/banner', async (req: Request, res: Response) => {
    const defaultBanners = [
        {
            bannerid: 1,
            toptitle: 'Starting From ₹499',
            middletitle: 'Exclusive Men & Women Fashion',
            bottomtitle: 'Top Rated Styles From ₹',
            startprice: '499',
            buttontitle: 'Shop Now',
            imglink: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1600&q=80',
            redirect_link: '/sub-category/Clothing/Shirts'
        },
        {
            bannerid: 2,
            toptitle: 'Up to 60% OFF',
            middletitle: 'Trending Footwear & Sneakers',
            bottomtitle: 'Starting at ₹',
            startprice: '799',
            buttontitle: 'Explore Now',
            imglink: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1600&q=80',
            redirect_link: '/sub-category/Footwear/Sports%20Shoes'
        },
        {
            bannerid: 3,
            toptitle: 'New Season 2026',
            middletitle: 'Luxury Watches & Accessories',
            bottomtitle: 'Best Deals From ₹',
            startprice: '999',
            buttontitle: 'View Collection',
            imglink: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1600&q=80',
            redirect_link: '/sub-category/Accessories/Watches'
        }
    ];

    try {
        const response = await client.query(`SELECT * FROM banners`);
        if (response.rows && response.rows.length > 0) {
            return res.status(200).json({ data: response.rows });
        }
        return res.status(200).json({ data: defaultBanners });
    } catch (error) {
        return res.status(200).json({ data: defaultBanners });
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