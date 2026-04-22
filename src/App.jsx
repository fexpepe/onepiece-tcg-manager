import { useState, useEffect, useMemo } from "react";

const USD_BRL = 5.75;
const GIST_ID = "dd4e9c0f027be3c6c28626a6a71da288";
const calcAvg = (tcp, liga) => { const a=tcp?.price?tcp.price*USD_BRL:null, b=liga?.price||null; if(a&&b) return ((a+b)/2).toFixed(2); return (a||b)?(a||b).toFixed(2):null; };
const cardKey = (c) => `${c.cardNumber}__${c.language}`;

const RARITY = { C:{c:"#94a3b8",l:"C"}, UC:{c:"#22c55e",l:"UC"}, R:{c:"#3b82f6",l:"R"},
 SR:{c:"#a855f7",l:"SR"}, L:{c:"#f59e0b",l:"L"}, SEC:{c:"#ef4444",l:"SEC"}, SP:{c:"#ec4899",l:"SP"} };
const CONDITIONS = ["NM","LP","MP","HP","DMG"];
const langFlag = (l) => l==="JP"?"🇯🇵":"🇺🇸";

const cardImg = (c) => `https://en.onepiece-cardgame.com/images/card/en/${c.setCode}/${c.cardNumber}.png`;

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
 {id:1019,name:"Wyper",nameEN:"Wyper",setCode:"OP15",cardNumber:"OP15-114",rarity:"SR",language:"EN",color:"Yellow",quantity:1,condition:"NM"},
];

