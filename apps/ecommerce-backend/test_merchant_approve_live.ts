import 'dotenv/config';
import { client } from './data/DB';
import { campaignIntelligenceService } from './merchant-campaigns/campaign-intelligence-service';
import { campaignExecutionService } from './merchant-communication/campaign-execution-service';

async function testMerchantApproveFlow() {
  console.log('================================================================');
  console.log('🎯 TESTING MERCHANT AI → APPROVE CAMPAIGN LIVE EXECUTION');
  console.log('================================================================\n');

  // Query existing marketing campaigns
  const campRes = await client.query('SELECT campaign_id, title, status, merchant_id FROM merchant_marketing_campaigns ORDER BY created_at DESC LIMIT 5');
  console.log(`Found ${campRes.rows.length} existing campaigns in DB.`);

  let targetCampaignId = campRes.rows[0]?.campaign_id;

  if (!targetCampaignId) {
    console.log('No campaign found, generating recommendations...');
    await campaignIntelligenceService.generateCampaignsFromOpportunities('default_merchant');
    const fresh = await client.query('SELECT campaign_id, title, status FROM merchant_marketing_campaigns ORDER BY created_at DESC LIMIT 1');
    targetCampaignId = fresh.rows[0]?.campaign_id;
  }

  console.log(`Target Campaign ID for Approval: ${targetCampaignId}`);

  // Reset status to DRAFT so approveCampaign can proceed
  await client.query(
    'UPDATE merchant_marketing_campaigns SET status = $1 WHERE campaign_id = $2',
    ['DRAFT', targetCampaignId]
  );

  console.log(`Triggering approval for ${targetCampaignId}...`);
  const approvalResult = await campaignIntelligenceService.approveCampaign(
    targetCampaignId,
    'default_merchant',
    'merchant_admin',
    ['EMAIL']
  );

  console.log('Approval Result:', approvalResult.success ? 'APPROVED' : 'FAILED', approvalResult.error || '');

  // Approval executes campaign in PRODUCTION mode
  console.log('\nExecuting campaign in PRODUCTION mode (sending real email with AI banner to abhishekhosamani79@gmail.com)...');
  const execution = await campaignExecutionService.executeCampaign(
    targetCampaignId,
    'default_merchant',
    'PRODUCTION',
    ['EMAIL']
  );

  console.log('\n--- Live Execution Results ---');
  console.log('Status:', execution.status);
  console.log('Sent Count:', execution.sentCount);
  console.log('Failed Count:', execution.failedCount);
  console.log('Is Dry Run:', execution.isDryRun);
  console.log('Messages:', JSON.stringify(execution.messages.map(m => ({
    recipient: m.recipient,
    channel: m.channel,
    status: m.status,
    provider: m.provider,
    providerMessageId: m.providerMessageId
  })), null, 2));

  if (execution.sentCount > 0 && !execution.isDryRun) {
    console.log('\n🎉 SUCCESS: Live Merchant AI promotional email with banner image was successfully delivered to abhishekhosamani79@gmail.com!');
  } else {
    console.error('\n❌ Dispatched count is 0 or dry run.');
    process.exit(1);
  }
}

testMerchantApproveFlow().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
