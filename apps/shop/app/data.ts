import { title } from "process";

const topCat = [
  {
    imgLink: 'https://codewithsadee.github.io/anon-ecommerce-website/assets/images/icons/shirt.svg',
    name: 'SHIRTS',
    quantity: 15,
    showLink: '/sub-category/men/shirt'
  },
  {
    imgLink: 'https://codewithsadee.github.io/anon-ecommerce-website/assets/images/icons/tee.svg',
    name: 'T-SHIRTS',
    quantity: 8,
    showLink: '/sub-category/men/t-shirt'
  },
  {
    imgLink: 'https://codewithsadee.github.io/anon-ecommerce-website/assets/images/icons/shorts.svg',
    name: 'JEANS',
    quantity: 10,
    showLink: '/sub-category/men/jeans'
  },
  {
    imgLink: 'https://codewithsadee.github.io/anon-ecommerce-website/assets/images/icons/jacket.svg',
    name: 'JACKETS',
    quantity: 4,
    showLink: '/sub-category/men/jackets'
  },
  {
    imgLink: 'https://codewithsadee.github.io/anon-ecommerce-website/assets/images/icons/dress.svg',
    name: 'DRESSES',
    quantity: 10,
    showLink: '/sub-category/women/dresses'
  },
  {
    imgLink: 'https://codewithsadee.github.io/anon-ecommerce-website/assets/images/icons/shoes.svg',
    name: 'SNEAKERS',
    quantity: 12,
    showLink: '/sub-category/footwear/sneakers'
  },
  {
    imgLink: 'https://codewithsadee.github.io/anon-ecommerce-website/assets/images/icons/shoes.svg',
    name: 'FORMAL SHOES',
    quantity: 6,
    showLink: '/sub-category/footwear/formal-shoes'
  },
  {
    imgLink: 'https://codewithsadee.github.io/anon-ecommerce-website/assets/images/icons/bag.svg',
    name: 'BAGS',
    quantity: 5,
    showLink: '/sub-category/accessories/bags'
  }
];

const navBtns = [
  { name: 'Home', isExtendable: false, extendables: [], catLink: '/' },
  { name: 'Categories', isExtendable: false, extendables: [], catLink: '' },
  {
    name: "Men's",
    isExtendable: true,
    extendables: [
      { title: 'Shirts', link: '/sub-category/men/shirt' },
      { title: 'T-Shirts', link: '/sub-category/men/t-shirt' },
      { title: 'Jeans', link: '/sub-category/men/jeans' },
      { title: 'Jackets', link: '/sub-category/men/jackets' },
      { title: 'Sneakers', link: '/sub-category/men/sneakers' },
      { title: 'Formal Shoes', link: '/sub-category/men/formal-shoes' },
      { title: 'Sports Shoes', link: '/sub-category/men/sports-shoes' }
    ],
    catLink: '/categories/men'
  },
  {
    name: "Women's",
    isExtendable: true,
    extendables: [
      { title: 'Dresses', link: '/sub-category/women/dresses' }
    ],
    catLink: '/categories/women'
  },
  {
    name: 'Clothing',
    isExtendable: true,
    extendables: [
      { title: 'Shirts', link: '/sub-category/clothing/shirts' },
      { title: 'T-Shirts', link: '/sub-category/clothing/t-shirt' },
      { title: 'Jeans', link: '/sub-category/clothing/jeans' },
      { title: 'Jackets', link: '/sub-category/clothing/jackets' },
      { title: 'Dresses', link: '/sub-category/clothing/dresses' }
    ],
    catLink: '/categories/clothing'
  },
  {
    name: 'Footwear',
    isExtendable: true,
    extendables: [
      { title: 'Sneakers', link: '/sub-category/footwear/sneakers' },
      { title: 'Formal Shoes', link: '/sub-category/footwear/formal-shoes' },
      { title: 'Sports Shoes', link: '/sub-category/footwear/sports-shoes' }
    ],
    catLink: '/categories/footwear'
  },
  {
    name: 'Accessories',
    isExtendable: true,
    extendables: [
      { title: 'Bags', link: '/sub-category/accessories/bags' }
    ],
    catLink: '/categories/accessories'
  },
  { name: 'Blog', isExtendable: false, extendables: [], catLink: '/blog' }
];

