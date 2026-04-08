const KEY='nexus_v143', CFG_KEY='nexus_cfg143', SESS='nexus_sess143', NSLOTS=3, DEF_K=2.5;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const DEF_CFG={
  goldBase:110,goldPerLv:55,goldUpset:50,lootChance:35,
  xpBase:60,xpPerLv:22,shopBase:25,shopScale:1.5,
  itemLvScale:118,itemAtk:10,itemDef:5,itemHp:35,
  enemyBase:70,enemyEliteLv:6,enemyEliteScale:110,
  enemyHp:1000,enemyAtk:45,enemyDef:50,enemyMaxOffset:15,
  gcdMs:1500,swingMs:2000,energyMax:100,energyRegen:15,
  intentMs:1400,interruptMs:1400,
  eHvy:25,eStn:25,eBlk:15,eFo:30,eRa:30,ePo:35,
  eMend:0,eEx:35,eBs:30,eEv:20,eSb:25,eTa:20,eGu:25,
  eBerserk:30,eBleedAtk:20,eExpAtk:25,eInt:30,
  cdHvy:7.5,cdStn:7.5,cdBlk:5,cdFo:12.5,cdRa:12.5,cdPo:12.5,
  cdMend:12.5,cdEx:10,cdBs:10,cdEv:7.5,cdSb:7.5,cdTa:10,cdGu:10,cdBerserk:12.5,
  cdBleedAtk:7.5,cdExpAtk:7.5,interruptCd:15.0,
  // CRIT NERF: standard is 1.4x, Slayer is 1.8x.
  multHvy:110,multEx:250,multExNorm:100,multStn:70,
  multBs:150,multSbash:60,multCrit:100,multSlayerCrit:180,multPalBlock:300,
};

const BD={
  fortify: {id:'fortify', name:'FORTIFY', icon:'🔷', type:'buff',   def:0.40, res:0.20},
  rally:   {id:'rally',   name:'RALLY',   icon:'⚡',  type:'buff',   atk:0.35, acc:0.15},
  berserk: {id:'berserk', name:'BERSERK', icon:'🔥', type:'buff',   atk:0.50, def:-0.20},
  regen:   {id:'regen',   name:'REGEN',   icon:'💚', type:'buff',   hot:true},
  enrage_b:{id:'enrage_b',name:'ENRAGED', icon:'🔥', type:'buff',   atk:0.30, def:-0.10},
  weaken:  {id:'weaken',  name:'WEAKEN',  icon:'💀', type:'debuff', atk:-0.35,acc:-0.20},
  slow:    {id:'slow',    name:'SLOW',    icon:'🐌', type:'debuff', eva:-0.40},
  bleed:   {id:'bleed',   name:'BLEED',   icon:'🩸', type:'debuff', dot:true},
  corrode: {id:'corrode', name:'CORRODE', icon:'🟤', type:'debuff', def:-0.35},
  expose:  {id:'expose',  name:'EXPOSE',  icon:'🎯', type:'debuff', def:-0.40,eva:-0.25},
  poison:  {id:'poison',  name:'POISON',  icon:'☠️', type:'debuff', dot:true},
  dispel:  {id:'dispel',  name:'DISPEL',  icon:'🌀', type:'debuff', clearBuffs:true},
};

const INTENTS={
  normal: {label:'Strike',              danger:false,col:'#64748b'},
  heavy:  {label:'💥 Heavy Strike ⚠️', danger:true, col:'#ef4444'},
  bash:   {label:'⚡ Bash ⚠️',          danger:true, col:'#f97316'},
  drain:  {label:'🩸 Life Drain',       danger:false,col:'#a855f7'},
  pierce: {label:'🗡️ Pierce ⚠️',        danger:true, col:'#ef4444'},
  weaken: {label:'💀 Weaken',           danger:false,col:'#a855f7'},
  corrode:{label:'🟤 Corrode',          danger:false,col:'#92400e'},
  bleed:  {label:'🩸 Bleed',            danger:false,col:'#ef4444'},
  regen:  {label:'💚 Regen',            danger:false,col:'#10b981'},
  rally:  {label:'⚡ Rally',            danger:false,col:'#f59e0b'},
  dispel: {label:'🌀 Dispel',           danger:false,col:'#818cf8'},
};

const LOADOUTS={
  Paladin:{row1:['hvy','stn','blk','fo'],row2:['mend','po','ra'],passive:'Holy Shield: Block absorbs 75% more · MEND free · +8% base DEF',passiveKey:'paladin',color:'#3b82f6',baseStats:{hp:380,atk:32,def:18},},
  // SLAYER TEXT UPDATED to reflect math
  Slayer:{row1:['execute','backstab','evade','bleed_atk'],row2:['berserk','po','ra'],passive:'Predator: Crits deal 1.8× · Execute 2.5× dmg below 30% HP · +10% base CRIT',passiveKey:'slayer',color:'#ef4444',baseStats:{hp:280,atk:50,def:11},},
  Warden:{row1:['shield_bash','taunt','guard','fo'],row2:['expose_atk','mend','po'],passive:'Iron Will: +12% base RES · Debuffs 35% shorter · +8% base DEF',passiveKey:'warden',color:'#94a3b8',baseStats:{hp:440,atk:26,def:24},},
};

