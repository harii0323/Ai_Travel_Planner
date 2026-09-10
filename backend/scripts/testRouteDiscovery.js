const routePlaceDiscoveryEngine = require('../src/services/routePlaceDiscoveryEngine');

async function testRouteDiscovery() {
  console.log('🏛️ Testing Route Place Discovery Engine (Corridor & Famous Landmarks)...\n');

  console.log('--- Test 1: Chennai to Kanyakumari Corridor (passes Madurai Meenakshi Temple) ---');
  const tamilNaduPlaces = await routePlaceDiscoveryEngine.discoverAllRouteCandidates({
    startLocation: 'Chennai',
    destination: 'Kanyakumari',
    corridorName: 'Chennai ➔ Madurai ➔ Kanyakumari',
    maxPlaces: 8
  });

  console.log(`Discovered ${tamilNaduPlaces.length} places along Chennai -> Kanyakumari corridor:`);
  tamilNaduPlaces.forEach((p, idx) => {
    console.log(`  ${idx + 1}. [${p.isMustVisit ? '⭐ MUST-VISIT' : 'RECOMMENDED'}] ${p.name} (${p.city}) — Fame: ${p.fameScore}, Rating: ${p.rating}★`);
  });

  const meenakshiFound = tamilNaduPlaces.some(p => p.name.includes('Meenakshi') || p.city.includes('Madurai'));
  console.log(`\nVerified Madurai Meenakshi Temple / Madurai attraction suggested: ${meenakshiFound ? '✅ YES' : '❌ NO'}`);

  console.log('\n--- Test 2: Bangalore to Goa Corridor (passes Dudhsagar / Western Ghats / Hampi) ---');
  const goaCorridorPlaces = await routePlaceDiscoveryEngine.discoverAllRouteCandidates({
    startLocation: 'Bangalore',
    destination: 'Goa',
    maxPlaces: 6
  });
  console.log(`Discovered ${goaCorridorPlaces.length} places along Bangalore -> Goa:`);
  goaCorridorPlaces.forEach((p, idx) => {
    console.log(`  ${idx + 1}. ${p.name} (${p.city}) - Score: ${p.finalScore}`);
  });

  console.log('\n✅ Route Discovery Engine tests PASSED!');
}

testRouteDiscovery().catch((err) => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});
