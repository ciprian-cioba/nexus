const DEF_K=2.5;

// Minimal setup - mimic config and constants
const testCfg = {
  multHvy:150, multEx:250, multExNorm:100, multStn:70, multBs:150, multSbash:60,
  multCrit:140, multSlayerCrit:180, multPalBlock:300,
  itemLvScale:118, itemAtk:10, itemDef:5, itemHp:35,
  swingMs:2000
};

// Test dummy configuration
function createDummy(lvl) {
  return {
    hp: 1000000, mhp: 1000000,
    atk: 0, def: 0, acc: 0, eva: 0, res: 0,
    buffs: [], isDummy: true, lv: lvl
  };
}

// Calculate damage like the game does
function calcDmg(atk, def, mult=1.0, resMult=1.0) {
  // Use average RNG (0.88 + 0.12 = 1.0, avg of 0.88 to 1.12 range)
  const raw = atk * mult * 1.0; // Average roll
  const red = def / (def + DEF_K * atk);
  return Math.max(1, Math.floor(raw * (1 - red) * resMult));
}

// Full DPS test for a character
function testDPS(heroName, lv, equipStats, duration = 30) {
  const results = {
    hero: heroName,
    level: lv,
    duration: duration,
    gear: equipStats,
    actions: [],
    totalDamage: 0,
    dps: 0
  };
  
  // Build character stats
  const baseStats = {
    'Paladin': { hp: 380, atk: 32, def: 21 },
    'Slayer': { hp: 280, atk: 50, def: 11 },
    'Warden': { hp: 320, atk: 38, def: 18 }
  };
  
  const base = baseStats[heroName] || baseStats.Paladin;
  const stats = {
    hp: base.hp + (lv-1)*40 + (equipStats.trainHp||0)*20,
    atk: base.atk + (lv-1)*6 + (equipStats.trainAtk||0)*2 + (equipStats.atk||0),
    def: base.def + (lv-1)*5 + (equipStats.trainDef||0)*2 + (equipStats.def||0),
    crit: Math.min(0.75, (heroName==='Slayer'?0.15:0.05) + (equipStats.trainCrit||0)*0.01 + (equipStats.crit||0)*0.01),
    acc: 0.92, eva: 0.05, res: 0.05
  };
  
  // Apply class passives
  if(heroName==='Warden') { stats.def = Math.floor(stats.def*1.08); stats.res = Math.min(0.65, stats.res+0.12); }
  if(heroName==='Paladin') { stats.def = Math.floor(stats.def*1.08); }
  
  const dummy = createDummy(lv);
  let swingCount = 0;
  let time = 0;
  
  // Simulate swings
  while(time < duration && dummy.hp > 0) {
    time += testCfg.swingMs / 1000;
    swingCount++;
    
    const isCrit = Math.random() < stats.crit;
    const critMult = (heroName==='Slayer'?testCfg.multSlayerCrit:testCfg.multCrit) / 100;
    const dmg = calcDmg(stats.atk, dummy.def, isCrit ? critMult : 1.0);
    
    dummy.hp -= dmg;
    results.totalDamage += dmg;
    results.actions.push({
      swing: swingCount,
      time: time.toFixed(2),
      damage: dmg,
      isCrit: isCrit
    });
  }
  
  results.dps = Math.round(results.totalDamage / time);
  results.actualDuration = time.toFixed(2);
  results.swings = swingCount;
  results.damagePerSwing = Math.round(results.totalDamage / swingCount);
  
  return results;
}

// Generate test configurations
function generateGearScenarios(lv) {
  return {
    'baseline': {
      name: 'Baseline (no gear, no training)',
      atk: 0, def: 0, crit: 0,
      trainAtk: 0, trainDef: 0, trainCrit: 0
    },
    'average': {
      name: 'Average Gear',
      atk: 50, def: 30, crit: 0.05,
      trainAtk: 5, trainDef: 3, trainCrit: 3
    },
    'full_gear': {
      name: 'Full Legendary Gear (BiS)',
      atk: 150, def: 80, crit: 0.20,
      trainAtk: 10, trainDef: 8, trainCrit: 8
    },
    'full_gear_max': {
      name: 'Max Training + Full Gear',
      atk: 180, def: 100, crit: 0.25,
      trainAtk: 20, trainDef: 20, trainCrit: 15
    }
  };
}

// Main test runner
function runFullTest() {
  const lv = 15;
  const scenarios = generateGearScenarios(lv);
  const heroes = ['Paladin', 'Slayer', 'Warden'];
  const allResults = [];
  
  console.log('\n=== NEXUS ARENA DPS TEST - LEVEL ' + lv + ' ===\n');
  
  heroes.forEach(hero => {
    console.log(`\n--- ${hero.toUpperCase()} ---`);
    Object.entries(scenarios).forEach(([key, config]) => {
      const result = testDPS(hero, lv, config, 40); // 40s test
      allResults.push(result);
      
      const ttk = (1000000 / (result.dps || 1)).toFixed(1);
      console.log(
        `[${config.name}] DPS: ${result.dps} | TTK: ~${ttk}s | Gear ATK: +${config.atk} | Crit: ${Math.round(config.crit*100)}%`
      );
    });
  });
  
  // Summary
  console.log('\n=== TARGET ANALYSIS ===');
  console.log('Goal TTK at LV15: ~40s');
  console.log('\nResults summary (avg DPS needed for 40s TTK = 25,000 DPS):\n');
  
  allResults.forEach(r => {
    const ttk = (1000000 / (r.dps || 1)).toFixed(1);
    const target = 40;
    const diff = (ttk - target).toFixed(1);
    const status = Math.abs(diff) < 3 ? '✓ GOOD' : Math.abs(diff) < 10 ? '~ OK' : '✗ NEEDS TUNING';
    console.log(
      `${r.hero.padEnd(10)} / ${r.gear.name.padEnd(30)} | DPS: ${String(r.dps).padStart(5)} | TTK: ${String(ttk).padStart(5)}s (${diff>0?'+':''} ${diff}) | ${status}`
    );
  });
  
  return allResults;
}

// Export for Node.js or run in browser
if(typeof module !== 'undefined' && module.exports) {
  module.exports = { testDPS, generateGearScenarios, runFullTest, calcDmg };
}

// Run test
runFullTest();