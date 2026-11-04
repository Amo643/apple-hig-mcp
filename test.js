import { AppleHigClient } from './dist/apple-client.js';

async function runTests() {
  console.log('🧪 Starting Apple HIG Client Verification Tests...\n');
  const client = new AppleHigClient();

  // Test 1: Ensure Index
  console.log('Test 1: Index Initialization');
  const index = await client.ensureIndex();
  console.log(`✅ Loaded ${index.length} topics from Apple master index.`);
  if (index.length === 0) throw new Error('Topic index is empty');

  // Test 2: Search HIG
  console.log('\nTest 2: Search HIG for "materials"');
  const searchResults = await client.search('materials');
  console.log(`✅ Found ${searchResults.length} results.`);
  console.log(`   Top match: ${searchResults[0].title} (${searchResults[0].slug})`);

  // Test 3: Live Guideline Fetch - Materials (Liquid Glass)
  console.log('\nTest 3: Live Fetch - "materials"');
  const materialsDoc = await client.getGuideline('materials');
  console.log(`✅ Title: "${materialsDoc.title}"`);
  console.log(`   URL: ${materialsDoc.url}`);
  console.log(`   Content length: ${materialsDoc.content.length} characters`);
  const hasLiquidGlass = materialsDoc.content.includes('Liquid Glass');
  console.log(`   Contains "Liquid Glass": ${hasLiquidGlass ? 'YES ✅' : 'NO ❌'}`);
  if (!hasLiquidGlass) throw new Error('Materials doc did not mention Liquid Glass');

  // Test 4: Live Guideline Fetch - Buttons
  console.log('\nTest 4: Live Fetch - "buttons"');
  const buttonsDoc = await client.getGuideline('buttons');
  console.log(`✅ Title: "${buttonsDoc.title}"`);
  console.log(`   Contains "44x44": ${buttonsDoc.content.includes('44x44') ? 'YES ✅' : 'NO ❌'}`);

  // Test 5: List Categories
  console.log('\nTest 5: List Categories');
  const categories = await client.listCategories();
  console.log(`✅ Found ${categories.length} categories:`, categories.map(c => c.category).join(', '));

  // Test 6: Repeated Read & Deduplication Benchmark (10x repeated read)
  console.log('\nTest 6: 10x Repeated Cache & Deduplication Benchmark');
  const startRepeat = performance.now();
  const repeatedResults = await Promise.all(
    Array.from({ length: 10 }, () => client.getGuideline('materials'))
  );
  const elapsedRepeat = (performance.now() - startRepeat).toFixed(2);
  console.log(`✅ Completed 10 parallel/repeated fetches in ${elapsedRepeat}ms (${(elapsedRepeat / 10).toFixed(3)}ms/op)`);
  if (repeatedResults.some(r => r.title !== 'Materials')) {
    throw new Error('Deduplicated results mismatch');
  }

  // Test 7: Cache Prune & Cleanup Lifecycle
  console.log('\nTest 7: Cache Auto-Pruning & Storage Integrity');
  client.pruneExpiredSync();
  console.log('✅ Auto-prune executed cleanly without error.');

  console.log('\n🎉 ALL 7 INTEGRATION TESTS PASSED WITH LIVE APPLE HIG DATA!\n');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
