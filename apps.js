// app.js - Blackjack PWA (Wong Halves + Illustrious 18)
// Local-only. Persists to localStorage. Outputs only: Hit / Stand / Double / Split.

// --------- CONFIG ----------
const STORAGE_KEY = 'bj_wong_app_v1';
const DEFAULT_DECKS = 6;
const S17 = true; // dealer stands on soft 17

// Wong Halves weights (standard): 2:+0.5, 3:+1, 4:+1, 5:+1.5, 6:+1, 7:+0.5, 8:0, 9:-0.5, 10/A:-1
const WH_VALUES = {
  '2': 0.5, '3': 1, '4': 1, '5': 1.5, '6': 1, '7': 0.5, '8': 0, '9': -0.5, '10': -1, 'A': -1
};

// Illustrious 18 (Hi-Lo indices). These are the classic I18 thresholds.
// NOTE: I18 was created for Hi-Lo. Many counters apply these TC thresholds across counts.
// We'll apply them as TC thresholds. See README for nuance.
const ILLUSTRIOUS_18 = [
  // {type:'insurance', index:3} // insurance handled separately if you want it
  {hand:'16v10', index:0, actionWhenTrue:'Stand'},   // 16 vs T -> Stand if TC >= 0 (else Hit)
  {hand:'15v10', index:4, actionWhenTrue:'Stand'},
  {hand:'10,10v5', index:5, actionWhenTrue:'Split'},
  {hand:'10,10v6', index:4, actionWhenTrue:'Split'},
  {hand:'10v10', index:4, actionWhenTrue:'Double'}, // 10 vs T => Double if TC>=4 else Hit
  {hand:'12v3', index:2, actionWhenTrue:'Stand'},
  {hand:'12v2', index:3, actionWhenTrue:'Stand'},
  {hand:'11vA', index:1, actionWhenTrue:'Double'},
  {hand:'9v2', index:1, actionWhenTrue:'Double'},
  {hand:'10vA', index:4, actionWhenTrue:'Double'},
  {hand:'9v7', index:3, actionWhenTrue:'Double'},
  {hand:'16v9', index:5, actionWhenTrue:'Stand'},
  {hand:'13v2', index:-1, actionWhenTrue:'Stand'},
  {hand:'12v4', index:0, actionWhenTrue:'Stand'},
  {hand:'12v5', index:-2, actionWhenTrue:'Stand'},
  {hand:'12v6', index:-1, actionWhenTrue:'Stand'},
  {hand:'13v3', index:-2, actionWhenTrue:'Stand'},
  // rest omitted (these give the majority of value)
];

// ---------- persistence ----------
function loadState(){
  try{
    const s = localStorage.getItem(STORAGE_KEY);
    if(!s) return {running:0, decks:DEFAULT_DECKS, player:[], dealer:[]};
    return JSON.parse(s);
  }catch(e){ return {running:0, decks:DEFAULT_DECKS, player:[], dealer:[]}; }
}
function saveState(st){ localStorage.setItem(STORAGE_KEY, JSON.stringify(st)); }

// ---------- helpers ----------
function normCard(token){
  if(!token) return null;
  token = token.trim().toUpperCase();
  if(token === 'T') token = '10';
  if(['J','Q','K'].includes(token)) token = '10';
  if(token === '1') token = 'A'; // tolerate "1" for ace
  if(token === 'ACE') token = 'A';
  if(token === 'A' || token === '8' || token === '9' || token === '7' ||
     token === '6' || token === '5' || token === '4' || token === '3' || token === '2' || token === '10'){
    return token;
  }
  return null;
}

function addToRunning(cards, state){
  for(const c of cards){
    const n = normCard(c);
    if(!n) continue;
    const w = WH_VALUES[n] || 0;
    state.running += w;
  }
  saveState(state);
}