// ── Main ──────────────────────────────────────────────────────────────────────
export default function App() {
 const [cards, setCards] = useState([]);
 const [busy, setBusy] = useState(false);
 const [busyMsg, setBusyMsg] = useState("");
 const [gistId, setGistId] = useState(GIST_ID);
 const [githubToken, setGithubToken] = useState("");
 const [githubTokenInput, setGithubTokenInput] = useState("");
 const [toast, setToast] = useState(null);
 const [showResetModal, setShowResetModal] = useState(false);
 // Filters & sort
 const [filterSet, setFilterSet] = useState("");
 const [filterRarity, setFilterRarity] = useState("");
 const [filterLang, setFilterLang] = useState("");
 const [filterCond, setFilterCond] = useState("");
 const [sortBy, setSortBy] = useState("name");
 const [sortDir, setSortDir] = useState("asc");
 const [selectedIds, setSelectedIds] = useState(new Set());
 const [gridView, setGridView] = useState(false);
 // Inline editing
 const [editingId, setEditingId] = useState(null);
 const [editValues, setEditValues] = useState({});
 // Admin
 const [showApiModal, setShowApiModal] = useState(false);
 const isAdmin = !!githubToken;

 // ── Persistence ──────────────────────────────────────────────────────────────
 useEffect(() => {
 (async () => {
 let savedGistId = GIST_ID;
 let savedToken = "";
 try { const r=await window.storage.get("gistId"); if(r){savedGistId=r.value; setGistId(r.value);} } catch{}
 try { const r=await window.storage.get("githubToken"); if(r){savedToken=r.value; setGithubToken(r.value);setGithubTokenInput(r.value);} } catch{}
 // Gist é a fonte da verdade — carrega dele se disponível
 if(savedGistId) {
 try {
 const headers = savedToken ? {Authorization:`Bearer ${savedToken}`} : {};
 const res = await fetch(`https://api.github.com/gists/${savedGistId}`,{headers});
 if(!res.ok) throw new Error(`${res.status}`);
 const data = await res.json();
 const content = data.files?.["collection.json"]?.content;
 if(!content) throw new Error("empty");
 const parsed = JSON.parse(content);
 const loaded = parsed.cards ?? parsed;
 setCards(loaded); await window.storage.set("cards",JSON.stringify(loaded));
 return;
 } catch(e) { console.warn("Gist load failed, falling back to localStorage",e); }
 }
 // Fallback: localStorage
 try { const r=await window.storage.get("cards"); if(r) setCards(JSON.parse(r.value)); } catch{}
 })();
 }, []);
 useEffect(() => { window.storage.set("cards",JSON.stringify(cards)).catch(()=>{}); }, [cards]);

 const showToast = (msg,type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),4000); };

 const loginAdmin = async () => {
 const ghToken = githubTokenInput.trim();
 if(!ghToken.startsWith("ghp_") && !ghToken.startsWith("github_pat_")) {
 showToast("Token inválido. Deve começar com ghp_ ou github_pat_","error"); return;
 }
 setGithubToken(ghToken); await window.storage.set("githubToken",ghToken).catch(()=>{});
 setShowApiModal(false); showToast("Modo admin ativado!");
 };
 const logoutAdmin = async () => {
 setGithubToken(""); setGithubTokenInput("");
 await window.storage.delete("githubToken").catch(()=>{});
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

 // ── Inline edit ───────────────────────────────────────────────────────────
 const startEdit = (card) => { setEditingId(card.id); setEditValues({quantity:card.quantity,condition:card.condition||"NM"}); };
 const saveEdit = (id) => {
 setCards(prev=>prev.map(c=>c.id===id?{...c,...editValues}:c));
 setEditingId(null); showToast("Atualizado!");
 };
 const cancelEdit = () => setEditingId(null);

 // ── GitHub Gist ───────────────────────────────────────────────────────────
 const loadFromGist = async () => {
 if(!gistId){showToast("Nenhum Gist configurado. Salve primeiro.","error");return;}
 setBusy(true); setBusyMsg("Carregando do GitHub...");
 try {
 const headers = githubToken ? {Authorization:`Bearer ${githubToken}`} : {};
 const res = await fetch(`https://api.github.com/gists/${gistId}`,{headers});
 if(!res.ok) throw new Error(`${res.status}`);
 const data = await res.json();
 const content = data.files?.["collection.json"]?.content;
 if(!content) throw new Error("file not found");
 const parsed = JSON.parse(content);
 const loaded = parsed.cards || parsed;
 setCards(loaded); await window.storage.set("cards",JSON.stringify(loaded));
 showToast(`${loaded.length} cartas carregadas do GitHub!`);
 } catch(e) {
 console.error(e); setCards(SEED_CARDS);
 await window.storage.set("cards",JSON.stringify(SEED_CARDS));
 showToast(`Erro no Gist, usando seed local (${SEED_CARDS.length} cartas)`,"info");
 } finally { setBusy(false); }
 };

 const saveToGist = async () => {
 if(!githubToken){showToast("GitHub Token necessário para salvar.","error");return;}
 setBusy(true); setBusyMsg("Salvando no GitHub...");
 try {
 const payload = JSON.stringify({cards,updatedAt:new Date().toISOString().slice(0,10)},null,2);
 const body = {description:"One Piece TCG Collection",public:false,files:{"collection.json":{content:payload}}};
 const url = gistId ? `https://api.github.com/gists/${gistId}` : "https://api.github.com/gists";
 const res = await fetch(url,{method:gistId?"PATCH":"POST",
 headers:{Authorization:`Bearer ${githubToken}`,"Content-Type":"application/json"},
 body:JSON.stringify(body)});
 if(!res.ok) throw new Error(`${res.status}`);
 const data = await res.json();
 const newId = data.id;
 setGistId(newId); await window.storage.set("gistId",newId);
 showToast(`${cards.length} cartas salvas no GitHub! ${!gistId?"Gist criado — atualize GIST_ID no código.":""}`);
 } catch(e) { console.error(e); showToast("Erro ao salvar no GitHub.","error"); }
 finally { setBusy(false); }
 };

 // ── CSV export ────────────────────────────────────────────────────────────
 const q = (v) => '"'+String(v).replace(/"/g,'""')+'"';

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
 setCards([]);
 setFilterSet(""); setFilterRarity(""); setFilterLang(""); setFilterCond("");
 setShowResetModal(false);
 await window.storage.set("cards","[]").catch(()=>{});
 // Propaga reset para o Gist (fonte da verdade)
 if(gistId && githubToken) {
 try {
 const payload = JSON.stringify({cards:[],updatedAt:new Date().toISOString().slice(0,10)},null,2);
 await fetch(`https://api.github.com/gists/${gistId}`,{method:"PATCH",
 headers:{Authorization:`Bearer ${githubToken}`,"Content-Type":"application/json"},
 body:JSON.stringify({files:{"collection.json":{content:payload}}})});
 } catch(e) { console.warn("Gist reset failed",e); }
 }
 showToast("Tudo resetado!","info");
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

 {/* ── Gist panel ── */}
 <div style={{background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.07)",borderRadius:12,padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
 <span style={{fontSize:16}}>🐙</span>
 <div style={{flex:1,fontSize:13,color:"#93c5fd"}}>
 {gistId
 ? <>Gist vinculado —&nbsp;<span style={{fontSize:11,color:"#334155",fontFamily:"monospace"}}>{gistId}</span></>
 : <span style={{color:"#334155"}}>Nenhum Gist configurado — entre como admin e clique "Salvar no GitHub".</span>}
 </div>
 {gistId&&<a href={`https://gist.github.com/${gistId}`} target="_blank" rel="noreferrer"
 style={{background:"rgba(37,99,235,.15)",color:"#60a5fa",borderRadius:7,padding:"6px 14px",fontSize:12,fontWeight:700,textDecoration:"none"}}>
 Ver no GitHub ↗</a>}
 </div>

 {/* ── Action bar ── */}
 <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
 {cards.length>0&&isAdmin&&<>
 <Btn onClick={exportCSV} disabled={busy} gradient="linear-gradient(135deg,#7c3aed,#4c1d95)" shadow="rgba(124,58,237,.3)">CSV</Btn>
 </>}
 {isAdmin&&<>
 <button onClick={loadFromGist} disabled={busy}
 style={{background:"rgba(251,191,36,.08)",border:"1px solid rgba(251,191,36,.2)",color:"#fbbf2490",borderRadius:9,padding:"10px 16px",cursor:"pointer",fontSize:13,fontWeight:700,transition:"all .2s"}}
 onMouseEnter={e=>{e.currentTarget.style.color="#fbbf24";e.currentTarget.style.background="rgba(251,191,36,.15)";}}
 onMouseLeave={e=>{e.currentTarget.style.color="#fbbf2490";e.currentTarget.style.background="rgba(251,191,36,.08)";}}>
 Carregar do GitHub</button>
 <button onClick={saveToGist} disabled={busy}
 style={{background:"rgba(14,165,233,.08)",border:"1px solid rgba(14,165,233,.2)",color:"#38bdf890",borderRadius:9,padding:"10px 16px",cursor:"pointer",fontSize:13,fontWeight:700,transition:"all .2s"}}
 onMouseEnter={e=>{e.currentTarget.style.color="#38bdf8";e.currentTarget.style.background="rgba(14,165,233,.15)";}}
 onMouseLeave={e=>{e.currentTarget.style.color="#38bdf890";e.currentTarget.style.background="rgba(14,165,233,.08)";}}>
 Salvar no GitHub</button>
 <button onClick={()=>setShowResetModal(true)}
 style={{marginLeft:"auto",background:"transparent",border:"1px solid rgba(239,68,68,.2)",color:"#ef444460",borderRadius:9,padding:"10px 16px",cursor:"pointer",fontSize:13,fontWeight:700,transition:"all .2s"}}
 onMouseEnter={e=>{e.currentTarget.style.color="#ef4444";e.currentTarget.style.background="rgba(239,68,68,.08)";}}
 onMouseLeave={e=>{e.currentTarget.style.color="#ef444460";e.currentTarget.style.background="transparent";}}>
 Resetar tudo</button>
 </>}
 {!isAdmin&&cards.length===0&&<div style={{fontSize:13,color:"#334155"}}>Entre como admin para gerenciar cartas.</div>}
 </div>

 {/* ── Filters & sort ── */}
 {cards.length>0&&<div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
 <Select value={filterSet} onChange={setFilterSet} options={["",...allSets]} labels={["Todos os Sets",...allSets]} label="Set"/>
 <Select value={filterRarity} onChange={setFilterRarity} options={["","C","UC","R","SR","L","SEC","SP"]} labels={["Raridade","C","UC","R","SR","L","SEC","SP"]} label="Raridade"/>
 <Select value={filterLang} onChange={setFilterLang} options={["","EN","JP"]} labels={["Idioma","EN 🇺🇸","JP 🇯🇵"]} label="Idioma"/>
 <Select value={filterCond} onChange={setFilterCond} options={["","NM","LP","MP","HP","DMG"]} labels={["Condição","NM","LP","MP","HP","DMG"]} label="Condição"/>
 <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
 <Select value={sortBy} onChange={setSortBy} options={["name","set","rarity","price","addedAt"]} labels={["Nome","Set","Raridade","Preço","Data de adição"]} label="Ordenar"/>
 <button onClick={()=>setSortDir(d=>d==="asc"?"desc":"asc")}
 style={{background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:7,padding:"7px 12px",color:"#94a3b8",cursor:"pointer",fontSize:14}}>
 {sortDir==="asc"?"↑":"↓"}</button>
 <button onClick={()=>setGridView(v=>!v)}
 style={{background:gridView?"rgba(251,191,36,.15)":"rgba(255,255,255,.05)",border:`1px solid ${gridView?"rgba(251,191,36,.4)":"rgba(255,255,255,.1)"}`,borderRadius:7,padding:"7px 12px",color:gridView?"#fbbf24":"#94a3b8",cursor:"pointer",fontSize:14}}>
 {gridView?"☰":"⊞"}</button>
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

 {/* ── Toast ── */}
 {toast&&<div style={{position:"fixed",bottom:24,right:24,zIndex:200,background:toast.type==="error"?"rgba(220,38,38,.95)":toast.type==="info"?"rgba(37,99,235,.95)":"rgba(5,150,105,.95)",borderRadius:10,padding:"12px 20px",boxShadow:"0 8px 32px rgba(0,0,0,.4)",fontSize:14,fontWeight:600,color:"white",animation:"slideIn .3s ease"}}>{toast.msg}</div>}

 {/* ── Empty ── */}
 {cards.length===0&&<div style={{textAlign:"center",padding:"80px 20px"}}>
 <div style={{fontSize:64,marginBottom:16}}>🃏</div>
 <div style={{fontSize:20,fontWeight:800,color:"#1e293b",marginBottom:8,letterSpacing:1}}>COLEÇÃO VAZIA</div>
 <div style={{fontSize:14,color:"#334155"}}>Entre como admin e salve cartas via GitHub Gist</div>
 </div>}

 {/* ── Grid view ── */}
 {cards.length>0&&gridView&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:16}}>
 {displayCards.map(card=>{
 const tcp=card.prices?.tcgplayer, liga=card.prices?.ligaonepiece, avg=calcAvg(tcp,liga);
 const rm=RARITY[card.rarity]||RARITY["C"];
 return <div key={card.id} style={{background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.07)",borderRadius:14,overflow:"hidden",transition:"transform .2s,border-color .2s"}}
 onMouseEnter={e=>{ e.currentTarget.style.transform="translateY(-3px)"; e.currentTarget.style.borderColor="rgba(251,191,36,.25)"; }}
 onMouseLeave={e=>{ e.currentTarget.style.transform=""; e.currentTarget.style.borderColor="rgba(255,255,255,.07)"; }}>
 <div style={{position:"relative",background:"#0a0f1a",aspectRatio:"63/88",overflow:"hidden"}}>
 <img src={cardImg(card)} alt={card.nameEN||card.name}
 style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}
 onError={e=>{e.target.style.display="none"; e.target.nextSibling.style.display="flex";}}/>
 <div style={{display:"none",position:"absolute",inset:0,alignItems:"center",justifyContent:"center",flexDirection:"column",gap:8,color:"#1e293b"}}>
 <div style={{fontSize:32}}>🃏</div>
 <div style={{fontSize:10,color:"#334155",textAlign:"center",padding:"0 8px"}}>{card.cardNumber}</div>
 </div>
 <div style={{position:"absolute",top:8,right:8}}>
 <span style={{background:`${rm.c}cc`,border:`1px solid ${rm.c}`,color:"white",borderRadius:5,padding:"2px 7px",fontSize:10,fontWeight:800}}>{card.rarity}</span>
 </div>
 {isAdmin&&<div style={{position:"absolute",top:8,left:8}}>
 <button onClick={()=>removeCard(card.id)} title="Remover" style={{background:"rgba(0,0,0,.6)",border:"1px solid rgba(239,68,68,.4)",color:"#ef4444",borderRadius:5,padding:"3px 6px",cursor:"pointer",fontSize:10}}>✕</button>
 </div>}
 </div>
 <div style={{padding:"10px 12px"}}>
 <div style={{fontWeight:700,color:"#e2e8f0",fontSize:13,marginBottom:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{card.nameEN||card.name}</div>
 <div style={{fontSize:11,color:"#475569",marginBottom:8}}>{card.cardNumber} · {langFlag(card.language)}</div>
 {avg
 ? <div style={{fontWeight:900,color:"#fbbf24",fontSize:15}}>R${avg}</div>
 : <div style={{fontSize:11,color:"#334155"}}>Sem preço</div>}
 {tcp?.price&&<div style={{fontSize:10,color:"#3b82f6",marginTop:2}}>${tcp.price.toFixed(2)} USD</div>}
 </div>
 </div>;
 })}
 </div>}

 {/* ── Collection table ── */}
 {cards.length>0&&!gridView&&<div style={{background:"rgba(255,255,255,.018)",border:"1px solid rgba(255,255,255,.06)",borderRadius:14,overflow:"auto"}}>
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
 <button onClick={()=>saveEdit(card.id)} style={{background:"rgba(5,150,105,.15)",border:"1px solid rgba(5,150,105,.3)",color:"#34d399",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:12}}>✓</button>
 <button onClick={cancelEdit} style={{background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",color:"#64748b",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:12}}>✕</button>
 </>
 : <>
 <button onClick={()=>startEdit(card)} title="Editar" style={{background:"transparent",border:"1px solid rgba(251,191,36,.2)",color:"#fbbf2460",borderRadius:6,padding:"4px 7px",cursor:"pointer",fontSize:11,transition:"all .2s"}}
 onMouseEnter={e=>{e.target.style.color="#fbbf24";e.target.style.background="rgba(251,191,36,.08)";}} onMouseLeave={e=>{e.target.style.color="#fbbf2460";e.target.style.background="transparent";}}
 >✎</button>
 <button onClick={()=>removeCard(card.id)} title="Remover" style={{background:"transparent",border:"1px solid rgba(239,68,68,.2)",color:"#ef444460",borderRadius:6,padding:"4px 7px",cursor:"pointer",fontSize:11,transition:"all .2s"}}
 onMouseEnter={e=>{e.target.style.color="#ef4444";e.target.style.background="rgba(239,68,68,.1)";}} onMouseLeave={e=>{e.target.style.color="#ef444460";e.target.style.background="transparent";}}
 >✕</button>
 </>}
 </div>
 </td>}
 </tr>;
 })}
 </tbody>
 </table>
 </div>}

 {/* ── Admin modal ── */}
 {showApiModal&&<div onClick={()=>setShowApiModal(false)}
 style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,.85)",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)"}}>
 <div onClick={e=>e.stopPropagation()} style={{background:"#0f172a",border:"1px solid rgba(251,191,36,.3)",borderRadius:16,padding:28,maxWidth:420,width:"90%",boxShadow:"0 24px 60px rgba(0,0,0,.7)"}}>
 <div style={{fontSize:28,textAlign:"center",marginBottom:8}}>🔑</div>
 <div style={{fontSize:16,fontWeight:800,color:"#fbbf24",textAlign:"center",marginBottom:4}}>Modo Admin</div>
 <div style={{fontSize:12,color:"#475569",textAlign:"center",marginBottom:20}}>Cole seu GitHub Token para desbloquear edição</div>
 <div style={{fontSize:10,color:"#475569",marginBottom:6,textTransform:"uppercase",letterSpacing:1,fontWeight:600}}>GitHub Token <span style={{color:"#334155",textTransform:"none",letterSpacing:0}}>(escopo: gist)</span></div>
 <input
 type="password"
 value={githubTokenInput}
 onChange={e=>setGithubTokenInput(e.target.value)}
 onKeyDown={e=>e.key==="Enter"&&loginAdmin()}
 placeholder="ghp_..."
 autoFocus
 style={{width:"100%",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:9,padding:"10px 14px",color:"#e2e8f0",fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"monospace",marginBottom:16}}/>
 <div style={{fontSize:11,color:"#334155",marginBottom:20,lineHeight:1.6}}>
 Token salvo apenas no seu browser (localStorage). Visitantes sem o token só visualizam a coleção.
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
 <div style={{fontSize:32,textAlign:"center",marginBottom:12}}>⚠️</div>
 <div style={{fontSize:16,fontWeight:800,color:"#ef4444",textAlign:"center",marginBottom:8}}>Resetar tudo?</div>
 <div style={{fontSize:13,color:"#94a3b8",textAlign:"center",lineHeight:1.7,marginBottom:24}}>
 Apaga todas as cartas e desvincula o Gist.<br/>
 <span style={{fontSize:12,color:"#475569"}}>O Gist no GitHub NÃO será apagado.</span>
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
