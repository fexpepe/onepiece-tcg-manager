import { useState, useRef, useEffect, useMemo } from "react";

// ── Prompts ───────────────────────────────────────────────────────────────────
const IDENTIFY_SYSTEM = `You are an expert One Piece TCG card identifier. The image may contain 1–6 cards.
For each card extract: name, nameEN (English), setCode (e.g. OP12), cardNumber (e.g. OP12-070),
rarity (C|UC|R|SR|L|SEC|SP), language (JP|EN), color (Red|Blue|Green|Purple|Black|Yellow|Multi).
Respond ONLY with a valid JSON array. No markdown.`;

const PRICE_SYSTEM = `You are a One Piece TCG price researcher. Follow these steps exactly:

STEP 1 — OPTCG.GG (primary source — always try first):
- Fetch: https://www.optcg.gg/products/cards/CARDNUMBER
  Example: https://www.optcg.gg/products/cards/OP07-116
- This page renders the TCGPlayer Market Price directly in HTML (look for "Market Price" field).
- Also find the TCGPlayer product link on the page and extract the product URL.
- This works for all standard card numbers (OP01-OP12, EB01-EB03, ST sets).

STEP 2 — If OPTCG.GG fails or shows no price, fall back to TCGPlayer direct search:
- Search: https://www.tcgplayer.com/search/one-piece-card-game/product?q=CARDNUMBER
- Open the specific product page (URL format: tcgplayer.com/product/XXXXXX/one-piece-...)
- Extract the MARKET PRICE (median of recent completed sales, NOT lowest listing price)
- If not found by number, retry with: CARDNAME + set full name
  Set codes → full names:
  OP01=Romance Dawn, OP02=Paramount War, OP03=Pillars of Strength,
  OP04=Kingdoms of Intrigue, OP05=Awakening of the New Era, OP06=Wings of the Captain,
  OP07=500 Years in the Future, OP08=Two Legends, OP09=The Four Emperors,
  OP10=Royal Blood, OP11=Egghead, OP12=Legacy of the Master,
  EB01=Memorial Collection, EB02=Anime 25th Collection, EB03=Heroines Edition

STEP 3 — Liga One Piece (BRL):
- Fetch the card page directly (already known URL format)
- If not available, search ligaonepiece.com.br for the card number or name
- Return price in BRL and direct card URL

Return ONLY valid JSON (no markdown):
{"tcgplayer":{"price":1.23,"currency":"USD","url":"https://www.tcgplayer.com/product/XXXXXX/...","found":true},"ligaonepiece":{"price":4.56,"currency":"BRL","url":"https://...","found":true}}
Use null+false if not found. Always return the most specific URL available (product page > search page).`;

// ── Helpers ───────────────────────────────────────────────────────────────────
const toBase64 = (f) => new Promise((res,rej) => { const r=new FileReader(); r.onload=()=>res(r.result.split(",")[1]); r.onerror=rej; r.readAsDataURL(f); });

const callClaude = async (body, apiKey) => {
 const res = await fetch("https://api.anthropic.com/v1/messages", {
 method:"POST", headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
 body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:2000,...body}),
 });
 if(!res.ok) throw new Error(`API ${res.status}`);
 return res.json();
};

const extractArray = (t) => { const m=t.replace(/```json\n?|```/g,"").trim().match(/\[[\s\S]*\]/); if(!m) throw 0; return JSON.parse(m[0]); };
const extractJSON = (t) => { const m=t.replace(/```json\n?|```/g,"").trim().match(/\{[\s\S]*\}/); if(!m) throw 0; return JSON.parse(m[0]); };

const USD_BRL = 5.75;
const DRIVE_FILE_ID = "1qSfoxdPVKFlzTI69mZP870zUFJP2O12S"; // onepiece-tcg-collection.json
const calcAvg = (tcp, liga) => { const a=tcp?.price?tcp.price*USD_BRL:null, b=liga?.price||null; if(a&&b) return ((a+b)/2).toFixed(2); return (a||b)?(a||b).toFixed(2):null; };
const cardKey = (c) => `${c.cardNumber}__${c.language}`;

const RARITY = { C:{c:"#94a3b8",l:"C"}, UC:{c:"#22c55e",l:"UC"}, R:{c:"#3b82f6",l:"R"},
 SR:{c:"#a855f7",l:"SR"}, L:{c:"#f59e0b",l:"L"}, SEC:{c:"#ef4444",l:"SEC"}, SP:{c:"#ec4899",l:"SP"} };
const CONDITIONS = ["NM","LP","MP","HP","DMG"];
const langFlag = (l) => l==="JP"?"🇯🇵":"🇺🇸";

const tcgUrl = (c) => `https://www.tcgplayer.com/search/one-piece-card-game/product?q=${encodeURIComponent(c.cardNumber)}`;
const ligaUrl = (c) => {
 const numPad = c.cardNumber.split("-")[1];
 const name = c.nameEN||c.name;
 const card = `${name} (${numPad}) (${c.cardNumber})`;
 return `https://www.ligaonepiece.com.br/?view=cards/card&card=${encodeURIComponent(card)}&ed=${c.setCode}&num=${c.cardNumber}`;
};

const SEED_CARDS = [
 {id:1001,name:"Sanji",nameEN:"Sanji",setCode:"OP12",cardNumber:"OP12-070",rarity:"R",language:"EN",color:"Purple",quantity:1,condition:"NM"},
 {id:1002,name:"Kalgara",nameEN:"Kalgara",setCode:"OP12",cardNumber:"OP12-099",rarity:"R",language:"EN",color:"Yellow",quantity:1,condition:"NM"},
 {id:1003,name:"Marguerite",nameEN:"Marguerite",setCode:"EB03",cardNumber:"EB03-027",rarity:"R",language:"EN",color:"Blue",quantity:1,condition:"NM"},
 {id:1004,name:"Monkey.D.Dragon",nameEN:"Monkey D. Dragon",setCode:"OP07",cardNumber:"OP07-001",rarity:"L",language:"EN",color:"Red",quantity:1,condition:"NM"},
 {id:1005,name:"Yamato",nameEN:"Yamato",setCode:"EB03",cardNumber:"EB03-057",rarity:"R",language:"EN",color:"Yellow",quantity:1,condition:"NM"},
 {id:1006,name:"Uta",nameEN:"Uta",setCode:"EB03",cardNumber:"EB03-061",rarity:"SEC",language:"EN",color:"Green",quantity:1,condition:"NM"},
 {id:1007,name:"Roronoa Zoro",nameEN:"Roronoa Zoro",setCode:"OP12",cardNumber:"OP12-036",rarity:"C",language:"EN",color:"Green",quantity:1,condition:"NM"},
 {id:1008,name:"Blaze Slice",nameEN:"Blaze Slice",setCode:"OP07",cardNumber:"OP07-118",rarity:"R",language:"EN",color:"Yellow",quantity:1,condition:"NM"},
 {id:1009,name:"Jinbe",nameEN:"Jinbe",setCode:"OP12",cardNumber:"OP12-009",rarity:"UC",language:"EN",color:"Red",quantity:1,condition:"NM"},
 {id:1010,name:"Atlas",nameEN:"Atlas",setCode:"OP07",cardNumber:"OP07-098",rarity:"UC",language:"EN",color:"Yellow",quantity:1,condition:"NM"},
 {id:1011,name:"Roronoa Zoro",nameEN:"Roronoa Zoro",setCode:"OP12",cardNumber:"OP12-020",rarity:"L",language:"EN",color:"Green",quantity:1,condition:"NM"},
 {id:1012,name:"Stussy",nameEN:"Stussy",setCode:"EB03",cardNumber:"EB03-043",rarity:"R",language:"EN",color:"Purple",quantity:1,condition:"NM"},
 {id:1013,name:"Five Warlords of the Sea",nameEN:"Five Warlords of the Sea",setCode:"OP03",cardNumber:"OP03-119",rarity:"R",language:"EN",color:"Multi",quantity:1,condition:"NM"},
 {id:1014,name:"Donquixote Rosinante",nameEN:"Donquixote Rosinante",setCode:"OP12",cardNumber:"OP12-061",rarity:"L",language:"EN",color:"Purple",quantity:1,condition:"NM"},
 {id:1015,name:"Baby 5",nameEN:"Baby 5",setCode:"EB03",cardNumber:"EB03-036",rarity:"C",language:"EN",color:"Purple",quantity:1,condition:"NM"},
 {id:1016,name:"Ice Block: Pheasant Peck",nameEN:"Ice Block: Pheasant Peck",setCode:"OP12",cardNumber:"OP12-057",rarity:"C",language:"EN",color:"Blue",quantity:1,condition:"NM"},
 {id:1017,name:"I Re-Quasar Helllp!!",nameEN:"I Re-Quasar Helllp!!",setCode:"OP07",cardNumber:"OP07-115",rarity:"C",language:"EN",color:"Yellow",quantity:1,condition:"NM"},
 {id:1018,name:"Keep Out",nameEN:"Keep Out",setCode:"OP07",cardNumber:"OP07-018",rarity:"C",language:"EN",color:"Red",quantity:1,condition:"NM"},
];