function renderCounts(state){
  document.getElementById('rcount').textContent = state.running.toFixed(2);
  const decks = parseFloat(document.getElementById('decks').value) || state.decks || DEFAULT_DECKS;
  const trueCount = decks > 0 ? state.running / decks : state.running;
  document.getElementById('tcount').textContent = (Math.round(trueCount*100)/100).toFixed(2);
}

function handInfo(cards){
  // returns {sum, isSoft, pair}
  const parsed = cards.map(normCard).filter(Boolean);
  if(parsed.length === 0) return null;
  let total = 0, aces=0;
  for(const c of parsed){
    if(c==='A'){ total += 11; aces++; }
    else total += parseInt(c);
  }
  while(total>21 && aces>0){ total -= 10; aces--; }
  const isSoft = parsed.includes('A') && (parsed.length>=2) && (parsed.map(c=> c==='A'?11:parseInt(c)).reduce((a,b)=>a+b,0) !== total);
  const pair = (parsed.length===2 && parsed[0] === parsed[1]);
  return {sum: total, isSoft, pair, raw: parsed};
}

// basic strategy (S17) - minimal and conservative; we will then check Illustrious 18 deviations.
// returns "Hit","Stand","Double","Split"
function basicStrategy(playerCards, dealerUp){
  const info = handInfo(playerCards);
  const dealer = normCard(dealerUp);
  if(!info || !dealer) return 'Stand';
  // Pair first:
  if(info.pair){
    const p = info.raw[0];
    if(p === 'A') return 'Split';
    if(p === '8') return 'Split';
    if(p === '10') return 'Stand';
    if(p === '9'){
      const d = parseInt(dealer) || (dealer==='A'?11:11);
      if((d>=2 && d<=6) || d===8 || d===9) return 'Split';
      return 'Stand';
    }
    if(p==='7'){ if(parseInt(dealer) <=7) return 'Split'; return 'Hit'; }
    if(p==='6'){ if(parseInt(dealer) <=6) return 'Split'; return 'Hit'; }
    if(p==='5'){ /* treat as hard 10 */ return basicStrategy(['5','5'], dealerUp); }
    if(p==='4'){ if(dealer==='5' || dealer==='6') return 'Split'; return 'Hit'; }
    if(p==='3' || p==='2'){ if(parseInt(dealer) >=2 && parseInt(dealer) <=7) return 'Split'; return 'Hit'; }
  }
  // Soft
  if(info.isSoft){
    const s = info.sum;
    const d = (dealer==='A'?11:parseInt(dealer));
    if(s <=17) return 'Hit';
    if(s === 18){
      if(d>=3 && d<=6) return 'Double';
      if(d===2 || d===7 || d===8) return 'Stand';
      return 'Hit';
    }
    return 'Stand';
  }
  // Hard
  const sum = info.sum;
  const d = (dealer==='A'?11:parseInt(dealer));
  if(sum >=17) return 'Stand';
  if(sum >=13 && sum <=16){ if(d>=2 && d<=6) return 'Stand'; return 'Hit'; }
  if(sum === 12){ if(d>=4 && d<=6) return 'Stand'; return 'Hit'; }
  if(sum === 11) return 'Double';
  if(sum === 10){ if(d>=2 && d<=9) return 'Double'; return 'Hit'; }
  if(sum === 9){ if(d>=3 && d<=6) return 'Double'; return 'Hit'; }
  return 'Hit';
}

