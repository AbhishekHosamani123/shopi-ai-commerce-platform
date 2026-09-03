import 'dotenv/config';
import { sendOrderConfirmationEmail, OrderConfirmationEmailData } from './merchant-communication/order-confirmation-email';
import { bannerGeneratorService } from './banner-generator/banner-generator-service';
import { renderCampaignEmail } from './merchant-communication/email-templates';
import { GmailEmailProvider } from './merchant-communication/providers/gmail-provider';
import { OutboundMessagePayload } from './merchant-communication/communication-types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`✅ ${testName}: PASSED ${detail ? `(${detail})` : ''}`);
  } else {
    failed++;
    console.error(`❌ ${testName}: FAILED ${detail ? `(${detail})` : ''}`);
  }
}

async function runEndToEndVerification() {
  console.log('================================================================');
  console.log('🚀 RUNNING END-TO-END VERIFICATION OF SHOPPING & EMAIL FLOWS');
  console.log('================================================================\n');

  const testRecipient = process.env.EMAIL_TEST_RECIPIENT || 'abhishekhosamani522@gmail.com';

  // --------------------------------------------------------------------------
  // TEST 1: Customer Order Confirmation Email Delivery (Live Send via SMTP)
  // --------------------------------------------------------------------------
  console.log('--- 1. Testing Customer Order Confirmation Email Flow ---');
  const mockOrderData: OrderConfirmationEmailData = {
    customerName: 'Priya Sharma',
    customerEmail: testRecipient,
    orderId: 90214,
    orderIds: [90214],
    items: [
      {
        productId: 1,
        title: 'Premium Handcrafted Leather Oxford (Brown / Size 9)',
        imageUrl: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=160&auto=format&fit=crop&q=80',
        quantity: 1,
        unitPrice: 2799,
        colorName: 'Brown',
        sizeName: '9'
      },
      {
        productId: 3,
        title: 'Slim Fit Pure Linen Casual Shirt (Sky Blue / Size M)',
        imageUrl: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=160&auto=format&fit=crop&q=80',
        quantity: 2,
        unitPrice: 1499,
        colorName: 'Sky Blue',
        sizeName: 'M'
      }
    ],
    totalAmount: 5896,
    shippingCharge: 99,
    trackingNumber: 'IN-90214',
    carrier: 'Shopi Express Logistics',
    shippingMethod: 'Express Delivery (3–5 Business Days)',
    address: {
      fullName: 'Priya Sharma',
      line1: 'Flat 402, Palm Heights Residency',
      line2: '100ft Inner Ring Road, Koramangala',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560034',
      country: 'India',
      phone: '+91 98765 43210'
    },
    storefrontUrl: 'https://shopi-ai-commerce-platform-shop-two.vercel.app'
  };

  const orderEmailResult = await sendOrderConfirmationEmail(mockOrderData);
  assert(
    orderEmailResult.sent === true && Boolean(orderEmailResult.messageId),
    '1. Order Confirmation Email Sent Successfully via SMTP',
    `MessageID: ${orderEmailResult.messageId}`
  );

  // --------------------------------------------------------------------------
  // TEST 2: Personalized Campaign Banner Generation Across Supported Rates
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Testing Personalized Campaign Banner Generator ---');
  const discountTests = [10, 15, 25, 30, 50];
  let allBannersValid = true;

  for (const discount of discountTests) {
    const banner = await bannerGeneratorService.generateCampaignBanner(
      'Abhishek',
      discount,
      `${discount}% OFF`
    );
    if (!banner.ok || !banner.cid || !banner.content || banner.content.length === 0) {
      allBannersValid = false;
      console.error(`Banner generation failed for ${discount}%:`, banner.error);
    }
  }

  assert(
    allBannersValid,
    '2. Personalized AI Campaign Banners Generated for all Discount Tiers',
    `Verified tiers: ${discountTests.map(d => `${d}%`).join(', ')}`
  );

  // --------------------------------------------------------------------------
  // TEST 3: Campaign Promotional Email with Inline CID Banner Attachment
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Testing Merchant AI Campaign Email Execution & Delivery ---');
  const sampleBanner = await bannerGeneratorService.generateCampaignBanner(
    'Abhishek',
    25,
    '25% OFF'
  );

  assert(
    sampleBanner.ok && Boolean(sampleBanner.content),
    '3a. 25% Campaign Banner Asset Generated & CID Created',
    `CID: ${sampleBanner.cid}, Size: ${sampleBanner.content?.length} bytes`
  );

  const renderedCampaign = renderCampaignEmail({
    customerName: 'Abhishek',
    subject: 'Special 25% VIP Offer: Handcrafted Leather Shoes',
    headline: 'Exclusive 25% VIP Reward on Handcrafted Shoes',
    personalizedMessage: 'We noticed you were browsing our formal shoes collection. Complete your style upgrade today with a special 25% discount reserved for you!',
    bannerImage: sampleBanner.cid ? `cid:${sampleBanner.cid}` : null,
    offer: {
      type: 'percentage',
      value: 25,
      displayText: '25% OFF'
    },
    product: {
      title: 'Classic Formal Oxford Shoe (Brown)',
      originalPrice: 3499,
      discountedPrice: 2624,
      imageUrl: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=500&auto=format&fit=crop&q=80'
    },
    coupon: {
      code: 'VIPSHOES25'
    },
    ctaText: 'Claim Your 25% Discount',
    ctaUrl: 'https://shopi-ai-commerce-platform-shop-two.vercel.app/products/1',
    isTestSend: false,
    supportEmail: 'support@shopi.store'
  });

  assert(
    renderedCampaign.html.includes(sampleBanner.cid || 'cid:') && renderedCampaign.html.includes('VIPSHOES25'),
    '3b. HTML Campaign Email Rendered with Inline CID Image and Offer Details',
    'HTML and text representations verified'
  );

  // --------------------------------------------------------------------------
  // TEST 4: Dispatch Promotional Campaign Email via Gmail Provider
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Testing Live Campaign Email Dispatch via Gmail Provider ---');
  const gmailProvider = new GmailEmailProvider();

  const campaignPayload: OutboundMessagePayload = {
    messageId: `msg_campaign_verify_${Date.now()}`,
    merchantId: 'default_merchant',
    campaignId: 'camp_vip_oxford_25',
    customerId: 680,
    channel: 'EMAIL',
    recipient: testRecipient,
    subject: '🌟 Special 25% VIP Offer: Handcrafted Leather Shoes Just for You!',
    textBody: renderedCampaign.text,
    htmlBody: renderedCampaign.html,
    campaignVersion: 1,
    idempotencyKey: `idemp_verify_${Date.now()}`,
    attribution: {
      campaignId: 'camp_vip_oxford_25',
      customerId: 680,
      trackingId: `trk_${Date.now()}`,
      utmSource: 'merchant_ai',
      utmMedium: 'email',
      utmCampaign: 'camp_vip_oxford_25'
    },
    inlineAttachments: sampleBanner.ok && sampleBanner.cid && sampleBanner.content ? [
      {
        cid: sampleBanner.cid,
        filename: sampleBanner.filename,
        contentType: 'image/png',
        content: sampleBanner.content
      }
    ] : undefined
  };

  const campaignSendResult = await gmailProvider.send(campaignPayload);

  assert(
    campaignSendResult.success === true && campaignSendResult.status === 'SENT',
    '4. Merchant AI Campaign Email Successfully Dispatched to Recipient with Embedded Banner',
    `Provider: ${campaignSendResult.provider}, MessageId: ${campaignSendResult.providerMessageId}`
  );

  console.log('\n================================================================');
  console.log(`📊 FINAL RESULTS: ${passed} PASSED | ${failed} FAILED (${Math.round((passed / (passed + failed)) * 100)}%)`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runEndToEndVerification().catch((err) => {
  console.error('Verification error:', err);
  process.exit(1);
});
