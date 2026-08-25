-- ====================================================================
-- Razorpay AI Commerce - Indian Rupee (INR) Pricing Update & Seed
-- Realistic Indian Ecommerce Pricing for 40 Products, Coupons & Cards
-- ====================================================================

-- 0. Alter Numeric Columns to Precision (12,2) for INR
ALTER TABLE products ALTER COLUMN price TYPE numeric(12,2);
ALTER TABLE products ALTER COLUMN discount TYPE numeric(12,2);
ALTER TABLE orders ALTER COLUMN totalamount TYPE numeric(12,2);
ALTER TABLE payments ALTER COLUMN amount TYPE numeric(12,2);
ALTER TABLE shipping ALTER COLUMN shippingcost TYPE numeric(12,2);
ALTER TABLE coupons ALTER COLUMN minpurchaseamount TYPE numeric(12,2);
ALTER TABLE coupons ALTER COLUMN maxdiscountamount TYPE numeric(12,2);
ALTER TABLE giftcards ALTER COLUMN balance TYPE numeric(12,2);
ALTER TABLE banners ALTER COLUMN startprice TYPE numeric(12,2);

-- 1. Update Product Prices & Discounts
UPDATE products SET price = 1499.00, discount = 899.00 WHERE productid = 20000001; -- Relaxed Short Full Sleeves (Shirts)
UPDATE products SET price = 1299.00, discount = 699.00 WHERE productid = 20000002; -- Girls Pink Embro Design Top (Casual)
UPDATE products SET price = 1899.00, discount = 1199.00 WHERE productid = 20000003; -- Black Floral Wrap Midi Skirt (Casual)
UPDATE products SET price = 1999.00, discount = 1299.00 WHERE productid = 20000004; -- Pure Garment Dyed Cotton Shirt (Shirt)
UPDATE products SET price = 3499.00, discount = 2299.00 WHERE productid = 20000005; -- MEN Yarn Fleece Full-Zip Jacket (Jacket)
UPDATE products SET price = 4999.00, discount = 3499.00 WHERE productid = 20000006; -- Mens Winter Leathers Jackets (Jacket)
UPDATE products SET price = 5499.00, discount = 3799.00 WHERE productid = 20000007; -- Mens Winter Leathers Jackets (Jacket)
UPDATE products SET price = 1199.00, discount = 699.00 WHERE productid = 20000008; -- Better Basics French Terry Sweatshorts (Shorts & Jeans)
UPDATE products SET price = 3299.00, discount = 1999.00 WHERE productid = 20000009; -- Running & Trekking Shoes - White (Sport)
UPDATE products SET price = 3999.00, discount = 2499.00 WHERE productid = 20000010; -- Trekking & Running Shoes - Black (Sport)
UPDATE products SET price = 2999.00, discount = 1799.00 WHERE productid = 20000011; -- Womens Party Wear Shoes (Party Wear Shoes)
UPDATE products SET price = 2799.00, discount = 1899.00 WHERE productid = 20000012; -- Sports Claw Women Shoes (Sport)
UPDATE products SET price = 3499.00, discount = 2199.00 WHERE productid = 20000013; -- Air Trekking Shoes - White (Sport)
UPDATE products SET price = 3999.00, discount = 2599.00 WHERE productid = 20000014; -- Boot With Suede Detail (Boots)
UPDATE products SET price = 3799.00, discount = 2499.00 WHERE productid = 20000015; -- Men Leather Formal Wear Shoes (Formal)
UPDATE products SET price = 2999.00, discount = 1999.00 WHERE productid = 20000016; -- Casual Men Brown Shoes (Formal)
UPDATE products SET price = 1499.00, discount = 899.00 WHERE productid = 20000017; -- Pocket Watch Leather Pouch (Smart Watch)
UPDATE products SET price = 2499.00, discount = 1299.00 WHERE productid = 20000018; -- Silver Deer Heart Necklace (Necklace)
UPDATE products SET price = 1999.00, discount = 1499.00 WHERE productid = 20000019; -- Titan 100 Ml Womens Perfume (Perfume)
UPDATE products SET price = 1299.00, discount = 799.00 WHERE productid = 20000020; -- Men Leather Reversible Belt (Formal)
UPDATE products SET price = 3999.00, discount = 2499.00 WHERE productid = 20000021; -- Platinum Zircon Classic Ring (Couple Rings)
UPDATE products SET price = 4999.00, discount = 2999.00 WHERE productid = 20000022; -- Smart Watche Vital Plus (Smart Watch)
UPDATE products SET price = 799.00, discount = 499.00, categoryid = 133633789 WHERE productid = 20000023; -- Shampoo Conditioner Packs (Shampoo / Cosmetics)
UPDATE products SET price = 1499.00, discount = 899.00 WHERE productid = 20000024; -- Rose Gold Peacock Earrings (Earrings)
UPDATE products SET price = 899.00, discount = 499.00 WHERE productid = 30000025; -- Baby Fabric Shoes (Casual)
UPDATE products SET price = 1499.00, discount = 899.00 WHERE productid = 30000026; -- Men Hoodies T-Shirt (TShirt)
UPDATE products SET price = 999.00, discount = 599.00 WHERE productid = 30000027; -- Girls T-Shirt (TShirt)
UPDATE products SET price = 699.00, discount = 399.00 WHERE productid = 30000028; -- Woolen Hat For Men (Casual)
UPDATE products SET price = 5999.00, discount = 3999.00 WHERE productid = 34000034; -- Mens Winter Leathers Jackets (Jacket)
UPDATE products SET price = 2199.00, discount = 1499.00 WHERE productid = 34100034; -- Pure Garment Dyed Cotton Shirt (Shirt)
UPDATE products SET price = 3699.00, discount = 2499.00 WHERE productid = 34200034; -- MEN Yarn Fleece Full-Zip Jacket (Jacket)
UPDATE products SET price = 1799.00, discount = 1099.00 WHERE productid = 34300034; -- Black Floral Wrap Midi Skirt (Casual)
UPDATE products SET price = 3499.00, discount = 2299.00 WHERE productid = 34400034; -- Casual Men's Brown Shoes (Casual)
UPDATE products SET price = 1699.00, discount = 999.00 WHERE productid = 34500034; -- Pocket Watch Leather Pouch (Smart Watch)
UPDATE products SET price = 4499.00, discount = 2799.00 WHERE productid = 34600034; -- Smart Watch Vital Plus (Smart Watch)
UPDATE products SET price = 2899.00, discount = 1699.00 WHERE productid = 34700034; -- Womens Party Wear Shoes (Party Wear Shoes)
UPDATE products SET price = 5299.00, discount = 3499.00 WHERE productid = 34800034; -- Mens Winter Leathers Jackets (Jacket)
UPDATE products SET price = 3799.00, discount = 2399.00 WHERE productid = 34900034; -- Trekking & Running Shoes - Black (Sport)
UPDATE products SET price = 3899.00, discount = 2599.00 WHERE productid = 35000034; -- Men's Leather Formal Wear Shoes (Formal)
UPDATE products SET price = 1399.00, discount = 799.00 WHERE productid = 35100034; -- Better Basics French Terry Sweatshorts (Shorts & Jeans)