// Apply Illustrious 18 deviations (check true count against index). Returns overridden action or null.
function applyI18(playerCards, dealerUp, trueCount){
  const info = handInfo(playerCards);
  if(!info) return null;
  const sum = info.sum;
  const d = (dealerUp === 'A' ? 11 : parseInt(dealerUp));

  // Evaluate entries
  // We'll do a few common ones from the I18 set:
  // 16 vs 10 -> Stand if TC >= 0
  if(sum === 16 && d === 10){
    if(trueCount >= 0) return 'Stand';
    return null;
  }
  // 15 vs 10 -> Stand if TC >= 4
  if(sum === 15 && d === 10){
    if(trueCount >= 4) return 'Stand';
    return null;
  }
  // 10 vs 10 -> Double if TC >= 4
  if(sum === 10 && d === 10){
    if(trueCount >= 4) return 'Double';
    return null;
  }
  // 11 vs A -> Double if TC >= 1
  if(sum === 11 && d === 11){
    if(trueCount >= 1) return 'Double';
    return null;
  }
  // 9 vs 2 -> Double if TC >= 1
  if(sum === 9 && d === 2){
    if(trueCount >= 1) return 'Double';
    return null;
  }
  // 12 vs 3 -> Stand if TC >= 2
  if(sum === 12 && d === 3){
    if(trueCount >= 2) return 'Stand';
    return null;
  }
  // 12 vs 2 -> Stand if TC >= 3
  if(sum === 12 && d === 2){
    if(trueCount >= 3) return 'Stand';
    return null;
  }
  // 16 vs 9 -> Stand if TC >= 5
  if(sum === 16 && d === 9){
    if(trueCount >= 5) return 'Stand';
    return null;
  }
  // 13 vs 2 -> Stand if TC >= -1
  if(sum === 13 && d === 2){
    if(trueCount >= -1) return 'Stand';
    return null;
  }
  // 12 vs 4 -> Stand if TC >= 0
  if(sum === 12 && d === 4){
    if(trueCount >= 0) return 'Stand';
    return null;
  }
  // 12 vs 5 -> Stand if TC >= -2
  if(sum === 12 && d === 5){
    if(trueCount >= -2) return 'Stand';
    return null;
  }
  // 12 vs 6 -> Stand if TC >= -1
  if(sum === 12 && d === 6){
    if(trueCount >= -1) return 'Stand';
    return null;
  }
  // 13 vs 3 -> Stand if TC >= -2
  if(sum === 13 && d === 3){
    if(trueCount >= -2) return 'Stand';
    return null;
  }
  // 9 vs 7 -> Double if TC >= 3
  if(sum === 9 && d === 7){
    if(trueCount >= 3) return 'Double';
    return null;
  }
  // 10,10 splitting: split vs 5 if TC>=5 or vs 6 if TC>=4
  if(info.pair && info.raw[0] === '10'){
    if(d === 5 && trueCount >=5) return 'Split';
    if(d === 6 && trueCount >=4) return 'Split';
  }

  return null;
}

// main DECIDE function (updates counts for player's two cards + dealer upcard plus any extras)
function decideAndOutput(state){
  const player = state.player.slice(); // array of tokens
  const dealer = state.dealer[0] || null;
  if(player.length < 2 || !dealer){
    showResult('Stand'); // fallback, but you should enter valid
    return;
  }

  // add counts for the visible cards (player + dealer)
  addToRunning(player.concat([dealer]), state);

  // compute true count
  const decksInput = parseFloat(document.getElementById('decks').value) || state.decks || DEFAULT_DECKS;
  state.decks = decksInput;
  saveState(state);
  const trueCount = decksInput > 0 ? state.running / decksInput : state.running;

  // check I18 deviations first
  const i18 = applyI18(player, dealer, Math.round(trueCount*100)/100);

  if(i18) { showResult(i18); renderCounts(state); return; }

  // otherwise basic strategy
  const base = basicStrategy(player, dealer);
  showResult(base);
  renderCounts(state);
}

// UI helpers
function mkCardEl(v){
  const el = document.createElement('div');
  el.className = 'card';
  el.textContent = v;
  el.dataset.card = v;
  return el;
}

function refreshUI(state){
  const pc = document.getElementById('player-cards');
  const dc = document.getElementById('dealer-cards');
  pc.innerHTML = ''; dc.innerHTML = '';
  state.player.forEach(c => pc.appendChild(mkCardEl(c)));
  state.dealer.forEach(c => dc.appendChild(mkCardEl(c)));
  renderCounts(state);
}

