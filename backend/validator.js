function validateAndFix(newState, oldState) {
  const result = { ...newState };
  
  // 1. Field completeness
  if (!result.day) result.day = oldState.day + 1;
  if (!result.season) result.season = oldState.season;
  if (!result.entities || !Array.isArray(result.entities)) result.entities = oldState.entities || [];
  if (!result.log) result.log = '今天很平静。';
  if (!result.events || !Array.isArray(result.events)) result.events = [];
  
  // 2. Environment parameter ranges
  if (result.environment) {
    result.environment.sunlight = Math.max(0, Math.min(10, result.environment.sunlight ?? 5));
    result.environment.humidity = Math.max(0, Math.min(10, result.environment.humidity ?? 5));
    result.environment.fertility = Math.max(0, Math.min(10, result.environment.fertility ?? 5));
    result.environment.temperature = result.environment.temperature ?? oldState.environment.temperature;
  } else {
    result.environment = { ...oldState.environment };
  }

  // 3. Remove entities with quantity <= 0
  result.entities = result.entities.filter(e => e.quantity > 0);

  // 4. Correct season based on day (5 days per season, 20 days total)
  if (result.day <= 5) result.season = 'spring';
  else if (result.day <= 10) result.season = 'summer';
  else if (result.day <= 15) result.season = 'autumn';
  else result.season = 'winter';

  return result;
}
module.exports = { validateAndFix };