// ── Main ──────────────────────────────────────────────────────────────────────
export default function App() {
 const [cards, setCards] = useState([]);
 const [view, setView] = useState("collection");
 const [pendingBatch, setPendingBatch] = useState([]);
 const [imgPreview, setImgPreview] = useState(null);
 const [busy, setBusy] = useState(false);
 const [busyMsg, setBusyMsg] = useState("");
 const [driveFileId, setDriveFileId] = useState(DRIVE_FILE_ID);
 const [driveInput, setDriveInput] = useState(DRIVE_FILE_ID);
 const [showDriveInput, setShowDriveInput] = useState(false);
 const [sheetError, setSheetError] = useState(null);
 const [toast, setToast] = useState(null);
 const [removedIds, setRemovedIds] = useState(new Set());
 const [showResetModal, setShowResetModal] = useState(false);
 // Filters & sort
 const [filterSet, setFilterSet] = useState("");
 const [filterRarity, setFilterRarity] = useState("");
 const [filterLang, setFilterLang] = useState("");
 const [filterCond, setFilterCond] = useState("");
 const [sortBy, setSortBy] = useState("name");
 const [sortDir, setSortDir] = useState("asc");
 const [selectedIds, setSelectedIds] = useState(new Set());
 // Inline editing
 const [editingId, setEditingId] = useState(null);
 const [editValues, setEditValues] = useState({});
 // Admin / API key
 const [apiKey, setApiKey] = useState("");
 const [apiKeyInput, setApiKeyInput] = useState("");
 const [showApiModal, setShowApiModal] = useState(false);
 const [showApiKeyText, setShowApiKeyText] = useState(false);
 const isAdmin = !!apiKey;
 const fileRef = useRef();

 // ── Persistence ──────────────────────────────────────────────────────────────
 useEffect(() => {
 (async () => {
 try { const r=await window.storage.get("driveFileId"); if(r){setDriveFileId(r.value);setDriveInput(r.value);} } catch{}
 try { const r=await window.storage.get("cards"); if(r) setCards(JSON.parse(r.value)); else setCards(SEED_CARDS); } catch { setCards(SEED_CARDS); }
 try { const r=await window.storage.get("apiKey"); if(r){setApiKey(r.value);setApiKeyInput(r.value);} } catch{}
 })();
 }, []);
 useEffect(() => { if(cards.length>0) window.storage.set("cards",JSON.stringify(cards)).catch(()=>{}); }, [cards]);

 const showToast = (msg,type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),4000); };

 const loginAdmin = async () => {
 const key = apiKeyInput.trim();
 if(!key.startsWith("sk-ant-")) { showToast("Chave inválida. Deve começar com sk-ant-","error"); return; }
 setApiKey(key); await window.storage.set("apiKey",key).catch(()=>{});
 setShowApiModal(false); showToast("Modo admin ativado!");
 };
 const logoutAdmin = async () => {
 setApiKey(""); setApiKeyInput("");
 await window.storage.delete("apiKey").catch(()=>{});
 showToast("Modo admin desativado.","info");
 };

 // ── Filtered & sorted cards ───────────────────────────────────────────────
 const displayCards = useMemo(() => {
 let list = [...cards];
 if(filterSet) list = list.filter(c=>c.setCode===filterSet);
 if(filterRarity) list = list.filter(c=>c.rarity===filterRarity);
 if(filterLang) list = list.filter(c=>c.language===filterLang);
 if(filterCond) list = list.filter(c=>(c.condition||"NM")===filterCond);
 list.sort((a,b) => {
 let av, bv;
 if(sortBy==="name") { av=a.nameEN||a.name; bv=b.nameEN||b.name; }
 else if(sortBy==="set"){ av=a.setCode; bv=b.setCode; }
 else if(sortBy==="rarity") {
 const order=["C","UC","R","SR","L","SEC","SP"];
 av=order.indexOf(a.rarity); bv=order.indexOf(b.rarity);
 }
 else if(sortBy==="price") {
 av=parseFloat(calcAvg(a.prices?.tcgplayer,a.prices?.ligaonepiece)||0);
 bv=parseFloat(calcAvg(b.prices?.tcgplayer,b.prices?.ligaonepiece)||0);
 }
 else if(sortBy==="addedAt") { av=a.addedAt||""; bv=b.addedAt||""; }
 if(typeof av==="string") return sortDir==="asc"?av.localeCompare(bv):bv.localeCompare(av);
 return sortDir==="asc"?av-bv:bv-av;
 });
 return list;
 }, [cards,filterSet,filterRarity,filterLang,filterCond,sortBy,sortDir]);

 // Unique sets for filter dropdown
 const allSets = useMemo(() => [...new Set(cards.map(c=>c.setCode))].sort(), [cards]);

 // Portfolio totals
 const totalCopies = cards.reduce((a,c)=>a+c.quantity,0);
 const totalValue = cards.reduce((a,c)=>{ const avg=calcAvg(c.prices?.tcgplayer,c.prices?.ligaonepiece); return a+(avg?parseFloat(avg)*c.quantity:0); },0);
 const totalValueUSD = cards.reduce((a,c)=>{ const p=c.prices?.tcgplayer?.price; return a+(p?p*c.quantity:0); },0);

 // ── Identify ──────────────────────────────────────────────────────────────
 const handleFile = async (e) => {
 const file=e.target.files?.[0]; if(!file) return;
 setImgPreview(URL.createObjectURL(file));
 setBusy(true); setBusyMsg(" Identificando cartas..."); setView("identifying");
 try {
 const b64=await toBase64(file);
 const data=await callClaude({system:IDENTIFY_SYSTEM,messages:[{role:"user",content:[
 {type:"image",source:{type:"base64",media_type:file.type,data:b64}},
 {type:"text",text:"Identify ALL One Piece TCG cards visible. Return JSON array."},
 ]}]},apiKey);
 const text=data.content?.find(b=>b.type==="text")?.text||"[]";
 const batch=extractArray(text).map((c,i)=>({...c,quantity:1,condition:"NM",_tempId:Date.now()+i}));
 if(!batch.length) throw 0;
 setPendingBatch(batch); setRemovedIds(new Set()); setView("confirm");
 } catch { showToast("Não foi possível identificar. Tente com melhor iluminação.","error"); setView("collection"); }
 finally { setBusy(false); if(fileRef.current) fileRef.current.value=""; }
 };

 const updatePending = (tid,k,v) => setPendingBatch(p=>p.map(c=>c._tempId===tid?{...c,[k]:v}:c));
 const toggleRemove = (tid) => setRemovedIds(p=>{const n=new Set(p);n.has(tid)?n.delete(tid):n.add(tid);return n;});

 const confirmBatch = () => {
 const toAdd=pendingBatch.filter(c=>!removedIds.has(c._tempId));
 if(!toAdd.length){showToast("Nenhuma carta selecionada.","error");return;}
 let added=0,updated=0;
 setCards(prev=>{let next=[...prev];
 const now=new Date().toISOString();
 for(const card of toAdd){
 const {_tempId,...clean}=card;
 const idx=next.findIndex(c=>cardKey(c)===cardKey(clean));
 if(idx>=0){next[idx]={...next[idx],quantity:next[idx].quantity+clean.quantity};updated++;}
 else{next.push({...clean,id:Date.now()+Math.random(),addedAt:now});added++;}
 }
 return next;
 });
 showToast(` ${added} adicionada(s)${updated?`, ${updated} atualizada(s)`:""}`);
 setPendingBatch([]); setRemovedIds(new Set()); setImgPreview(null); setView("collection");
 };

 // ── Inline edit ───────────────────────────────────────────────────────────
 const startEdit = (card) => { setEditingId(card.id); setEditValues({quantity:card.quantity,condition:card.condition||"NM"}); };
 const saveEdit = (id) => {
 setCards(prev=>prev.map(c=>c.id===id?{...c,...editValues}:c));
 setEditingId(null); showToast("Atualizado!");
 };
 const cancelEdit = () => setEditingId(null);

 // ── Prices ────────────────────────────────────────────────────────────────
 const fetchPrice = async (card) => {
 const data=await callClaude({system:PRICE_SYSTEM,tools:[{type:"web_search_20250305",name:"web_search"}],
 messages:[{role:"user",content:`Find prices for One Piece TCG: "${card.nameEN||card.name}" (${card.cardNumber}, ${card.rarity}, ${card.language}).`}]},apiKey);
 const text=data.content?.find(b=>b.type==="text")?.text; if(!text) return null;
 try{const r=extractJSON(text); if(r.tcgplayer&&!r.tcgplayer.url) r.tcgplayer.url=tcgUrl(card); if(r.ligaonepiece&&!r.ligaonepiece.url) r.ligaonepiece.url=ligaUrl(card); return r;} catch{return null;}
 };

  const searchAllPrices = async () => {
    // Search selected cards that have no price; if nothing selected, search all without price
    const pool = selectedIds.size > 0
      ? cards.filter(c => selectedIds.has(c.id) && !c.prices)
      : cards.filter(c => !c.prices);
    if(!pool.length){
      showToast(
        selectedIds.size > 0
          ? "Todas as cartas selecionadas já têm preço."
          : `Todas as cartas já têm preço. Use "Atualizar Preços" para re-buscar.`,
        "info"
      );
      return;
    }
    setBusy(true); const upd=[...cards]; let done=0;
    for(let i=0;i<upd.length;i++){
      if(!pool.find(p=>p.id===upd[i].id)) continue;
      done++;
      setBusyMsg(`Buscando ${done}/${pool.length}: ${upd[i].nameEN||upd[i].name}`);
      upd[i]={...upd[i],prices:await fetchPrice(upd[i])};
      setCards([...upd]);
    }
    setBusy(false);
    clearSelection();
    showToast(`Busca concluída! ${done} carta(s) atualizada(s).`);
  };

 const retryPrice = async (id) => {
 const card=cards.find(c=>c.id===id); if(!card) return;
 setBusy(true); setBusyMsg(` Re-buscando: ${card.cardNumber}...`);
 const prices=await fetchPrice(card);
 setCards(prev=>prev.map(c=>c.id===id?{...c,prices}:c));
 setBusy(false); showToast(prices?"Preços atualizados!":"Não encontrado.","info");
 };

  const updateAllPrices = async () => {
    // Re-fetch ALL cards, including those that already have prices
    setBusy(true); const upd=[...cards]; let done=0;
    for(let i=0;i<upd.length;i++){
      done++;
      setBusyMsg(`Atualizando ${done}/${upd.length}: ${upd[i].nameEN||upd[i].name}`);
      upd[i]={...upd[i],prices:await fetchPrice(upd[i])};
      setCards([...upd]);
    }
    setBusy(false); showToast(`Preços atualizados! (${upd.length} cartas)`);
  };

 // ── Sheet export ──────────────────────────────────────────────────────────
 const q = (v) => '"'+String(v).replace(/"/g,'""')+'"';

 const exportToSheets = async () => {
 setBusy(true); setSheetError(null); setBusyMsg(" Criando planilha...");
 const today=new Date().toLocaleDateString("pt-BR");
 const headers=["Nome","Nome EN","Set","Número","Raridade","Idioma","Condição","Qtd",
 "Preço TCGPlayer (USD)","Link TCGPlayer","Preço Liga OP (BRL)","Link Liga OP","Preço Médio (BRL)","Adicionada em"];
 const csvRows=cards.map((c,i)=>{
 const rn=i+2;
 const avg=`=IF(AND(I${rn}<>"",K${rn}<>""),AVERAGE(I${rn}*${USD_BRL},K${rn}),IF(I${rn}<>"",I${rn}*${USD_BRL},K${rn}))`;
 const tcp=c.prices?.tcgplayer, liga=c.prices?.ligaonepiece;
 return [c.name,c.nameEN||c.name,c.setCode,c.cardNumber,c.rarity,c.language,c.condition||"NM",c.quantity,
 tcp?.price?.toFixed(2)||"", tcp?.url||tcgUrl(c),
 liga?.price?.toFixed(2)||"", liga?.url||ligaUrl(c), avg,
 c.addedAt?new Date(c.addedAt).toLocaleDateString("pt-BR"):""].map(q).join(",");
 });
 const csv="\uFEFF"+[headers.map(q).join(","),...csvRows].join("\n");
 const b64=btoa(unescape(encodeURIComponent(csv)));
 try {
 const data=await callClaude({
 system:"You are a Google Drive assistant. Create the file and return the Google Sheets URL.",
 mcp_servers:[{type:"url",url:"https://drivemcp.googleapis.com/mcp/v1",name:"google-drive"}],
 messages:[{role:"user",content:`Create a Google Sheets file titled "One Piece TCG — Coleção (${today})" with mimeType "text/csv" and this base64 content: ${b64}\nReturn the URL.`}],
 },apiKey);
 const allText=(data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n");
 const urlMatch=allText.match(/https:\/\/docs\.google\.com\/spreadsheets\/[^\s"'\)\\]+/);
 if(urlMatch){
 const url=urlMatch[0]; setSheetUrl(url); setSheetInput(url);
 
 showToast(` ${cards.length} cartas exportadas!`);
 } else setSheetError("Não foi possível capturar o link. Verifique o Google Drive.");
 } catch { setSheetError("Erro ao exportar. Use o CSV como alternativa."); }
 finally { setBusy(false); }
 };

 const linkDrive = () => {
 const id = driveInput.trim();
 if(!id){showToast("ID inválido.","error");return;}
 setDriveFileId(id); window.storage.set("driveFileId",id).catch(()=>{});
 setShowDriveInput(false); showToast("Arquivo JSON vinculado! ");
 };

 const exportCSV = () => {
 const headers=["Nome","Nome EN","Set","Número","Raridade","Idioma","Condição","Qtd","Preço TCGPlayer (USD)","Link TCGPlayer","Preço Liga OP (BRL)","Link Liga OP","Preço Médio (BRL)","Adicionada em"];
 const rows=cards.map((c,i)=>{
 const rn=i+2; const tcp=c.prices?.tcgplayer, liga=c.prices?.ligaonepiece;
 const avg=calcAvg(tcp,liga)||"";
 return [c.name,c.nameEN||c.name,c.setCode,c.cardNumber,c.rarity,c.language,c.condition||"NM",c.quantity,
 tcp?.price?.toFixed(2)||"",tcp?.url||tcgUrl(c),liga?.price?.toFixed(2)||"",liga?.url||ligaUrl(c),avg,
 c.addedAt?new Date(c.addedAt).toLocaleDateString("pt-BR"):""].map(q).join(",");
 });
 const csv="\uFEFF"+[headers.map(q).join(","),...rows].join("\n");
 const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));
 a.download=`onepiece_tcg_${new Date().toISOString().slice(0,10)}.csv`; a.click(); showToast("CSV exportado!");
 };

 const resetAll = async () => {
 setCards([]); setDriveFileId(DRIVE_FILE_ID); setDriveInput(DRIVE_FILE_ID); setSheetError(null);
 setFilterSet(""); setFilterRarity(""); setFilterLang(""); setFilterCond("");
 setView("collection"); setShowResetModal(false);
 await Promise.all([window.storage.delete("cards").catch(()=>{}),window.storage.delete("driveFileId").catch(()=>{})]);
 showToast("Tudo resetado!","info");
 };
 const loadSeed = async () => {
 setBusy(true); setBusyMsg(" Carregando coleção do Drive...");
 try {
 const data = await callClaude({
 system: "You are a Google Drive assistant. Fetch the file content and return it as plain JSON text.",
 mcp_servers:[{type:"url",url:"https://drivemcp.googleapis.com/mcp/v1",name:"google-drive"}],
 messages:[{role:"user",content:`Read the file with ID "${driveFileId}" from Google Drive and return its full JSON content as plain text, nothing else.`}],
 },apiKey);
 const text = (data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n");
 const match = text.match(/\{[\s\S]*\}/);
 if(!match) throw new Error("No JSON found");
 const parsed = JSON.parse(match[0]);
 const loaded = parsed.cards || parsed;
 setCards(loaded);
 await window.storage.set("cards", JSON.stringify(loaded));
 showToast(` ${loaded.length} cartas carregadas do Drive! (${parsed.updatedAt||""})`);
 } catch(e) {
 console.error(e);
 // Fallback to local seed
 setCards(SEED_CARDS);
 await window.storage.set("cards", JSON.stringify(SEED_CARDS));
 showToast(` Erro no Drive, usando seed local (${SEED_CARDS.length} cartas)`, "info");
 } finally { setBusy(false); }
 };

  const saveToDrive = async () => {
    setBusy(true); setBusyMsg("Salvando no Drive...");
    try {
      const payload = JSON.stringify({ cards, updatedAt: new Date().toISOString().slice(0,10) }, null, 2);
      const b64 = btoa(unescape(encodeURIComponent(payload)));
      const data = await callClaude({
        system: "You are a Google Drive assistant. Create a JSON file and after creating it, return its file ID in this exact format on a line by itself: FILE_ID=XXXXXXX",
        mcp_servers:[{type:"url",url:"https://drivemcp.googleapis.com/mcp/v1",name:"google-drive"}],
        messages:[{role:"user",content:`Create a Google Drive file with title "onepiece-tcg-collection.json", mimeType "application/json", disableConversionToGoogleType true, and this base64 content: ${b64}
Return the new file ID as: FILE_ID=THE_ID`}],
      },apiKey);
      const text = (data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n");
      const idMatch = text.match(/FILE_ID=([A-Za-z0-9_-]{10,})/);
      if(idMatch) {
        const newId = idMatch[1];
        setDriveFileId(newId); setDriveInput(newId);
        await window.storage.set("driveFileId", newId);
        showToast(`${cards.length} cartas salvas! ID atualizado automaticamente.`);
      } else {
        showToast(`${cards.length} cartas salvas! Novo arquivo criado no Drive.`);
      }
    } catch(e) { console.error(e); showToast("Erro ao salvar no Drive.", "error"); }
    finally { setBusy(false); }
  };

 const removeCard = (id) => setCards(p=>p.filter(c=>c.id!==id));

  const toggleSelect = (id) => setSelectedIds(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const toggleSelectAll = () => {
    if(selectedIds.size === displayCards.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(displayCards.map(c=>c.id)));
  };
  const clearSelection = () => setSelectedIds(new Set());

 const activeCount=pendingBatch.filter(c=>!removedIds.has(c._tempId)).length;

 // ── Render ────────────────────────────────────────────────────────────────
 return (
 <div style={{minHeight:"100vh",background:"#06090f",color:"#e2e8f0",fontFamily:"'Segoe UI','Helvetica Neue',sans-serif"}}>
 <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,background:"radial-gradient(ellipse 60% 40% at 15% 10%,rgba(220,38,38,.07) 0%,transparent 70%),radial-gradient(ellipse 50% 40% at 85% 90%,rgba(251,191,36,.05) 0%,transparent 70%)"}}/>

 {/* ── Header ── */}
 <header style={{position:"sticky",top:0,zIndex:100,background:"rgba(6,9,15,.92)",backdropFilter:"blur(16px)",borderBottom:"1px solid rgba(251,191,36,.12)",padding:"0 24px",display:"flex",alignItems:"center",justifyContent:"space-between",height:64}}>
 <div style={{display:"flex",alignItems:"center",gap:12}}>
 <div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,#dc2626,#7f1d1d)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,boxShadow:"0 0 20px rgba(220,38,38,.3)"}}></div>
 <div>
 <div style={{fontSize:16,fontWeight:900,letterSpacing:3,background:"linear-gradient(90deg,#fbbf24,#ef4444)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>ONE PIECE TCG</div>
 <div style={{fontSize:9,color:"#475569",letterSpacing:4,textTransform:"uppercase"}}>Collection Manager</div>
 </div>
 </div>
 {/* Portfolio stats */}
 <div style={{display:"flex",gap:12,alignItems:"center"}}>
 {cards.length>0&&<>
 <Stat label="Cartas únicas" value={cards.length}/>
 <Stat label="Total de cópias" value={totalCopies}/>
 {totalValue>0&&<>
 {totalValueUSD>0&&<Stat label=" Valor (USD)" value={`$${totalValueUSD.toFixed(2)}`} accent/>}
 <Stat label=" Valor (BRL)" value={`R$${totalValue.toFixed(2)}`} accent/>
 </>}
 </>}
 {isAdmin
 ? <button onClick={logoutAdmin} style={{background:"rgba(5,150,105,.15)",border:"1px solid rgba(5,150,105,.35)",color:"#34d399",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:12,fontWeight:700}}>Admin ✓</button>
 : <button onClick={()=>setShowApiModal(true)} style={{background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.12)",color:"#475569",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:12,fontWeight:700}}>Admin</button>}
 </div>
 </header>

 <main style={{maxWidth:1300,margin:"0 auto",padding:"24px",position:"relative",zIndex:1}}>

 {/* ── Drive JSON panel ── */}
 <div style={{background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.07)",borderRadius:12,padding:"12px 16px",marginBottom:16}}>
 <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
 <span style={{fontSize:16}}></span>
 <div style={{flex:1,fontSize:13,color:"#93c5fd"}}>
 Arquivo JSON vinculado —&nbsp;
 <span style={{fontSize:11,color:"#334155",fontFamily:"monospace"}}>{driveFileId}</span>
 </div>
 <div style={{display:"flex",gap:8}}>
 <a href={`https://drive.google.com/file/d/${driveFileId}/view`} target="_blank" rel="noreferrer"
 style={{background:"rgba(37,99,235,.15)",color:"#60a5fa",borderRadius:7,padding:"6px 14px",fontSize:12,fontWeight:700,textDecoration:"none"}}>
 Ver no Drive ↗</a>
 <button onClick={()=>setShowDriveInput(v=>!v)}
 style={{background:"rgba(251,191,36,.1)",border:"1px solid rgba(251,191,36,.25)",color:"#fbbf24",borderRadius:7,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>
 Trocar arquivo</button>
 </div>
 </div>
 {showDriveInput&&<div style={{display:"flex",gap:8,marginTop:10,alignItems:"center"}}>
 <div style={{fontSize:12,color:"#475569",whiteSpace:"nowrap"}}>ID do arquivo:</div>
 <input value={driveInput} onChange={e=>setDriveInput(e.target.value)}
 placeholder="Cole aqui o ID do arquivo JSON no Drive…"
 style={{flex:1,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:7,padding:"8px 12px",color:"#e2e8f0",fontSize:13,outline:"none",fontFamily:"monospace"}}
 onFocus={e=>e.target.style.borderColor="rgba(251,191,36,.4)"} onBlur={e=>e.target.style.borderColor="rgba(255,255,255,.1)"}
 onKeyDown={e=>e.key==="Enter"&&linkDrive()}/>
 <Btn onClick={linkDrive} gradient="linear-gradient(135deg,#059669,#064e3b)" shadow="rgba(5,150,105,.3)">Vincular</Btn>
 <button onClick={()=>setShowDriveInput(false)}
 style={{background:"transparent",border:"1px solid rgba(255,255,255,.1)",borderRadius:7,padding:"8px 12px",color:"#475569",cursor:"pointer",fontSize:13}}></button>
 </div>}
 </div>

 {/* ── Action bar ── */}
 {view!=="confirm"&&<div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
 {isAdmin&&<Btn onClick={()=>fileRef.current?.click()} disabled={busy} gradient="linear-gradient(135deg,#dc2626,#991b1b)" shadow="rgba(220,38,38,.35)">Adicionar Foto (até 6 cartas)</Btn>}
 {cards.length>0&&isAdmin&&<>
 <Btn onClick={searchAllPrices} disabled={busy} gradient="linear-gradient(135deg,#059669,#064e3b)" shadow="rgba(5,150,105,.3)">
              {selectedIds.size>0?`Buscar Selecionadas (${selectedIds.size})`:"Buscar Preços"}
            </Btn>
 <Btn onClick={updateAllPrices} disabled={busy} gradient="linear-gradient(135deg,#0891b2,#0c4a6e)" shadow="rgba(8,145,178,.3)">Atualizar Preços</Btn>
 <Btn onClick={exportToSheets} disabled={busy} gradient="linear-gradient(135deg,#2563eb,#1e3a8a)" shadow="rgba(37,99,235,.3)">Exportar para Sheets</Btn>
 <Btn onClick={exportCSV} disabled={busy} gradient="linear-gradient(135deg,#7c3aed,#4c1d95)" shadow="rgba(124,58,237,.3)">CSV</Btn>
 </>}
 {isAdmin&&<>
 <button onClick={loadSeed} disabled={busy}
 style={{background:"rgba(251,191,36,.08)",border:"1px solid rgba(251,191,36,.2)",color:"#fbbf2490",borderRadius:9,padding:"10px 16px",cursor:"pointer",fontSize:13,fontWeight:700,transition:"all .2s"}}
 onMouseEnter={e=>{e.currentTarget.style.color="#fbbf24";e.currentTarget.style.background="rgba(251,191,36,.15)";}}
 onMouseLeave={e=>{e.currentTarget.style.color="#fbbf2490";e.currentTarget.style.background="rgba(251,191,36,.08)";}}>
 Carregar do Drive</button>
 <button onClick={saveToDrive} disabled={busy}
 style={{background:"rgba(14,165,233,.08)",border:"1px solid rgba(14,165,233,.2)",color:"#38bdf890",borderRadius:9,padding:"10px 16px",cursor:"pointer",fontSize:13,fontWeight:700,transition:"all .2s"}}
 onMouseEnter={e=>{e.currentTarget.style.color="#38bdf8";e.currentTarget.style.background="rgba(14,165,233,.15)";}}
 onMouseLeave={e=>{e.currentTarget.style.color="#38bdf890";e.currentTarget.style.background="rgba(14,165,233,.08)";}}>
 Salvar no Drive</button>
 <button onClick={()=>setShowResetModal(true)}
 style={{marginLeft:"auto",background:"transparent",border:"1px solid rgba(239,68,68,.2)",color:"#ef444460",borderRadius:9,padding:"10px 16px",cursor:"pointer",fontSize:13,fontWeight:700,transition:"all .2s"}}
 onMouseEnter={e=>{e.currentTarget.style.color="#ef4444";e.currentTarget.style.background="rgba(239,68,68,.08)";}}
 onMouseLeave={e=>{e.currentTarget.style.color="#ef444460";e.currentTarget.style.background="transparent";}}>
 Resetar tudo</button>
 </>}
 {!isAdmin&&cards.length===0&&<div style={{fontSize:13,color:"#334155"}}>Entre como admin para adicionar cartas.</div>}
 <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{display:"none"}}/>
 </div>}

 {/* ── Filters & sort ── */}
 {cards.length>0&&view==="collection"&&<div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
 <Select value={filterSet} onChange={setFilterSet} options={["",...allSets]} labels={["Todos os Sets",...allSets]} label="Set"/>
 <Select value={filterRarity} onChange={setFilterRarity} options={["","C","UC","R","SR","L","SEC","SP"]} labels={["Raridade","C","UC","R","SR","L","SEC","SP"]} label="Raridade"/>
 <Select value={filterLang} onChange={setFilterLang} options={["","EN","JP"]} labels={["Idioma","EN 🇺🇸","JP 🇯🇵"]} label="Idioma"/>
 <Select value={filterCond} onChange={setFilterCond} options={["","NM","LP","MP","HP","DMG"]} labels={["Condição","NM","LP","MP","HP","DMG"]} label="Condição"/>
 <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
 <Select value={sortBy} onChange={setSortBy} options={["name","set","rarity","price","addedAt"]} labels={["Nome","Set","Raridade","Preço","Data de adição"]} label="Ordenar"/>
 <button onClick={()=>setSortDir(d=>d==="asc"?"desc":"asc")}
 style={{background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:7,padding:"7px 12px",color:"#94a3b8",cursor:"pointer",fontSize:14}}>
 {sortDir==="asc"?"↑":"↓"}</button>
 </div>
 {(filterSet||filterRarity||filterLang||filterCond)&&
 <button onClick={()=>{setFilterSet("");setFilterRarity("");setFilterLang("");setFilterCond("");}}
 style={{background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.2)",color:"#ef4444",borderRadius:7,padding:"7px 12px",cursor:"pointer",fontSize:12,fontWeight:600}}>
 Limpar filtros</button>}
 {displayCards.length!==cards.length&&<span style={{fontSize:12,color:"#475569"}}>Mostrando {displayCards.length} de {cards.length}</span>}
 </div>}

 {/* ── Busy ── */}
 {busy&&<div style={{background:"rgba(251,191,36,.04)",border:"1px solid rgba(251,191,36,.18)",borderRadius:10,padding:"14px 18px",marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
 <Spinner/><span style={{color:"#fbbf24",fontSize:14}}>{busyMsg}</span>
 </div>}

 {/* ── Sheet error ── */}
 {sheetError&&<div style={{background:"rgba(220,38,38,.07)",border:"1px solid rgba(220,38,38,.25)",borderRadius:10,padding:"12px 16px",marginBottom:16,color:"#fca5a5",fontSize:13}}> {sheetError}</div>}

 {/* ── Toast ── */}
 {toast&&<div style={{position:"fixed",bottom:24,right:24,zIndex:200,background:toast.type==="error"?"rgba(220,38,38,.95)":toast.type==="info"?"rgba(37,99,235,.95)":"rgba(5,150,105,.95)",borderRadius:10,padding:"12px 20px",boxShadow:"0 8px 32px rgba(0,0,0,.4)",fontSize:14,fontWeight:600,color:"white",animation:"slideIn .3s ease"}}>{toast.msg}</div>}

 {/* ── Identifying ── */}
 {view==="identifying"&&imgPreview&&<div style={{background:"rgba(255,255,255,.025)",border:"1px solid rgba(251,191,36,.15)",borderRadius:14,padding:24,marginBottom:24,display:"flex",alignItems:"center",gap:20}}>
 <img src={imgPreview} alt="card" style={{width:130,borderRadius:10,opacity:.75,objectFit:"cover",boxShadow:"0 8px 24px rgba(0,0,0,.5)"}}/>
 <div><div style={{color:"#fbbf24",fontWeight:700,fontSize:15,marginBottom:6}}>Analisando até 6 cartas...</div>
 <div style={{color:"#475569",fontSize:13}}>Identificando nome, número, raridade e idioma</div></div>
 </div>}

 {/* ── Batch confirm ── */}
 {view==="confirm"&&pendingBatch.length>0&&<div>
 <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}>
 <div>
 <div style={{fontSize:15,fontWeight:800,color:"#fbbf24",letterSpacing:1}}> {pendingBatch.length} CARTA{pendingBatch.length>1?"S":""} IDENTIFICADA{pendingBatch.length>1?"S":""}</div>
 <div style={{fontSize:12,color:"#475569",marginTop:3}}>Revise, edite e confirme antes de adicionar</div>
 </div>
 <div style={{display:"flex",gap:8}}>
 <button onClick={()=>{setPendingBatch([]);setRemovedIds(new Set());setImgPreview(null);setView("collection");}}
 style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.1)",borderRadius:9,padding:"9px 18px",color:"#64748b",cursor:"pointer",fontSize:13,fontWeight:600}}>Cancelar</button>
 <Btn onClick={confirmBatch} gradient="linear-gradient(135deg,#dc2626,#991b1b)" shadow="rgba(220,38,38,.3)">Confirmar {activeCount} carta{activeCount!==1?"s":""}</Btn>
 </div>
 </div>
 <div style={{display:"grid",gridTemplateColumns:"180px 1fr",gap:20,alignItems:"start"}}>
 {imgPreview&&<div style={{position:"sticky",top:80}}>
 <img src={imgPreview} alt="cards" style={{width:"100%",borderRadius:12,objectFit:"cover",boxShadow:"0 12px 40px rgba(0,0,0,.6)"}}/>
 <div style={{textAlign:"center",marginTop:8,fontSize:11,color:"#334155"}}>{pendingBatch.length} detectada{pendingBatch.length>1?"s":""}</div>
 </div>}
 <div style={{display:"flex",flexDirection:"column",gap:12}}>
 {pendingBatch.map((card,idx)=>{
 const isRm=removedIds.has(card._tempId), isDup=cards.some(c=>cardKey(c)===cardKey(card));
 const rm=RARITY[card.rarity]||RARITY["C"];
 return <div key={card._tempId} style={{background:isRm?"rgba(239,68,68,.04)":"rgba(255,255,255,.03)",border:`1px solid ${isRm?"rgba(239,68,68,.2)":isDup?"rgba(251,191,36,.25)":"rgba(255,255,255,.08)"}`,borderRadius:12,padding:16,opacity:isRm?.4:1,transition:"all .2s"}}>
 <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
 <div style={{display:"flex",alignItems:"center",gap:8}}>
 <span style={{background:"rgba(255,255,255,.06)",borderRadius:5,padding:"2px 9px",fontSize:11,color:"#475569",fontWeight:700}}>#{idx+1}</span>
 {isDup&&!isRm&&<span style={{background:"rgba(251,191,36,.1)",border:"1px solid rgba(251,191,36,.3)",color:"#fbbf24",borderRadius:5,padding:"2px 9px",fontSize:10,fontWeight:700}}> Já na coleção</span>}
 {isRm&&<span style={{color:"#ef4444",fontSize:11,fontWeight:700}}>REMOVIDA</span>}
 </div>
 <button onClick={()=>toggleRemove(card._tempId)} style={{background:isRm?"rgba(5,150,105,.15)":"rgba(239,68,68,.1)",border:`1px solid ${isRm?"rgba(5,150,105,.3)":"rgba(239,68,68,.25)"}`,color:isRm?"#34d399":"#ef4444",borderRadius:7,padding:"4px 12px",cursor:"pointer",fontSize:12,fontWeight:700}}>
 {isRm?"↩ Restaurar":" Remover"}</button>
 </div>
 {!isRm&&<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
 {[["Nome","name"],["Nome EN","nameEN"],["Set","setCode"],["Número","cardNumber"]].map(([l,k])=>
 <Field key={k} label={l} value={card[k]||""} onChange={v=>updatePending(card._tempId,k,v)}/>)}
 <div>
 <div style={{fontSize:10,color:"#475569",marginBottom:4,textTransform:"uppercase",letterSpacing:1,fontWeight:600}}>Raridade</div>
 <select value={card.rarity||""} onChange={e=>updatePending(card._tempId,"rarity",e.target.value)}
 style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:7,padding:"7px 9px",color:rm.c,width:"100%",fontSize:13,outline:"none",fontWeight:800}}>
 {Object.keys(RARITY).map(r=><option key={r} value={r} style={{background:"#1e293b",color:RARITY[r].c}}>{r}</option>)}
 </select>
 </div>
 <div>
 <div style={{fontSize:10,color:"#475569",marginBottom:4,textTransform:"uppercase",letterSpacing:1,fontWeight:600}}>Idioma</div>
 <select value={card.language||""} onChange={e=>updatePending(card._tempId,"language",e.target.value)}
 style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:7,padding:"7px 9px",color:"#e2e8f0",width:"100%",fontSize:13,outline:"none"}}>
 <option value="EN" style={{background:"#1e293b"}}>🇺🇸 EN</option>
 <option value="JP" style={{background:"#1e293b"}}>🇯🇵 JP</option>
 </select>
 </div>
 <div>
 <div style={{fontSize:10,color:"#475569",marginBottom:4,textTransform:"uppercase",letterSpacing:1,fontWeight:600}}>Condição</div>
 <select value={card.condition||"NM"} onChange={e=>updatePending(card._tempId,"condition",e.target.value)}
 style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:7,padding:"7px 9px",color:"#e2e8f0",width:"100%",fontSize:13,outline:"none"}}>
 {CONDITIONS.map(c=><option key={c} value={c} style={{background:"#1e293b"}}>{c}</option>)}
 </select>
 </div>
 <Field label="Quantidade" value={card.quantity} type="number" onChange={v=>updatePending(card._tempId,"quantity",parseInt(v)||1)}/>
 </div>}
 </div>;
 })}
 </div>
 </div>
 <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:20,paddingTop:16,borderTop:"1px solid rgba(255,255,255,.06)"}}>
 <button onClick={()=>{setPendingBatch([]);setRemovedIds(new Set());setImgPreview(null);setView("collection");}}
 style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.1)",borderRadius:9,padding:"10px 20px",color:"#64748b",cursor:"pointer",fontSize:13,fontWeight:600}}>Cancelar</button>
 <Btn onClick={confirmBatch} gradient="linear-gradient(135deg,#dc2626,#991b1b)" shadow="rgba(220,38,38,.3)">Confirmar {activeCount} carta{activeCount!==1?"s":""}</Btn>
 </div>
 </div>}

 {/* ── Empty ── */}
 {cards.length===0&&view==="collection"&&<div style={{textAlign:"center",padding:"80px 20px"}}>
 <div style={{fontSize:64,marginBottom:16}}>‍</div>
 <div style={{fontSize:20,fontWeight:800,color:"#1e293b",marginBottom:8,letterSpacing:1}}>COLEÇÃO VAZIA</div>
 <div style={{fontSize:14,color:"#334155"}}>Tire uma foto com <strong style={{color:"#ef4444"}}>até 6 cartas</strong> lado a lado para começar</div>
 </div>}

 {/* ── Collection table ── */}
 {cards.length>0&&view==="collection"&&<div style={{background:"rgba(255,255,255,.018)",border:"1px solid rgba(255,255,255,.06)",borderRadius:14,overflow:"auto"}}>
 <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
 <thead>
 <tr style={{background:"rgba(251,191,36,.04)",borderBottom:"1px solid rgba(251,191,36,.12)"}}>
 <th style={{padding:"12px 10px",width:36}}><input type="checkbox" checked={displayCards.length>0&&selectedIds.size===displayCards.length} onChange={toggleSelectAll} style={{cursor:"pointer",width:15,height:15,accentColor:"#fbbf24"}}/></th>
 {["Carta","Set / Nº","Raridade","Idioma","Cond.","Qtd","TCGPlayer","Liga OP","Média (BRL)","Adicionada",""].map(h=>(
 <th key={h} style={{padding:"12px 14px",textAlign:"left",color:"#475569",fontWeight:700,fontSize:10,textTransform:"uppercase",letterSpacing:1.2,whiteSpace:"nowrap"}}>{h}</th>
 ))}
 </tr>
 </thead>
 <tbody>
 {displayCards.map((card,i)=>{
 const tcp=card.prices?.tcgplayer, liga=card.prices?.ligaonepiece, avg=calcAvg(tcp,liga);
 const rm=RARITY[card.rarity]||RARITY["C"];
 const isEditing=editingId===card.id;
 const condColor={"NM":"#22c55e","LP":"#fbbf24","MP":"#f97316","HP":"#ef4444","DMG":"#7f1d1d"};
 return <tr key={card.id}
 style={{borderBottom:"1px solid rgba(255,255,255,.035)",background:i%2===0?"transparent":"rgba(255,255,255,.012)",transition:"background .15s"}}
 onMouseEnter={e=>e.currentTarget.style.background="rgba(251,191,36,.03)"}
 onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"transparent":"rgba(255,255,255,.012)"}>
 <td style={{padding:"12px 10px"}}><input type="checkbox" checked={selectedIds.has(card.id)} onChange={()=>toggleSelect(card.id)} style={{cursor:"pointer",width:15,height:15,accentColor:"#fbbf24"}}/></td>
 {/* Name */}
 <td style={{padding:"12px 14px"}}>
 <div style={{fontWeight:700,color:"#e2e8f0"}}>{card.nameEN||card.name}</div>
 {card.nameEN&&card.name!==card.nameEN&&<div style={{fontSize:11,color:"#334155",marginTop:1}}>{card.name}</div>}
 </td>
 {/* Set/Number */}
 <td style={{padding:"12px 14px"}}>
 <div style={{fontWeight:700,color:"#cbd5e1",fontSize:12}}>{card.setCode}</div>
 <div style={{fontSize:11,color:"#475569",marginTop:1}}>{card.cardNumber}</div>
 </td>
 {/* Rarity */}
 <td style={{padding:"12px 14px"}}>
 <span style={{background:`${rm.c}18`,border:`1px solid ${rm.c}40`,color:rm.c,borderRadius:5,padding:"3px 9px",fontSize:11,fontWeight:800}}>{card.rarity}</span>
 </td>
 {/* Language */}
 <td style={{padding:"12px 14px",fontSize:18}}>{langFlag(card.language)}</td>
 {/* Condition — editable */}
 <td style={{padding:"12px 14px"}}>
 {isEditing
 ? <select value={editValues.condition||"NM"} onChange={e=>setEditValues(v=>({...v,condition:e.target.value}))}
 style={{background:"rgba(255,255,255,.08)",border:"1px solid rgba(251,191,36,.3)",borderRadius:6,padding:"4px 6px",color:"#e2e8f0",fontSize:12,outline:"none"}}>
 {CONDITIONS.map(c=><option key={c} value={c} style={{background:"#1e293b"}}>{c}</option>)}
 </select>
 : <span style={{background:`${condColor[card.condition||"NM"]}22`,border:`1px solid ${condColor[card.condition||"NM"]}44`,color:condColor[card.condition||"NM"],borderRadius:5,padding:"2px 8px",fontSize:11,fontWeight:700}}>{card.condition||"NM"}</span>}
 </td>
 {/* Quantity — editable */}
 <td style={{padding:"12px 14px",textAlign:"center"}}>
 {isEditing
 ? <input type="number" min="1" value={editValues.quantity} onChange={e=>setEditValues(v=>({...v,quantity:parseInt(e.target.value)||1}))}
 style={{width:52,background:"rgba(255,255,255,.08)",border:"1px solid rgba(251,191,36,.3)",borderRadius:6,padding:"4px 6px",color:"#fbbf24",fontSize:13,fontWeight:800,textAlign:"center",outline:"none"}}/>
 : <span style={{background:"rgba(251,191,36,.1)",border:"1px solid rgba(251,191,36,.2)",color:"#fbbf24",borderRadius:7,padding:"3px 10px",fontWeight:800,fontSize:14}}>{card.quantity}</span>}
 </td>
 {/* TCGPlayer */}
 <td style={{padding:"12px 14px"}}>
 {tcp?.price
 ? <a href={tcp.url} target="_blank" rel="noreferrer" style={{textDecoration:"none"}}>
 <div style={{fontWeight:700,color:"#60a5fa",fontSize:13}}>${tcp.price.toFixed(2)}</div>
 <div style={{fontSize:10,color:"#1d4ed8",marginTop:1}}>TCGPlayer ↗</div>
 </a>
 : card.prices
 ? <a href={tcgUrl(card)} target="_blank" rel="noreferrer" style={{textDecoration:"none",color:"#1d4ed8",fontSize:11}}>Buscar ↗</a>
 : <span style={{color:"#1e293b"}}>—</span>}
 </td>
 {/* Liga OP */}
 <td style={{padding:"12px 14px"}}>
 {liga?.price
 ? <a href={liga.url} target="_blank" rel="noreferrer" style={{textDecoration:"none"}}>
 <div style={{fontWeight:700,color:"#34d399",fontSize:13}}>R${liga.price.toFixed(2)}</div>
 <div style={{fontSize:10,color:"#065f46",marginTop:1}}>Liga OP ↗</div>
 </a>
 : card.prices
 ? <a href={ligaUrl(card)} target="_blank" rel="noreferrer" style={{textDecoration:"none",color:"#065f46",fontSize:11}}>Buscar ↗</a>
 : <span style={{color:"#1e293b"}}>—</span>}
 </td>
 {/* Average */}
 <td style={{padding:"12px 14px"}}>
 {avg?<span style={{fontWeight:900,color:"#fbbf24",fontSize:14}}>R${avg}</span>:<span style={{color:"#1e293b"}}>—</span>}
 </td>
 {/* Added date */}
 <td style={{padding:"12px 14px",whiteSpace:"nowrap"}}>
 {card.addedAt
 ? <span style={{color:"#94a3b8",fontSize:12}}>{new Date(card.addedAt).toLocaleDateString("pt-BR")}</span>
 : <span style={{color:"#1e293b"}}>—</span>}
 </td>
 {/* Actions */}
 {isAdmin&&<td style={{padding:"12px 10px"}}>
 <div style={{display:"flex",gap:4}}>
 {isEditing
 ? <>
 <button onClick={()=>saveEdit(card.id)} style={{background:"rgba(5,150,105,.15)",border:"1px solid rgba(5,150,105,.3)",color:"#34d399",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:12}}></button>
 <button onClick={cancelEdit} style={{background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",color:"#64748b",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:12}}></button>
 </>
 : <>
 <button onClick={()=>startEdit(card)} title="Editar" style={{background:"transparent",border:"1px solid rgba(251,191,36,.2)",color:"#fbbf2460",borderRadius:6,padding:"4px 7px",cursor:"pointer",fontSize:11,transition:"all .2s"}}
 onMouseEnter={e=>{e.target.style.color="#fbbf24";e.target.style.background="rgba(251,191,36,.08)";}} onMouseLeave={e=>{e.target.style.color="#fbbf2460";e.target.style.background="transparent";}}></button>
 <button onClick={()=>retryPrice(card.id)} disabled={busy} title="Atualizar preço" style={{background:"transparent",border:"1px solid rgba(96,165,250,.2)",color:"#60a5fa60",borderRadius:6,padding:"4px 7px",cursor:"pointer",fontSize:11,transition:"all .2s"}}
 onMouseEnter={e=>{e.target.style.color="#60a5fa";e.target.style.background="rgba(96,165,250,.08)";}} onMouseLeave={e=>{e.target.style.color="#60a5fa60";e.target.style.background="transparent";}}></button>
 <button onClick={()=>removeCard(card.id)} title="Remover" style={{background:"transparent",border:"1px solid rgba(239,68,68,.2)",color:"#ef444460",borderRadius:6,padding:"4px 7px",cursor:"pointer",fontSize:11,transition:"all .2s"}}
 onMouseEnter={e=>{e.target.style.color="#ef4444";e.target.style.background="rgba(239,68,68,.1)";}} onMouseLeave={e=>{e.target.style.color="#ef444460";e.target.style.background="transparent";}}></button>
 </>}
 </div>
 </td>}
 </tr>;
 })}
 </tbody>
 </table>
 </div>}

 {/* ── API Key modal ── */}
 {showApiModal&&<div onClick={()=>setShowApiModal(false)}
 style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,.85)",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)"}}>
 <div onClick={e=>e.stopPropagation()} style={{background:"#0f172a",border:"1px solid rgba(251,191,36,.3)",borderRadius:16,padding:28,maxWidth:420,width:"90%",boxShadow:"0 24px 60px rgba(0,0,0,.7)"}}>
 <div style={{fontSize:28,textAlign:"center",marginBottom:8}}></div>
 <div style={{fontSize:16,fontWeight:800,color:"#fbbf24",textAlign:"center",marginBottom:4}}>Modo Admin</div>
 <div style={{fontSize:12,color:"#475569",textAlign:"center",marginBottom:20}}>Cole sua Anthropic API key para desbloquear edição</div>
 <div style={{position:"relative",marginBottom:16}}>
 <input
 type={showApiKeyText?"text":"password"}
 value={apiKeyInput}
 onChange={e=>setApiKeyInput(e.target.value)}
 onKeyDown={e=>e.key==="Enter"&&loginAdmin()}
 placeholder="sk-ant-api03-..."
 autoFocus
 style={{width:"100%",background:"rgba(255,255,255,.05)",border:"1px solid rgba(251,191,36,.3)",borderRadius:9,padding:"10px 44px 10px 14px",color:"#e2e8f0",fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"monospace"}}/>
 <button onClick={()=>setShowApiKeyText(v=>!v)}
 style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"transparent",border:"none",color:"#475569",cursor:"pointer",fontSize:16,padding:4}}>
 {showApiKeyText?"🙈":"👁"}</button>
 </div>
 <div style={{fontSize:11,color:"#334155",marginBottom:20,lineHeight:1.6}}>
 A key fica salva apenas no seu browser (localStorage). Visitantes sem a key só visualizam a coleção.
 </div>
 <div style={{display:"flex",gap:10}}>
 <button onClick={()=>setShowApiModal(false)} style={{flex:1,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.12)",borderRadius:9,padding:"11px",color:"#64748b",cursor:"pointer",fontSize:14,fontWeight:600}}>Cancelar</button>
 <button onClick={loginAdmin} style={{flex:1,background:"linear-gradient(135deg,#fbbf24,#d97706)",border:"none",borderRadius:9,padding:"11px",color:"#000",cursor:"pointer",fontSize:14,fontWeight:800,boxShadow:"0 4px 20px rgba(251,191,36,.3)"}}>Entrar</button>
 </div>
 </div>
 </div>}

 {/* ── Reset modal ── */}
 {showResetModal&&<div onClick={()=>setShowResetModal(false)}
 style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,.8)",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)"}}>
 <div onClick={e=>e.stopPropagation()} style={{background:"#0f172a",border:"1px solid rgba(239,68,68,.4)",borderRadius:16,padding:28,maxWidth:380,width:"90%",boxShadow:"0 24px 60px rgba(0,0,0,.7)"}}>
 <div style={{fontSize:32,textAlign:"center",marginBottom:12}}></div>
 <div style={{fontSize:16,fontWeight:800,color:"#ef4444",textAlign:"center",marginBottom:8}}>Resetar tudo?</div>
 <div style={{fontSize:13,color:"#94a3b8",textAlign:"center",lineHeight:1.7,marginBottom:24}}>
 Apaga todas as cartas e desvincula a planilha.<br/>
 <span style={{fontSize:12,color:"#475569"}}>O arquivo no Google Drive NÃO será apagado.</span>
 </div>
 <div style={{display:"flex",gap:10}}>
 <button onClick={()=>setShowResetModal(false)} style={{flex:1,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.12)",borderRadius:9,padding:"12px",color:"#64748b",cursor:"pointer",fontSize:14,fontWeight:600}}>Cancelar</button>
 <button onClick={resetAll} style={{flex:1,background:"linear-gradient(135deg,#dc2626,#991b1b)",border:"none",borderRadius:9,padding:"12px",color:"white",cursor:"pointer",fontSize:14,fontWeight:800,boxShadow:"0 4px 20px rgba(220,38,38,.4)"}}>Sim, resetar</button>
 </div>
 </div>
 </div>}
 </main>
 <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes slideIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
 </div>
 );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Btn({children,onClick,disabled,gradient,shadow}){
 return <button onClick={onClick} disabled={disabled}
 style={{background:disabled?"rgba(255,255,255,.05)":gradient,border:"none",borderRadius:9,padding:"10px 20px",color:disabled?"#334155":"white",fontWeight:700,cursor:disabled?"not-allowed":"pointer",fontSize:13,boxShadow:disabled?"none":`0 4px 20px ${shadow}`,transition:"all .2s",whiteSpace:"nowrap"}}
 onMouseEnter={e=>{if(!disabled)e.currentTarget.style.transform="translateY(-1px)";}}
 onMouseLeave={e=>{e.currentTarget.style.transform="";}}>{children}</button>;
}