const SKILLS={
  hvy:        {icon:'💢',label:'HEAVY',  cd:'h',  eCfg:'eHvy',     key:'1', offgcd:false},
  stn:        {icon:'✨',label:'STUN',   cd:'s',  eCfg:'eStn',     key:'2', offgcd:false},
  blk:        {icon:'🛡️',label:'BLOCK',  cd:'b',  eCfg:'eBlk',     key:'3', offgcd:false},
  execute:    {icon:'💀',label:'EXEC',   cd:'ex', eCfg:'eEx',      key:'1', offgcd:false},
  backstab:   {icon:'🗡️',label:'STAB',   cd:'bs', eCfg:'eBs',      key:'2', offgcd:false},
  evade:      {icon:'💨',label:'EVADE',  cd:'ev', eCfg:'eEv',      key:'3', offgcd:false},
  shield_bash:{icon:'🛡️',label:'SBASH',  cd:'sb', eCfg:'eSb',      key:'1', offgcd:false},
  taunt:      {icon:'😤',label:'TAUNT',  cd:'ta', eCfg:'eTa',      key:'2', offgcd:false},
  guard:      {icon:'🏰',label:'GUARD',  cd:'gu', eCfg:'eGu',      key:'3', offgcd:false},
  fo:         {icon:'🔷',label:'FORT',   cd:'fo', eCfg:'eFo',      key:'4', offgcd:false},
  ra:         {icon:'⚡',label:'RALLY',  cd:'ra', eCfg:'eRa',      key:'5', offgcd:false},
  po:         {icon:'☠️',label:'PSTN',   cd:'po', eCfg:'ePo',      key:'6', offgcd:false},
  mend:       {icon:'💚',label:'MEND',   cd:'mn', eCfg:'eMend',    key:'4', offgcd:false},
  berserk:    {icon:'🔥',label:'BERSRK', cd:'be', eCfg:'eBerserk', key:'4', offgcd:false},
  bleed_atk:  {icon:'🩸',label:'BLEED',  cd:'bl', eCfg:'eBleedAtk',key:'4', offgcd:false},
  expose_atk: {icon:'🎯',label:'EXPOSE', cd:'ep', eCfg:'eExpAtk',  key:'5', offgcd:false},
  interrupt:  {icon:'⚡',label:'INT',    cd:'int',eCfg:'eInt',     key:'I', offgcd:true},
  stance:     {icon:'🎭',label:'STANCE', cd:null, eCfg:null,       key:'S', offgcd:true},
};

const STAT_COL={atk:'var(--bad)',def:'var(--prim)',hp:'var(--good)',acc:'#67e8f9',eva:'#84cc16',res:'#a855f7',crit:'var(--warn)'};
const STAT_ICON={atk:'⚔️',def:'🛡️',hp:'❤️',acc:'🎯',eva:'💨',res:'🔮',crit:'💥'};
function statTag(s,val,suffix=''){return val?`<span class="stat-tag" style="color:${STAT_COL[s]}">${STAT_ICON[s]}${val}${suffix}</span>`:''}

const DEMO_SAVE = {
  p:{n:'Slayer',hp:280,atk:50,def:11,chp:210},
  lv:3,xp:80,xn:387,gd:340,tp:4,
  inv:[],eq:{
    Weapon:{n:'Rare Weapon',s:'Weapon',r:1,lv:2,upgrades:0,atk:22,def:0,hp:0,acc:0,eva:0,res:0,crit:3,val:55},
    Boots: {n:'Common Boots',s:'Boots', r:0,lv:1,upgrades:0,atk:0,def:0,hp:60,acc:0,eva:2,res:0,crit:0,val:30},
  },
  cds:{h:0,s:0,b:0,fo:0,ra:0,po:0,mn:0,ex:0,bs:0,ev:0,sb:0,ta:0,gu:0,be:0,bl:0,ep:0,int:0},
  auto:true,wins:4,losses:1,fightsSinceShopRefresh:1,
  train:{atk:1,def:0,hp:1,crit:1,acc:0,eva:1,res:0},
  history:[
    {result:'win',eLvl:2,ePre:'Swift',gold:230,turns:6,dps:42},
    {result:'win',eLvl:3,ePre:'Brutal',gold:285,turns:9,dps:38},
  ],
  totalDmgDealt:1840,totalDmgTaken:1120,totalGoldEarned:1650,
  pBuffs:[],energy:70,stance:'normal',interruptsHit:2,interruptsMissed:1,
  pSt:0, eSt:0, combat:false, enemy:null,
};
