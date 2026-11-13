// Parsers for the two shops' public catalog pages. No sign-in or API key is required.
const square = "https://tennissquare.co.kr";
const metro = "https://www.tennismetro.co.kr";
const familyQueries = new Map([
  ["라켓", "racket"], ["라켓트", "racket"], ["라켓추천", "racket"],
  ["테니스라켓", "racket"], ["테니스라켓트", "racket"], ["테니스라켓추천", "racket"], ["테니스채", "racket"], ["racket", "racket"], ["racquet", "racket"],
  ["테니스화", "shoes"], ["테니스신발", "shoes"], ["신발", "shoes"], ["shoes", "shoes"],
  ["테니스공", "balls"], ["테니스볼", "balls"], ["공", "balls"], ["볼", "balls"], ["balls", "balls"],
  ["가방", "bag"], ["테니스가방", "bag"], ["그립", "grip"], ["오버그립", "grip"], ["테니스그립", "grip"]
]);
const brandNames = ["바볼랏","윌슨","요넥스","헤드","프린스","던롭","다이아뎀","솔린코","테크니화이버","라코스테","아식스","아디다스","나이키","뉴발란스","미즈노","휠라","케이스위스","낫소","스타","투나","스포니","감마","키모니","럭실론","큐텐","타키니","탄","아머스포츠"];
const squareCats = {racket:"24",shoes:"25",balls:"668",bag:"26",grip:"155"};
const metroCats = {racket:"066002",balls:"066003002",bag:"066001",grip:"066003003"};
function plain(s="") {
  return s.replace(/<[^>]+>/g, " ").replace(/&(?:nbsp|amp|quot|apos|lt|gt|#0?39|#38);/gi, x => ({"&nbsp;":" ", "&amp;":"&","&quot;":'"',"&apos;":"'","&lt;":"<","&gt;":">","&#39;":"'","&#039;":"'","&#38;":"&"})[x.toLowerCase()] || " ").replace(/\s+/g," ").trim();
}
function kindOf(name, cat, hint) {
  if (/피클볼|피클박스|배드민턴전용|스쿼시라켓|런블레이즈|러닝화|런닝화|슬리퍼|리쥬브|런닝|갤럭시 8/.test(name)) return "";
  if (/가방|백팩|배낭|키링|스몰 더플|슈퍼투어|더플백|토트백|테니스 (토트|백팩)|RH\s?X\d|라켓홀더|미니어처|미니어쳐|커버|진동방지|댐프너|범퍼|그로멧|타올|테이프|홀더|캡슐|패션|버킷|쿠션그립|오버\s?그립|리플레이스먼트|스윙커버|파우치|와펜|헤어밴드|신발끈|스트링머신|볼바구니|볼피커|캔오프너|볼 카트|클리커|점보볼|코칭볼 픽업/.test(name)) return "gear";
  if (cat==="25" || /테니스화|올코트|클레이코트화|게임코트|베이퍼|러쉬 프로|우버소닉|솔루션 스피드|코트잼|젤레졸루션|젤 레졸루션|코트 FF|하이퍼코트|그랜드코트|바리케이드|프로펄스|코트플래시|GP 챌린지|퓨전레브|임펄스|코코 CG|ECLIPSION|더 로저 프로/.test(name)) return "shoes";
  if (cat==="668" || /테니스\s?[공볼]|테니스 연습구|시합구|연습구|스타터 (레드|오렌지|그린)|챔피언[쉽십].*(캔|\d구|볼)|짜르투어.*캔/.test(name)) return "balls";
  if (cat==="24" || /테니스라켓|테니스 라켓|블레이드.*(?:그립|V\d|G[123])|퓨어\s?(?:에어로|드라이브|스트라이크).*(?:그립|GEN)|\d+\s?g\b|\d{2,3}\s?sq|\d{2}인치/i.test(name)) return "racket";
  if (hint==="racket" || hint==="balls") return hint;
  return "gear";
}
function standard(shop, id, url, name, brand, price, image, cat, hint, date, model="") {
  const kind=kindOf(name,cat,hint);
  if (!id || !name || !kind || !Number.isFinite(price) || price<=0) return null;
  const label=brand && !name.includes(brand) ? brand+" "+name : name;
  return {name:label, brand, kind, shop, price, url, date, shipping:null, image, model};
}
export function parseSquare(html, hint="", date=new Date().toLocaleDateString("sv-SE",{timeZone:"Asia/Seoul"})) {
  const out=[];
  for (const block of html.split(/<li\b[^>]*\bid=["']anchorBoxId_/i).slice(1)) {
    const body=block.split(/<\/ul>\s*<\/div>\s*<\/li>/i)[0];
    if (/alt=["'][^"']*품절|>품절<|ico_product_soldout/i.test(body)) continue;
    const id=body.match(/^(\d+)/)?.[1];
    const rawName=body.match(/<strong class="name">([\s\S]*?)<\/strong>/i)?.[1];
    if (!id || !rawName) continue;
    const name=plain(rawName).replace(/^상품명\s*:\s*/,"");
    const cat=rawName.match(/cate_no=(\d+)/)?.[1];
    const priceMatch=plain(body).match(/판매가\s*:\s*([\d,]+)\s*원/);
    const imgUrl=body.match(/<img[^>]+src=["'](\/\/[^"']+|https:\/\/[^"']+)["'][^>]*\bid="eListPrdImage/i)?.[1];
    const item=standard("테니스스퀘어", id, square+"/product/detail.html?product_no="+id,name,brandNames.find(b=>name.includes(b))||"",Number(priceMatch?.[1]?.replaceAll(",","")),imgUrl?new URL(imgUrl,square).href:"",cat,hint,date);
    if (item) out.push(item);
  }
  return out;
}
export function parseMetro(html, hint="", date=new Date().toLocaleDateString("sv-SE",{timeZone:"Asia/Seoul"})) {
  const out=[];
  for (const [,body] of html.matchAll(/<div class="item_cont">([\s\S]*?)<!--\s*\/\/item_cont\s*-->/gi)) {
    if (/alt=["'][^"']*품절|sold[_-]?out|goods_soldout/i.test(body)) continue;
    const id=body.match(/goods_view\.php\?goodsNo=(\d+)/)?.[1];
    const name=plain(body.match(/<strong class="item_name">([\s\S]*?)<\/strong>/i)?.[1]);
    const brand=plain(body.match(/<span class="item_brand">([\s\S]*?)<\/span>/i)?.[1]);
    const model=plain(body.match(/<!--\s*<span class="num_model">([^<]+)<\/span>\s*-->/i)?.[1]);
    const imgUrl=body.match(/<img[^>]*\bsrc="([^"]+)"[^>]*\bclass="middle"/i)?.[1];
    const prices=[...body.matchAll(/<strong class="item_(?:price|sale)"[^>]*>([\s\S]*?)<\/strong>/gi)].map(x=>plain(x[1])).filter(x=>!x.includes("최대할인"));
    const price=Number(prices.at(-1)?.match(/([\d,]+)\s*원/)?.[1]?.replaceAll(",",""));
    const item=standard("테니스메트로",id,metro+"/goods/goods_view.php?goodsNo="+id,name,brand,price,imgUrl?new URL(imgUrl,metro).href:"","",hint,date,model);
    if (item) out.push(item);
  }
  return out;
}
function plan(query) {
  const q=query.trim().slice(0,80).replace(/테니스\s+화/g,"테니스화");
  if (!q) throw Error("검색어를 입력하세요.");
  const f=familyQueries.get(q.replace(/\s+/g,"").toLowerCase());
  const e=encodeURIComponent(q);
  return {hint:f||"", urls:[
    f ? square+"/product/list.html?cate_no="+squareCats[f]+"&sort_method=3" : square+"/product/search.html?keyword="+e+"&order_by=priceasc",
    metroCats[f] ? metro+"/goods/goods_list.php?cateCd="+metroCats[f]+"&sort=price_asc" : metro+"/goods/goods_search.php?keyword="+(f==="shoes"?encodeURIComponent("테니스화"):e)+"&sort=price_asc"
  ]};
}
export async function searchRetail(query, fetcher=fetch) {
  const {hint,urls}=plan(query);
  const checkedAt=new Date().toISOString();
  const date=new Date(checkedAt).toLocaleDateString("sv-SE",{timeZone:"Asia/Seoul"});
  const sources=["테니스스퀘어","테니스메트로"];
  const results=await Promise.allSettled(urls.map(async(url,i)=>{
    const response=await fetcher(url,{headers:{Accept:"text/html"},signal:AbortSignal.timeout(8500) ,credentials:'omit',referrerPolicy:'no-referrer'});
    if (!response.ok) throw Error("HTTP "+response.status);
    const html=await response.text();
    const recognized=i===0?/xans-search|xans-product-listnormal/i.test(html):/goods_search_cont|goods_list_item_tit|item_cont/i.test(html);
    if (!recognized) throw Error("Unknown catalog response");
    const rows=(i===0?parseSquare:parseMetro)(html,hint,date);
    return rows.filter(x=>hint==="racket"||hint==="shoes"||hint==="balls"?x.kind===hint:hint==="bag"?/가방|백팩|백\b|백$|토트|더플|숄더/i.test(x.name):hint==="grip"?/그립/.test(x.name):true);
  }));
  const items=[...new Map(results.flatMap(x=>x.status==="fulfilled"?x.value:[]).map(x=>[x.url,x])).values()].sort((a,b)=>a.price-b.price);
  return {items, checkedAt, sources:results.map((r,i)=>({name:sources[i],ok:r.status==="fulfilled",count:r.status==="fulfilled"?r.value.length:0}))};
}