const leftStatus = [
  {
    imgLink: 'https://codewithsadee.github.io/anon-ecommerce-website/assets/images/icons/dress.svg',
    title: 'Clothing',
    links: [
      { title: 'Shirts', link: '/sub-category/clothing/shirts', quantity: 15 },
      { title: 'T-Shirts', link: '/sub-category/clothing/t-shirt', quantity: 8 },
      { title: 'Jeans', link: '/sub-category/clothing/jeans', quantity: 10 },
      { title: 'Jackets', link: '/sub-category/clothing/jackets', quantity: 4 },
      { title: 'Dresses', link: '/sub-category/clothing/dresses', quantity: 10 }
    ]
  },
  {
    imgLink: 'https://codewithsadee.github.io/anon-ecommerce-website/assets/images/icons/shoes.svg',
    title: 'Footwear',
    links: [
      { title: 'Sneakers', link: '/sub-category/footwear/sneakers', quantity: 12 },
      { title: 'Formal Shoes', link: '/sub-category/footwear/formal-shoes', quantity: 6 },
      { title: 'Sports Shoes', link: '/sub-category/footwear/sports-shoes', quantity: 6 }
    ]
  },
  {
    imgLink: 'https://codewithsadee.github.io/anon-ecommerce-website/assets/images/icons/bag.svg',
    title: 'Accessories',
    links: [
      { title: 'Bags', link: '/sub-category/accessories/bags', quantity: 5 }
    ]
  }
];

