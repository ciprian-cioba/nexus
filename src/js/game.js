class Arena {
  constructor(){
    this.slots=['Weapon','Armor','Shield','Helm','Ring','Boots','Gloves','Relic'];
    this.rarity=[{n:'Common',c:'#94a3b8',m:1.0},{n:'Rare',c:'#3b82f6',m:1.5},{n:'Epic',c:'#a855f7',m:2.2},{n:'Legend',c:'#f59e0b',m:3.5}];
    this.prefixes=[
      {n:'Swift',atk:1.15,def:0.85,hp:0.95,color:'#10b981'},
      {n:'Brutal',atk:1.45,def:0.75,hp:1.00,color:'#ef4444'},
      {n:'Goliath',atk:0.80,def:1.70,hp:1.55,color:'#94a3b8'},
      {n:'Cursed',atk:1.25,def:1.20,hp:1.60,color:'#a855f7'},
      {n:'Venom',atk:1.30,def:1.00,hp:1.10,color:'#84cc16'},
      {n:'Arcane',atk:1.20,def:1.30,hp:0.90,color:'#67e8f9'},
    ];
    // CRIT TRAINING NERF: max 15%, cost scaled up slightly.
    this.trainDefs=[
      {id:'atk', label:'⚔️ Attack',   perLv:4,  baseCost:1,costMult:1.22,maxLv:20},
      {id:'def', label:'🛡️ Defense',  perLv:3,  baseCost:1,costMult:1.22,maxLv:20},
      {id:'hp',  label:'❤️ Vitality', perLv:30, baseCost:1,costMult:1.18,maxLv:20},
      {id:'crit',label:'💥 Crit %',   perLv:1,  baseCost:2,costMult:1.35,maxLv:15},
      {id:'acc', label:'🎯 Accuracy', perLv:2,  baseCost:1,costMult:1.22,maxLv:13},
      {id:'eva', label:'💨 Evasion',  perLv:2,  baseCost:1,costMult:1.22,maxLv:20},
      {id:'res', label:'🔮 Resist',   perLv:2,  baseCost:1,costMult:1.25,maxLv:20},
    ];

    this.cfg=this._loadCfg();
    this.meta=this._loadMeta();
    this.activeSlot=this.meta.activeSlot||0;
    
    // Auto-migrate saves
    for(let i=0; i<NSLOTS; i++) {
        let oldSave = localStorage.getItem('nexus_v142_s'+i);
        if(oldSave && !localStorage.getItem(KEY+'_s'+i)) {
            localStorage.setItem(KEY+'_s'+i, oldSave);
        }
    }

    this.saves=Array.from({length:NSLOTS},(_,i)=>this._loadSlot(i));
    this.state=this.saves[this.activeSlot];
    this.sess=this._loadSess();

    this.stock=[];
    this.logData=[];
    this._lootPend=null;
    this._fightCooldown=0;
    
    this._ticker=null;
    this._lastTick=0;
    this._dotAccumulator=0;
    this._swingInterval=null;
    this._aiTimer=null;
    this._pDR = { count: 0, lastStun: 0 };
    this._eDR = { count: 0, lastStun: 0 };

    this.gcd={active:false,timer:null,queued:null};
    this.intCd=0;
    this.intWindowOpen=false;
    this._intResolve=null;
    this._intTimer=null;
    this._executing=false;

    this.pDps=[];this.eDps=[];this.fightStart=0;

    this._bindKeys();
    this.init();
  }

  _loadMeta() {try{return JSON.parse(localStorage.getItem(KEY+'_meta')||'{}');}catch(e){return{};}}
  _saveMeta() {localStorage.setItem(KEY+'_meta',JSON.stringify({activeSlot:this.activeSlot}));}
  _loadSlot(i){try{const s=localStorage.getItem(KEY+'_s'+i);if(s)return JSON.parse(s);}catch(e){} return null;}
  _saveSlot(i,d){localStorage.setItem(KEY+'_s'+i,JSON.stringify(d));}
  _deleteSlot(i){localStorage.removeItem(KEY+'_s'+i);this.saves[i]=null;}
  _loadSess() {try{return JSON.parse(sessionStorage.getItem(SESS)||'{}');}catch(e){return{};}}
  _saveSess() {sessionStorage.setItem(SESS,JSON.stringify(this.sess));}
  _loadCfg()  {
    try{const s=JSON.parse(localStorage.getItem(CFG_KEY)||'{}');const o={...DEF_CFG};Object.keys(s).forEach(k=>{if(k in DEF_CFG)o[k]=s[k];});return o;}
    catch(e){return{...DEF_CFG};}
  }
  _saveCfg(){localStorage.setItem(CFG_KEY,JSON.stringify(this.cfg));}

  _newSave(){
    const CDS={h:0,s:0,b:0,fo:0,ra:0,po:0,mn:0,ex:0,bs:0,ev:0,sb:0,ta:0,gu:0,be:0,bl:0,ep:0,int:0};
    return{p:null,lv:1,xp:0,xn:200,gd:150,tp:0,inv:[],eq:{},cds:{...CDS},
      auto:false,wins:0,losses:0,fightsSinceShopRefresh:0,
      train:{atk:0,def:0,hp:0,crit:0,acc:0,eva:0,res:0},
      history:[],totalDmgDealt:0,totalDmgTaken:0,totalGoldEarned:0,
      pBuffs:[],energy:100,stance:'normal',interruptsHit:0,interruptsMissed:0,
      pSt:0, eSt:0};
  }

  save(){this._saveSlot(this.activeSlot,this.state);this._saveMeta();}
  reset(){if(confirm('Delete this character?')){this._deleteSlot(this.activeSlot);location.reload();}}

  init(){
    if(!this.state){this.state=this._newSave();this.saves[this.activeSlot]=this.state;}
    const st=this.state;

    // CRIT TRAINING SQUISH: Smoothly downscale legacy massive crit training to new 15 max cap
    if(st.p && !st.squished_crit_v143) {
        if(st.train.crit > 15) {
            st.train.crit = 15;
            this.log('⚙️ Applied V143 Crit Squish to Training.','info');
        }
        st.squished_crit_v143=true;
        this.save();
    }

    if(st.energy===undefined)st.energy=this.cfg.energyMax;
    if(st.stance===undefined)st.stance='normal';
    if(st.pSt===undefined)st.pSt=0;
    if(st.eSt===undefined)st.eSt=0;
    if(!st.cds.int)st.cds.int=0;
    if(!st.cds.ex)st.cds={...this._newSave().cds,...st.cds};
    if(st.fightsSinceShopRefresh===undefined)st.fightsSinceShopRefresh=0;
    
    if(st.combat){
      st.combat=false;st.enemy=null;st.pBuffs=[];
      st.pSt=0; st.eSt=0; st.pShield=st.pEvading=st.pImmune=false;
    }
    if(st.p){this.show();this._initShop();}
    else this.renderHeroPick();
    this._updateBadge();
    if(st.p) this._setCombatLayout(false);
  }

  show(){
    document.getElementById('hero-pick').classList.add('hidden');
    document.getElementById('game-ui').classList.remove('hidden');
    this._setCombatLayout(false);
    this.render();
  }

  _updateBadge(){const b=document.getElementById('char-badge');if(b)b.innerText='P'+(this.activeSlot+1);}

  _setCombatLayout(inCombat){
    const tabs=document.getElementById('main-tabs');
    const tc=document.getElementById('tab-content');
    const gcd=document.getElementById('gcd-area');
    const sw=document.getElementById('swing-wrap');
    const fb=document.getElementById('fight-bar');
    const sa=document.getElementById('skill-area');
    if(inCombat){
      tabs.classList.add('hidden');tc.classList.add('hidden');
      gcd.classList.add('on');if(sw)sw.classList.add('on');
      fb.classList.remove('on');sa.classList.add('on');
      document.getElementById('queue-box').classList.add('on');
    }else{
      tabs.classList.remove('hidden');tc.classList.remove('hidden');
      gcd.classList.remove('on');if(sw)sw.classList.remove('on');
      fb.classList.add('on');sa.classList.remove('on');
      document.getElementById('queue-box').classList.remove('on');
    }
  }

  _startTicker() {
    this._lastTick = performance.now();
    this._dotAccumulator = 0;
    
    if(this._ticker) clearInterval(this._ticker);
    
    this._ticker = setInterval(() => {
      if(!this.state.combat) {
        clearInterval(this._ticker);
        return;
      }
      
      const now = performance.now();
      const dt = now - this._lastTick;
      this._lastTick = now;
      
      this._tickCombat(dt);
    }, 100);
  }

  _tickCombat(dt) {
    const st = this.state;
    const dtSec = dt / 1000;

    this._tickStuns(dtSec);
    if(st.pSt > 0) return;

    const regenPerSec = this.cfg.energyRegen / 2.5; 
    st.energy = Math.min(this.cfg.energyMax, st.energy + (regenPerSec * dtSec));

    Object.keys(st.cds).forEach(k => {
      if(st.cds[k] > 0) st.cds[k] = Math.max(0, st.cds[k] - dtSec);
    });
    if(this.intCd > 0) this.intCd = Math.max(0, this.intCd - dtSec);

    this._tickBuffsRealTime('p', dtSec);
    this._tickBuffsRealTime('e', dtSec);

    this._dotAccumulator += dt;
    if(this._dotAccumulator >= 2000) {
      if(st.enemy) this.applyDoTs('p', st.enemy.atk);
      this.applyDoTs('e', this.getStats().atk);
      this.applyHoTs('p');
      this.applyHoTs('e');
      this._dotAccumulator -= 2000;
      
      if(st.p.chp <= 0) this.lose();
      else if(st.enemy && st.enemy.hp <= 0) this.win();
    }

    this.renderSkillBar();
    this._updateEnergyUI();
    this._updateDpsLive();
    this.renderCardsOnly();
  }

  _tickBuffsRealTime(target, dtSec) {
    const arr = target === 'p' ? this.state.pBuffs : this.state.enemy?.buffs;
    if(!arr) return;
    for(let i = arr.length - 1; i >= 0; i--) {
      arr[i].turns -= (dtSec / 2.5);
      if(arr[i].turns <= 0) {
        const d = BD[arr[i].id];
        if(d) this.log(`${target === 'p' ? '👤' : '👹'} ${d.icon}${d.name} expired`, 'info');
        arr.splice(i, 1);
      }
    }
  }

  _updateEnergyUI() {
    const enFill = document.getElementById('en-f');
    if(enFill) enFill.style.width = (this.state.energy / this.cfg.energyMax * 100) + '%';
    const regenPerSec = (this.cfg.energyRegen / 2.5).toFixed(1);
    const enLbl = document.getElementById('en-regen-lbl');
    if(enLbl) enLbl.innerText = `+${regenPerSec}/s`;
  }

  _applyStun(target, baseDurationSec) {
    const drState = target === 'p' ? this._pDR : this._eDR;
    const now = performance.now();
    
    if(now - drState.lastStun > 18000) drState.count = 0;
    
    let duration = baseDurationSec;
    if(drState.count === 1) duration *= 0.50;
    else if(drState.count === 2) duration *= 0.25;
    else if(drState.count >= 3) duration = 0; 

    if(duration > 0) {
      if(target === 'p') {
        this.state.pSt = duration;
        this.updateHud('p', `💤 STUNNED (${duration.toFixed(1)}s)`);
      } else {
        this.state.eSt = duration;
        this.updateHud('e', `💤 STUNNED (${duration.toFixed(1)}s)`);
      }
      drState.count++;
      drState.lastStun = now;
    } else {
      this.updateHud(target, '🛡️ IMMUNE (DR)');
    }
  }

  _tickStuns(dtSec) {
    if(this.state.pSt > 0) {
      this.state.pSt -= dtSec;
      if(this.state.pSt <= 0) { this.state.pSt = 0; this.state.pImmune = true; } 
    }
    if(this.state.eSt > 0) {
      this.state.eSt -= dtSec;
      if(this.state.eSt <= 0) this.state.eSt = 0;
    }
  }

  openSaveMenu(){
    if(this.state?.p)this.save();
    const inCombat=this.state?.combat;
    let body=`<div style="font-size:0.60rem;color:#555;margin-bottom:9px">${inCombat?'⚠️ Switching during combat counts as a loss.':'Auto-saved. Switch or create characters.'}</div>`;
    for(let i=0;i<NSLOTS;i++){
      const s=this.saves[i],isA=i===this.activeSlot,isEmpty=!s||!s.p;
      const sum=isEmpty?'<small style="color:#333">Empty slot</small>'
        :`<small style="color:#555">${s.p.n} · LV${s.lv} · ${s.wins}W/${s.losses}L · 🏆${s.tp}</small>`;
      body+=`<div class="save-slot${isA?' active-slot':''}">
        <div class="save-slot-info"><b style="color:${isA?'var(--warn)':'var(--txt)'}">Slot ${i+1}${isA?' ◀':''}</b>${sum}</div>
        <div class="slot-btns">
          ${isEmpty?`<button class="slot-btn" style="background:var(--prim);color:#fff" onclick="G.switchSlot(${i})">NEW</button>`
            :isA?`<button class="slot-btn" style="background:#111;color:#333" disabled>ACTIVE</button>`
            :`<button class="slot-btn" style="background:${inCombat?'var(--warn)':'var(--good)'};color:#000" onclick="G.switchSlot(${i})">${inCombat?'RESCUE':'LOAD'}</button>`}
          ${!isEmpty&&!isA?`<button class="slot-btn" style="background:var(--bad);color:#fff" onclick="G.deleteSlot(${i})">DEL</button>`:''}
        </div>
      </div>`;
    }
    this.showModal('💾 CHARACTERS',body,[{label:'CLOSE',cls:'',fn:()=>this.closeModal()}]);
  }

  switchSlot(i){
    const st=this.state;
    if(st.combat){
      st.losses++;st.history.push({result:'loss',eLvl:st.enemy?.lv||0,ePre:st.enemy?.pre||'?',gold:0,turns:0,dps:0});
      this._cleanupCombatTimers();
      st.combat=false;st.enemy=null;st.pBuffs=[];
      const s=this.getStats();st.p.chp=Math.floor(s.hp*0.08);
    }
    this._saveSlot(this.activeSlot,st);
    this.activeSlot=i;
    localStorage.setItem(KEY+'_meta',JSON.stringify({activeSlot:i}));
    location.reload();
  }

  deleteSlot(i){if(!confirm('Delete permanently?'))return;this._deleteSlot(i);this.openSaveMenu();}

  openEditor(){
    const c=this.cfg;
    const row=(lbl,key,min,max,step=1)=>`<div class="ed-row">
      <span class="ed-lbl">${lbl}</span>
      <div class="ed-ctrl">
        <input class="ed-range" type="range" min="${min}" max="${max}" step="${step}" value="${c[key]}"
          oninput="G.cfgSet('${key}',+this.value,this.nextElementSibling)">
        <input class="ed-input" type="number" min="${min}" max="${max}" step="${step}" value="${c[key]}"
          onchange="G.cfgSet('${key}',+this.value,null)">
      </div></div>`;
    const body=`
      <div class="ed-section"><h4>💰 Economy</h4>
        ${row('Gold base','goldBase',50,400)}${row('Gold per enemy LV','goldPerLv',10,150)}
        ${row('Loot chance %','lootChance',5,80)}${row('Shop base cost','shopBase',10,100)}
      </div>
      <div class="ed-section"><h4>⏱️ Cooldowns (seconds)</h4>
        ${row('Heavy','cdHvy',2.5,20,0.5)}${row('Stun','cdStn',2.5,20,0.5)}${row('Block','cdBlk',2.5,15,0.5)}
        ${row('Fortify','cdFo',5,25,0.5)}${row('Rally','cdRa',5,25,0.5)}${row('Poison','cdPo',5,25,0.5)}
        ${row('Mend','cdMend',5,25,0.5)}${row('Execute','cdEx',5,25,0.5)}${row('Backstab','cdBs',5,25,0.5)}
        ${row('Evade','cdEv',2.5,20,0.5)}${row('Shield Bash','cdSb',2.5,20,0.5)}${row('Taunt','cdTa',5,25,0.5)}
        ${row('Guard','cdGu',5,25,0.5)}${row('Berserk','cdBerserk',7.5,30,0.5)}
        ${row('Interrupt CD','interruptCd',5,30,0.5)}
      </div>
      <div class="ed-section"><h4>⏰ Combat timing (ms)</h4>
        ${row('GCD ms','gcdMs',800,4000,100)}${row('Intent ms','intentMs',600,3000,100)}
        ${row('Interrupt window ms','interruptMs',400,1500,100)}
      </div>`;
    this.showModal('⚙️ GAME EDITOR',body,[
      {label:'RESET',cls:'',fn:()=>{if(confirm('Reset all settings?')){this.cfg={...DEF_CFG};this._saveCfg();this.closeModal();}}},
      {label:'DONE',cls:'p',fn:()=>this.closeModal()},
    ]);
  }

  cfgSet(key,val,sync){this.cfg[key]=val;if(sync)sync.value=val;this._saveCfg();}

  tab(t){
    ['v-camp','v-shop','v-train','v-stats','v-log'].forEach(id=>document.getElementById(id).classList.add('hidden'));
    document.getElementById('v-'+t).classList.remove('hidden');
    const m={camp:'gear',shop:'shop',train:'train',stats:'stats',log:'log'};
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active',b.innerText.toLowerCase().includes(m[t]||t)));
    if(t==='train')this.renderTrain();
    if(t==='stats')this.renderStats();
    if(t==='shop') this.renderShop();
  }

  getStats(){
    const p=this.state.p,lv=this.state.lv-1,tr=this.state.train;
    let s={
      hp:  Math.floor(p.hp  + lv*40 + tr.hp *20),
      atk: Math.floor(p.atk + lv*6  + tr.atk*2),
      def: Math.floor(p.def + lv*5  + tr.def*2),
      // CRIT CHANCE NERF: Max 75%. Base 5%. Train gives 1%.
      crit:Math.min(0.75, 0.05 + tr.crit*0.01),
      acc: Math.min(0.92, 0.85+tr.acc *0.02),
      eva: Math.min(0.40, 0.05+tr.eva *0.02),
      res: Math.min(0.55, 0.00+tr.res *0.02),
    };
    if(p.n==='Warden'){s.res=Math.min(0.65,s.res+0.12);s.def=Math.floor(s.def*1.08);}
    if(p.n==='Paladin')s.def=Math.floor(s.def*1.08);
    if(p.n==='Slayer') s.crit=Math.min(0.75,s.crit+0.10); // Slayer 15% Base
    this.slots.forEach(sl=>{
      const i=this.state.eq[sl];if(!i)return;
      s.hp  +=i.hp  ||0; s.atk +=i.atk ||0; s.def +=i.def ||0;
      s.crit=Math.min(0.75,s.crit+(i.crit||0)/100);
      s.acc =Math.min(0.92,s.acc +(i.acc ||0)/100);
      s.eva =Math.min(0.40,s.eva +(i.eva ||0)/100);
      s.res =Math.min(0.65,s.res +(i.res ||0)/100);
    });
    if(this.state.stance==='agro'){s.atk=Math.floor(s.atk*1.20);s.def=Math.floor(s.def*0.85);}
    if(this.state.stance==='def') {s.atk=Math.floor(s.atk*0.85);s.def=Math.floor(s.def*1.20);s.res=Math.min(0.70,s.res+0.10);}
    return s;
  }

  rollHit(acc,eva){const a2=acc*acc,e2=eva*eva;return Math.random()<a2/(a2+e2);}
  calcDmg(atk,def,mult=1.0,resMult=1.0){const raw=atk*mult*(0.88+Math.random()*0.24);const red=def/(def+DEF_K*atk);return Math.max(1,Math.floor(raw*(1-red)*resMult));}
  _softCap(x){return x/(1+0.8*Math.abs(x))*(x>=0?1:-1);}

  getMults(buffs){
    let ab=0,db=0,acb=0,eb=0,rb=0;
    (buffs||[]).forEach(b=>{const d=BD[b.id];if(!d)return;
      if(d.atk!==undefined)ab+=d.atk;if(d.def!==undefined)db+=d.def;
      if(d.acc!==undefined)acb+=d.acc;if(d.eva!==undefined)eb+=d.eva;
      if(d.res!==undefined)rb+=d.res;
    });
    return{atkM:1+this._softCap(ab),defM:1+this._softCap(db),
      accM:Math.max(0.1,1+this._softCap(acb)),evaM:Math.max(0,1+this._softCap(eb)),resM:Math.max(0,1+this._softCap(rb))};
  }

  applyDoTs(target,atkrAtk){
    const arr=target==='p'?this.state.pBuffs:this.state.enemy?.buffs;
    if(!arr?.length)return 0;
    const s=this.getStats();let tot=0;
    arr.forEach(b=>{
      const d=BD[b.id];if(!d||!d.dot)return;
      const res=target==='p'?s.res:(this.state.enemy?.res||0);
      const dot=Math.max(1,Math.floor(atkrAtk*0.18*(1-res)));
      if(target==='p'){this.state.p.chp-=dot;this.log(`👤 ${d.icon}${d.name} ${dot}dmg`,'lose');this._trackE(dot);}
      else{this.state.enemy.hp-=dot;this.log(`👹 ${d.icon}${d.name} ${dot}dmg`,'buff');this._trackP(dot,'dot_'+b.id);}
      tot+=dot;
    });
    return tot;
  }

  applyHoTs(target){
    const arr=target==='p'?this.state.pBuffs:this.state.enemy?.buffs;
    if(!arr)return;
    arr.forEach(b=>{const d=BD[b.id];if(!d||!d.hot)return;
      if(target==='e'&&this.state.enemy){const h=Math.max(1,Math.floor(this.state.enemy.mhp*0.05));this.state.enemy.hp=Math.min(this.state.enemy.mhp,this.state.enemy.hp+h);this.log(`👹 💚REGEN +${h}`,'buff');}
      if(target==='p'){const s=this.getStats();const h=Math.max(1,Math.floor(s.hp*0.04));this.state.p.chp=Math.min(s.hp,this.state.p.chp+h);this.log(`👤 💚REGEN +${h}`,'buff');}
    });
  }

  addBuff(target,id,durationTurns){
    const arr=target==='p'?this.state.pBuffs:this.state.enemy?.buffs;
    if(!arr)return false;
    const d=BD[id];if(!d)return false;
    if(d.clearBuffs&&target==='p'){
      const cl=this.state.pBuffs.filter(b=>BD[b.id]?.type==='buff').length;
      this.state.pBuffs=this.state.pBuffs.filter(b=>BD[b.id]?.type!=='buff');
      if(cl>0)this.log(`👤 🌀DISPEL — ${cl} buff(s) cleared`,'lose');
      return true;
    }
    if(d.type==='debuff'&&target==='p'){const s=this.getStats();if(Math.random()<s.res){this.log(`👤 ${d.icon}${d.name} resisted!`,'info');return false;}}
    const warden=this.state.p?.n==='Warden'&&target==='p';
    const res=target==='p'?this.getStats().res:(this.state.enemy?.res||0);
    let effT=d.type==='debuff'?Math.max(1,Math.floor(durationTurns*(1-res)*(warden?0.65:1))):durationTurns;
    
    const ex=arr.find(b=>b.id===id);
    if(ex){ex.turns=ex.turns+Math.floor(effT*0.5);return true;}
    arr.push({id,turns:effT});
    this.log(`${target==='p'?'👤':'👹'} ${d.icon}${d.name}(${(effT*2.5).toFixed(1)}s)`,'buff');
    return true;
  }

  _trackP(amt,src){
    if(!this.state.combat||amt<=0)return;
    this.pDps.push({ts:performance.now(),amt,src});
    this.state.totalDmgDealt+=amt;
    if(this.state.enemy?.isDummy){
      this.dummyTotalDmg=(this.dummyTotalDmg||0)+amt;
    }
  }
  _trackE(amt)   {if(!this.state.combat||amt<=0)return;this.eDps.push({ts:performance.now(),amt});this.state.totalDmgTaken+=amt;}

  _updateDpsLive(){
    const el=document.getElementById('dps-live');if(!el)return;
    if(!this.state.combat){el.classList.remove('on');return;}
    el.classList.add('on');
    const elapsed=Math.max(1,(performance.now()-this.fightStart)/1000);
    const pTot=this.pDps.reduce((s,e)=>s+e.amt,0);
    const eTot=this.eDps.reduce((s,e)=>s+e.amt,0);
    
    if(this.state.enemy?.isDummy){
      document.getElementById('p-dps').innerText=Math.round(pTot/elapsed);
      document.getElementById('p-tot').innerText=pTot;
      document.getElementById('e-dps').innerText='--';
      document.getElementById('e-tot').innerText='DUMMY';
    } else {
      document.getElementById('p-dps').innerText=Math.round(pTot/elapsed);
      document.getElementById('p-tot').innerText=pTot;
      document.getElementById('e-dps').innerText=Math.round(eTot/elapsed);
      document.getElementById('e-tot').innerText=eTot;
    }
    
    const min=Math.floor(elapsed/60);
    const sec=Math.floor(elapsed%60).toString().padStart(2,'0');
    document.getElementById('turn-n').innerText=`${min}:${sec}`;
  }

  _showRecap(){
    const el=document.getElementById('dps-recap');
    const pTot=this.pDps.reduce((s,e)=>s+e.amt,0)||1;
    const eTot=this.eDps.reduce((s,e)=>s+e.amt,0);
    const dur=Math.max(1,(performance.now()-this.fightStart)/1000);
    const dps=Math.round(pTot/dur);
    document.getElementById('rec-dur').innerText=Math.round(dur)+'s';
    document.getElementById('rec-dmg').innerText=pTot;
    document.getElementById('rec-dps').innerText=dps;
    document.getElementById('rec-taken').innerText=eTot;
    document.getElementById('rec-int').innerText=(this.state.interruptsHit||0)+'/'+(this.state.interruptsMissed||0);
    const srcs={};this.pDps.forEach(e=>{srcs[e.src]=(srcs[e.src]||0)+e.amt;});
    
    const SRC={basic:'Basic ATK',crit:'Crit (Bonus Dmg)',heavy:'Heavy Strike',execute:'Execute',
      backstab:'Backstab',stun:'Stun Hit',poison:'Poison',bleed_atk:'Bleed Strike',
      dot_poison:'Poison DoT',dot_bleed:'Bleed DoT',expose_atk:'Expose Strike',
      shield_bash:'Shield Bash',other:'Other'};
    const COL={basic:'#94a3b8',crit:'#f59e0b',heavy:'#ef4444',execute:'#dc2626',
      backstab:'#7c3aed',stun:'#a855f7',poison:'#84cc16',bleed_atk:'#ef4444',
      dot_poison:'#84cc16',dot_bleed:'#ef4444',expose_atk:'#f59e0b',shield_bash:'#3b82f6',other:'#64748b'};
    document.getElementById('rec-breakdown').innerHTML=Object.entries(srcs)
      .sort((a,b)=>b[1]-a[1]).map(([src,amt])=>{
        const pct=Math.round(amt/pTot*100),col=COL[src]||'#64748b',lbl=SRC[src]||src;
        return`<div class="src-row"><span class="src-name">${lbl}</span>
          <div class="src-track"><div class="src-fill" style="width:${pct}%;background:${col}"></div></div>
          <span class="src-pct">${pct}%</span></div>`;
      }).join('')||'<div style="font-size:0.58rem;color:#444">No data</div>';
    el.classList.add('on');
  }

  dismissRecap(){document.getElementById('dps-recap').classList.remove('on');}

  _enemyScale(lv){
    const base=Math.pow(this.cfg.enemyBase/100,lv-1);
    const elite=lv>=this.cfg.enemyEliteLv?Math.pow(this.cfg.enemyEliteScale/100,lv-this.cfg.enemyEliteLv+1):1;
    return base*elite;
  }
  _enemyLvl(){
    const w=this.state.wins,mo=this.cfg.enemyMaxOffset;
    const maxUp=w>=15?Math.min(mo,6):w>=5?Math.min(mo,4):Math.min(mo,2);
    return Math.max(1,this.state.lv+Math.floor(Math.random()*(maxUp+2))-1);
  }
  makeEnemy(eLvl){
    const pre=this.prefixes[Math.floor(Math.random()*this.prefixes.length)];
    const sc=this._enemyScale(eLvl);
    const mhp=Math.floor(this.cfg.enemyHp*sc*pre.hp);
    const eAcc=Math.min(0.92,0.78+eLvl*0.006),eEva=Math.min(0.30,0.03+eLvl*0.004),eRes=Math.min(0.35,0+eLvl*0.004);
    const allSp=['bash','drain','pierce','weaken','corrode','regen','rally','dispel','bleed','heavy'];
    const numSp=Math.min(2,Math.floor(eLvl/4));
    const pool=[...allSp];const specials=[];
    for(let i=0;i<numSp+1&&pool.length;i++){const idx=Math.floor(Math.random()*pool.length);specials.push(pool.splice(idx,1)[0]);}
    return{pre:pre.n,lv:eLvl,color:pre.color,hp:mhp,mhp,
      atk:Math.floor(this.cfg.enemyAtk*sc*pre.atk),def:Math.floor(this.cfg.enemyDef*sc*pre.def),
      acc:eAcc,eva:eEva,res:eRes,specials,spCds:{},buffs:[],stallPenalty:0,taunted:false};
  }

  _pickAction(e,s,st){
    const pBuf=(st.pBuffs||[]).filter(b=>BD[b.id]?.type==='buff').length;
    const pHp=st.p.chp/s.hp,eHp=e.hp/e.mhp;
    const turn=Math.max(0, (performance.now() - this.fightStart)/2500);
    if(turn>12)e.stallPenalty=Math.min(5,turn-12);
    Object.keys(e.spCds||{}).forEach(k=>{if(e.spCds[k]>0)e.spCds[k]--;});
    const avail=e.specials.filter(sp=>!(e.spCds[sp]>0));
    if(e.taunted){e.taunted=false;return 'normal';}
    if(pBuf>=2&&avail.includes('dispel'))return 'dispel';
    if(pBuf>=2){const d=avail.find(s=>['weaken','corrode'].includes(s));if(d)return d;}
    if(eHp<0.30){if(avail.includes('regen'))return 'regen';if(avail.includes('rally'))return 'rally';}
    if(pHp<0.20&&avail.includes('bash')&&!st.pImmune)return 'bash';
    if(avail.length&&Math.random()<0.35)return avail[Math.floor(Math.random()*avail.length)];
    return Math.random()<0.22?'heavy':'normal';
  }

  _showIntent(action){
    const def=INTENTS[action]||INTENTS.normal;
    const box=document.getElementById('e-intent');
    box.className='intent-box'+(def.danger?' danger':action==='regen'||action==='rally'?' magic':'');
    document.getElementById('intent-lbl').innerText=def.label;
    document.getElementById('intent-lbl').style.color=def.col;
    const fill=document.getElementById('intent-fill');
    fill.style.background=def.danger?'#ef4444':def.col;
    fill.style.transition='none';fill.style.width='100%';
    box.classList.remove('hidden');
    const dur=this.cfg.intentMs;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{fill.style.transition=`width ${dur}ms linear`;fill.style.width='0%';}));
  }
  _hideIntent(){document.getElementById('e-intent').classList.add('hidden');}

  _startGCDBar(){
    const fill=document.getElementById('gcd-fill');
    if(!fill)return;
    fill.style.transition='none';fill.style.width='0%';
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      fill.style.transition=`width ${this.cfg.gcdMs}ms linear`;
      fill.style.width='100%';
    }));
  }

  _setQueueDisplay(skillId){
    const slot=document.getElementById('queue-slot');
    if(!slot)return;
    if(!skillId){
      slot.className='queue-slot';
      slot.innerHTML='<span class="queue-empty">— press a skill to queue —</span>';
      return;
    }
    const sk=SKILLS[skillId];
    slot.className='queue-slot filled';
    slot.innerHTML=`<span class="queue-skill-icon">${sk?.icon||'?'}</span>
      <span class="queue-skill-name">${sk?.label||skillId}</span>
      <button class="queue-cancel" onclick="G.cancelQueue()" title="Cancel queue">✕</button>`;
  }

  cancelQueue(){
    this.gcd.queued=null;
    this._setQueueDisplay(null);
    this.renderSkillBar(); 
  }

  pressSkill(type){
    const st=this.state;
    if(!st.combat || st.pSt > 0) return;

    const sk=SKILLS[type];
    if(this.gcd.queued === type) return; 

    if(sk?.offgcd){
      this._executeOffGcd(type);
      return;
    }

    this.gcd.queued=type;
    this._setQueueDisplay(type);
    this.renderSkillBar(); 

    if(!this.gcd.active&&!this._executing){
      this._consumeQueue();
    }
  }

  _consumeQueue(){
    if(!this.gcd.queued||this.gcd.active||this._executing)return;
    if(!this.state?.combat)return;
    const type=this.gcd.queued;
    this.gcd.queued=null;
    this.gcd.active=true;
    this._setQueueDisplay(null);
    this.renderSkillBar(); 

    this._startGCDBar();

    clearTimeout(this.gcd.timer);
    this.gcd.timer=setTimeout(()=>{
      this.gcd.active=false;
      if(this.gcd.queued&&this.state?.combat&&!this._executing&&this.state.pSt<=0){
        this._consumeQueue();
      } else {
        this.renderSkillBar();
      }
    },this.cfg.gcdMs);

    this._executeTurn(type);
  }

  _executeOffGcd(type){
    if(type==='interrupt'){
      if(this.intCd>0){this.log(`Interrupt on CD (${this.intCd.toFixed(1)}s)`,'info');return;}
      const enCost=this.cfg.eInt;
      if(this.state.energy<enCost){this.updateHud('p','⚡ Need Energy!');return;}
      
      this.state.energy=Math.max(0,this.state.energy-enCost);
      this.intCd=this.cfg.interruptCd;
      
      if(this.intWindowOpen){
        this.intWindowOpen=false;
        this._didInterrupt=true;  
        clearTimeout(this._intTimer);this._intResolve?.();this._intResolve=null;
        this.state.interruptsHit++;
        
        const intentLbl = document.getElementById('intent-lbl');
        if(intentLbl) {
            intentLbl.innerText = '💥 INTERRUPTED!';
            intentLbl.style.color = '#ef4444';
        }
        
        this.log('💥 INTERRUPTED! Enemy action cancelled!','interrupt');
        this.updateHud('p','💥 INTERRUPTED!');
        this.render();
      } else {
        this.state.interruptsMissed++;
        this.log('Interrupt wasted — no danger','info');
        this.render();
      }
    } else if(type==='stance'){
      const ss=['normal','agro','def'];
      this.state.stance=ss[(ss.indexOf(this.state.stance)+1)%ss.length];
      this.updateHud('p','Stance → '+this.state.stance.toUpperCase());
      this.render();
    }
  }

  async _executeTurn(type){
    if(this._executing)return;
    this._executing=true;
    try{ await this._castSkill(type); }
    catch(err){ console.error(err); this.updateHud('p','⚠️ Error'); }
    finally{ this._executing=false; }
  }

  async _castSkill(type){
    const st=this.state;
    if(!st.combat||!st.enemy||st.pSt>0)return;
    const s=this.getStats(),e=st.enemy;
    const pM=this.getMults(st.pBuffs),eM=this.getMults(e.buffs);

    const sk=SKILLS[type];
    const enCost=sk?.eCfg?this.cfg[sk.eCfg]:0;
    const actualCost=(type==='mend'&&st.p.n==='Paladin')?0:enCost;
    if(actualCost>st.energy){
      this.log('Not enough energy (need '+actualCost+')','lose');
      this.updateHud('p','⚡ Need Energy!');
      return;
    }
    if(actualCost>0)st.energy=Math.max(0,st.energy-actualCost);

    st.pImmune=false;
    const effAcc=s.acc*pM.accM,effEva=e.eva*eM.evaM;
    const hit=this.rollHit(effAcc,effEva);
    const critMult=(st.p.n==='Slayer'?this.cfg.multSlayerCrit:this.cfg.multCrit)/100;
    const cr=Math.random()<s.crit;
    let dmg=0;

    // Helper to log and apply skill crits smoothly
    const logSkill = (lbl, critLbl, trackId, rawMult, defMult=1.0) => {
      dmg=this.calcDmg(s.atk*pM.atkM,e.def*eM.defM*defMult, rawMult*(cr?critMult:1.0));
      this.updateHud('p', cr ? critLbl+' '+dmg : lbl+' '+dmg);
      this._trackP(dmg, trackId);
    };

    if(type==='hvy'){st.cds.h=this.cfg.cdHvy;
      if(!hit)this.updateHud('p','HEAVY MISS!');
      else logSkill('💢 HEAVY!','💥 HVY CRIT!','heavy',this.cfg.multHvy/100, 0.6);
    }
    else if(type==='stn'){st.cds.s=this.cfg.cdStn;
      if(!hit)this.updateHud('p','STUN MISS!');
      else{
        logSkill('✨ STUN!','💥 STUN CRIT!','stun',this.cfg.multStn/100, 1.0);
        if(Math.random()<0.55){this._applyStun('e', 2.5);}
      }
    }
    else if(type==='blk'){st.pShield=true;st.cds.b=this.cfg.cdBlk;this.updateHud('p','🛡️ BLOCKING');}
    else if(type==='fo'){this.addBuff('p','fortify',3);st.cds.fo=this.cfg.cdFo;this.updateHud('p','🔷 FORTIFY!');}
    else if(type==='ra'){this.addBuff('p','rally',3);st.cds.ra=this.cfg.cdRa;this.updateHud('p','⚡ RALLY!');}
    else if(type==='po'){st.cds.po=this.cfg.cdPo;
      if(!hit)this.updateHud('p','POISON MISS!');
      else{this.addBuff('e','poison',4);this.addBuff('e','expose',2);this.updateHud('p','☠️ POISON+EXPOSE!');}
    }
    else if(type==='execute'){st.cds.ex=this.cfg.cdEx;
      if(!hit)this.updateHud('p','EXEC MISS!');
      else{
        const kill=e.hp/e.mhp<0.30;
        const mult=kill?this.cfg.multEx/100:this.cfg.multExNorm/100;
        logSkill(kill?'💀 EXECUTE!':'EXEC', kill?'💥 EXEC CRIT!':'💥 EXEC CRIT!', 'execute', mult, 1.0);
      }
    }
    else if(type==='backstab'){st.cds.bs=this.cfg.cdBs;
      if(!hit)this.updateHud('p','STAB MISS!');
      else logSkill('🗡️ BACKSTAB!','💥 STAB CRIT!','backstab',this.cfg.multBs/100, 0.5);
    }
    else if(type==='evade'){st.cds.ev=this.cfg.cdEv;st.pEvading=true;this.updateHud('p','💨 EVADE — next attack dodged!');}
    else if(type==='berserk'){st.cds.be=this.cfg.cdBerserk;this.addBuff('p','berserk',3);this.updateHud('p','🔥 BERSERK!');}
    else if(type==='bleed_atk'){st.cds.bl=this.cfg.cdBleedAtk;
      if(!hit)this.updateHud('p','BLEED MISS!');
      else {
         logSkill('🩸 BLEED!','💥 BLEED CRIT!','bleed_atk',0.80, 1.0);
         this.addBuff('e','bleed',3);
      }
    }
    else if(type==='shield_bash'){st.cds.sb=this.cfg.cdSb;
      if(!hit)this.updateHud('p','SBASH MISS!');
      else{
         logSkill('🛡️ SBASH!','💥 SBASH CRIT!','shield_bash',this.cfg.multSbash/100, 1.0);
         if(Math.random()<0.70){this._applyStun('e',2.5);}
         this.addBuff('p','fortify',1);
      }
    }
    else if(type==='taunt'){st.cds.ta=this.cfg.cdTa;e.taunted=true;this.updateHud('p','😤 TAUNT!');}
    else if(type==='guard'){st.cds.gu=this.cfg.cdGu;st.pShield=true;this.addBuff('p','regen',2);this.updateHud('p','🏰 GUARD!');}
    else if(type==='mend'){st.cds.mn=this.cfg.cdMend;const heal=Math.floor(s.hp*0.20);st.p.chp=Math.min(s.hp,st.p.chp+heal);this.updateHud('p','💚 MEND +'+heal);}
    else if(type==='expose_atk'){st.cds.ep=this.cfg.cdExpAtk;
      if(!hit)this.updateHud('p','EXPOSE MISS!');
      else{
         logSkill('🎯 EXPOSE!','💥 EXPOSE CRIT!','expose_atk',0.85, 1.0);
         this.addBuff('e','expose',3);
      }
    }

    if(dmg>0)e.hp-=dmg;
    if(e.hp<=0 && !e.isDummy) this.win();
  }

  async _triggerEnemyIntent() {
    const st = this.state, e = st.enemy, s = this.getStats();
    if(!st.combat || !e || st.eSt > 0) return;

    const eAction = this._pickAction(e, s, st);
    if(eAction !== 'normal' && eAction !== 'heavy' && e.spCds) e.spCds[eAction] = (e.spCds[eAction] || 0) + 4;
    
    this._showIntent(eAction);
    const isDanger = INTENTS[eAction]?.danger || false;

    if(isDanger) {
      await sleep(200);
      this._didInterrupt = false;
      this.intWindowOpen = true;
      await new Promise(resolve => {
        this._intResolve = resolve;
        this._intTimer = setTimeout(() => {
          this.intWindowOpen = false;
          if(!this._didInterrupt) this.state.interruptsMissed++;
          resolve();
        }, this.cfg.interruptMs);
      });
      if(this._didInterrupt) return; 
    } else {
      await sleep(this.cfg.intentMs);
    }

    this._hideIntent();
    
    if(st.combat && st.eSt <= 0) {
      const eM = this.getMults(e.buffs);
      this._doEnemyAction(eAction, e, s, st, eM);
      if(st.p.chp <= 0) this.lose();
    }
  }

  _doEnemyAction(sp,e,s,st,eM){
    const enraged=e.hp/e.mhp<0.25;
    if(enraged&&!e.buffs.find(b=>b.id==='enrage_b'))this.addBuff('e','enrage_b',99);
    const eM2=this.getMults(e.buffs);
    const bAtk=e.atk*(1+(e.stallPenalty||0)*0.10)*eM2.atkM*(enraged?1.25:1);
    const pM=this.getMults(st.pBuffs);
    const res=s.res*pM.resM;
    const hit=this.rollHit(e.acc*eM2.accM,s.eva*pM.evaM);
    const evaded=st.pEvading;if(evaded)st.pEvading=false;

    if(sp==='regen'){this.addBuff('e','regen',3);this.updateHud('e','💚 REGEN!');return;}
    if(sp==='rally'){this.addBuff('e','rally',2);this.updateHud('e','⚡ RALLY!');return;}
    if(sp==='dispel'){this.addBuff('p','dispel',1);this.updateHud('e','🌀 DISPEL!');return;}
    if(['weaken','corrode','slow','bleed'].includes(sp)){this.addBuff('p',sp,3);this.updateHud('e',`${BD[sp]?.icon}${sp.toUpperCase()}!`);return;}

    if(evaded){this.updateHud('e','EVADED!');return;}
    if(sp==='bash'&&!st.pImmune){
      if(hit){this._applyStun('p', 2.5);const d=this.calcDmg(bAtk,s.def*pM.defM,0.75,1-res);st.p.chp-=d;this._trackE(d);this.updateHud('e','⚡ BASH+STUN! '+d);}else this.updateHud('e','⚡ BASH MISS!');return;
    }
    if(sp==='drain'){
      if(hit){const d=this.calcDmg(bAtk,s.def*pM.defM,1.15,1-res);st.p.chp-=d;this._trackE(d);e.hp=Math.min(e.mhp,e.hp+Math.floor(d*0.35));this.updateHud('e','🩸 DRAIN '+d);}else this.updateHud('e','🩸 MISS!');return;
    }
    if(sp==='pierce'){
      if(hit){const d=Math.max(1,Math.floor(bAtk*1.35*(1-e.def/(e.def+DEF_K*e.atk)*0.4)*(1-res)));st.p.chp-=d;this._trackE(d);this.updateHud('e','🗡️ PIERCE '+d);}else this.updateHud('e','🗡️ MISS!');return;
    }
    if(sp==='heavy'){
      if(hit){const d=this.calcDmg(bAtk,s.def*pM.defM*0.6,1.8,1-res);st.p.chp-=d;this._trackE(d);this.updateHud('e','💥 HEAVY '+d);}else this.updateHud('e','💥 MISS!');return;
    }
    if(!hit){this.updateHud('e','Strike MISS!');return;}
    const bm=st.pShield&&st.p.n==='Paladin'?this.cfg.multPalBlock/100:2;
    const effDef=st.pShield?s.def*pM.defM*bm:s.def*pM.defM;
    const d=this.calcDmg(bAtk,effDef,1.0,1-res);
    st.p.chp-=d;this._trackE(d);
    this.updateHud('e','Strike '+d+(st.pShield?' (BLOCKED!)':enraged?' 🔥':''));
    st.pShield=false;
  }

  _cleanupCombatTimers() {
    clearInterval(this._ticker);
    clearInterval(this._swingInterval);
    clearInterval(this._aiTimer);
    clearTimeout(this.gcd.timer);
    clearTimeout(this._intTimer);
    this.gcd.active = false;
    this.gcd.queued = null;
    this.intWindowOpen = false;
    this._executing = false;
    const sw=document.getElementById('swing-wrap');
    if(sw)sw.classList.remove('on');
  }

  win(){
    const st=this.state,e=st.enemy;
    const g=Math.floor(this.cfg.goldBase+e.lv*this.cfg.goldPerLv+(e.lv>st.lv?this.cfg.goldUpset:0));
    const xp=this.cfg.xpBase+e.lv*this.cfg.xpPerLv+(e.lv>st.lv?30:0);
    const pTot=this.pDps.reduce((s,x)=>s+x.amt,0);
    const dur=Math.max(1,(performance.now()-this.fightStart)/1000);
    st.gd+=g;st.tp++;st.wins++;st.xp+=xp;st.totalGoldEarned+=g;
    st.fightsSinceShopRefresh=(st.fightsSinceShopRefresh||0)+1;
    if(st.fightsSinceShopRefresh>=3){this._decayShop();st.fightsSinceShopRefresh=0;}
    st.history.push({result:'win',eLvl:e.lv,ePre:e.pre,gold:g,turns:Math.round(dur/2.5),dps:Math.round(pTot/dur)});
    if(st.history.length>20)st.history.shift();
    if(st.xp>=st.xn){st.lv++;st.xp=0;st.xn=Math.floor(st.xn*1.38);this.log('🎉 LEVEL UP → LV'+st.lv+'!','win');}
    const hasLoot=Math.random()<this.cfg.lootChance/100;
    if(hasLoot)this._lootPend=this.gen(Math.max(1,e.lv));
    this.log(`Victory! +${g}💰 +${xp}XP +1🏆${hasLoot?' — loot!':''}`, 'win');
    
    st.combat=false;st.enemy=null;st.pBuffs=[];st.pShield=st.pEvading=false; st.pSt=0; st.eSt=0;
    this._cleanupCombatTimers();
    this._fightCooldown=performance.now()+3000;
    
    this._hideIntent();this.updateHud('e','DEFEATED ☠️');
    this._setCombatLayout(false);this.render();this.save();
    this._showRecap();
    if(this._lootPend)setTimeout(()=>this.showLootModal(),400);
  }

  lose(){
    const st=this.state,e=st.enemy;
    const pTot=this.pDps.reduce((s,x)=>s+x.amt,0);
    const dur=Math.max(1,(performance.now()-this.fightStart)/1000);
    st.history.push({result:'loss',eLvl:e?.lv||0,ePre:e?.pre||'?',gold:0,turns:Math.round(dur/2.5),dps:Math.round(pTot/dur)});
    if(st.history.length>20)st.history.shift();
    st.losses++;
    st.fightsSinceShopRefresh=(st.fightsSinceShopRefresh||0)+1;
    if(st.fightsSinceShopRefresh>=3){this._decayShop();st.fightsSinceShopRefresh=0;}
    
    st.combat=false;st.enemy=null;st.pBuffs=[];st.pShield=st.pEvading=false; st.pSt=0; st.eSt=0;
    this._cleanupCombatTimers();
    
    const s=this.getStats();st.p.chp=Math.floor(s.hp*0.08);
    this._hideIntent();this.updateHud('p','DEFEATED');this.log('💀 Defeated. 8% HP remains.','lose');
    this._setCombatLayout(false);this.render();this.save();this._showRecap();
  }

  gen(lv,forced,forcedR){
    const sl=forced||this.slots[Math.floor(Math.random()*8)];
    let rIdx = 0;
    if(forcedR !== undefined) {
        rIdx = forcedR;
    } else {
        const roll=Math.random(); rIdx=roll<0.06?3:roll<0.20?2:roll<0.45?1:0;
    }
    const sc=Math.pow(this.cfg.itemLvScale/100,lv-1);const rm=this.rarity[rIdx].m;
    const PRIMARY={Weapon:'atk',Ring:'atk',Gloves:'atk',Armor:'def',Shield:'def',Helm:'def',Boots:'hp',Relic:'hp'};
    const primary=PRIMARY[sl];
    const PRIM_VAL={atk:Math.floor(this.cfg.itemAtk*sc*rm),def:Math.floor(this.cfg.itemDef*sc*rm),hp:Math.floor(this.cfg.itemHp*sc*rm)};
    const item={n:this.rarity[rIdx].n+' '+sl,s:sl,r:rIdx,lv,upgrades:0,atk:0,def:0,hp:0,acc:0,eva:0,res:0,crit:0,val:Math.floor(28*sc*rm)};
    item[primary]=PRIM_VAL[primary];
    const maxSec=rIdx===3?2:rIdx===2?(Math.random()<0.6?2:1):rIdx===1?1:(Math.random()<0.25?1:0);
    const pool=['atk','def','hp','acc','eva','res','crit'].filter(s=>s!==primary);
    for(let i=0;i<maxSec&&pool.length;i++){
      const sec=pool.splice(Math.floor(Math.random()*pool.length),1)[0];
      if(sec==='atk')item.atk+=Math.max(1,Math.floor(PRIM_VAL.atk*0.35));
      else if(sec==='def')item.def+=Math.max(1,Math.floor(PRIM_VAL.def*0.40));
      else if(sec==='hp') item.hp +=Math.max(1,Math.floor(PRIM_VAL.hp *0.40));
      else item[sec]=Math.max(1,Math.floor((0.8+Math.log2(lv+1))*rm*0.6)); // CRIT STAT NERF ON ITEMS
    }
    return item;
  }

  _shopCost(){return Math.floor(this.cfg.shopBase*Math.pow(this.cfg.shopScale,(this.sess.shopN||0)));}
  _decayShop(){if((this.sess.shopN||0)>0){this.sess.shopN=(this.sess.shopN||0)-1;this._saveSess();}}

  _initShop(){
    if(!this.sess.seenInit){this.sess.seenInit=true;this.sess.shopN=0;this._saveSess();}
    this.stock=Array.from({length:3},()=>this.gen(this.state.lv));
    this.renderShop();
  }

  restock(free){
    if(!free){const cost=this._shopCost();
      if(this.state.gd<cost){this.log('Need '+cost+'💰 to refresh!','lose');return;}
      this.state.gd-=cost;this.sess.shopN=(this.sess.shopN||0)+1;this.sess.shopFD=0;this._saveSess();
    }
    this.stock=Array.from({length:3},()=>this.gen(this.state.lv));
    this.renderShop();this.render();
  }

  renderShop(){
    const l=document.getElementById('shop-list');l.innerHTML='';
    const badge=document.getElementById('shop-badge');
    if(!this.stock?.length){l.innerHTML='<div style="color:#2d3748;font-size:0.62rem;text-align:center;padding:7px">Loading…</div>';return;}
    this.stock.forEach((itm,i)=>{
      const d=document.createElement('div');d.className='item-card';d.style.borderColor=this.rarity[itm.r].c;
      const ca=this.state.gd>=itm.val;
      d.innerHTML=`<button style="float:right;background:${ca?'var(--prim)':'#1a1a1a'};color:#fff;border:none;padding:3px 7px;border-radius:4px;font-size:0.58rem;cursor:pointer" onclick="G.buy(${i})" ${ca?'':'disabled'}>BUY ${itm.val}💰</button>
        <b style="color:${this.rarity[itm.r].c};font-size:0.70rem">${itm.n}</b> <small style="color:#444">LV${itm.lv}</small><br>
        <div style="margin-top:3px;flex-wrap:wrap">${this._itemStatTags(itm)}</div>
        <div class="compare-row">${this.compareItem(itm)}</div>`;
      l.appendChild(d);
    });
    if(badge){const cost=this._shopCost();badge.innerHTML=`<b>${cost}💰</b><small style="color:#555;font-size:0.46rem;display:block">×${(this.sess.shopN||0)+1}</small>`;}
  }

  _itemStatTags(itm){
    return ['atk','def','hp','acc','eva','res','crit']
      .filter(s=>itm[s])
      .map(s=>{
        const pct=['acc','eva','res','crit'].includes(s);
        return statTag(s,itm[s],pct?'%':'');
      }).join('');
  }

  buy(i){const itm=this.stock[i];if(!itm)return;
    if(this.state.gd<itm.val){this.log('Not enough gold!','lose');return;}
    if(this.state.inv.length>=14){this.log('Inventory full!','lose');return;}
    this.state.gd-=itm.val;this.state.inv.push(itm);this.stock.splice(i,1);
    this.renderShop();this.render();this.save();
  }

  sell(i){const itm=this.state.inv[i];const v=Math.floor(itm.val*(itm.r>=2?0.40:0.50));
    this.log('Sold '+itm.n+' for '+v+'💰');this.state.gd+=v;this.state.inv.splice(i,1);this.render();this.save();}

  renderEquipment(){
    const eg=document.getElementById('eq-grid');eg.innerHTML='';
    this.slots.forEach(sl=>{
      const itm=this.state.eq[sl];const d=document.createElement('div');d.className='slot';
      if(itm)d.style.border='2px solid '+this.rarity[itm.r].c;
      const upg=itm?.upgrades?'+'+itm.upgrades:'';
      let statsHtml='';
      if(itm){
        const parts=[];
        if(itm.atk)parts.push(`<span style="color:${STAT_COL.atk}">⚔️${itm.atk}</span>`);
        if(itm.def)parts.push(`<span style="color:${STAT_COL.def}">🛡️${itm.def}</span>`);
        if(itm.hp) parts.push(`<span style="color:${STAT_COL.hp}">❤️${itm.hp}</span>`);
        if(itm.acc)parts.push(`<span style="color:${STAT_COL.acc}">🎯${itm.acc}%</span>`);
        if(itm.eva)parts.push(`<span style="color:${STAT_COL.eva}">💨${itm.eva}%</span>`);
        if(itm.res)parts.push(`<span style="color:${STAT_COL.res}">🔮${itm.res}%</span>`);
        if(itm.crit)parts.push(`<span style="color:${STAT_COL.crit}">💥${itm.crit}%</span>`);
        statsHtml=parts.join(' ');
      }
      d.innerHTML=`<span class="slot-type">${sl.slice(0,3).toUpperCase()}</span>
        <span class="slot-name" style="color:${itm?this.rarity[itm.r].c:'#333'}">${itm?itm.n.split(' ').slice(-1)[0]:'–'}</span>
        <div class="slot-stats">${statsHtml}</div>
        ${itm?`<span class="slot-lvl">LV${itm.lv}${upg?`<span style="color:var(--sec)">${upg}</span>`:''}</span>`:''}`;
      d.onclick=()=>{if(!this.state.combat&&itm){this.state.inv.push(itm);this.state.eq[sl]=null;this.render();this.save();}};
      eg.appendChild(d);
    });
  }

  compareItem(itm){
    const cur=this.state.eq[itm.s];
    if(!cur)return '<span class="delta-pos">↑ Empty slot</span>';
    const stats=['atk','def','hp','acc','eva','res','crit'];
    const parts=[];
    stats.forEach(s=>{
      const diff=(itm[s]||0)-(cur[s]||0);
      if(diff!==0)parts.push(`<span class="${diff>0?'delta-pos':'delta-neg'}">${STAT_ICON[s]}${diff>0?'+':''}${diff}${['acc','eva','res','crit'].includes(s)?'%':''}</span>`);
    });
    return parts.length?'vs: '+parts.join(' '):'<span class="delta-neu">≈ similar</span>';
  }

  renderInventory(){
    const ig=document.getElementById('inv-grid');ig.innerHTML='';
    if(!this.state.inv.length){ig.innerHTML='<div style="color:#2d3748;font-size:0.62rem;text-align:center;padding:8px">Inventory empty</div>';return;}
    this.state.inv.forEach((itm,i)=>{
      const d=document.createElement('div');d.className='item-card';d.style.borderColor=this.rarity[itm.r].c;
      const sv=Math.floor(itm.val*(itm.r>=2?0.40:0.50));
      const upg=itm.upgrades?`<span style="color:var(--sec)"> +${itm.upgrades}</span>`:'';
      d.innerHTML=`<button style="float:right;background:var(--bad);border:none;padding:2px 5px;border-radius:4px;font-size:0.50rem;color:#fff;cursor:pointer" onclick="event.stopPropagation();G.sell(${i})">SELL ${sv}💰</button>
        <b style="font-size:0.68rem;color:${this.rarity[itm.r].c}">${itm.n}${upg}</b>
        <small style="color:#444"> LV${itm.lv} · ${itm.s}</small><br>
        <div style="margin-top:3px">${this._itemStatTags(itm)}</div>
        <div class="compare-row">${this.compareItem(itm)}</div>`;
      d.onclick=()=>{if(!this.state.combat){const old=this.state.eq[itm.s];if(old)this.state.inv.push(old);this.state.eq[itm.s]=itm;this.state.inv.splice(i,1);this.render();this.save();}};
      ig.appendChild(d);
    });
  }

  trainCost(id){const td=this.trainDefs.find(x=>x.id===id);return Math.max(1,Math.floor(td.baseCost*Math.pow(td.costMult,this.state.train[id]||0)));}

  renderTrain(){
    const tg=document.getElementById('train-grid');tg.innerHTML='';
    this.trainDefs.forEach(td=>{
      const lv=this.state.train[td.id]||0,atMax=lv>=td.maxLv,cost=this.trainCost(td.id),ca=this.state.tp>=cost;
      const d=document.createElement('div');d.className='train-card';
      const isPct=td.id!=='atk'&&td.id!=='def'&&td.id!=='hp';
      const vt=atMax?'MAX':(lv>=1?(isPct?'+'+lv*td.perLv+'%':'+'+lv*td.perLv):'0');
      d.innerHTML=`<h4>${td.label}</h4><div class="val" style="color:${atMax?'var(--warn)':'var(--good)'}">${vt}</div>
        <div class="cost">LV${lv}/${td.maxLv} · ${atMax?'MAXED':cost+'🏆'}</div>
        <button onclick="G.trainStat('${td.id}')" ${!ca||atMax?'disabled':''}>${atMax?'MAXED':ca?'TRAIN ▲':'NEED '+cost+'🏆'}</button>`;
      tg.appendChild(d);
    });
    const fg=document.getElementById('forge-grid');fg.innerHTML='';
    const equipped=this.slots.filter(sl=>this.state.eq[sl]);
    if(!equipped.length){fg.innerHTML='<div style="color:#2d3748;font-size:0.62rem;text-align:center;padding:6px">No items equipped</div>';return;}
    equipped.forEach(sl=>{
      const itm=this.state.eq[sl],upg=itm.upgrades||0;
      const fc=Math.floor(itm.val*0.8*Math.pow(1.6,upg)),ca=this.state.gd>=fc;
      const msk=itm.atk?'atk':itm.def?'def':'hp',bonus=Math.max(1,Math.floor(itm[msk]*0.15));
      const d=document.createElement('div');d.className='upgrade-card';
      d.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;gap:6px">
        <div style="flex:1;min-width:0">
          <b style="color:${this.rarity[itm.r].c};font-size:0.65rem">${itm.n}</b>${upg?`<span style="color:var(--sec);font-size:0.53rem"> +${upg}</span>`:''}
          <div style="font-size:0.52rem;color:#555;margin-top:1px">${STAT_ICON[msk]}${itm[msk]} → <span style="color:var(--good)">+${bonus}/forge</span></div>
        </div>
        <button style="background:${ca&&upg<5?'var(--warn)':'#1a1a1a'};border:none;padding:5px 7px;border-radius:5px;color:${ca&&upg<5?'#000':'#555'};font-weight:900;font-size:0.54rem;cursor:pointer;flex-shrink:0" onclick="G.forgeItem('${sl}')" ${!ca||upg>=5?'disabled':''}>${upg>=5?'⭐MAX':ca?'⚒️'+fc+'💰':fc+'💰'}</button>
      </div>`;
      fg.appendChild(d);
    });
  }

  trainStat(id){const td=this.trainDefs.find(x=>x.id===id);const lv=this.state.train[id]||0;if(lv>=td.maxLv)return;const cost=this.trainCost(id);
    if(this.state.tp<cost){this.log('Need '+cost+'🏆 trophies!','lose');return;}
    this.state.tp-=cost;this.state.train[id]=lv+1;
    const isPct=id!=='atk'&&id!=='def'&&id!=='hp';
    this.log('🏋️ '+td.label+' LV'+(lv+1)+' (+'+td.perLv+(isPct?'%':'')+'!)','win');
    this.renderTrain();this.render();this.save();}

  forgeItem(sl){const itm=this.state.eq[sl];if(!itm)return;const upg=itm.upgrades||0;const fc=Math.floor(itm.val*0.8*Math.pow(1.6,upg));
    if(this.state.gd<fc){this.log('Not enough gold!','lose');return;}
    const msk=itm.atk?'atk':itm.def?'def':'hp';const bonus=Math.max(1,Math.floor(itm[msk]*0.15));
    this.state.gd-=fc;itm[msk]+=bonus;itm.upgrades=(itm.upgrades||0)+1;itm.val=Math.floor(itm.val*1.1);
    this.log('⚒️ '+itm.n+' +'+itm.upgrades+' — '+STAT_ICON[msk]+' +'+bonus+'!','win');
    this.renderTrain();this.render();this.save();}

  renderStats(){
    const st=this.state,s=this.getStats(),tot=st.wins+st.losses,wr=tot>0?Math.round(st.wins/tot*100):0;
    const ld=LOADOUTS[st.p?.n];
    document.getElementById('stats-content').innerHTML=
      `<div style="font-size:0.65rem;font-weight:900;color:var(--warn);margin-bottom:7px;font-family:Cinzel">CHARACTER</div>`
      +this._sr('Class',st.p?.n||'—')+this._sr('Level',st.lv)
      +this._sr('HP',s.hp)+this._sr('ATK',s.atk)+this._sr('DEF',s.def)
      +this._sr('Crit',Math.round(s.crit*100)+'%')+this._sr('Accuracy',Math.round(s.acc*100)+'%')
      +this._sr('Evasion',Math.round(s.eva*100)+'%')+this._sr('Resistance',Math.round(s.res*100)+'%')
      +this._sr('Stance',st.stance.toUpperCase())
      +(ld?`<div style="font-size:0.53rem;color:#3d4a5c;padding:4px 6px;background:#080b10;border-radius:4px;margin-top:4px">${ld.passive}</div>`:'')
      +`<div style="font-size:0.65rem;font-weight:900;color:var(--warn);margin:10px 0 7px;font-family:Cinzel">CAREER</div>`
      +this._sr('Fights',tot)
      +`<div class="stat-row"><span class="stat-label">W / L</span><span><span style="color:var(--good)">${st.wins}</span> / <span style="color:var(--bad)">${st.losses}</span> (${wr}%)</span></div>`
      +this._sr('Trophies',st.tp)+this._sr('Gold Earned',st.totalGoldEarned+'💰')
      +this._sr('Interrupts','✓'+st.interruptsHit+' / ✗'+st.interruptsMissed)
      +`<div style="font-size:0.65rem;font-weight:900;color:var(--warn);margin:10px 0 7px;font-family:Cinzel">FIGHT HISTORY</div>`
      +`<div class="fight-history">`
      +(st.history.length===0?'<div style="color:#2d3748;font-size:0.62rem;text-align:center;padding:7px">No fights yet</div>'
        :st.history.slice().reverse().map(f=>`<div class="fight-row ${f.result==='win'?'w':'l'}">
          <span>${f.result==='win'?'✓':'✗'} LV${f.eLvl} ${f.ePre}</span>
          ${f.result==='win'?`<span>+${f.gold}💰</span>`:'<span>—</span>'}
          <span>${f.turns}t</span><span>${f.dps||'—'}dps</span></div>`).join(''))
      +'</div>';
  }
  _sr(l,v,fs='0.65rem'){return`<div class="stat-row"><span class="stat-label">${l}</span><span style="font-size:${fs}">${v}</span></div>`;}

  render(){
    document.getElementById('lv').innerText=this.state.lv;
    document.getElementById('gd').innerText=this.state.gd;
    document.getElementById('tp').innerText=this.state.tp;
    document.getElementById('xp').innerText=this.state.xp+'/'+this.state.xn;
    this._updateBadge();
    this.renderCardsOnly();
    this.renderEquipment();
    this.renderInventory();
    this.renderSkillBar();
    this._updateFightBtn();
  }

  renderCardsOnly() {
    const st=this.state,s=this.getStats();
    
    const sb=document.getElementById('stance-badge');
    if(st.stance==='agro'){sb.className='stance-badge stance-agro';sb.innerText='AGRO';sb.classList.remove('hidden');}
    else if(st.stance==='def'){sb.className='stance-badge stance-def';sb.innerText='DEF';sb.classList.remove('hidden');}
    else sb.classList.add('hidden');

    const pPct=Math.max(0,Math.ceil(st.p.chp)/s.hp*100);
    const pHasBuff=(st.pBuffs||[]).some(b=>BD[b.id]?.type==='buff');
    const pHasDebuff=(st.pBuffs||[]).some(b=>BD[b.id]?.type==='debuff');
    document.getElementById('p-card').className='unit-card'
      +(st.pSt>0?' stunned':'')+(st.pShield?' shielded':'')+(st.pEvading?' evading':'')
      +(pHasBuff?' buffed':'')+(pHasDebuff?' debuffed':'');
    document.getElementById('p-name').innerHTML=`YOU <small style="color:var(--sec);font-size:0.44rem">${st.p.n}</small>`;
    const pf=document.getElementById('p-f');
    pf.style.width=pPct+'%';pf.style.background=pPct>60?'#16a34a':pPct>30?'#d97706':'#dc2626';
    document.getElementById('p-t').innerText=Math.max(0,Math.ceil(st.p.chp))+' / '+s.hp;
    document.getElementById('p-s').innerText=Math.max(0,Math.ceil(st.p.chp))+' / '+s.hp +' ⚔️'+s.atk+' 🛡️'+s.def+' ⚡'+Math.floor(st.energy)
      +(s.acc>0.85?` 🎯${Math.round(s.acc*100)}%`:'')+
      (s.eva>0.05?` 💨${Math.round(s.eva*100)}%`:'');
    this._updateEnergyUI();

    const ps=document.getElementById('p-status');ps.innerHTML='';
    if(st.pSt>0)   ps.innerHTML+=`<span class="pip pip-stun">💤STUN (${st.pSt.toFixed(1)}s)</span>`;
    if(st.pShield) ps.innerHTML+='<span class="pip pip-block">🛡BLOCK</span>';
    if(st.pEvading)ps.innerHTML+='<span class="pip pip-evade">💨EVADE</span>';
    if(st.pImmune) ps.innerHTML+='<span class="pip pip-immune">IMMUNE</span>';
    (st.pBuffs||[]).forEach(b=>{const d=BD[b.id];if(!d)return;ps.innerHTML+=`<span class="pip ${d.type==='buff'?'pip-buff':'pip-debuff'}">${d.icon}${d.name}(${(b.turns*2.5).toFixed(1)}s)</span>`;});

    if(st.enemy){
      const e=st.enemy,ePct=Math.max(0,e.hp/e.mhp*100),enraged=ePct<25;
      const eMults=this.getMults(e.buffs);
      const eHasBuff=(e.buffs||[]).some(b=>BD[b.id]?.type==='buff');
      const eHasDebuff=(e.buffs||[]).some(b=>BD[b.id]?.type==='debuff');
      document.getElementById('e-card').classList.remove('hidden');
      document.getElementById('e-card').className='unit-card'+(st.eSt>0?' stunned':'')+(enraged?' enraged':'')+(eHasBuff?' buffed':'')+(eHasDebuff?' debuffed':'');
      document.getElementById('e-n-disp').innerHTML=`<span style="color:${e.color}">${e.pre}</span> FOE <small style="color:#444;font-size:0.44rem">LV${e.lv}${e.specials?.length?' •'+e.specials.join('/'):''}</small>`;
      const ef=document.getElementById('e-f');ef.style.width=ePct+'%';ef.style.background=ePct>60?'#dc2626':ePct>30?'#d97706':'#ff4500';
      document.getElementById('e-t').innerText=Math.max(0,Math.ceil(e.hp))+' / '+Math.ceil(e.mhp);
      const eAtk=Math.floor(e.atk*(1+(e.stallPenalty||0)*0.10)*eMults.atkM*(enraged?1.25:1));
      document.getElementById('e-s').innerText=Math.max(0,Math.ceil(e.hp))+' / '+Math.ceil(e.mhp) +' ⚔️'+eAtk+' 🛡️'+Math.floor(e.def*eMults.defM)+(enraged?' 🔥':'');
      const es=document.getElementById('e-status');es.innerHTML='';
      if(st.eSt>0)   es.innerHTML+=`<span class="pip pip-stun">💤STUN (${st.eSt.toFixed(1)}s)</span>`;
      if(enraged)  es.innerHTML+='<span class="pip pip-enrage">🔥ENRAGE</span>';
      if(e.taunted)es.innerHTML+='<span class="pip pip-block">😤TAUNTED</span>';
      (e.buffs||[]).forEach(b=>{const d=BD[b.id];if(!d)return;es.innerHTML+=`<span class="pip ${d.type==='buff'?'pip-buff':'pip-debuff'}">${d.icon}${d.name}(${(b.turns*2.5).toFixed(1)}s)</span>`;});
    }else{
      document.getElementById('e-card').classList.add('hidden');this._hideIntent();
    }
  }

  _updateFightBtn(){
    const btn=document.getElementById('fight-btn');if(!btn)return;
    const ready=performance.now()>this._fightCooldown;
    btn.disabled=!ready;
    if(!ready){
      const sec=Math.ceil((this._fightCooldown-performance.now())/1000);
      btn.innerText=`⏳ ${sec}s…`;
      clearTimeout(this._cdTick);
      this._cdTick=setTimeout(()=>this._updateFightBtn(),1000);
    }else{
      btn.innerText='⚔️ ENTER ARENA';
    }
  }

  renderSkillBar(){
    const st=this.state;
    const r1=document.getElementById('skill-row1');
    const r2=document.getElementById('skill-row2');
    if(!r1||!r2)return;
    r1.innerHTML='';r2.innerHTML='';
    if(!st.combat)return;

    const ld=LOADOUTS[st.p?.n]||LOADOUTS.Paladin;
    const en=st.energy,cds=st.cds,cfg=this.cfg;

    const mkBtn=(id,row,overrideKey)=>{
      const sk=SKILLS[id];if(!sk)return;
      const cdKey=sk.cd;
      
      const remSec=cdKey&&cds[cdKey]>0?cds[cdKey]:0;
      const onCd=remSec>0;
      const enCost=sk.eCfg?cfg[sk.eCfg]:0;
      const actualCost=(id==='mend'&&st.p.n==='Paladin')?0:enCost;
      const noEn=actualCost>0&&en<actualCost;
      const isQueued=!sk.offgcd&&this.gcd.queued===id;

      const btn=document.createElement('button');
      btn.dataset.skill=id;

      const qBadge=isQueued?`<span class="q-badge">Q</span>`:'';

      if(sk.offgcd){
        if(id==='interrupt'){
          const intOnCd=this.intCd>0;
          btn.className='btn off-gcd'+(this.intWindowOpen?' int-ready':intOnCd?' int-cd':'');
          btn.innerHTML=`<span class="offgcd-badge">OFF-GCD</span><span class="btn-icon">${sk.icon}</span><span class="btn-lbl">${sk.label} ${intOnCd?`(${this.intCd.toFixed(1)}s)`:''}</span><span class="kb">${sk.key}</span>${actualCost?`<span class="en-cost">${actualCost}⚡</span>`:''}`;
          if(this.intCd>0||en<actualCost){btn.disabled=true;btn.classList.add('int-cd');}
        }else if(id==='stance'){
          const icons={normal:'⚔️',agro:'🔥',def:'🛡️'};
          const cls={normal:'',agro:'stance-agro',def:'stance-def'};
          btn.className='btn off-gcd '+(cls[st.stance]||'');
          btn.innerHTML=`<span class="offgcd-badge">OFF-GCD</span><span class="btn-icon">${icons[st.stance]||'⚔️'}</span><span class="btn-lbl">${st.stance.slice(0,3).toUpperCase()}</span><span class="kb">${sk.key}</span>`;
        }else{
          btn.className='btn off-gcd'+(st.auto?' active-sk':'');
          btn.innerHTML=`<span class="offgcd-badge">OFF-GCD</span><span class="btn-icon">${sk.icon}</span><span class="btn-lbl">${sk.label}</span><span class="kb">${sk.key}</span>`;
        }
      }else{
        btn.className='btn'+(onCd?' cd':noEn?' no-en':isQueued?' queued':'');
        btn.innerHTML=`${qBadge}<span class="btn-icon">${sk.icon}</span><span class="btn-lbl">${onCd?`${sk.label} (${remSec.toFixed(1)}s)`:sk.label}</span><span class="kb">${overrideKey||sk.key}</span>${actualCost?`<span class="en-cost">${actualCost}⚡</span>`:''}`;
        if(onCd)btn.disabled=true;
      }

      btn.onclick=()=>this.pressSkill(id);
      (row===1?r1:r2).appendChild(btn);
    };

    ld.row1.forEach(id=>mkBtn(id,1));
    ld.row2.forEach(id=>mkBtn(id,2));
    mkBtn('interrupt',2);mkBtn('stance',2);
  }

  _swingBasic(){
    const st=this.state;
    if(!st.combat||!st.enemy||st.pSt>0)return;
    const s=this.getStats(),e=st.enemy;
    const pM=this.getMults(st.pBuffs),eM=this.getMults(e.buffs);
    
    const hit=this.rollHit(s.acc*pM.accM,e.eva*eM.evaM);
    const critMult=(st.p.n==='Slayer'?this.cfg.multSlayerCrit:this.cfg.multCrit)/100;
    
    if(!hit){
      this.updateHud('p','Auto MISS!');
    }else{
      const cr=Math.random()<s.crit;
      const dmg=this.calcDmg(s.atk*pM.atkM,e.def*eM.defM,cr?critMult:1.0);
      this.updateHud('p',cr?'💥 AUTO CRIT! '+dmg:'⚔️ Auto '+dmg);
      
      if(cr){
          const baseDmg = Math.floor(dmg / critMult);
          const bonusDmg = dmg - baseDmg;
          this._trackP(baseDmg, 'basic');
          this._trackP(bonusDmg, 'crit');
      } else {
          this._trackP(dmg, 'basic');
      }
      e.hp-=dmg;
    }
    
    if(e.hp<=0 && !e.isDummy) this.win();
  }

  _animateSwingBar(){
    const fill=document.getElementById('swing-fill');
    if(!fill)return;
    fill.style.transition='none';
    fill.style.width='0%';
    const dur=this.cfg.swingMs;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      fill.style.transition=`width ${dur}ms linear`;
      fill.style.width='100%';
    }));
    let rem=dur;
    const txt=document.getElementById('swing-cd-txt');
    const tick=()=>{
      if(!txt||!this.state?.combat)return;
      rem-=100;
      txt.innerText=(rem/1000).toFixed(1)+'s';
      if(rem>0)setTimeout(tick,100);
    };
    setTimeout(tick,100);
  }

  battle(){
    if(performance.now()<this._fightCooldown)return;
    const st=this.state,s=this.getStats();
    st.p.chp=s.hp;
    st.energy=this.cfg.energyMax;
    Object.keys(st.cds).forEach(k=>st.cds[k]=0);
    this.intCd=0;
    st.pBuffs=[];st.pShield=st.pEvading=st.pImmune=false;
    st.pSt=0; st.eSt=0;
    st.stance='normal';

    this._cleanupCombatTimers();
    this._pDR = { count: 0, lastStun: 0 };
    this._eDR = { count: 0, lastStun: 0 };

    st.enemy=this.makeEnemy(this._enemyLvl());
    st.combat=true;
    this.pDps=[];this.eDps=[];this.fightStart=performance.now();

    this.updateHud('p','Ready!');this.updateHud('e','Charging…');
    this._setCombatLayout(true);
    
    this._startTicker();

    clearInterval(this._swingInterval);
    const swing=()=>{
      if(!this.state?.combat)return clearInterval(this._swingInterval);
      if(this.state.pSt<=0) this._swingBasic(); 
      this._animateSwingBar();
    };
    
    setTimeout(()=>{
      if(!this.state?.combat)return;
      swing();
      this._swingInterval=setInterval(swing,this.cfg.swingMs);
    },800);
    this._animateSwingBar();

    clearInterval(this._aiTimer);
    this._aiTimer = setInterval(() => {
        if(!this.state?.combat || this.state.eSt > 0) return;
        this._triggerEnemyIntent(); 
    }, 2500); 
  }

  battleDummy(){
    if(performance.now()<this._fightCooldown)return;
    const st=this.state,s=this.getStats();
    st.p.chp=s.hp;
    st.energy=this.cfg.energyMax;
    Object.keys(st.cds).forEach(k=>st.cds[k]=0);
    this.intCd=0;
    st.pBuffs=[];st.pShield=st.pEvading=st.pImmune=false;
    st.pSt=0; st.eSt=0;
    st.stance='normal';

    this._cleanupCombatTimers();
    this._pDR = { count: 0, lastStun: 0 };
    this._eDR = { count: 0, lastStun: 0 };

    st.enemy={
      pre:'Test',lv:st.lv,color:'#f59e0b',
      hp:1000000,mhp:1000000,
      atk:0,def:0,acc:0,eva:0,res:0,
      specials:[],spCds:{},buffs:[],stallPenalty:0,taunted:false,
      isDummy:true
    };
    st.combat=true;
    this.pDps=[];this.eDps=[];this.fightStart=performance.now();
    this.dummyTotalDmg=0;

    this.updateHud('p','Testing DPS!');this.updateHud('e','Dummy ready');
    this._setCombatLayout(true);
    
    this._startTicker();

    clearInterval(this._swingInterval);
    const swing=()=>{
      if(!this.state?.combat)return clearInterval(this._swingInterval);
      if(this.state.pSt<=0) this._swingBasic(); 
      this._animateSwingBar();
    };
    
    setTimeout(()=>{
      if(!this.state?.combat)return;
      swing();
      this._swingInterval=setInterval(swing,this.cfg.swingMs);
    },800);
    this._animateSwingBar();

    clearInterval(this._aiTimer);
    
    this.log('🎯 TEST DUMMY spawned! Hit ESC to end test.','info');
  }

  endDummyTest(){
    if(!this.state.combat || !this.state.enemy?.isDummy)return;
    
    const st=this.state;
    const pTot=this.pDps.reduce((s,x)=>s+x.amt,0);
    const dur=Math.max(1,(performance.now()-this.fightStart)/1000);
    const dps=Math.round(pTot/dur);
    
    st.combat=false;st.enemy=null;st.pBuffs=[];st.pShield=st.pEvading=false;st.pSt=0;st.eSt=0;
    this._cleanupCombatTimers();
    this._hideIntent();
    
    this.log(`🎯 DUMMY TEST COMPLETE | Duration: ${Math.round(dur)}s | Total Damage: ${pTot} | DPS: ${dps}`,'win');
    this.updateHud('p','Test Complete!');
    
    this._setCombatLayout(false);
    this.render();
    this._showRecap();
  }

  showModal(title,body,buttons){
    document.getElementById('modal-title').innerHTML=title;
    document.getElementById('modal-body').innerHTML=body;
    const acts=document.getElementById('modal-actions');acts.innerHTML='';
    (buttons||[]).forEach(({label,cls,fn})=>{const b=document.createElement('button');b.className='btn '+(cls||'');b.style.padding='8px 14px';b.innerText=label;b.onclick=fn;acts.appendChild(b);});
    document.getElementById('overlay').classList.remove('hidden');
    document.getElementById('modal').classList.remove('hidden');
  }
  closeModal(){document.getElementById('overlay').classList.add('hidden');document.getElementById('modal').classList.add('hidden');this._lootPend=null;}

  showLootModal(){
    const itm=this._lootPend;if(!itm)return;
    const cur=this.state.eq[itm.s],cmp=this.compareItem(itm);
    const body=`<div style="text-align:center">
      <div style="color:${this.rarity[itm.r].c};font-size:0.88rem;font-weight:900;margin-bottom:3px">${itm.n}</div>
      <div style="font-size:0.60rem;color:#555;margin-bottom:7px">LV${itm.lv} · ${itm.s}</div>
      <div style="margin-bottom:7px">${this._itemStatTags(itm)}</div>
      <div style="font-size:0.58rem;padding:4px 8px;background:#080b10;border-radius:5px">${cmp}</div>
      ${cur?`<div style="font-size:0.52rem;color:#444;margin-top:3px">Equipped: ${cur.n} (LV${cur.lv})</div>`:''}
    </div>`;
    const sellVal=Math.floor(itm.val*(itm.r>=2?0.40:0.50));
    this.showModal('⚔️ LOOT!',body,[
      {label:'✅ TAKE',    cls:'p',fn:()=>this.takeLoot()},
      {label:'⚔️ EQUIP',  cls:'',fn:()=>this.equipLoot()},
      {label:'💰 SELL '+sellVal,cls:'',fn:()=>this.sellLoot()},
      {label:'SKIP',       cls:'',fn:()=>this.closeModal()},
    ]);
  }

  equipLoot(){
    const itm=this._lootPend;if(!itm){this.closeModal();return;}
    const old=this.state.eq[itm.s];
    if(old)this.state.inv.push(old);
    this.state.eq[itm.s]=itm;
    this._lootPend=null;this.closeModal();this.save();this.render();
    this.log('Equipped '+itm.n,'win');
  }
  sellLoot(){
    const itm=this._lootPend;if(!itm){this.closeModal();return;}
    const v=Math.floor(itm.val*(itm.r>=2?0.40:0.50));
    this.state.gd+=v;
    this.log('Sold '+itm.n+' for '+v+'💰');
    this._lootPend=null;this.closeModal();this.save();this.render();
  }
  takeLoot(){
    if(!this._lootPend){this.closeModal();return;}
    if(this.state.inv.length>=14){const v=Math.floor(this._lootPend.val*0.45);this.state.gd+=v;this.log('Bag full — sold for '+v+'💰');}
    else this.state.inv.push(this._lootPend);
    this._lootPend=null;this.closeModal();this.save();this.render();
  }

  log(m,cls=''){
    const ts=new Date().toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    this.logData.unshift('['+ts+'] '+m.replace(/<[^>]+>/g,''));
    if(this.logData.length>200)this.logData.pop();
    const l=document.getElementById('log');
    l.innerHTML=`<div class="log-msg ${cls}">${m}</div>`+l.innerHTML;
    const msgs=l.querySelectorAll('.log-msg');if(msgs.length>80)msgs[msgs.length-1].remove();
  }
  updateHud(side,msg){document.getElementById('hud-'+side).innerText=msg;this.log((side==='p'?'👤':'👹')+' '+msg);}

  copyLog(){
    const text=this.logData.join('\n'),btn=document.getElementById('copy-btn');
    const r=()=>{btn.innerHTML='📋 COPY LOG';btn.style.background='';};
    navigator.clipboard.writeText(text).then(()=>{btn.innerHTML='✅ COPIED!';btn.style.background='var(--good)';setTimeout(r,2000);})
      .catch(()=>{try{const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);btn.innerHTML='✅ COPIED!';btn.style.background='var(--good)';setTimeout(r,2000);}catch(e){btn.innerHTML='❌ Failed';setTimeout(r,2000);}});
  }

  _bindKeys(){
    document.addEventListener('keydown',ev=>{
      if(ev.target.tagName==='INPUT'||ev.target.tagName==='TEXTAREA')return;
      if(!document.getElementById('modal').classList.contains('hidden')){if(ev.key==='Escape')this.closeModal();return;}
      if(!this.state?.combat){if(ev.key==='f'||ev.key==='F')this.battle();return;}
      
      if(ev.key==='Escape' && this.state.enemy?.isDummy){
        ev.preventDefault();
        this.endDummyTest();
        return;
      }
      
      const ld=LOADOUTS[this.state.p?.n]||LOADOUTS.Paladin;
      const keyMap={'1':ld.row1[0],'2':ld.row1[1],'3':ld.row1[2],'4':ld.row1[3],
        '5':ld.row2[0],'6':ld.row2[1],'7':ld.row2[2],
        'i':'interrupt','I':'interrupt','s':'stance','S':'stance'};
      const action=keyMap[ev.key];if(!action)return;
      ev.preventDefault();this.pressSkill(action);
    });
  }

  openSessionMenu(){
    const body=`
      <div style="font-size:0.62rem;color:#555;margin-bottom:10px">
        Export saves a JSON file of the active character.<br>Import loads one back.<br>Demo loads a preset mid-game session.
      </div>
      <div style="display:flex;flex-direction:column;gap:7px">
        <button class="btn p" style="padding:10px" onclick="G.exportSession()">📤 EXPORT SESSION (JSON)</button>
        <label style="cursor:pointer">
          <div class="btn" style="padding:10px;text-align:center">📥 IMPORT SESSION (JSON)</div>
          <input type="file" accept=".json" style="display:none" onchange="G.importSession(this)">
        </label>
        <button class="btn" style="padding:10px;background:#1a2a12;border-color:#22c55e;color:#86efac" onclick="G.loadDemo()">🎮 LOAD DEMO SESSION</button>
      </div>`;
    this.showModal('💿 SESSION',body,[{label:'CLOSE',cls:'',fn:()=>this.closeModal()}]);
  }

  exportSession(){
    if(!this.state?.p){this.log('No character to export','lose');return;}
    this.save();
    const data=JSON.stringify(this.state,null,2);
    const blob=new Blob([data],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download='nexus_session_'+this.state.p.n+'_LV'+this.state.lv+'.json';
    a.click();URL.revokeObjectURL(url);
    this.log('Session exported','info');
    this.closeModal();
  }

  importSession(input){
    const file=input.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=e=>{
      try{
        const data=JSON.parse(e.target.result);
        if(!data.p||!data.p.n)throw new Error('Invalid session file');
        data.combat=false;data.enemy=null;data.pBuffs=data.pBuffs||[];
        data.pSt=0;data.eSt=0;data.pShield=false;data.pEvading=false;data.pImmune=false;
        this.state=data;this.saves[this.activeSlot]=data;
        this._saveSlot(this.activeSlot,data);this._saveMeta();
        this.closeModal();location.reload();
      }catch(err){
        this.log('Import failed: '+err.message,'lose');
        this.closeModal();
      }
    };
    reader.readAsText(file);
  }

  loadDemo(){
    if(!confirm('Load demo session? This replaces the current character in slot '+(this.activeSlot+1)+'.')){return;}
    const d=JSON.parse(JSON.stringify(DEMO_SAVE));
    d.combat=false;d.enemy=null;d.pBuffs=[];d.energy=this.cfg.energyMax;
    d.pSt=0; d.eSt=0;
    this._saveSlot(this.activeSlot,d);this._saveMeta();
    this.closeModal();location.reload();
  }

  renderHeroPick(){
    const h=document.getElementById('hero-pick');
    h.innerHTML=`<h2 style="text-align:center;margin:20px 0 4px;font-family:Cinzel;color:var(--warn)">NEXUS ARENA</h2>
      <p style="text-align:center;color:#3d4a5c;font-size:0.58rem;margin-bottom:14px">Slot ${this.activeSlot+1} — Choose your fighter</p>`;
    Object.entries(LOADOUTS).forEach(([name,ld])=>{
      const base=ld.baseStats;
      const d=document.createElement('div');d.className='hero-card';d.style.borderColor=ld.color;
      d.innerHTML=`<b style="font-size:0.83rem;color:${ld.color}">${name}</b>
        <div class="hero-passive">${ld.passive}</div>
        <div style="margin-bottom:6px">
          ${statTag('hp',base.hp)}${statTag('atk',base.atk)}${statTag('def',base.def)}
        </div>
        <div style="font-size:0.53rem;color:#3d4a5c">
          Skills: ${ld.row1.map(id=>SKILLS[id]?.icon||id).join(' ')} | ${ld.row2.map(id=>SKILLS[id]?.icon||id).join(' ')}
        </div>`;
      d.onclick=()=>{this.state.p={n:name,...base,chp:base.hp};this.show();this._initShop();this.save();};
      h.appendChild(d);
    });
  }
}