-- 2. Update Gift Cards to INR Currency & Realistic Balances
UPDATE giftcards SET currency = 'INR', balance = 1000.00 WHERE cardid = 1;
UPDATE giftcards SET currency = 'INR', balance = 1500.00 WHERE cardid = 2;
UPDATE giftcards SET currency = 'INR', balance = 500.00 WHERE cardid = 3;
UPDATE giftcards SET currency = 'INR', balance = 2000.00 WHERE cardid = 4;
UPDATE giftcards SET currency = 'INR', balance = 750.00 WHERE cardid = 5;

-- 3. Update Coupons to Realistic INR Thresholds & Caps
UPDATE coupons SET minpurchaseamount = 999.00, maxdiscountamount = 500.00 WHERE couponid = 1;
UPDATE coupons SET minpurchaseamount = 1499.00, maxdiscountamount = 750.00 WHERE couponid = 2;
UPDATE coupons SET minpurchaseamount = 799.00, maxdiscountamount = 300.00 WHERE couponid = 3;
UPDATE coupons SET minpurchaseamount = 1999.00, maxdiscountamount = 1000.00 WHERE couponid = 4;
UPDATE coupons SET minpurchaseamount = 1199.00, maxdiscountamount = 600.00 WHERE couponid = 5;
UPDATE coupons SET minpurchaseamount = 999.00, maxdiscountamount = 500.00 WHERE couponid = 6;

-- 4. Update Banners
UPDATE banners SET bottomtitle = 'starting at ₹', startprice = 499.00 WHERE bannerid = 1;
UPDATE banners SET bottomtitle = 'starting at ₹', startprice = 299.00 WHERE bannerid = 2;
UPDATE banners SET bottomtitle = 'starting at ₹', startprice = 699.00 WHERE bannerid = 3;
