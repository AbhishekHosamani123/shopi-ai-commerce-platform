process.env.DB_NAME = 'render_seed_test';
process.env.DB_USER = 'postgres';
process.env.DB_PASS = '1234';
process.env.DB_HOST = 'localhost';
// Force connectDB to run the full path
import('./data/DB').then(async ({ connectDB }) => {
  const t0 = Date.now();
  await connectDB();
  console.log('connectDB finished in', ((Date.now()-t0)/1000).toFixed(1), 's (seed runs in background)');
  // Wait for background seed to complete
  const { client } = await import('./data/DB');
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 10000));
    try {
      const r = await client.query("SELECT to_regclass('public.shopi_orders') as t, (SELECT COUNT(*) FROM shopi_orders) as n");
      if (r.rows[0]?.t) {
        console.log(`after ${(i+1)*10}s: shopi_orders EXISTS with ${r.rows[0].n} rows`);
        if (parseInt(r.rows[0].n) > 0) { console.log('SEED COMPLETE ✓'); process.exit(0); }
      } else {
        console.log(`after ${(i+1)*10}s: shopi_orders still missing`);
      }
    } catch (e) { console.log(`after ${(i+1)*10}s: ${e.message.slice(0,60)}`); }
  }
  console.log('TIMEOUT — seed did not complete in 10 min');
  process.exit(1);
});
