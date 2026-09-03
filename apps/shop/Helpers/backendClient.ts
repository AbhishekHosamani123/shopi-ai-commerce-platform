import axios from 'axios';

const backendUrl = process.env.BACKEND_URL
    || process.env.NEXT_PUBLIC_BACKEND_URL
    || (process.env.NODE_ENV === 'production' ? 'https://shopi-backend-ono3.onrender.com' : 'http://localhost:3500');

const backendClient = axios.create({
    baseURL: backendUrl,
    headers: {
        'x-api-secret': process.env.API_SECRET || 'razorpay_ai_commerce_shared_secret_2026',
    },
    timeout: 25000,
});

export default backendClient;