const footerCategories = [
  {
    name: 'CLOTHING',
    subcategories: [
      { name: 'Shirts', subcatLink: '/sub-category/clothing/shirts' },
      { name: 'T-Shirts', subcatLink: '/sub-category/clothing/t-shirt' },
      { name: 'Jeans', subcatLink: '/sub-category/clothing/jeans' },
      { name: 'Jackets', subcatLink: '/sub-category/clothing/jackets' },
      { name: 'Dresses', subcatLink: '/sub-category/clothing/dresses' }
    ]
  },
  {
    name: 'FOOTWEAR',
    subcategories: [
      { name: 'Sneakers', subcatLink: '/sub-category/footwear/sneakers' },
      { name: 'Formal Shoes', subcatLink: '/sub-category/footwear/formal-shoes' },
      { name: 'Sports Shoes', subcatLink: '/sub-category/footwear/sports-shoes' }
    ]
  },
  {
    name: 'ACCESSORIES',
    subcategories: [
      { name: 'Bags', subcatLink: '/sub-category/accessories/bags' }
    ]
  }
];
const footerSections = [
    {
        sectionName: "Popular Categories",
        items: [
            {
                title: "Men's Fashion",
                link: "/categories/men"
            },
            {
                title: "Women's Fashion",
                link: "/categories/women"
            },
            {
                title: "Clothing",
                link: "/categories/clothing"
            },
            {
                title: "Footwear",
                link: "/categories/footwear"
            },
            {
                title: "Accessories",
                link: "/categories/accessories"
            }
        ]
    },
    {
        sectionName: "Products",
        items: [
            // {
            //     title: "Prices Drop",
            //     link: "products/price-drop"
            // },
            // {
            //     title: "New Products",
            //     link: "products/new-products"
            // },
            {
                title: "Blog",
                link: "/blog"
            },
            {
                title: "Contact Us",
                link: "/contact"
            },
            {
                title: "Our Services",
                link: "/our-services"
            }
        ]
    },
    {
        sectionName: "Our Company",
        items: [
            {
                title: "About Us",
                link: "/about"
            },
            {
                title: "Privacy Policy",
                link: "/policy/privacypolicy"
            },
            {
                title: "Secure Payment",
                link: "/securepayment"
            },
            {
                title: "Terms And Conditions",
                link: "/policy/terms&conditions"
            },
            {
                title: "Refund & Cancellation",
                link: "/policy/refund&cancellation"
            }
        ]
    },
    {
        sectionName: 'Contact',
        items: [
            {title:'419 State 414 Rte Beaver Dams, New York(NY), 14812, USA',link:"#"},
            {title:'(607) 936-8058',link:"#"},
            {title:'Example@Gmail.Com',link:"#"}
        ]
    }
];
const featuresSec = [
    {
        title: "Worldwide Delivery",
        description: "For Order Over $100",
        siteLink:"",
        icon:'fa-solid fa-ship fa-2xl',
    },
    {
        title: "Next Day Delivery",
        description: "Tier-1 City Orders Only",
        siteLink:"",
        icon:'fa-solid fa-rocket fa-2xl',
    },
    {
        title: "Best Online Support",
        description: "Hours: 8AM - 11PM",
        siteLink:"",
        icon:'fa-solid fa-phone fa-2xl',
    },
    {
        title: "Return Policy",
        description: "Easy & Free Return",
        siteLink:"",
        icon:'fa-solid fa-backward fa-2xl',
    },
    {
        title: "30% Money Back",
        description: "For Order Over $100",
        siteLink:"",
        icon:'fa-solid fa-gift fa-2xl',
    }
];
const currentEvent = {
    discount:25,
    titleFirst:"Summer",
    titleLast:"Collection",
    starting:10,
    isDiscount:true,
    eventLink:''
}
const testimonial = {
    imgLink:'https://codewithsadee.github.io/anon-ecommerce-website/assets/images/testimonial-1.jpg',
    name:'Alan Doe',
    position:'Verified Buyer & Stylist',
    description:'Shopi made discovering the perfect fit effortless. The quality, fast delivery, and AI recommendations exceeded my expectations!'
}
const categoryDropDown = [
  {
    title: "Men's",
    catLink: "men",
    imgLink: "https://codewithsadee.github.io/anon-ecommerce-website/assets/images/mens-banner.jpg",
    imgAlt: "Men's Fashion",
    imgRedirectLink: "/categories/men",
    subCategories: [
      { title: "Shirts", link: "/sub-category/men/shirt" },
      { title: "T-Shirts", link: "/sub-category/men/t-shirt" },
      { title: "Jeans", link: "/sub-category/men/jeans" },
      { title: "Jackets", link: "/sub-category/men/jackets" },
      { title: "Sneakers", link: "/sub-category/men/sneakers" },
      { title: "Formal Shoes", link: "/sub-category/men/formal-shoes" }
    ]
  },
  {
    title: "Women's",
    catLink: "women",
    imgLink: "https://codewithsadee.github.io/anon-ecommerce-website/assets/images/womens-banner.jpg",
    imgAlt: "Women's Fashion",
    imgRedirectLink: "/categories/women",
    subCategories: [
      { title: "Dresses", link: "/sub-category/women/dresses" }
    ]
  },
  {
    title: "Clothing",
    catLink: "clothing",
    imgLink: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=500&q=80",
    imgAlt: "Clothing Collection",
    imgRedirectLink: "/categories/clothing",
    subCategories: [
      { title: "Shirts", link: "/sub-category/clothing/shirts" },
      { title: "T-Shirts", link: "/sub-category/clothing/t-shirt" },
      { title: "Jeans", link: "/sub-category/clothing/jeans" },
      { title: "Jackets", link: "/sub-category/clothing/jackets" },
      { title: "Dresses", link: "/sub-category/clothing/dresses" }
    ]
  },
  {
    title: "Footwear",
    catLink: "footwear",
    imgLink: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=500&q=80",
    imgAlt: "Footwear Collection",
    imgRedirectLink: "/categories/footwear",
    subCategories: [
      { title: "Sneakers", link: "/sub-category/footwear/sneakers" },
      { title: "Formal Shoes", link: "/sub-category/footwear/formal-shoes" },
      { title: "Sports Shoes", link: "/sub-category/footwear/sports-shoes" }
    ]
  }
];
const paymentSecure = [
    {
        title:'Secure Payment',
        description:"We prioritize the security of your payment information. We understand the importance of ensuring that every transaction you make with us is safe and protected. That's why we have implemented robust security measures to safeguard your payment details and provide you with peace of mind throughout your shopping experience.",
        imgLink:'securepayment.jpg',
        imgAlt:'',
    },
    {
        title:'Cutting-Edge Encryption Technology',
        description:"We utilize cutting-edge encryption technology to protect your sensitive payment information. Our secure sockets layer (SSL) encryption ensures that all data transmitted between your browser and our servers remains encrypted and confidential. This means that your credit card details, personal information, and transaction data are shielded from unauthorized access by third parties.",
        imgLink:'securepayment-1.jpg',
        imgAlt:'',
    },
    {
        title:'PCI Compliance',
        description:"We are fully compliant with Payment Card Industry Data Security Standard (PCI DSS) requirements. This industry-standard framework sets forth stringent guidelines for securely handling credit card information during payment transactions. By adhering to PCI DSS standards, we maintain a secure environment for processing payment information, reducing the risk of data breaches and fraud.",
        imgLink:'securepayment-2.jpg',
        imgAlt:'',
    },
    {
        title:'Trusted Payment Partners',
        description:"We partner with trusted payment service providers that adhere to the highest security standards in the industry. Whether you choose to pay by credit card, debit card, or alternative payment methods, rest assured that your transaction is processed securely and efficiently.",
        imgLink:'securepayment-3.jpg',
        imgAlt:'',
    },
    {
        title:'Continuous Monitoring and Assessment',
        description:"Our dedicated security team continuously monitors and assesses our payment systems to identify and mitigate any potential vulnerabilities or threats. We stay vigilant against emerging security risks and implement proactive measures to ensure the ongoing security of your payment information.",
        imgLink:'securepayment-4.jpg',
        imgAlt:'',
    },
    {
        title:'Your Peace of Mind is Our Priority',
        description:"We are committed to providing you with a seamless and secure payment experience. Your peace of mind is our top priority, and we spare no effort in upholding the highest standards of security to protect your valuable information. Shop with confidence knowing that your payment details are in safe hands.",
        imgLink:'securepayment-5.jpg',
        imgAlt:'',
    },
]
const aboutUS= {
    section1:[
        {
            title:"About Us",
            description:"Welcome to [Your E-commerce Site Name], your ultimate destination for all things [your niche or industry]. Founded [year], we are passionate about delivering exceptional products and unparalleled shopping experiences to our customers worldwide.",
            imgLink:"about.jpg",
            imgAlt:""
        },
        {
            title:"Our Story",
            description:"At [Your E-commerce Site Name], our journey began with a simple yet powerful vision: to redefine the online shopping experience. What started as a small venture has grown into a thriving e-commerce platform, serving customers across the globe with a diverse range of high-quality products.",
            imgLink:"about-1.jpg",
            imgAlt:""
        },
        {
            title:"Our Mission",
            description:"Our mission is to empower individuals and communities by providing access to top-notch products that enhance their lives. We strive to create a seamless and enjoyable shopping environment where customers can discover new trends, find their favorite brands, and make informed purchasing decisions.",
            imgLink:"about-2.jpg",
            imgAlt:""
        },
        {
            title:"What Sets Us Apart",
            description:"What sets us apart is our unwavering commitment to excellence in every aspect of our business. From curating the finest selection of products to ensuring prompt and reliable delivery, we go above and beyond to exceed our customers' expectations.",
            imgLink:"about-3.jpg",
            imgAlt:""
        }

    ],
    section2:{
        title:"Our Values",
        imgLink:"about-5.jpg",
        imgAlt:"",
        listPoints:[
            {
                title:"Customer Satisfaction",
                description:"Your satisfaction is our top priority. We are dedicated to providing exceptional customer service and personalized support to ensure a smooth and enjoyable shopping experience."
            },
            {
                title:"Quality Assurance",
                description:"We stand behind the quality and authenticity of every product we offer. Each item undergoes rigorous quality control checks to meet our stringent standards of excellence."
            },
            {
                title:"Innovation",
                description:"We embrace innovation and continuously seek new ways to enhance our platform and elevate the shopping experience for our customers."
            },
            {
                title:"Sustainability",
                description:"We are committed to promoting sustainability and ethical practices throughout our supply chain. We prioritize eco-friendly products and strive to minimize our environmental footprint."
            }
        ],
    },
    section3:{
        title:"Get in Touch",
        description:[
            "We value transparency and open communication with our customers. If you have any questions, feedback, or inquiries, we encourage you to reach out to our dedicated customer support team. We are here to assist you every step of the way.",
            "Thank you for choosing [Your E-commerce Site Name]. We look forward to serving you and helping you discover the joy of shopping online."
        ]
    }
}
const availableCategories = [
    {
        title: 'clothing',
        banners: [
            "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&q=80",
            "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=1200&q=80"
        ],
        subcategories: [
            { title: 'Shirts', link: '/sub-category/clothing/shirts' },
            { title: 'T-Shirts', link: '/sub-category/clothing/t-shirt' },
            { title: 'Jeans', link: '/sub-category/clothing/jeans' },
            { title: 'Jackets', link: '/sub-category/clothing/jackets' },
            { title: 'Dresses', link: '/sub-category/clothing/dresses' }
        ]
    },
    {
        title: 'footwear',
        banners: [
            "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=1200&q=80",
            "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=1200&q=80"
        ],
        subcategories: [
            { title: 'Sneakers', link: '/sub-category/footwear/sneakers' },
            { title: 'Formal Shoes', link: '/sub-category/footwear/formal-shoes' },
            { title: 'Sports Shoes', link: '/sub-category/footwear/sports-shoes' }
        ]
    },
    {
        title: 'accessories',
        banners: [
            "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=1200&q=80"
        ],
        subcategories: [
            { title: 'Bags', link: '/sub-category/accessories/bags' }
        ]
    },
    {
        title: 'men',
        banners: [
            "https://codewithsadee.github.io/anon-ecommerce-website/assets/images/mens-banner.jpg"
        ],
        subcategories: [
            { title: 'Shirts', link: '/sub-category/men/shirts' },
            { title: 'T-Shirts', link: '/sub-category/men/t-shirt' },
            { title: 'Jeans', link: '/sub-category/men/jeans' },
            { title: 'Jackets', link: '/sub-category/men/jackets' },
            { title: 'Sneakers', link: '/sub-category/men/sneakers' },
            { title: 'Formal Shoes', link: '/sub-category/men/formal-shoes' },
            { title: 'Sports Shoes', link: '/sub-category/men/sports-shoes' }
        ]
    },
    {
        title: 'women',
        banners: [
            "https://codewithsadee.github.io/anon-ecommerce-website/assets/images/womens-banner.jpg"
        ],
        subcategories: [
            { title: 'Dresses', link: '/sub-category/women/dresses' }
        ]
    }
];
const loginFeatures = [
    {
        title: 'Track Your Orders',
        description: 'Keep tabs on your purchases with real-time order tracking and updates.',
        iconType: 'search',
    },
    {
        title: 'Personalized Recommendations',
        description: 'Log in to receive product suggestions tailored to your shopping preferences.',
        iconType: 'star',
    },
    {
        title: 'Wishlist Management',
        description: 'Save your favorite items to your wishlist for quick and easy future purchases.',
        iconType: 'heart',
    },
    {
        title: 'Secure Checkout',
        description: 'Enjoy a fast, secure, and hassle-free checkout process every time you shop with us.',
        iconType: 'lock',
    },
];
const serviceFeatures = [
    {
        title: 'Worldwide Delivery',
        description: "Enjoy our comprehensive global shipping services, designed to bring your favorite products right to your doorstep, no matter where you are. We partner with top logistics companies to ensure your order reaches you safely and promptly, providing you with a seamless shopping experience from anywhere in the world.",
        imgLink: 'https://cdn.pixabay.com/photo/2014/04/03/11/55/globe-312563_640.png',
        imgAlt: 'Globe with delivery arrows',
    },
    {
        title: 'Free Shipping on Orders Over $100',
        description: "Shop to your heart's content and take advantage of our special offer: free shipping on all orders over $100. Whether you're buying gifts for loved ones or treating yourself, you'll save on shipping costs, making your shopping experience even more enjoyable. Spend more, save more with us!",
        imgLink: 'https://img.freepik.com/premium-vector/delivery-order-illustration-modern-flat-style_529804-22.jpg',
        imgAlt: 'Shipping box with dollar sign',
    },
    {
        title: 'Next Day Delivery',
        description: "Need your items in a hurry? With our next day delivery service, you can receive your order the very next day! This service is available for orders in tier-1 cities, ensuring that you never have to wait long for your essential items. Fast, reliable, and convenient delivery right to your door.",
        imgLink: 'https://cdn-icons-png.freepik.com/512/1254/1254262.png',
        imgAlt: 'Clock with delivery truck',
    },
    {
        title: 'Next Day Delivery for Tier-1 Cities',
        description: "Our next day delivery service is exclusively available for customers in tier-1 cities. This means you can enjoy the speed and convenience of receiving your orders within 24 hours, perfect for those last-minute needs or urgent purchases. Experience the ultimate in fast delivery with our premium service.",
        imgLink: 'https://img.freepik.com/free-vector/gradient-international-trade_23-2149150716.jpg',
        imgAlt: 'Map highlighting tier-1 cities',
    },
    {
        title: 'Best Online Support',
        description: "Our customer support team is dedicated to providing you with the best service possible. Available from 8AM to 11PM, our knowledgeable and friendly representatives are here to assist you with any inquiries or issues you may have. We're committed to ensuring your shopping experience is smooth and enjoyable.",
        imgLink: 'https://img.freepik.com/free-vector/hand-drawn-flat-design-omnichannel-illustration_23-2149360245.jpg?size=626&ext=jpg&ga=GA1.1.1141335507.1718496000&semt=ais_user',
        imgAlt: 'Headset with customer service icon',
    },
    {
        title: 'Easy & Free Return',
        description: "Shop with confidence knowing that our easy and free return policy has you covered. If you're not completely satisfied with your purchase, you can return it hassle-free. We aim to make the return process as straightforward as possible, giving you peace of mind with every order.",
        imgLink: 'https://atlanticcourier.net/static/images/testimonials-atlantic-courier.jpg',
        imgAlt: 'Return package with arrow',
    },
    {
        title: '30% Money Back Guarantee',
        description: "Enjoy added assurance with our 30% money back guarantee on orders over $100. If you're not fully satisfied with your purchase, we'll refund 30% of your order value. This guarantee underscores our commitment to your satisfaction and ensures that you can shop with complete confidence.",
        imgLink: 'https://cdni.iconscout.com/illustration/premium/thumb/cashback-3465499-2912113.png?f=webp',
        imgAlt: 'Money back symbol',
    },
];
const allCategories = [
  { name: "Men's", link: '/categories/men' },
  { name: "Women's", link: '/categories/women' },
  { name: 'Clothing', link: '/categories/clothing' },
  { name: 'Footwear', link: '/categories/footwear' },
  { name: 'Accessories', link: '/categories/accessories' }
];
export {topCat, allCategories, serviceFeatures, loginFeatures,  navBtns,  aboutUS, availableCategories, paymentSecure, leftStatus, categoryDropDown,  footerCategories, footerSections, featuresSec, currentEvent, testimonial};