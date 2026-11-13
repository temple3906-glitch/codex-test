"use strict";
const $=s=>document.querySelector(s);
const paths={
 stay:'<path d="M3 18V6m0 8h18v6m0-6v-3a2 2 0 0 0-2-2h-7v5M3 18h18M3 18v2"/><circle cx="7.5" cy="10" r="2"/>',
 map:'<path d="m3 5 6-2 6 3 6-2v15l-6 2-6-3-6 2zM9 3v15m6-12v15"/>',
 pin:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
 tag:'<path d="M3 3h8l10 10-8 8L3 11z"/><circle cx="7.8" cy="7.8" r="1"/>',
 bookmark:'<path d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-4-6 4z"/>',
 search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',chevronDown:'<path d="m6 9 6 6 6-6"/>',chevronRight:'<path d="m9 5 7 7-7 7"/>',
 arrowRight:'<path d="M3 12h17m-6-6 6 6-6 6"/>',locate:'<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4"/>',
 court:'<rect x="2" y="5" width="20" height="14" rx="1"/><path d="M12 5v14M2 8h20M2 16h20M6 8v8m12-8v8M6 12h12"/>',
 practice:'<ellipse cx="14.7" cy="8.8" rx="6.1" ry="7.1" transform="rotate(38 14.7 8.8)"/><path d="m10.4 13.6-3.2 4.2m.8-1.4-4 5-1.6-1.4 4-4.9M12 7l5.4 4M13.7 5l5.2 4M12.3 10.8l4-5.2"/>',
 shop:'<path d="M3 9 5 4h14l2 5M3 9v2a3 3 0 0 0 5.7 1.2 3.5 3.5 0 0 0 6.6 0A3 3 0 0 0 21 11V9Zm2 5v6h14v-6M10 20v-5h4v5"/>',
 grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',fit:'<path d="M3 9V3h6m6 0h6v6M3 15v6h6m6 0h6v-6"/>',external:'<path d="M14 3h7v7m0-7L10 14m0-10H4v16h16v-6"/>',
 x:'<path d="m5 5 14 14m0-14L5 19"/>',list:'<path d="M8 5h13M8 12h13M8 19h13M3 5h.1M3 12h.1M3 19h.1"/>',
 sort:'<path d="M4 5h15M4 10h11M4 15h7m6-3v9m-3-3 3 3 3-3"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.4"/>',
 phone:'<path d="m4 3 4-1 2 6-2 2a15 15 0 0 0 6 6l2-2 6 2-1 4c-.4 2.3-5 2-8 0C8 17 3 12 2 7c-.4-2 0-3 2-4z"/>',
 balls:'<circle cx="12" cy="12" r="9"/><path d="M6 5c5 5 5 10-1 13m13 1c-5-5-5-10 1-14"/>',shoes:'<path d="M3 13V7l3 1 3-3 3 4 2 3 7 3v4H3zm0 3h17M10 8l-2 2m4 1-2 2"/>',trash:'<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15"/>'
};
function icon(n){return '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">'+(paths[n]||paths.tag)+'</svg>'}
function I(n){return '<i data-i="'+n+'">'+icon(n)+'</i>'}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
const tidy=s=>String(s||'').toLowerCase().replace(/[\s()·,.-]/g,'');
const pick={all:'전체',court:'테니스장',practice:'연습장',shop:'장비샵',stay:'테니스 숙소'};
const gear={racket:'라켓',shoes:'테니스화',balls:'테니스공',grip:'그립',bag:'가방'};
const gearIcon={racket:'practice',shoes:'shoes',balls:'balls',grip:'tag',bag:'shop'};
const ico=k=>k==='all'?'grid':k;
const hasCoords=p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng);
const mapsLink=q=>'https://map.naver.com/p/search/'+encodeURIComponent(q);
const fmt=new Intl.NumberFormat('ko-KR');
const state={places:[],offers:[],rows:[],city:'여수',category:'all',stayType:'전체',areaType:'city',q:'',origin:null,userPos:null,tab:'places',sort:'default',page:36,gearQuery:'',gearRows:[],gearPage:18,run:0,view:'map',saved:new Set(),cityNames:[],geoSeq:0};
try{state.saved=new Set(JSON.parse(localStorage.getItem('rally-favorites-v1')||'[]'))}catch{}
let map,markers,base,tiles,myMarker,summaryTimer,loadDataReady=false;
const areaMemory={places:null,stays:{city:'전국',q:'',areaType:'city',origin:null,sort:'default'}};
const stayTypes=['전체','펜션','호텔','리조트'];
const isStayTab=()=>state.tab==='stays';
const placeTag=p=>p.kind==='stay'?p.stayType:pick[p.kind];
function searchText(p){return tidy([p.name,p.address,p.kind==='stay'?'테니스 숙소 숙박 숙박업소 테니스코트':'',pick[p.kind],p.stayType].filter(Boolean).join(' '))}
const bounds=[[34.645,127.435],[35.035,127.835]];
const regionLabels={'서울':'서울특별시','부산':'부산광역시','대구':'대구광역시','인천':'인천광역시','광주':'광주광역시','대전':'대전광역시','울산':'울산광역시','세종':'세종특별자치시','제주':'제주시','전국':'전국'};
const label=c=>regionLabels[c]||((state.places.find(p=>p.city===c)?.address||'').match(new RegExp(c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'[시군]'))?.[0])||c;
const area=()=>state.areaType==='geo'?'내 위치':label(state.city);
function dist(p,o){if(!o||!hasCoords(p))return Infinity;const d=Math.PI/180,a=Math.sin((p.lat-o[0])*d/2)**2+Math.cos(o[0]*d)*Math.cos(p.lat*d)*Math.sin((p.lng-o[1])*d/2)**2;return 12742*Math.asin(Math.sqrt(Math.min(a,1)))}
function prettyDist(x){return x<1?Math.round(x*1000)+'m':x.toFixed(1)+'km'}
function message(text){clearTimeout(summaryTimer);$('#toast').textContent=text;$('#toast').classList.add('show');summaryTimer=setTimeout(()=>$('#toast').classList.remove('show'),4100)}
function openDialog(title,html){$('#dialogTitle').textContent=title;$('#dialogBody').innerHTML=html;$('#dialogBody').scrollTop=0;if(!$('#dialog').open)$('#dialog').showModal()}
function close(){if($('#dialog').open)$('#dialog').close()}
const safeUrl=rallyLinks.webUrl;
function webAnchor(url,cls,body,label=''){
 const web=safeUrl(url);
 if(!web)return '';
 const target=web;
 return '<a class="'+cls+'" target="_top" rel="noreferrer" href="'+esc(target)+'"'+
  (label?' aria-label="'+esc(label)+'"':'')+'>'+body+'</a>';
}
function link(url,txt,cl='source'){return webAnchor(url,cl,esc(txt)+I('external'))}
function browserChoice(url){
 if(!rallyLinks.mobile)return '';
 const web=safeUrl(url);if(!web)return '';
 return '<a class="browser-choice" target="_top" href="'+esc(rallyLinks.externalUrl(web))+'" data-handoff="'+esc(web)+'" rel="noreferrer">'+I('external')+(rallyLinks.ios?'Safari로 열기':'브라우저로 열기')+'</a>';
}
const photoUrl=name=>'./photos/'+name+'.webp';
function mapDestination(place){
 return hasCoords(place)?'https://map.kakao.com/link/to/'+encodeURIComponent(place.name)+','+place.lat+','+place.lng:mapsLink(place.name+' '+place.address);
}
function sharedPage(place){
 const u=new URL(location.pathname,location.origin);
 const tab=place?(place.kind==='stay'?'stays':'places'):state.tab;
 u.searchParams.set('view',tab);
 if(place){u.searchParams.set('place',place.id);return u.href}
 if(tab==='prices'&&state.gearQuery)u.searchParams.set('product',state.gearQuery.slice(0,80));
 if(tab!=='prices'&&state.areaType==='city'){
  u.searchParams.set('city',state.city);
  if(state.q)u.searchParams.set('q',state.q.slice(0,80));
  if(tab==='stays'&&state.stayType!=='전체')u.searchParams.set('type',state.stayType);
  if(tab==='places'&&state.category!=='all')u.searchParams.set('type',state.category);
 }
 return u.href;
}
async function shareKakao(place){
 const url=sharedPage(place);
 const title=place?'랠리맵 · '+place.name:'랠리맵 · '+({places:'테니스 시설 탐색',stays:'테니스 숙소',prices:'용품 가격비교'}[state.tab]);
 if(typeof navigator.share==='function'){
  try{await navigator.share({title,url});return}
  catch(error){if(error.name==='AbortError')return}
 }
 openDialog('카카오톡으로 공유','<p class="detail-note">아래 링크를 복사해 카카오톡 대화방에 붙여넣으세요.</p>'+
  '<input id="shareUrl" class="region-search" type="url" readonly aria-label="공유 링크" value="'+esc(url)+'">'+
  '<div class="detail-actions"><button type="button" class="button-primary" id="copyShare">링크 복사</button></div><p id="copyStatus" aria-live="polite"></p>');
 $('#copyShare').onclick=async()=>{
  const input=$('#shareUrl');input.focus();input.select();input.setSelectionRange(0,input.value.length);
  let copied=false;
  try{await navigator.clipboard.writeText(url);copied=true}catch{try{copied=document.execCommand('copy')}catch{}}
  $('#copyStatus').textContent=copied?'복사했습니다. 카카오톡에 붙여넣으세요.':'주소를 길게 눌러 복사하세요.';
 };
}
function restoreSharedPage(){
 const params=new URLSearchParams(location.search);
 const savedGear=history.state?.gearQuery;
 const picked=state.places.find(p=>p.id===params.get('place'));
 const view=picked?(picked.kind==='stay'?'stays':'places'):(params.get('view')||location.hash.slice(1));
 const tab=['prices','stays'].includes(view)?view:'places';
 setTab(tab,params.get('product')||savedGear);
 if(tab==='prices')return;
 const city=picked?.city||params.get('city');
 if(city&&(city==='전국'||state.cityNames.includes(city)))chooseCity(city);
 if(!picked&&params.has('type')){
  const type=params.get('type');
  if(tab==='stays'&&stayTypes.includes(type))state.stayType=type;
  if(tab==='places'&&Object.hasOwn(pick,type))state.category=type;
 }
 if(!picked&&params.has('q')){state.q=params.get('q').slice(0,80);$('#query').value=state.q}
 renderPlaces(true);
 if(picked)detail(picked.id);
}
function updateBrowserLink(){
 const a=$('#openInBrowser');
 a.hidden=!rallyLinks.mobile;
 if(a.hidden)return;
 const u=new URL(location.href);if(u.protocol!=='https:'){a.hidden=true;return}if(state.tab==='prices'&&state.gearQuery)u.searchParams.set('product',state.gearQuery);else u.searchParams.delete('product');
 a.href=rallyLinks.externalUrl(u.href);a.dataset.handoff=u.href;
 a.querySelector('span').textContent=rallyLinks.ios?'Safari로 열기':'웹브라우저로 열기';
}
let handoffTimer;
function armBrowserFallback(url){
 clearTimeout(handoffTimer);
 const cancel=()=>clearTimeout(handoffTimer);
 document.addEventListener('visibilitychange',cancel,{once:true});
 window.addEventListener('pagehide',cancel,{once:true});
 handoffTimer=setTimeout(()=>{
  document.removeEventListener('visibilitychange',cancel);
  window.removeEventListener('pagehide',cancel);
  if(document.visibilityState!=='visible')return;
  const web=safeUrl(url);if(!web)return;
  openDialog('웹페이지 열기','<p class="detail-note">브라우저가 열리지 않으면 아래에서 웹페이지를 직접 열 수 있습니다.</p><div class="detail-actions"><a class="button-primary" target="_top" rel="noreferrer" href="'+esc(web)+'">웹페이지 바로 열기</a><button class="button-light" data-copy-offer="'+esc(web)+'">주소 복사</button></div>');
 },1900);
}
function chip(k,name,active,iconName,color=''){return '<button class="chip '+(active?'on':'')+'" type="button" data-key="'+k+'" aria-pressed="'+active+'" style="--icon:'+color+'">'+I(iconName)+esc(name)+'</button>'}
function drawFilters(){
 $('#placeFilters').innerHTML=Object.entries(pick).map(([k,t])=>chip(k,t,k===state.category,ico(k),{court:'var(--court)',practice:'var(--practice)',shop:'var(--shop)',stay:'var(--stay)'}[k]||'var(--green)')).join('');
 $('#stayFilters').innerHTML=stayTypes.map(t=>chip(t,t==='전체'?'숙소 전체':t,t===state.stayType,t==='전체'?'grid':'stay','var(--stay)')).join('');
 $('#priceFilters').innerHTML=Object.entries(gear).map(([k,t])=>chip(k,t,tidy(state.gearQuery)===tidy(t),gearIcon[k])).join('');
}
function imgFor(p){if(p.kind==='stay')return 'court';if(p.kind==='practice')return 'practice';if(p.kind==='shop')return 'shop';if(p.name.includes('진남'))return 'blue';return ['court','blue','clay'][p.pic%3]}
function refreshBookmarks(){let count=state.places.filter(x=>state.saved.has(x.id)).length;$('#savedCount').textContent=count?String(count):''}
function toggleSaved(id){if(state.saved.has(id))state.saved.delete(id);else state.saved.add(id);try{localStorage.setItem('rally-favorites-v1',JSON.stringify([...state.saved]))}catch{message('이 브라우저에서는 현재 화면에서만 저장됩니다.')}refreshBookmarks()}
function showSaved(){const rows=state.places.filter(x=>state.saved.has(x.id));openDialog('저장한 장소',rows.length?rows.map(p=>'<div class="saved-row"><button data-detail="'+p.id+'"><strong>'+esc(p.name)+'</strong><small>'+esc(p.address)+'</small></button><button class="icon-button" aria-label="저장 해제" data-remove="'+p.id+'">'+I('trash')+'</button></div>').join(''):'<div class="empty">'+I('bookmark')+'<strong>저장한 장소가 없습니다</strong>시설 상세 화면에서 ‘장소 저장’을 눌러보세요.</div>')}
function detail(id){const p=state.places.find(r=>r.id===id);if(!p)return;const destination=mapDestination(p);const ph=String(p.phone||'').replace(/[^\d+]/g,'');
 openDialog(p.kind==='stay'?'테니스 숙소 정보':'시설 정보','<span class="tag '+p.kind+'">'+esc(placeTag(p))+'</span><h3 class="detail-title">'+esc(p.name)+'</h3><p class="detail-note">'+esc(p.note||'시설의 운영 시간과 이용 조건은 방문 전에 확인해 주세요.')+'</p><div class="data-row">'+I('pin')+'<span>'+esc(p.address||p.city)+'</span></div>'+(ph?'<div class="data-row">'+I('phone')+'<a href="tel:'+ph+'">'+esc(p.phone)+'</a></div>':'')+'<div class="detail-actions">'+(p.kind==='stay'&&p.website?link(p.website,'숙소 웹사이트','button-primary'):'')+link(destination,hasCoords(p)?'길찾기':'지도에서 위치 확인','button-primary')+'<button class="button-light" data-save="'+p.id+'">'+I('bookmark')+(state.saved.has(p.id)?'저장 해제':'장소 저장')+'</button><button class="button-light" data-share-place="'+p.id+'">카카오톡 공유</button></div>'+link(safeUrl(p.source)||mapsLink(p.name+' '+p.city),p.kind==='stay'?'코트 이용 안내 · '+(p.sourceName||'시설 안내'):p.sourceName||'시설 정보 출처')+(p.kind==='stay'?browserChoice(p.website||p.source):'')+(p.date?'<p class="detail-note" style="font-size:11px;margin-top:7px">자료 기준 '+esc(p.date)+'</p>':''));
}
function chooseCity(city){state.geoSeq++;state.areaType='city';state.city=city;state.q='';state.origin=null;state.page=36;state.sort='default';$('#sort').value='default';$('#query').value='';close();renderPlaces(true)}
function chooseRegion(){const rank=['여수','순천','광양','서울','부산','인천','대구','대전','광주','울산','제주','전국'];const names=isStayTab()?['전국',...new Set(state.places.filter(p=>p.kind==='stay').map(p=>p.city).sort((a,b)=>a.localeCompare(b,'ko')))]:[...new Set([...rank,...state.cityNames])];openDialog('지역 선택','<input type="search" id="regionSearch" class="region-search" aria-label="시·군 또는 시·도 검색" placeholder="시·군 또는 시·도 검색"><div class="city-grid" id="cities"></div>');
 function fill(q){const list=names.filter(x=>!q||tidy(label(x)).includes(tidy(q))||state.places.some(p=>(!isStayTab()||p.kind==='stay')&&p.city===x&&tidy(p.address.split(' ')[0]).includes(tidy(q))));$('#cities').innerHTML=list.map(x=>'<button class="'+(state.areaType==='city'&&x===state.city?'on':'')+'" data-city="'+esc(x)+'">'+esc(label(x))+'</button>').join('')||'<p class="empty">등록된 지역이 없습니다.</p>'}
 fill('');$('#regionSearch').oninput=e=>fill(e.target.value);$('#regionSearch').focus()
}
function row(p){let d=dist(p,state.origin);return '<button class="place-row" data-detail="'+p.id+'"><img class="thumb" src="'+photoUrl(imgFor(p))+'" alt="" title="시설 유형 대표 사진" loading="lazy"><div class="place-copy"><span class="tag '+p.kind+'">'+esc(placeTag(p))+'</span>'+(state.areaType==='geo'&&isFinite(d)?'<span class="dist">'+prettyDist(d)+'</span>':'')+'<h3>'+esc(p.name)+'</h3><p>'+esc(p.address||p.city)+'</p></div><span class="row-arrow">'+I('chevronRight')+'</span></button>'}
function renderList(){
 const shown=state.rows.slice(0,state.page);
 if(!shown.length&&isStayTab()){
  $('#placeTotal').textContent='0';
  $('#placeList').innerHTML='<div class="empty">'+I('stay')+'<strong>이 조건에서 확인된 테니스 숙소가 없습니다</strong><button id="allStays">전국 숙소 전체 보기</button></div>';
  return
 }$('#placeTotal').textContent=fmt.format(state.rows.length);
 $('#placeList').innerHTML=shown.length?shown.map(row).join('')+(shown.length<state.rows.length?'<button id="morePlaces" class="place-more">시설 더 보기 ('+fmt.format(state.rows.length-shown.length)+')</button>':''):'<div class="empty">'+I('search')+'<strong>찾은 시설이 없습니다</strong>지역이나 시설 유형을 바꿔보세요.<br><a class="text-link" target="_blank" rel="noopener" href="'+esc($('#moreMap').href)+'">외부 지도에서 찾기</a></div>';
}
function renderPlaces(fit=true){if(!loadDataReady)return;const q=tidy(state.q);
 state.rows=state.places.filter(p=>(state.areaType==='geo'?dist(p,state.origin)<=25:state.city==='전국'||p.city===state.city)&&(isStayTab()?p.kind==='stay'&&(state.stayType==='전체'||state.stayType===p.stayType):(state.category==='all'||state.category===p.kind))&&(!q||searchText(p).includes(q)));
 if(state.sort==='near'&&state.origin)state.rows.sort((a,b)=>dist(a,state.origin)-dist(b,state.origin));else if(state.sort==='name')state.rows.sort((a,b)=>a.name.localeCompare(b.name,'ko'));
 const basis=area();$('#regionName').textContent=basis;$('#basis').textContent=state.areaType==='geo'?'현재 위치 반경 25km':basis+' 기준';$('#mapCity').textContent=basis;
 const mq=(state.areaType==='geo'?(state.places.filter(hasCoords).reduce((a,p)=>!a||dist(p,state.origin)<dist(a,state.origin)?p:a,null)?.city||''):state.city==='전국'?'':state.city)+' '+(state.q||(isStayTab()?'테니스 코트 숙소':state.category==='all'?'테니스':pick[state.category]));$('#moreMap').href=mapsLink(mq.trim());drawFilters();renderList();refreshMap(fit)
}
function initMap(){
 if(!window.L){$('#mapNotice').hidden=false;$('#mapNotice').textContent='지도를 표시할 수 없습니다. 목록에서 시설을 선택하세요.';return}
 map=L.map('map',{zoomControl:false,minZoom:5,maxZoom:19,scrollWheelZoom:false,zoomSnap:.25,zoomDelta:1}).setView([34.755,127.686],13);
 map.attributionControl.setPrefix(false);
 tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'});
 const inside=()=>L.latLngBounds(bounds).contains(map.getBounds())&&map.getZoom()<=15;
 const setTiles=()=>{const local=inside();if(local){if(map.hasLayer(tiles))tiles.remove();$('#mapNotice').hidden=true}else if(!map.hasLayer(tiles))tiles.addTo(map)};
 const pane=map.createPane('regional');pane.style.zIndex=195;
 base=L.imageOverlay(photoUrl('basemap'),bounds,{pane:'regional',interactive:false,attribution:'<a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a> · <a href="https://openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'}).addTo(map);
 tiles.on('tileerror',()=>{if(!inside()){$('#mapNotice').textContent='지도 배경을 불러오지 못했습니다. 시설 정보에서 길찾기를 이용하세요.';$('#mapNotice').hidden=false}});
 tiles.on('tileload',()=>{$('#mapNotice').hidden=true});map.on('moveend zoomend',setTiles);markers=L.layerGroup().addTo(map);setTiles()
}
function refreshMap(fit){if(!map||state.tab==='prices')return;
 const pts=state.rows.filter(hasCoords);let target=pts;
 const fallback=state.areaType==='geo'?state.origin:state.places.find(p=>hasCoords(p)&&p.city===state.city);
 if(fit){
   if(state.areaType==='geo'){const nearby=pts.filter(p=>dist(p,state.origin)<12).slice(0,25);map.fitBounds(L.latLngBounds([state.origin,...nearby.map(p=>[p.lat,p.lng])]).pad(.12),{padding:[35,30],maxZoom:14,animate:false})}
   else if(pts.length===1)map.setView([pts[0].lat,pts[0].lng],14,{animate:false});
   else if(pts.length)map.fitBounds(pts.map(p=>[p.lat,p.lng]),{padding:[28,32],maxZoom:14,animate:false});
   else if(fallback&&hasCoords(fallback))map.setView([fallback.lat,fallback.lng],13,{animate:false});
 }
 markers.clearLayers();
 // Render only markers in the current viewport. Nearby markers remain accessible in the list.
 if(pts.length>80)target=pts.filter(p=>map.getBounds().pad(.15).contains([p.lat,p.lng]));
 const groups=new Map(),zoom=map.getZoom(),cell=zoom<9?40:zoom<12?29:13;
 for(const p of target){const xy=map.project([p.lat,p.lng],zoom);const key=Math.round(xy.x/cell)+'/'+Math.round(xy.y/cell);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p)}
 for(const group of groups.values()){const p=group[0];const multi=group.length>1;const title=multi?p.name+' 외 '+(group.length-1)+'곳':p.name;
 const marker=L.marker([p.lat,p.lng],{title,alt:title,icon:L.divIcon({className:'rally-marker',iconSize:[32,36],iconAnchor:[13,34],html:'<span class="map-pin '+p.kind+'">'+(multi?'<i style="font:700 13px Arial;transform:rotate(45deg)">'+group.length+'</i>':I(p.kind))+'</span>'})}).addTo(markers);
 marker.on('click',()=>{if(!multi){detail(p.id);return}const bbox=L.latLngBounds(group.map(x=>[x.lat,x.lng]));if(zoom<15&&map.distance(bbox.getSouthWest(),bbox.getNorthEast())>100){map.fitBounds(bbox,{padding:[40,40],maxZoom:zoom+3,animate:false});return}openDialog('이 위치의 시설',group.map(row).join(''))});
 const tip=document.createElement('span');tip.textContent=title;marker.bindTooltip(tip,{direction:'top',offset:[4,-29],permanent:!multi&&p.name==='진남테니스장'&&zoom>11&&zoom<15,className:'place-tooltip'})
 }
 if(myMarker)myMarker.remove();if(state.areaType==='geo'&&state.userPos){myMarker=L.circleMarker(state.userPos,{radius:7,fillColor:'#247bd0',color:'#fff',fillOpacity:1,weight:3}).addTo(map).bindTooltip('현재 위치')}
}
function locate(){if(!navigator.geolocation){message('위치 기능이 없는 브라우저입니다. 검색창에서 지역을 선택해 주세요.');return}
 const seq=++state.geoSeq,btn=$('[data-geo]');btn.disabled=true;btn.innerHTML=I('locate')+'위치 확인 중';const reset=()=>{btn.disabled=false;btn.innerHTML=I('locate')+'내 위치 사용'};
 navigator.geolocation.getCurrentPosition(pos=>{reset();if(seq!==state.geoSeq)return;state.origin=[pos.coords.latitude,pos.coords.longitude];state.userPos=state.origin;state.areaType='geo';state.sort='near';state.q='';state.page=36;$('#sort').value='near';$('#query').value='';renderPlaces(true);message('현재 위치 반경 25km를 가까운 순으로 표시합니다.')},err=>{reset();if(seq!==state.geoSeq)return;$('#sort').value=state.sort;message(err.code===1?'브라우저 위치 권한을 허용하거나 검색창에서 지역을 선택해 주세요.':'위치를 확인하지 못했습니다. 지역을 선택하거나 다시 시도해 주세요.')},{enableHighAccuracy:true,timeout:11000,maximumAge:60000})
}
function gearType(q){const n=tidy(q);if(['라켓','테니스라켓','테니스채','racket','racquet'].includes(n))return 'racket';if(['신발','테니스화','테니스신발','shoes'].includes(n))return 'shoes';if(['볼','공','테니스공','테니스볼','balls'].includes(n))return 'balls';if(['오버그립','그립','테니스그립'].includes(n))return 'grip';if(['가방','테니스가방','백팩'].includes(n))return 'bag';return ''}
function isGear(q){return !!gearType(q)||/라켓|테니스\s?화|그립|스트링|퓨어\s?(에어로|드라이브)|그래비티|블레이드|바볼랏|아식스|요넥스|윌슨|테니스\s?(가방|공|볼)|테니스채|vcore|ezone/i.test(q)}
function snapshot(q){const g=gearType(q);let terms=q.trim().toLowerCase().split(/\s+/).map(tidy);return state.offers.filter(p=>g==='grip'?p.kind==='gear'&&/그립/.test(p.name):g==='bag'?p.kind==='gear'&&/백|가방|토트|더플/.test(p.name):g?p.kind===g:terms.every(t=>tidy(p.name+' '+p.brand+' '+p.model).includes(t))).sort((a,b)=>a.price-b.price)}
function productCard(p){
 const url=safeUrl(p.url);
 if(!url)return '';
 const pic=safeUrl(p.image);
 const photo=pic?'<img loading="lazy" src="'+esc(pic)+'" alt="" referrerpolicy="no-referrer">':I(gearIcon[p.kind]||'tag');
 const label=p.name+' · '+p.shop+' 상품 보기';
 return '<article class="offer">'+webAnchor(url,'offer-main',
  '<div class="offer-img">'+photo+'</div><div class="offer-content"><small>'+esc(p.shop)+'</small><h3>'+esc(p.name)+'</h3>'+
  '<strong>'+fmt.format(p.price)+'<span>원</span></strong><span class="offer-date">'+esc(p.date)+' 확인</span>'+
  '<span class="offer-open">판매처에서 상품 보기 '+I('arrowRight')+'</span></div>',label)+
  '<div class="offer-tools">'+browserChoice(url)+'<button class="copy-offer" type="button" data-copy-offer="'+esc(url)+'" aria-label="'+esc(p.name)+' 링크 복사">링크 복사</button></div></article>';
}
async function copyOffer(url){
 try{
  await navigator.clipboard.writeText(url);
  message('웹페이지 주소를 복사했습니다.');
 }catch{
  openDialog('주소 복사','<label for="productUrl">아래 주소를 길게 눌러 복사하세요.</label><input class="region-search" id="productUrl" type="text" readonly value="'+esc(url)+'">');
  const input=$('#productUrl');input.focus();input.select();input.setSelectionRange(0,input.value.length);
 }
}
function showOffers(status){$('#priceStatus').textContent=status;const rows=state.gearRows;$('#offerList').innerHTML=rows.length?rows.slice(0,state.gearPage).map(productCard).join(''):'<div class="empty"><strong>표시할 상품이 없습니다</strong>브랜드·모델명을 줄여 보거나 아래 쇼핑 검색에서 확인하세요.</div>';$('#loadOffers').hidden=rows.length<=state.gearPage;$('#offerList').querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{img.parentNode.innerHTML=I(gearIcon[gearType(state.gearQuery)]||'tag')},{once:true}));drawFilters()}
async function findOffers(q){q=q.trim().slice(0,80)||'라켓';const seq=++state.run;state.gearQuery=q;updateBrowserLink();history.replaceState({gearQuery:q},'','#prices');state.gearPage=18;$('#query').value=q;const backup=snapshot(q);state.gearRows=backup;
 $('#shoppingLinks').innerHTML=link('https://search.shopping.naver.com/search/all?sort=price_asc&query='+encodeURIComponent(q),'네이버쇼핑 가격순')+link('https://search.danawa.com/dsearch.php?k1='+encodeURIComponent(q)+'&sort=priceASC','다나와에서도 검색');
 showOffers('상품별 확인가 '+backup.length+'개 · 판매처 가격 조회 중');
 try{const {searchRetail}=await import('./retail.js');const data=await searchRetail(q);if(seq!==state.run)return;
 const good=new Set(data.sources.filter(x=>x.ok).map(x=>x.name));if(!good.size)throw Error();
 state.gearRows=[...data.items,...backup.filter(p=>!good.has(p.shop))].filter((x,i,a)=>a.findIndex(r=>r.url===x.url)===i).sort((a,b)=>a.price-b.price);
 showOffers((good.size===2?'전문몰 2곳 조회':'전문몰 1곳 조회 · 다른 판매처는 이전 확인가')+' · 검색 결과 '+fmt.format(state.gearRows.length)+'개');
 }catch{if(seq!==state.run)return;state.gearRows=backup;showOffers('판매처 실시간 조회 불가 · 이전 확인가 '+backup.length+'개 표시')}
}
function setTab(name,q){
 if(!['places','stays','prices'].includes(name))return;
 if(name!==state.tab){
  state.geoSeq++;
  if(state.tab!=='prices')areaMemory[state.tab]={city:state.city,q:state.q,areaType:state.areaType,origin:state.origin,sort:state.sort};
  if(name!=='prices'){
   Object.assign(state,areaMemory[name]||{city:'여수',q:'',areaType:'city',origin:null,sort:'default'});
   state.page=36;$('#sort').value=state.sort;
  }
 }
 state.tab=name;
 const shopping=name==='prices',stays=isStayTab();
 $('#placeSection').hidden=shopping;$('#priceSection').hidden=!shopping;$('#regionBtn').hidden=shopping;
 $('#placeFilters').hidden=stays;$('#stayFilters').hidden=!stays;
 $('#legend').classList.toggle('stay-only',stays);
 $('#mapKicker').textContent=stays?'TENNIS STAYS':'COURT FINDER';
 $('#placeHeading').textContent=stays?'코트가 있는 숙소':'테니스 시설 탐색';
 $('#listLabel').textContent=stays?'숙소 목록':'시설 목록';
 $('#heroTitle').innerHTML=(stays?'테니스 코트가 있는 숙소':shopping?'테니스 용품 가격비교':'내 주변 테니스 찾기')+'<span class="period">.</span>';
 $('#heroText').textContent=stays?'코트를 갖춘 펜션·호텔·리조트를 찾아보고 숙소별 코트 이용 조건을 확인하세요.':shopping?'라켓과 테니스화, 필요한 용품을 검색하고 판매처별 가격을 비교하세요.':'코트부터 연습장, 장비샵까지. 원하는 테니스 시설을 지도에서 찾아보세요.';
 $('#query').placeholder=stays?'숙소명 또는 여행 지역을 검색하세요':shopping?'라켓, 테니스화 또는 모델명을 검색하세요':'시설명 또는 동네를 검색하세요';
 $('#query').value=shopping?(q||state.gearQuery||'라켓'):state.q;
 document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('on',b.dataset.tab===name);b.setAttribute('aria-pressed',String(b.dataset.tab===name))});
 const current=new URL(location.href);current.search='';current.hash=name;
 history.replaceState(null,'',current);updateBrowserLink();
 if(!shopping){state.run++;if(map)map.invalidateSize();renderPlaces(true)}else if(loadDataReady)findOffers(q||state.gearQuery||'라켓')
}
function doSearch(q){
 const stayQuery=q.trim().match(/^(.*?)(?:테니스\s*(?:코트|장)?\s*(?:가\s*있는|있는|보유)?\s*)?(펜션|팬션|호텔|리조트|숙소|숙박업소|숙박)$/);
 if(stayQuery){
  const cityName=stayQuery[1].trim(),type=stayQuery[2].replace('팬션','펜션');
  if(!cityName||state.cityNames.some(c=>c===cityName||label(c)===cityName)||cityName==='전국'){
   setTab('stays');
   state.stayType=stayTypes.includes(type)?type:'전체';
   if(cityName)chooseCity(state.cityNames.find(c=>c===cityName||label(c)===cityName)||'전국');
   else {state.q='';$('#query').value='';state.page=36;renderPlaces(true)}
   return;
  }
 }
 if(state.tab==='prices'||(isGear(q)&&!state.places.some(p=>tidy(p.name)===tidy(q)))){setTab('prices',q);return}
 const original=q;q=q.trim();const first=q.split(/\s/)[0];const c=state.cityNames.find(x=>x===first||label(x)===first)||((first==='전국')?'전국':null);
 if(c){state.areaType='city';state.city=c;state.origin=null;state.sort='default';$('#sort').value='default';q=q.slice(first.length).trim()}
 if(isStayTab()&&q&&state.places.some(p=>p.kind==='stay'&&tidy(p.name).includes(tidy(q))))state.stayType='전체';
 const cat=Object.entries(pick).find(([k,t])=>k!=='all'&&q===t);if(cat&&!isStayTab()){if(cat[0]==='stay'){setTab('stays');return}state.category=cat[0];q=''}
 state.q=q;state.page=36;
 if(!c&&q&&state.areaType==='city'&&state.city!=='전국'&&!state.places.some(p=>(!isStayTab()||p.kind==='stay')&&p.city===state.city&&searchText(p).includes(tidy(q)))&&state.places.some(p=>(!isStayTab()||p.kind==='stay')&&searchText(p).includes(tidy(q)))){state.city='전국';message('다른 지역에서 일치하는 시설을 찾았습니다.')}
 $('#query').value=c?q:original;renderPlaces(true)
}
function about(){openDialog('데이터 및 사진 출처','<div class="source-note"><p><b>시설 정보</b><br>시설별 상세 화면에 운영기관, 지도 또는 공공데이터 출처를 표시합니다. 위치를 허용하면 반경 25km 내의 등록 시설을 직선거리순으로 보여줍니다. 위치 권한 없이도 지역을 선택할 수 있습니다.</p><p><b>가격 정보</b><br>테니스스퀘어와 테니스메트로의 공개 검색·분류 페이지에 표시되는 상품가를 비교합니다. 배송비, 쿠폰, 옵션 추가금은 판매처에서 확인하세요. 조회에 실패한 판매처는 이전에 확인한 가격과 확인일을 표시합니다.</p><p><b>지도</b><br>'+link('https://openfreemap.org/','OpenFreeMap')+' · '+link('https://openmaptiles.org/','OpenMapTiles')+' · '+link('https://www.openstreetmap.org/copyright','© OpenStreetMap contributors, ODbL')+'</p><p><b>사진</b><br>시설 목록은 유형별 대표 사진을 사용합니다. Unsplash 사진 제공 '+[['Marianna Smiley','Y4YeUSYLFsw'],['Y M','yNFOHf-1Ays'],['Aleksandr Galichkin','y5kmr0wz-jQ'],['Caroline Badran','KL9jqMvWIIs'],['Andy Sartori','2O0u3fzTfH0'],['Butterfly Doe','pPJtHB1zoIE']].map(([n,id])=>link('https://unsplash.com/photos/'+id,n)).join(', ')+'. 상품 사진은 해당 판매처 제공입니다.</p></div>')}
function initEvents(){
 document.querySelectorAll('i[data-i]').forEach(x=>x.innerHTML=icon(x.dataset.i));
 $('#mainSearch').onsubmit=e=>{e.preventDefault();doSearch($('#query').value)};$('#regionBtn').onclick=chooseRegion;$('#savedBtn').onclick=showSaved;$('#shareBtn').onclick=()=>shareKakao();$('#about').onclick=about;$('#closeDialog').onclick=close;$('#dialog').addEventListener('click',e=>{if(e.target===$('#dialog')){const b=e.target.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)close()}});
 $('[data-geo]').onclick=locate;$('#zoomIn').onclick=()=>map?.zoomIn();$('#zoomOut').onclick=()=>map?.zoomOut();$('#mapFit').onclick=()=>{map?.invalidateSize();refreshMap(true)};
 $('#sort').onchange=e=>{if(e.target.value==='near'&&!state.origin){e.target.value=state.sort;locate();return}state.sort=e.target.value;renderPlaces(false)};
 $('#loadOffers').onclick=()=>{state.gearPage+=18;showOffers($('#priceStatus').textContent)};
 $('.brand').onclick=e=>{e.preventDefault();setTab('places')};
 document.addEventListener('click',e=>{
 const handoff=e.target.closest('a[data-handoff]');
 if(handoff){armBrowserFallback(handoff.dataset.handoff);return}
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.copyOffer)copyOffer(b.dataset.copyOffer);
 else if(b.dataset.sharePlace)shareKakao(state.places.find(p=>p.id===b.dataset.sharePlace));
 else if(b.dataset.tab)setTab(b.dataset.tab);
 else if(b.dataset.city)chooseCity(b.dataset.city);
 else if(b.dataset.detail)detail(b.dataset.detail);
 else if(b.dataset.save){toggleSaved(b.dataset.save);detail(b.dataset.save)}
 else if(b.dataset.remove){toggleSaved(b.dataset.remove);showSaved()}
 else if(b.id==='allStays'){state.stayType='전체';chooseCity('전국')}
 else if(b.closest('#stayFilters')){state.stayType=b.dataset.key;state.page=36;renderPlaces(true)}
 else if(b.closest('#placeFilters')&&b.dataset.key==='stay')setTab('stays');
 else if(b.closest('#placeFilters')){state.category=b.dataset.key;state.page=36;renderPlaces(true)}
 else if(b.closest('#priceFilters'))findOffers(gear[b.dataset.key]);
 else if(b.id==='morePlaces'){state.page+=36;renderList()}
 else if(b.dataset.view){state.view=b.dataset.view;$('#explorer').classList.toggle('list-only',state.view==='list');document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x===b));if(state.view==='map')requestAnimationFrame(()=>{map?.invalidateSize();refreshMap(true)})}
 })
}
async function init(){initEvents();drawFilters();initMap();try{const get=async url=>{const r=await fetch(url);if(!r.ok)throw Error(url);return r.json()};const [places,offers,stays]=await Promise.all([get('./data/places.json'),get('./data/offers.json'),get('./data/stays.json')]);state.places=places.concat(stays);state.offers=offers;state.cityNames=[...new Set(state.places.map(p=>p.city))].sort((a,b)=>a.localeCompare(b,'ko'));loadDataReady=true;refreshBookmarks();restoreSharedPage();if(map)map.on('moveend zoomend',()=>refreshMap(false))}catch{$('#placeList').innerHTML='<div class="empty"><strong>시설 자료를 불러오지 못했습니다</strong><button id="retry">다시 불러오기</button></div>';$('#retry').onclick=()=>location.reload()}}
init()
