function calculateScore(finalState) {
  const entities = finalState.entities || [];
  const aliveEntities = entities.filter(e => e.status !== 'dead' && e.quantity > 0);
  
  // 1. Biodiversity (max 40)
  const uniqueSpecies = new Set(aliveEntities.map(e => e.type)).size;
  let diversity = 0;
  if (uniqueSpecies >= 10) diversity = 40;
  else if (uniqueSpecies >= 7) diversity = 30;
  else if (uniqueSpecies >= 4) diversity = 20;
  else if (uniqueSpecies >= 1) diversity = 10;
  
  // 2. Ecological balance (max 30)
  let balance = 0;
  
  // 2a. Food chain completeness (max 10)
  const plantTypes = ['sprout', 'grass', 'grass_turf', 'herb', 'flower', 'bush', 'mushroom', 'clover'];
  const herbivoreTypes = ['mouse', 'caterpillar', 'snail'];
  const predatorTypes = ['bird', 'spider', 'frog'];
  const hasPlant = aliveEntities.some(e => plantTypes.includes(e.type));
  const hasHerbivore = aliveEntities.some(e => herbivoreTypes.includes(e.type));
  const hasPredator = aliveEntities.some(e => predatorTypes.includes(e.type));
  if (hasPlant && hasHerbivore && hasPredator) balance += 10;
  else if (hasPlant && (hasHerbivore || hasPredator)) balance += 6;
  else if (hasPlant) balance += 2;
  
  // 2b. Environment balance (max 10)
  const env = finalState.environment || {};
  let envScore = 10;
  if (env.sunlight < 3 || env.sunlight > 7) envScore -= 3;
  if (env.humidity < 3 || env.humidity > 7) envScore -= 3;
  if (env.fertility < 3 || env.fertility > 7) envScore -= 3;
  balance += Math.max(0, envScore);
  
  // 2c. Plant coverage (max 10)
  const plantQuantity = aliveEntities
    .filter(e => plantTypes.includes(e.type))
    .reduce((sum, e) => sum + e.quantity, 0);
  const coverageRatio = plantQuantity / (12 * 8); // grid = 96 cells
  balance += Math.min(10, Math.round(coverageRatio / 0.3 * 10));
  
  // 3. Survival resilience (max 20)
  let resilience = 0;
  if (aliveEntities.length > 0 && finalState.day >= 20) resilience += 10;
  else if (aliveEntities.length > 0) resilience += Math.round(finalState.day / 2);
  // Winter survival bonus
  if (finalState.day >= 20) {
    const winterSpecies = new Set(aliveEntities.map(e => e.type)).size;
    if (winterSpecies >= 3) resilience += 10;
    else if (winterSpecies >= 1) resilience += 5;
  }
  
  const total = diversity + balance + resilience;
  
  return { total, diversity: uniqueSpecies, diversityScore: diversity, balance, resilience };
}

module.exports = { calculateScore };