function showResult(word){
  // MUST display only the single word
  const r = document.getElementById('resultWord');
  r.textContent = word;
  // small visual flash
  r.animate([{opacity:0.3},{opacity:1}],{duration:180,iterations:1});
}

// parse manual input lines like "8,7,6" or "| 2,K,A" or "reset" or "set decks=6"
function parseManual(line, state){
  if(!line) return;
  line = line.trim();
  if(line.toLowerCase() === 'reset'){
    state.running = 0; state.player = []; state.dealer = []; saveState(state); refreshUI(state); showResult('Reset'); return;
  }
  if(line.toLowerCase().startsWith('set decks=')){
    const n = parseFloat(line.split('=')[1]);
    if(!isNaN(n) && n>0) { state.decks = n; saveState(state); document.getElementById('decks').value = n; renderCounts(state); showResult('OK'); return; }
    showResult('Error'); return;
  }
  if(line.startsWith('|')){
    const tokens = line.slice(1).split(',').map(s=>s.trim()).filter(Boolean);
    addToRunning(tokens, state); showResult('OK'); renderCounts(state); return;
  }
  // otherwise assume cards
  const toks = line.split(',').map(s=>s.trim()).filter(Boolean);
  if(toks.length >= 3){
    // first two are player, third is dealer; remaining are extras
    state.player = [normCard(toks[0]) || toks[0], normCard(toks[1]) || toks[1]];
    state.dealer = [normCard(toks[2]) || toks[2]];
    if(toks.length>3) addToRunning(toks.slice(3), state);
    saveState(state); refreshUI(state); showResult('OK'); return;
  }
  showResult('Error');
}

// palette (cards)
function initPalette(){
  const palette = document.getElementById('palette');
  const cardFaces = ['A','2','3','4','5','6','7','8','9','10'];
  for(const f of cardFaces){
    const el = mkCardEl(f);
    el.classList.add('small');
    el.addEventListener('click', ()=> {
      const state = loadState();
      // if dealer empty, set on dealer; otherwise add to player (max flexibility)
      if(state.dealer.length===0){
        state.dealer = [f];
      } else {
        if(state.player.length < 2) state.player.push(f);
        else state.player.push(f);
      }
      saveState(state);
      refreshUI(state);
    });
    palette.appendChild(el);
  }
}

function init(){
  const state = loadState();
  if(typeof state.decks === 'undefined') state.decks = DEFAULT_DECKS;
  // wire UI
  initPalette();
  document.getElementById('decks').value = state.decks;
  refreshUI(state);

  document.getElementById('parseBtn').addEventListener('click', ()=>{
    const line = document.getElementById('manual').value;
    parseManual(line, loadState());
  });
  document.getElementById('decideBtn').addEventListener('click', ()=>{
    decideAndOutput(loadState());
  });
  document.getElementById('resetBtn').addEventListener('click', ()=>{
    const s = loadState(); s.running = 0; s.player = []; s.dealer = []; saveState(s); refreshUI(s); showResult('Reset');
  });

  // tap-to-remove card support
  document.getElementById('player-cards').addEventListener('click', (ev)=>{
    if(!ev.target.dataset || !ev.target.dataset.card) return;
    const s = loadState();
    // remove the clicked card (last occurrence)
    const idx = s.player.lastIndexOf(ev.target.dataset.card);
    if(idx >=0) { s.player.splice(idx,1); saveState(s); refreshUI(s); }
  });
  document.getElementById('dealer-cards').addEventListener('click', (ev)=>{
    if(!ev.target.dataset || !ev.target.dataset.card) return;
    const s = loadState();
    const idx = s.dealer.lastIndexOf(ev.target.dataset.card);
    if(idx >=0) { s.dealer.splice(idx,1); saveState(s); refreshUI(s); }
  });
}

document.addEventListener('DOMContentLoaded', init);