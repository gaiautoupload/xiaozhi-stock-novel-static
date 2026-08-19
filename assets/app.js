const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];
const DATA = p => `./data/${p}?v=${Date.now()}`;
const state = { config:null, manifest:null, feed:null, catalog:null, stocksHistory:null, marketIndex:null, sync:null, latestStocks:null, latestMarket:null, route:"home", chapterId:null, currentSequence:0, selectedTicker:"ALL" };

async function fetchJSON(url, fallback=null){
  try{
    const r = await fetch(url,{cache:"no-store"});
    if(!r.ok) throw new Error(`${r.status} ${url}`);
    const data = await r.json();
    localStorage.setItem(`cache:${url.split("?")[0]}`, JSON.stringify(data));
    return data;
  }catch(err){
    const cached = localStorage.getItem(`cache:${url.split("?")[0]}`);
    if(cached) return JSON.parse(cached);
    if(fallback!==null) return fallback;
    throw err;
  }
}
async function fetchText(url){
  const r=await fetch(url,{cache:"no-store"});
  if(!r.ok) throw new Error(`${r.status} ${url}`);
  return await r.text();
}
function esc(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function inlineMd(s){
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")
    .replace(/`(.+?)`/g,"<code>$1</code>")
    .replace(/\[(.+?)\]\((https?:\/\/[^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');
}
function renderMarkdown(md=""){
  md = md.replace(/^---[\s\S]*?---\s*/,"");
  const lines=md.split(/\r?\n/); let out=[], para=[];
  const flush=()=>{if(para.length){out.push(`<p>${inlineMd(para.join(" "))}</p>`);para=[];}};
  let inList=false;
  for(const raw of lines){
    const line=raw.trimEnd();
    if(/^#{1,3}\s/.test(line)){flush(); if(inList){out.push("</ul>");inList=false;} const n=line.match(/^#+/)[0].length; out.push(`<h${n}>${inlineMd(line.replace(/^#{1,3}\s+/,""))}</h${n}>`);}
    else if(/^[-*]\s+/.test(line)){flush(); if(!inList){out.push("<ul>");inList=true;} out.push(`<li>${inlineMd(line.replace(/^[-*]\s+/,""))}</li>`);}
    else if(/^---+$/.test(line)){flush(); if(inList){out.push("</ul>");inList=false;} out.push("<hr>");}
    else if(!line.trim()){flush(); if(inList){out.push("</ul>");inList=false;}}
    else para.push(line.trim());
  }
  flush(); if(inList)out.push("</ul>");
  return out.join("\n");
}
function fmtTime(s){if(!s)return "—"; try{return new Intl.DateTimeFormat("zh-TW",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"Asia/Taipei"}).format(new Date(s));}catch{return s}}
function money(n){return typeof n==="number" ? new Intl.NumberFormat("zh-TW",{style:"currency",currency:"TWD",maximumFractionDigits:0}).format(n) : "—";}
function badge(t,c=""){return `<span class="badge ${c}">${esc(t)}</span>`;}
function arr(v){return Array.isArray(v)?v:[];}
function list(items){return arr(items).length?`<ul>${arr(items).map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:`<p class="muted">尚無資料</p>`;}
function routeInfo(){
  const raw=location.hash.replace(/^#/,"")||"home"; const [route,q]=raw.split("/");
  return {route, id:q||null};
}
function setActiveNav(route){$$(".tabs a").forEach(a=>a.classList.toggle("active",a.dataset.route===route));}
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2600);}
function ratingRank(r){return {"A+":10,"A":9,"A-":8,"B+":7,"B":6,"B-":5,"C+":4,"C":3,"C-":2,"D":1}[r]??0;}

async function init(){
  state.config=await fetchJSON("./config/site.json");
  await loadCore();
  applyTheme();
  bindGlobal();
  startCountdown();
  window.addEventListener("hashchange",renderRoute);
  renderRoute();
}
async function loadCore(){
  [state.manifest,state.feed,state.catalog,state.stocksHistory,state.marketIndex,state.sync] = await Promise.all([
    fetchJSON(DATA("manifest.json"),{}),fetchJSON(DATA("feed.index.json"),{}),fetchJSON(DATA("catalog.json"),{entries:[]}),
    fetchJSON(DATA("stock-history.json"),{events:[],current:[]}),fetchJSON(DATA("market.index.json"),{updates:[]}),fetchJSON(DATA("sync-status.json"),{})
  ]);
  state.currentSequence=state.manifest.sequence||state.feed.sequence||0;
  const latest=state.manifest.latest_update_id||state.feed.latest_update_id;
  const cat=(state.catalog.entries||[]).find(x=>x.update_id===latest);
  if(cat?.stocks_path) state.latestStocks=await fetchJSON(`./${cat.stocks_path}?v=${Date.now()}`,null);
  if(!state.latestStocks && latest) state.latestStocks=await fetchJSON(DATA(`stocks/${latest}.stocks.json`),null).catch(()=>null);
  const mid=state.manifest.market_intel_latest_id||state.marketIndex.latest_market_id;
  if(mid) state.latestMarket=await fetchJSON(DATA(`market-intel/${mid}.market.json`),null).catch(()=>null);
  updateSyncUI();
}
function updateSyncUI(){
  const dot=$("#syncDot"), txt=$("#syncText");
  const errs=state.sync?.errors||[];
  if(errs.length){dot.className="sync-dot error";txt.textContent="同步有警告";}
  else if((state.sync?.feed_sequence||0)<(state.feed?.sequence||0)){dot.className="sync-dot stale";txt.textContent="快照待同步";}
  else{dot.className="sync-dot";txt.textContent=`資料 #${state.feed?.sequence||"—"}`;}
}
function applyTheme(){
  const th=localStorage.getItem("theme")||"dark";document.documentElement.dataset.theme=th;
  const fs=localStorage.getItem("readerSize")||"medium";setReaderSize(fs,false);
}
function bindGlobal(){
  $("#themeBtn").onclick=()=>{const n=document.documentElement.dataset.theme==="light"?"dark":"light";document.documentElement.dataset.theme=n;localStorage.setItem("theme",n);};
  $("#refreshBtn").onclick=()=>checkForUpdates(true);
}
function nextRefreshDate(){
  const slots=state.config?.browserRefreshMinutes||[8,28,48], now=new Date();
  for(let h=0;h<2;h++){
    const base=new Date(now);base.setHours(now.getHours()+h,0,0,0);
    for(const m of slots){const d=new Date(base);d.setMinutes(m);if(d>now)return d;}
  }
  return new Date(now.getTime()+20*60000);
}
let nextRefresh=null, retryTimer=null;
function startCountdown(){
  nextRefresh=nextRefreshDate();
  setInterval(()=>{
    const ms=nextRefresh-Date.now();
    if(ms<=0){$("#countdown").textContent="同步中"; checkForUpdates(false); nextRefresh=nextRefreshDate(); return;}
    const mm=Math.floor(ms/60000),ss=Math.floor((ms%60000)/1000);$("#countdown").textContent=`${String(mm).padStart(2,"0")}:${String(ss).padStart(2,"0")}`;
  },1000);
}
async function checkForUpdates(manual=false){
  try{
    const m=await fetchJSON(DATA("manifest.json"),{});
    if((m.sequence||0)>state.currentSequence){
      const oldLatest=state.manifest?.latest_update_id; state.manifest=m; await loadCore();
      toast(`新資料已到：#${m.sequence}`);
      const {route,id}=routeInfo();
      const wasLatest = route==="novel" && (!id || id===oldLatest);
      if(wasLatest && state.config.autoOpenLatestWhenReadingLatest) location.hash=`#novel/${m.latest_update_id}`;
      else renderRoute();
      return;
    }
    if(manual) toast("目前已是最新資料");
    scheduleRetry();
  }catch(e){toast("更新檢查失敗，保留上一版快照");scheduleRetry();}
}
let retries=0;
function scheduleRetry(){
  const max=state.config?.refreshRetryCount||8;
  if(retries>=max){retries=0;return;}
  clearTimeout(retryTimer); retries++;
  retryTimer=setTimeout(async()=>{await checkForUpdates(false); if(retries>=max)retries=0;},(state.config?.refreshRetrySeconds||30)*1000);
}
function setReaderSize(size,persist=true){
  const map={small:"17px",medium:"19px",large:"22px"};document.documentElement.style.setProperty("--reader-size",map[size]||map.medium);
  if(persist)localStorage.setItem("readerSize",size);
  $$(".font-controls button").forEach(b=>b.classList.toggle("active",b.dataset.size===size));
}
function renderRoute(){
  const {route,id}=routeInfo();state.route=route;state.chapterId=id;setActiveNav(route);
  ({home:renderHome,novel:()=>renderNovel(id),stocks:renderStocks,"stock-history":renderStockHistory,ledger:renderLedger,market:renderMarket,characters:renderCharacters,history:renderHistory}[route]||renderHome)();
  window.scrollTo({top:0,behavior:"instant"});
}
function latestEntry(){return (state.catalog.entries||[]).slice().sort((a,b)=>(b.sequence||0)-(a.sequence||0))[0]||{};}

function renderHome(){
  const le=latestEntry(), led=state.latestStocks?.ledger||{};
  $("#app").innerHTML=`
    <section class="card hero">
      <div class="eyebrow">Drive → GitHub → Static Site</div>
      <h1>${esc(le.title||"小智股海發財記")}</h1>
      <p>網站不再依賴 Work 重建。GitHub Actions 只同步 Drive 發布包，瀏覽器每 20 分鐘檢查新 sequence；小說、選股、帳本與市場資料都由同一份發布資料驅動。</p>
      <div class="meta">${badge(`最新 #${state.feed.sequence||"—"}`,"good")}${badge(le.update_id||"—")}${badge(`市場 ${state.marketIndex.latest_market_id||"—"}`,"warn")}</div>
      <div class="kpis">
        <div class="kpi"><b>${state.feed.history_count||state.feed.sequence||0}</b><span>發布回次</span></div>
        <div class="kpi"><b>${money(led.total_assets_twd)}</b><span>總資產</span></div>
        <div class="kpi"><b>${led.stock_positions??0}</b><span>股票持股</span></div>
        <div class="kpi"><b>${state.marketIndex.sequence||0}</b><span>市場快照</span></div>
      </div>
      <div style="margin-top:18px"><a class="btn primary" href="#novel/${esc(le.update_id||"")}">閱讀最新一回</a> <a class="btn" href="#stocks">看今日選股</a></div>
    </section>
    <div class="section-head"><h2>現在值得看</h2><p>資料不足就明確顯示，不用舊數字假裝即時。</p></div>
    <div class="grid three">
      <section class="card"><div class="eyebrow">市場狀態</div><h3>${esc(state.latestMarket?.session_status||"等待同步")}</h3><p class="muted">${esc(state.latestMarket?.website_summary||"")}</p><a class="btn" href="#market">市場即時／ABC →</a></section>
      <section class="card"><div class="eyebrow">選股流程</div><h3>新增、升降評、汰換都留痕</h3><p class="muted">歷程以原始 selection_changes 優先；沒有明確變更註記時才用快照差異整理並標示來源。</p><a class="btn" href="#stock-history">看選股歷程 →</a></section>
      <section class="card"><div class="eyebrow">同步狀態</div><h3>${esc(state.sync?.message||"GitHub Actions 同步")}</h3><p class="muted">最後成功：${esc(state.sync?.last_success||"—")}</p><a class="btn" href="#history">查看資料歷史 →</a></section>
    </div>`;
}

function chapterOptions(selected){
  return (state.catalog.entries||[]).slice().sort((a,b)=>(b.sequence||0)-(a.sequence||0)).map(e=>`<option value="${esc(e.update_id)}" ${e.update_id===selected?"selected":""}>#${e.sequence} ${esc(e.title)}</option>`).join("");
}
async function renderNovel(id){
  const entries=(state.catalog.entries||[]).slice().sort((a,b)=>(b.sequence||0)-(a.sequence||0));
  const target=entries.find(x=>x.update_id===id)||entries[0];
  $("#app").innerHTML=`<div class="novel-layout">
    <aside class="card chapter-list desktop">${entries.map(e=>`<div class="chapter-link ${e.update_id===target?.update_id?"active":""}" data-id="${esc(e.update_id)}"><b>#${e.sequence} ${esc(e.title)}</b><small>${fmtTime(e.published_at)} · ${esc(e.update_id)}</small></div>`).join("")}</aside>
    <section>
      <div class="mobile-only filters"><select id="chapterSelect">${chapterOptions(target?.update_id)}</select></div>
      <article class="card">
        <div class="reader-toolbar"><div class="meta">${badge(`#${target?.sequence||"—"}`)}${badge(target?.update_id||"—")}</div>
          <div class="font-controls"><button class="btn" data-size="small">小</button><button class="btn" data-size="medium">中</button><button class="btn" data-size="large">大</button></div>
        </div>
        <div id="readerBody" class="reader"><div class="loading-card">載入章節…</div></div>
      </article>
    </section></div>`;
  $$(".chapter-link").forEach(x=>x.onclick=()=>location.hash=`#novel/${x.dataset.id}`);
  $("#chapterSelect")?.addEventListener("change",e=>location.hash=`#novel/${e.target.value}`);
  $$(".font-controls button").forEach(b=>b.onclick=()=>setReaderSize(b.dataset.size));
  setReaderSize(localStorage.getItem("readerSize")||"medium",false);
  if(!target){$("#readerBody").innerHTML=`<div class="empty">尚無章節資料</div>`;return;}
  const path=target.chapter_path||`data/chapters/${target.update_id}.md`;
  try{$("#readerBody").innerHTML=renderMarkdown(await fetchText(`./${path}?v=${Date.now()}`));}
  catch{$("#readerBody").innerHTML=`<div class="notice">這一回尚未被 GitHub Actions 從 Drive 補到本地快照。第一次部署後執行「Sync Drive & Deploy」即可自動補抓；現有網站不會因此刪除舊資料。</div>`;}
}
function renderStocks(){
  const d=state.latestStocks, listx=d?.watchlist||state.stocksHistory.current||[];
  $("#app").innerHTML=`
  <div class="section-head"><div><h2>今日選股</h2><p>${esc(d?.market_summary||"")}</p></div>${badge(d?.update_id||state.manifest.latest_update_id||"—","good")}</div>
  <div class="grid two">${listx.map(s=>`<section class="card stock-card">
    <div class="stock-top"><div><div class="eyebrow">${esc(s.ticker)} · ${esc(s.positioning)}</div><h3>${esc(s.name)}</h3><span class="status">${esc(s.trade_status||"觀察")}</span></div><div class="rating">${esc(s.rating||"—")}</div></div>
    <h4>為什麼在清單裡</h4>${list(s.evidence)}
    <h4>風險</h4>${list(s.risks)}
    <h4>確認訊號</h4>${list(s.confirm_signals)}
    <h4>失效條件</h4>${list(s.invalidations)}
    <div class="notice"><b>退出邏輯：</b>${esc(s.exit_logic||"未提供")}</div>
  </section>`).join("")||`<div class="empty">尚無選股快照</div>`}</div>`;
}
function eventClass(e){
  if(e.action?.includes("汰換")||e.action?.includes("移除")||e.action?.includes("降評"))return "down";
  if(e.action?.includes("維持"))return "maintain";return "";
}
function renderStockHistory(){
  const events=state.stocksHistory.events||[], tickers=[...new Map(events.map(e=>[e.ticker,e.name])).entries()];
  const selected=state.selectedTicker;
  const filtered=selected==="ALL"?events:events.filter(e=>e.ticker===selected);
  $("#app").innerHTML=`
  <div class="section-head"><div><h2>選股歷程</h2><p>不刪舊判斷。新增、升評、降評、汰換、定位改變都保留理由與當時證據。</p></div>${badge(`${events.length} 個變更事件`)}</div>
  <div class="notice">「原始理由」代表 stocks JSON 明確提供的 selection_changes；「自動差異整理」代表由前後快照比對產生，網站不會把推論冒充原始紀錄。</div>
  <div class="filters" style="margin-top:14px"><select id="tickerFilter"><option value="ALL">全部股票</option>${tickers.map(([t,n])=>`<option value="${esc(t)}" ${selected===t?"selected":""}>${esc(t)} ${esc(n)}</option>`).join("")}</select></div>
  <div class="timeline">${filtered.slice().sort((a,b)=>(b.sequence||0)-(a.sequence||0)).map(e=>`<div class="event ${eventClass(e)}"><div class="event-card">
    <div class="event-head"><div><b>${esc(e.ticker)} ${esc(e.name)}</b> ${badge(e.action||"變更",eventClass(e)==="down"?"danger":"")}</div><small class="muted">#${e.sequence||"—"} · ${fmtTime(e.as_of)}</small></div>
    <div style="margin-top:7px">${e.previous_rating?`${badge(e.previous_rating)} → `:""}${badge(e.rating||"—","good")} ${badge(e.positioning||"")}</div>
    <div class="event-reason">${esc(e.reason||"未提供變更理由")}</div>
    <div class="meta" style="margin-top:8px">${badge(e.reason_source==="explicit"?"原始理由":"自動差異整理",e.reason_source==="explicit"?"good":"warn")}${e.trade_status?badge(e.trade_status):""}</div>
  </div></div>`).join("")||`<div class="empty">尚無結構化選股歷程；首次 GitHub Action 同步後會回溯可取得的 stocks 快照。</div>`}</div>`;
  $("#tickerFilter").onchange=e=>{state.selectedTicker=e.target.value;renderStockHistory();};
}
function renderLedger(){
  const l=state.latestStocks?.ledger||{};
  const metrics=[
    ["總資產",l.total_assets_twd],["自由現金",l.unrestricted_cash_twd],["限制款",l.restricted_cash_twd],
    ["已認列收入",l.recognized_income_twd],["股票持倉",l.stock_positions],["股票成交",l.stock_trades],
    ["已實現損益",l.realized_pnl_twd],["未實現損益",l.unrealized_pnl_twd]
  ];
  $("#app").innerHTML=`<div class="section-head"><div><h2>交易帳本</h2><p>未付款、未驗收與意向金額不灌本金。</p></div></div>
    <div class="metric-list">${metrics.map(([k,v],i)=>`<div class="metric"><small>${k}</small><strong>${i<4||i>5?money(v):esc(v??"—")}</strong></div>`).join("")}</div>
    <section class="card" style="margin-top:16px"><h3>待完成條件</h3><p class="muted">${esc(l.pending_contracts||"無結構化資料")}</p></section>`;
}
function flatten(obj,prefix="",out=[]){
  if(obj===null||obj===undefined)return out;
  for(const [k,v] of Object.entries(obj)){
    const key=prefix?`${prefix}.${k}`:k;
    if(v && typeof v==="object" && !Array.isArray(v)) flatten(v,key,out);
    else if(!Array.isArray(v)) out.push([key,v]);
  } return out;
}
function renderMarket(){
  const m=state.latestMarket;
  if(!m){$("#app").innerHTML=`<div class="empty">市場快照尚未同步</div>`;return;}
  const idx=flatten(m.index_snapshot||{}), fx=flatten(m.fx_snapshot||{}).filter(x=>typeof x[1]!=="object").slice(0,10);
  $("#app").innerHTML=`
    <div class="section-head"><div><h2>市場即時／ABC 波段</h2><p>${esc(m.session_status||"")}</p></div>${badge(m.market_id||"—","warn")}</div>
    <div class="grid two">
      <section class="card"><div class="eyebrow">Index snapshot</div><div class="metric-list">${idx.filter(([,v])=>["number","string"].includes(typeof v)).slice(0,12).map(([k,v])=>`<div class="metric"><small>${esc(k)}</small><strong>${esc(v)}</strong></div>`).join("")}</div></section>
      <section class="card"><div class="eyebrow">USD/TWD & cross asset</div><div class="metric-list">${fx.map(([k,v])=>`<div class="metric"><small>${esc(k)}</small><strong>${esc(v)}</strong></div>`).join("")}</div></section>
    </div>
    <div class="section-head"><h2>ABC 修正波情境</h2><p>情境推演，不是確定預言。</p></div>
    <section class="card"><h3>${esc(m.abc_wave?.current_interpretation||"insufficient_data")}</h3>
      <div class="grid three">
       <div class="scenario"><b>多方情境</b><p class="muted">${esc(m.scenarios?.bullish||"—")}</p></div>
       <div class="scenario base"><b>基準情境</b><p class="muted">${esc(m.scenarios?.base||"—")}</p></div>
       <div class="scenario bear"><b>空方情境</b><p class="muted">${esc(m.scenarios?.bearish||"—")}</p></div>
      </div>
      <p><b>支撐：</b>${arr(m.abc_wave?.support).map(x=>badge(x)).join(" ")||"—"}</p>
      <p><b>壓力：</b>${arr(m.abc_wave?.resistance).map(x=>badge(x,"warn")).join(" ")||"—"}</p>
      <p class="muted"><b>替代情境：</b>${esc(m.abc_wave?.alternate_scenario||"—")}</p>
      <p class="muted"><b>失效：</b>${esc(m.abc_wave?.invalidation||"—")}</p>
    </section>
    <div class="grid two" style="margin-top:16px">
      <section class="card"><h3>下一步確認</h3>${list(m.next_confirmations)}</section>
      <section class="card"><h3>風險旗標</h3>${list(m.risk_flags)}</section>
    </div>
    <section class="card" style="margin-top:16px"><h3>重要消息</h3>${list(m.breaking_news)}</section>
    <section class="card" style="margin-top:16px"><h3>來源</h3><ol class="sources">${arr(m.sources).map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a> <small>${esc(s.published_at||"")}</small></li>`).join("")}</ol></section>`;
}
async function renderCharacters(){
  const manual=await fetchJSON(DATA("characters.manual.json"),{characters:[]});
  const mentions=await fetchJSON(DATA("character-index.json"),{characters:[]}).catch(()=>({characters:[]}));
  const map=new Map();
  for(const c of manual.characters||[])map.set(c.name,{...c,appearances:[]});
  for(const c of mentions.characters||[]){const x=map.get(c.name)||{name:c.name,role:"出場角色",note:""};x.appearances=c.appearances||[];map.set(c.name,x);}
  $("#app").innerHTML=`<div class="section-head"><div><h2>人物誌</h2><p>手動人物資料只作覆蓋層；出場紀錄由章節同步器整理，不自行替角色增加秘密或關係。</p></div></div>
  <div class="grid three">${[...map.values()].map(c=>`<section class="card character-card"><h3>${esc(c.name)}</h3>${badge(c.role||"角色")}<p class="muted">${esc(c.note||"")}</p><div class="character-appearances">出場：${arr(c.appearances).slice(-8).map(x=>`#${x.sequence}`).join("、")||"待同步"}</div></section>`).join("")||`<div class="empty">尚無人物資料</div>`}</div>`;
}
async function renderHistory(){
  const sheets=await fetchJSON(DATA("sheet-tabs.json"),{sheets:{}}).catch(()=>({sheets:{}}));
  const entries=(state.catalog.entries||[]).slice().sort((a,b)=>(b.sequence||0)-(a.sequence||0));
  $("#app").innerHTML=`<div class="section-head"><div><h2>歷史資料</h2><p>feed 只追加不覆蓋；Git 紀錄本身也是第二層版本歷史。</p></div>${badge(`${entries.length} 回`)}</div>
    <section class="card"><div class="table-wrap"><table><thead><tr><th>Seq</th><th>Update</th><th>時間</th><th>標題</th><th>章節</th><th>選股</th></tr></thead><tbody>
    ${entries.map(e=>`<tr><td>${e.sequence}</td><td>${esc(e.update_id)}</td><td>${fmtTime(e.published_at)}</td><td>${esc(e.title)}</td><td>${e.chapter_path?badge("已同步","good"):badge("待補","warn")}</td><td>${e.stocks_path?badge("有快照","good"):badge("—")}</td></tr>`).join("")}
    </tbody></table></div></section>
    <div class="section-head"><h2>固定 Sheet 快照</h2><p>若 GitHub Secret 已設定並分享 Sheet，Actions 會同步五張表為 JSON。</p></div>
    <div class="grid two">${Object.entries(sheets.sheets||{}).map(([name,rows])=>`<section class="card"><h3>${esc(name)}</h3><p class="muted">${rows.length} rows</p></section>`).join("")||`<div class="empty">目前尚未取得 Sheet API 快照；不影響小說與市場頁。</div>`}</div>`;
}
init().catch(err=>{$("#app").innerHTML=`<div class="empty">網站初始化失敗：${esc(err.message)}。可先檢查 data/ 是否已由 GitHub Actions 同步。</div>`;console.error(err);});