function Field({label,value,onChange,type="text"}){
 return <div>
 <div style={{fontSize:10,color:"#475569",marginBottom:4,textTransform:"uppercase",letterSpacing:1.2,fontWeight:600}}>{label}</div>
 <input type={type} value={value} onChange={e=>onChange(e.target.value)}
 style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:7,padding:"7px 9px",color:"#e2e8f0",width:"100%",fontSize:13,outline:"none",boxSizing:"border-box",transition:"border .2s"}}
 onFocus={e=>e.target.style.borderColor="rgba(251,191,36,.4)"} onBlur={e=>e.target.style.borderColor="rgba(255,255,255,.08)"}/>
 </div>;
}

function Select({value,onChange,options,labels,label}){
 return <select value={value} onChange={e=>onChange(e.target.value)}
 style={{background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:7,padding:"7px 10px",color:value?"#e2e8f0":"#475569",fontSize:12,outline:"none",cursor:"pointer",minWidth:100}}>
 {options.map((o,i)=><option key={o} value={o} style={{background:"#0f172a"}}>{labels?.[i]||o}</option>)}
 </select>;
}

function Stat({label,value,accent}){
 return <div style={{background:"rgba(255,255,255,.03)",border:`1px solid ${accent?"rgba(251,191,36,.25)":"rgba(255,255,255,.07)"}`,borderRadius:9,padding:"5px 12px",textAlign:"center"}}>
 <div style={{fontSize:15,fontWeight:900,color:accent?"#fbbf24":"#e2e8f0"}}>{value}</div>
 <div style={{fontSize:9,color:"#334155",textTransform:"uppercase",letterSpacing:1.5}}>{label}</div>
 </div>;
}

function Spinner(){
 return <div style={{width:16,height:16,border:"2px solid rgba(251,191,36,.2)",borderTop:"2px solid #fbbf24",borderRadius:"50%",animation:"spin .8s linear infinite",flexShrink:0}}/>;
}
