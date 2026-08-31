import 'dotenv/config';
import { sendOrderConfirmationEmail } from './merchant-communication/order-confirmation-email';

async function main() {
  const targetEmail = 'abhishekhosamani79@gmail.com';
  console.log(`🚀 Sending test Order Confirmation email to: ${targetEmail}`);

  const orderData = {
    customerName: 'Abhishek Hosamani',
    customerEmail: targetEmail,
    orderId: 10482,
    orderIds: [10482],
    items: [
      {
        productId: 1,
        title: 'Classic Formal Oxford Shoe (Brown / Size 9)',
        imageUrl: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=160&auto=format&fit=crop&q=80',
        quantity: 1,
        unitPrice: 2499,
        colorName: 'Brown',
        sizeName: '9'
      },
      {
        productId: 4,
        title: 'Slim Fit Oxford Cotton Shirt (Sky Blue / Size M)',
        imageUrl: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=160&auto=format&fit=crop&q=80',
        quantity: 1,
        unitPrice: 1299,
        colorName: 'Sky Blue',
        sizeName: 'M'
      }
    ],
    totalAmount: 3897,
    shippingCharge: 99,
    trackingNumber: 'IN-10482',
    carrier: 'Shopi Express',
    shippingMethod: 'Express Delivery (3–5 Days)',
    address: {
      fullName: 'Abhishek Hosamani',
      line1: '42 Prestige Tech Park',
      line2: 'Marathahalli-Sarjapur Outer Ring Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560103',
      country: 'India',
      phone: '+91 98765 43210'
    },
    storefrontUrl: 'https://shopi-ai-commerce-platform-shop-two.vercel.app'
  };

  const result = await sendOrderConfirmationEmail(orderData);
  console.log('Result:', result);

  if (result.sent) {
    console.log(`\n🎉 SUCCESS: Order confirmation email successfully dispatched to ${targetEmail}!\nMessage ID: ${result.messageId}`);
  } else {
    console.error(`\n❌ FAILED: Could not send email: ${result.error}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error during send:', err);
  process.exit(1);
});
