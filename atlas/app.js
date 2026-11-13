'use strict';
// Cube-face order is front, right, back, left, up and down.
function openPhotoSphere(box,faces) {
  const canvas=document.createElement('canvas');box.append(canvas);canvas.tabIndex=0;canvas.setAttribute('aria-label','조던 연못 360도 전망. 화살표 키 또는 드래그로 둘러보기');
  let yaw=Math.PI,pitch=-.08,fov=75,drag=null,dead=false;
  const context=canvas.getContext('2d',{alpha:false}), data=[];
  const draw=()=>{
    if(dead||data.length!==6||data.includes(null))return;
    const w=Math.max(200,Math.min(box.clientWidth,780)),h=Math.round(w*(box.clientHeight/box.clientWidth));if(!h)return;
    canvas.width=w;canvas.height=h;const result=context.createImageData(w,h);const out=result.data;
    const scale=2*Math.tan(fov*Math.PI/360)/h, sy0=Math.sin(yaw),cy0=Math.cos(yaw),sp=Math.sin(pitch),cp=Math.cos(pitch);
    let at=0;
    for(let y=0;y<h;y++){const Y=(h*.5-y)*scale;const vy=sp+Y*cp;const zp=cp-Y*sp;
      for(let x=0;x<w;x++){const X=(x-w*.5)*scale,vx=zp*sy0+X*cy0,vz=zp*cy0-X*sy0;
        const ax=Math.abs(vx),ay=Math.abs(vy),az=Math.abs(vz);let face,u,v;
        if(ay>=ax&&ay>=az){face=vy>0?4:5;u=vx/ay;v=vy>0?vz/ay:-vz/ay}
        else if(az>=ax){face=vz>0?0:2;u=vz>0?vx/az:-vx/az;v=-vy/az}
        else{face=vx>0?1:3;u=vx>0?-vz/ax:vz/ax;v=-vy/ax}
        const src=data[face],d=src.data,n=src.width;const idx=(Math.min(n-1,Math.max(0,((v+1)*n*.5)|0))*n+Math.min(n-1,Math.max(0,((u+1)*n*.5)|0)))*4;
        out[at++]=d[idx];out[at++]=d[idx+1];out[at++]=d[idx+2];out[at++]=255;
      }}
    context.putImageData(result,0,0);
  };
  let pending=false;const update=()=>{if(!pending){pending=true;requestAnimationFrame(()=>{pending=false;draw()})}};
  data.push(null,null,null,null,null,null);
  faces.forEach((src,i)=>{const im=new Image();im.onload=()=>{if(dead)return;const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,0,0,512,512);data[i]=ctx.getImageData(0,0,512,512);update()};im.src=src});
  const move=(dx,dy)=>{yaw+=dx;pitch=Math.max(-1.48,Math.min(1.48,pitch+dy));update()};
  canvas.onpointerdown=e=>{drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId)};
  canvas.onpointermove=e=>{if(drag){move((drag[0]-e.clientX)*.005,(e.clientY-drag[1])*.005);drag=[e.clientX,e.clientY]}};
  canvas.onpointerup=canvas.onpointercancel=()=>drag=null;
  canvas.onkeydown=e=>{const delta={ArrowLeft:[-.13,0],ArrowRight:[.13,0],ArrowUp:[0,.13],ArrowDown:[0,-.13]}[e.key];if(delta){e.preventDefault();move(...delta)}};
  canvas.onwheel=e=>{e.preventDefault();fov=Math.max(35,Math.min(100,fov+Math.sign(e.deltaY)*4));update()};
  const observer=new ResizeObserver(update);observer.observe(box);return()=>{dead=true;observer.disconnect()}
}


;
'use strict';
class AtlasRoom {
  constructor(snapshot, changed) {
    this.snapshot=snapshot; this.changed=changed; this.code=''; this.state=''; this.peers=new Map(); this.epoch=0;
    this.id=Array.from(crypto.getRandomValues(new Uint8Array(8)),x=>x.toString(16).padStart(2,'0')).join('');
    this.seq=0;this.seen=new Map();
  }
  static code(){return Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('')}
  async join(code) {
    if(!/^[a-f0-9]{32}$/i.test(code))throw Error('32자리 여행 방 코드를 확인해 주세요.');
    this.leave(); this.code=code.toLowerCase(); const e=++this.epoch; this.state='연결 중';this.changed();
    if(!crypto.subtle){this.state='보안 연결 필요';this.changed();throw Error('여행 방은 HTTPS, localhost 또는 내려받은 HTML에서 열어 주세요.')}
    const bytes=Uint8Array.from(this.code.match(/../g),s=>parseInt(s,16));
    const [key,hash]=await Promise.all([crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt','decrypt']),crypto.subtle.digest('SHA-256',bytes)]);
    if(e!==this.epoch)return;
    this.key=key;this.channel='roaming-atlas/v2/'+Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('');
    if('BroadcastChannel' in window){try{this.bc=new BroadcastChannel(this.channel);this.bc.onmessage=m=>this.receive(m.data,e)}catch{}}
    this.tick=setInterval(()=>{this.send();let removed=false;for(const [id,v] of this.peers)if(Date.now()-v.last>22000){this.peers.delete(id);removed=true}if(removed)this.changed()},3500);
    this.connect(e);await this.send('hello')
  }
  connect(e) {
    if(e!==this.epoch||!this.code)return;
    const lost=()=>{if(e!==this.epoch)return;this.state='중계 재연결 중';this.changed();clearTimeout(this.retry);this.retry=setTimeout(()=>this.connect(e),7500)};
    try {
      const client=new Paho.Client('wss://broker.emqx.io:8084/mqtt','ra'+this.id);this.client=client;
      client.onMessageArrived=m=>this.receive(m.payloadString,e);
      client.onConnectionLost=lost;
      client.connect({useSSL:true,mqttVersion:4,timeout:8,keepAliveInterval:25,cleanSession:true,onFailure:lost,onSuccess:()=>{
        if(e!==this.epoch){try{client.disconnect()}catch{}return}
        client.subscribe(this.channel,{qos:0,timeout:8,onFailure:lost,onSuccess:()=>{if(e!==this.epoch)return;this.state='온라인';this.changed();this.send('hello')}})
      }})
    }catch{lost()}
  }
  envelope(kind){return {...this.snapshot(),id:this.id,kind,seq:++this.seq}}
  async send(kind='state') {
    if(!this.key)return;const e=this.epoch;
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const plain=new TextEncoder().encode(JSON.stringify(this.envelope(kind)));
    const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},this.key,plain);
    if(e!==this.epoch)return;
    const bytes=new Uint8Array(iv.length+data.byteLength);bytes.set(iv);bytes.set(new Uint8Array(data),12);
    const body=btoa(String.fromCharCode(...bytes));try{this.bc?.postMessage(body)}catch{}
    try{if(this.client?.isConnected()){const m=new Paho.Message(body);m.destinationName=this.channel;this.client.send(m)}}catch{}
  }
  async receive(encoded,e) {
    if(e!==this.epoch||typeof encoded!=='string'||encoded.length>3500)return;
    try {
      const b=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
      const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:b.slice(0,12)},this.key,b.slice(12));
      if(e!==this.epoch)return;const m=JSON.parse(new TextDecoder().decode(raw));
      if(!/^[0-9a-f]{16}$/.test(m.id)||m.id===this.id||!Number.isSafeInteger(m.seq)||m.seq<=(this.seen.get(m.id)||0))return;
      if(!validPoint(m.pos)||!['state','hello','bye'].includes(m.kind)||typeof m.name!=='string')return;
      if(!this.peers.has(m.id)&&this.peers.size>=24)return;
      this.seen.set(m.id,m.seq);
      if(m.kind==='bye'){this.peers.delete(m.id)}else{this.peers.set(m.id,{id:m.id,name:m.name.slice(0,20),variant:Math.max(0,Math.min(3,Number(m.variant)|0)),pos:m.pos,mode:String(m.mode).slice(0,20),place:String(m.place).slice(0,48),at:typeof m.at==='string'?m.at.slice(0,24):'',dest:typeof m.dest==='string'?m.dest.slice(0,24):'',last:Date.now()})}
      this.changed();if(m.kind==='hello')this.send();
    }catch{}
  }
  leave() {
    this.epoch++;clearTimeout(this.retry);clearInterval(this.tick);
    if(this.client){this.client.onConnectionLost=()=>{};try{this.client.disconnect()}catch{}}
    try{this.bc?.close()}catch{} this.bc=null;this.client=null;this.code='';this.key=null;this.state='';this.peers.clear();this.seen.clear();this.changed();
  }
}


;
function hasShareableAddress() {
  return /^https?:$/.test(location.protocol) && window.top === window.self;
}
function renderTouchControls() {
  const dock = $('#travel-touch');
  dock.hidden = page !== 'world';
  let buttons = '';
  if (s.phase === 'drive' || s.phase === 'flight') {
    const drive = s.phase === 'drive';
    buttons = iconsBtn('step', 'arrow', drive ? '전진 250 m' : '한 구간 비행', 'secondary')
      + iconsBtn('run', drive ? 'car' : 'plane', running ? '일시 정지' : drive ? '연속 주행' : '연속 비행', 'primary');
  } else if (s.phase === 'explore' && !pendingWalk) {
    buttons = '<div class="touch-directions">' + [
      ['a','←','서'], ['w','↑','북'], ['s','↓','남'], ['d','→','동']
    ].map(([key,arrow,dir]) => '<button class="secondary" data-move="'+key+'" aria-label="'+dir+'쪽으로 35미터 걷기"><b>'+arrow+'</b><span>'+dir+'</span></button>').join('') + '</div>';
  } else if (pendingWalk) {
    buttons = iconsBtn('cancel-walk', 'close', '이동 멈추기', 'primary');
  } else if (s.phase === 'airport') {
    buttons = iconsBtn('choose','search','도착지 변경','secondary')
      + iconsBtn('takeoff','plane','비행기 탑승','primary');
  } else {
    buttons = iconsBtn('local','walk','여수 걷기','secondary')
      + iconsBtn('start-drive','car','공항으로 출발','primary');
  }
  // Keep the focused touch target when only the travel coordinates change.
  const key = [s.phase, running, Boolean(pendingWalk)].join('|');
  if (dock.dataset.layout !== key) {
    dock.innerHTML = '<div class="touch-buttons">'+buttons+'</div>';
    dock.dataset.layout = key;
  }
}


;
let googleSDK=null,googleAuthError=null,streetPeers=null;
function loadGoogleSDK(key){
 if(window.google?.maps?.StreetViewService)return Promise.resolve(window.google.maps);
 if(googleSDK)return googleSDK;
 googleSDK=new Promise((resolve,reject)=>{
  const tag=document.createElement('script');let settled=false;
  const finish=(ok,value)=>{if(settled)return;settled=true;clearTimeout(timer);delete window.roamGoogleInit;if(ok)resolve(value);else{tag.remove();googleSDK=null;reject(Error(value))}};
  const timer=setTimeout(()=>finish(false,'Google 응답을 기다리다 연결이 종료되었습니다.'),15000);
  window.gm_authFailure=()=>{googleSDK=null;finish(false,'Google API 키의 Maps JavaScript API 활성화와 허용 주소를 확인해 주세요.');googleAuthError?.()};
  window.roamGoogleInit=()=>finish(true,window.google.maps);
  tag.onerror=()=>finish(false,'Google 거리뷰 서비스에 연결할 수 없습니다.');
  tag.async=true;tag.referrerPolicy='strict-origin-when-cross-origin';
  tag.src='https://maps.googleapis.com/maps/api/js?'+new URLSearchParams({key,loading:'async',v:'weekly',language:'ko',callback:'roamGoogleInit'});
  document.head.appendChild(tag);
 });return googleSDK;
}
async function liveStreet(point,label){
 const q='https://www.google.com/maps/@?api=1&map_action=pano&viewpoint='+encodeURIComponent(point.join(','));
 showModal('live-street',label,'SHARED STREET VIEW','<div id="actual-street" class="g-frame"></div><p class="help" id="sv-status">주변의 실제 거리 사진을 찾고 있습니다.</p><a class="secondary ext" target="_blank" rel="noopener" href="'+q+'">Google 스트리트 뷰에서 열기 '+ic('arrow')+'</a>',true);
 let view,dead=false,listener;const markers=new Map();
 const fail=message=>{if(dead)return;$('#sv-status').textContent=message;$('#actual-street').hidden=true};googleAuthError=()=>fail('Google API 키 또는 허용 주소를 확인해 주세요.');
 modalCleanup=()=>{dead=true;googleAuthError=null;streetPeers=null;listener?.remove();for(const m of markers.values())m.setMap(null);if(view)view.setVisible(false)};
 try{
  const maps=await loadGoogleSDK(sessionKey);if(dead)return;
  const result=await new maps.StreetViewService().getPanorama({location:{lat:point[0],lng:point[1]},radius:250,preference:maps.StreetViewPreference.NEAREST});
  if(dead)return;view=new maps.StreetViewPanorama($('#actual-street'),{pano:result.data.location.pano,visible:true,addressControl:true,linksControl:true,clickToGo:true,showRoadLabels:true,motionTracking:false,motionTrackingControl:false});
  const syncPosition=()=>{if(dead||s.phase!=='explore')return;const p=view.getPosition();if(!p)return;const a=[p.lat(),p.lng()];if(!validPoint(a))return;s.pos=a;s.place=view.getLocation()?.shortDescription||label;s.poi=null;storeTrip();if(page==='world'){drawMap();renderDeck()}room.send()};
  listener=view.addListener('position_changed',syncPosition);syncPosition();
  streetPeers=()=>{const ids=new Set();room.peers.forEach(p=>{if(km(p.pos,s.pos)>.5)return;ids.add(p.id);let m=markers.get(p.id);if(!m){m=new maps.Marker({map:view,title:p.name,label:p.name.slice(0,3)});markers.set(p.id,m)}m.setPosition({lat:p.pos[0],lng:p.pos[1]})});for(const [id,m] of markers)if(!ids.has(id)){m.setMap(null);markers.delete(id)}};streetPeers();
  $('#sv-status').textContent=s.phase==='explore'?'거리의 화살표를 눌러 이동하세요. 여행 방에도 내 위치가 반영됩니다.':'사진 속 화살표로 주변을 미리 둘러보세요. 현지 도보 탐험에서 동행 위치를 공유합니다.';
 }catch(e){fail(e?.message?.includes('Google')?e.message:'가까운 거리 사진을 찾을 수 없거나 Google 연결이 제한되어 있습니다.')}
}


;
let modelModulePromise;
function loadModels() {
  if (window.TravelModels) return Promise.resolve(window.TravelModels);
  if (modelModulePromise) return modelModulePromise;
  modelModulePromise = new Promise((resolve,reject) => {
    const script = document.createElement('script');
    script.src = 'models.js';
    script.onload = () => resolve(window.TravelModels);
    script.onerror = () => { script.remove(); modelModulePromise = null; reject(Error('3D 모델을 불러오지 못했습니다.')); };
    document.head.appendChild(script);
  });
  return modelModulePromise;
}
function mountTravelModel(host, kind, options) {
  let closed = false, viewer = null;
  const status = document.createElement('p');
  status.className = 'help'; status.textContent = '3D 모델을 불러오는 중입니다.'; host.append(status);
  loadModels().then(module => {
    if (closed) return;
    status.remove();
    viewer = module.mount(host, kind, options);
  }).catch(() => { if (!closed) status.textContent = '3D 모델 연결을 확인하고 이 화면을 다시 열어 주세요.'; });
  return {
    setMode(next, prefs) { kind = next; options = prefs; viewer?.setMode(next,prefs); },
    destroy() { closed = true; viewer?.destroy(); }
  };
}


;
'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeLink=s=>{try{const u=new URL(s);return /^https?:$/.test(u.protocol)?esc(u.href):'#'}catch{return '#'}};
const icons={compass:'<circle cx="12" cy="12" r="9"/><path d="m16.6 7.4-3 6.2-6.2 3 3-6.2z"/>',car:'<path d="m4 10 2-5h12l2 5M3 10h18v8H3zM5 18v2m14-2v2M6 14h2m8 0h2"/>',plane:'<path d="m2 14 8-3 4-8c.8-1.5 2.8-1 2.5.7L15.2 11l6 4-.7 1.8-6.5-2-2.8 5-1.5-.3 1-5-7.5.9z"/>',pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0z"/><circle cx="12" cy="10" r="2.3"/>',arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',chevron:'<path d="m9 5 7 7-7 7"/>',users:'<circle cx="9" cy="8" r="3"/><path d="M3 19v-2a6 6 0 0 1 12 0v2m0-14a3 3 0 0 1 0 6m2 3a5 5 0 0 1 4 5"/>',user:'<circle cx="12" cy="8" r="3.4"/><path d="M5 20a7 7 0 0 1 14 0"/>',globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',locate:'<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="1.5"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>',layers:'<path d="m3 8 9-5 9 5-9 5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',panorama:'<path d="M3 6a23 23 0 0 0 18 0v12a23 23 0 0 0-18 0zM5 15l4-4 4 3 3-3 3 3"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',book:'<path d="M4 4h13a3 3 0 0 1 3 3v14H7a3 3 0 0 1-3-3zM4 17h16M8 4v13"/>',check:'<path d="m4 12 5 5 11-11"/>',walk:'<circle cx="13" cy="4" r="2"/><path d="m8 12 3-5 3 1 2 4 3 1M12 9l-2 6 5 3 1 4m-6-7-4 6"/>',camera:'<path d="M3 7h4l2-3h6l2 3h4v13H3z"/><circle cx="12" cy="13" r="4"/>'};
const ic=k=>'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">'+(icons[k]||icons.pin)+'</svg>';
document.querySelectorAll('[data-icon]').forEach(n=>n.innerHTML=ic(n.dataset.icon));
const iconsBtn=(a,k,t,cl='secondary')=>'<button class="'+cl+'" data-action="'+a+'">'+ic(k)+esc(t)+'</button>';
const C=Object.fromEntries(GEO.cities.map(c=>[c.slug,c])),color=['#376f55','#a35f47','#466887','#8a6293'];
const catalog=Array.from(new Map(AIRPORTS.map(r=>[r[0],r])).values());
const byCode=new Map(catalog.map(r=>[r[0],r]));
const validPoint=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=90&&Math.abs(p[1])<=180;
const custom=code=>{const r=byCode.get(code);return r&&{slug:'ap-'+code,city:r[1],country:'세계 공항',code,airport:r[1],terminal:[r[3],r[4]],pois:[]}};
const city=id=>C[id]||(id?.startsWith('ap-')?custom(id.slice(3)):null);
const read=(k,f)=>{try{const v=localStorage.getItem('roam2-'+k);return v?JSON.parse(v):f}catch{return f}};
const put=(k,v)=>{try{localStorage.setItem('roam2-'+k,JSON.stringify(v))}catch{}};
const initial=()=>({phase:'home',origin:'yeosu',dest:'tokyo',at:'yeosu',pos:[...GEO.home.coord],t:0,route:GEO.drive.geometry,roadKm:GEO.drive.distanceKm,routeLabel:GEO.drive.label,flightFrom:null,flightTo:null,place:'여수시청',poi:null});
let s=read('trip',null);if(!s||!validPoint(s.pos)||!city(s.at)||!city(s.dest)||!city(s.origin)||!['home','drive','airport','flight','explore'].includes(s.phase)||!Array.isArray(s.route)||s.route.length<2||!s.route.every(validPoint)||!Number.isFinite(s.t)||(s.phase==='flight'&&(!validPoint(s.flightFrom)||!validPoint(s.flightTo))))s=initial();
let profile=read('profile',{name:'여행자',variant:0});if(!profile||typeof profile.name!=='string')profile={name:'여행자',variant:0};profile.variant=Math.max(0,Math.min(3,profile.variant|0));
let stamps=read('stamps',[]);if(!Array.isArray(stamps))stamps=[];
let page='home',filter='추천',map,tiles,offlineLayer,userPin,routeLine,pins,friends,followId='',tracking=true,tileMode='road',userZoom=false,externalPlaces=[],pendingWalk=null,running=false,rate=1,motionTime=0,driveRequest=0,routePromise=null,modalMode='',modalCleanup=null,selectedPOI=null,googlePoint=null,googleLabel='',targetFocus=null,tour=null,profilePreview=null,walkSeq=0;
let lastStore=0,lastMap=0,lastWire=0;
const norm=x=>((x+540)%360)-180;
const rad=Math.PI/180;
function km(a,b){const d=(b[0]-a[0])*rad,l=(b[1]-a[1])*rad;const h=Math.sin(d/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(l/2)**2;return 12742*Math.asin(Math.sqrt(Math.min(1,h)))}
function globePoint(a,b,t){if(t<=0)return [...a];if(t>=1)return [...b];const vector=p=>[Math.cos(p[0]*rad)*Math.cos(p[1]*rad),Math.cos(p[0]*rad)*Math.sin(p[1]*rad),Math.sin(p[0]*rad)];const u=vector(a),v=vector(b),d=Math.acos(Math.max(-1,Math.min(1,u.reduce((sum,x,i)=>sum+x*v[i],0))));if(Math.sin(d)<1e-7)return [a[0]+(b[0]-a[0])*t,norm(a[1]+norm(b[1]-a[1])*t)];const x=u.map((n,i)=>(Math.sin((1-t)*d)*n+Math.sin(t*d)*v[i])/Math.sin(d));return [Math.atan2(x[2],Math.hypot(x[0],x[1]))/rad,Math.atan2(x[1],x[0])/rad]}
function roadPoint(line,t){if(t>=1)return [...line.at(-1)];if(t<=0)return [...line[0]];const seg=line.slice(1).map((p,i)=>km(line[i],p));let left=seg.reduce((a,b)=>a+b,0)*t;for(let i=0;i<seg.length;i++){if(left<=seg[i]){const f=seg[i]?left/seg[i]:0;return line[i].map((n,j)=>n+(line[i+1][j]-n)*f)}left-=seg[i]}return [...line.at(-1)]}
function coords(p){return Math.abs(p[0]).toFixed(4)+'° '+(p[0]>=0?'N':'S')+'  /  '+Math.abs(p[1]).toFixed(4)+'° '+(p[1]>=0?'E':'W')}
function storeTrip(){put('trip',s);lastStore=performance.now()}
let toastTimer;function toast(msg){const n=$('#toast');n.textContent=msg;n.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>n.classList.remove('show'),3000)}
const modeLabel=()=>({home:'출발 준비',drive:'운전 중',airport:'탑승 대기',flight:'비행 중',explore:'도보 탐험'})[s.phase];
const modeIcon=()=>({home:'user',drive:'car',airport:'plane',flight:'plane',explore:'walk'})[s.phase];
const room=new AtlasRoom(()=>({name:profile.name,variant:profile.variant,pos:s.pos,place:s.place,mode:modeLabel(),at:s.at,dest:s.dest}),()=>{updatePeers();if(modalMode==='room')roster()});
function setPage(name){page=name;$('#travel-touch').hidden=name!=='world';['home','world','passport'].forEach(k=>$('#'+k).hidden=k!==name);document.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('sel',b.dataset.nav===name));window.scrollTo({top:0,behavior:'auto'});if(name==='world'){ensureMap();map.invalidateSize();drawMap(true);renderDeck();renderPlaces()}else if(name==='passport')renderPassport();else renderHome()}
function showModal(mode,title,kicker,body,wide=false){const d=$('#modal');if(modalCleanup){modalCleanup();modalCleanup=null}modalMode=mode;$('#modal-title').textContent=title;$('#modal-kicker').textContent=kicker;$('#modal-body').innerHTML=body;d.classList.toggle('wide',wide);if(!d.open)d.showModal();d.scrollTop=0}
function closeModal(){if($('#modal').open)$('#modal').close()}
$('#modal').addEventListener('close',()=>{if(modalCleanup){modalCleanup();modalCleanup=null}modalMode='';profilePreview=null});
$('#close').onclick=closeModal;$('#modal').addEventListener('click',e=>{if(e.target===$('#modal')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal()}});
function primaryPhoto(id){return LOCALPHOTOS[id]?.src||PHOTOS[id]?.fallback||''}
function pictureFallback(img){if(!img||img.dataset.bound)return;img.dataset.bound='yes';img.addEventListener('error',()=>{if(img.dataset.back)return;img.dataset.back='yes';const id=img.dataset.photo;
 if(PHOTOS[id]&&img.src!==PHOTOS[id].url){img.src=PHOTOS[id].url;img.onerror=()=>{img.style.visibility='hidden';img.parentElement.title='사진 연결 대기'}}else img.style.visibility='hidden'})}
function renderHome(){const dest=city(s.dest),origin=city(s.origin);$('#strip-start').textContent=s.origin==='yeosu'?'여수시청':city(s.at).city;$('#strip-airport').textContent=origin.airport;$('#strip-dest').textContent=dest.city;$('#hero-action').textContent=s.phase==='home'?'탐험 시작하기':'여행 이어가기';
 $('#filters').innerHTML=['추천','국내','해외'].map(f=>'<button data-filter="'+f+'" class="'+(filter===f?'on':'')+'" aria-pressed="'+(filter===f)+'">'+f+'</button>').join('');
 const list=filter==='추천'?['tokyo','seoul','paris','rome']:filter==='국내'?['yeosu','jeju','seoul','busan']:['tokyo','paris','rome','newyork','sydney'];
 $('#cards').innerHTML=list.map(id=>{const c=C[id];return '<button class="card" data-card="'+id+'"><div class="card-img"><img data-photo="'+id+'" src="'+esc(primaryPhoto(id))+'" alt="'+esc(LOCALPHOTOS[id]?.scene||PHOTOS[id]?.scene)+'"><span class="card-top">'+c.code+'</span></div><div class="card-body"><small>'+esc(c.country)+'</small><div class="card-row"><b>'+esc(c.city)+'</b><i>'+ic('arrow')+'</i></div><p>'+c.pois.slice(0,2).map(p=>esc(p.name)).join(' · ')+'</p></div></button>'}).join('');$('#cards').querySelectorAll('img').forEach(pictureFallback)}
function renderPassport(){$('#pass-name').textContent=profile.name;$('#pass-total').textContent=String(stamps.length);$('#journal').innerHTML=stamps.length?stamps.slice().reverse().map(x=>'<div class="entry">'+ic(x.kind==='airport'?'plane':'pin')+'<div><strong>'+esc(x.name)+'</strong><div class="help">'+esc(x.city)+'</div></div><small class="entry-date">'+esc(new Date(x.when).toLocaleDateString('ko-KR'))+'</small></div>').join(''):'<div class="empty">아직 방문 기록이 없습니다. 공항에 도착하거나 명소를 방문하면 첫 기록이 남습니다.<br>'+iconsBtn('depart','compass','탐험 시작하기','plain-btn')+'</div>'}
function stamp(name,kind,p){const key=kind+'|'+name+'|'+p.map(n=>n.toFixed(3));if(stamps.some(x=>x.key===key))return;stamps.push({key,name,kind,city:city(s.at).city,when:Date.now(),coord:p});put('stamps',stamps)}
function ensureMap(){if(map)return;map=L.map('map',{zoomControl:true,worldCopyJump:true,minZoom:2,maxZoom:19,preferCanvas:true}).setView(s.pos,13);
 // Reproject the small world reference image onto Web Mercator only for the visible tiles.
 const atlas=L.GridLayer.extend({createTile(coords,done){const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d'),n=2**coords.z;const draw=()=>{const img=atlasEarth;if(!img.naturalWidth){done(null,canvas);return}const sx=((coords.x%n+n)%n)*img.width/n,sw=img.width/n;for(let y=0;y<256;y++){const lat=py=>Math.atan(Math.sinh(Math.PI*(1-2*(coords.y+py/256)/n)))/rad;const a=(90-lat(y))/180*img.height,b=(90-lat(y+1))/180*img.height;ctx.drawImage(img,sx,a,sw,Math.max(.01,b-a),0,y,256,1)}done(null,canvas)};if(atlasEarth.complete)requestAnimationFrame(draw);else atlasEarth.addEventListener('load',draw,{once:true});return canvas}});
 offlineLayer=new atlas({maxNativeZoom:5,attribution:'<a href="https://github.com/vasturiano/three-globe" target="_blank">세계 참고도 · three-globe</a>'}).addTo(map);
 setTiles();pins=L.layerGroup().addTo(map);friends=L.layerGroup().addTo(map);map.on('dragstart',()=>{tracking=false;followId=''});map.on('click',e=>{if(s.phase==='explore'){const p=[e.latlng.lat,norm(e.latlng.lng)];if(pendingWalk){cancelWalk()}openPlace({name:'지도에서 선택한 위치',coord:p,description:'선택한 좌표로 이동하거나 실제 주변 장소를 찾아보세요.'},false)}});
}
const atlasEarth=new Image();atlasEarth.src=IMAGES.earth;
function setTiles(){if(tiles)tiles.remove();const status=$('#map-status');const satellite=tileMode==='satellite';tiles=L.tileLayer(satellite?'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}':'https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxNativeZoom:satellite?18:19,maxZoom:19,attribution:satellite?'Imagery © Esri, Vantor, Earthstar Geographics, GIS User Community':'© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'});const current=tiles;let good=false;current.on('loading',()=>{good=false});current.on('tileload',()=>{if(tiles===current){good=true;status.hidden=true}});current.on('tileerror',()=>{if(!good&&tiles===current){status.textContent='상세 지도 연결 대기 · 세계 참고도와 경로 표시 중';status.hidden=false}});current.addTo(map);$('#tile-btn').title=satellite?'도로 지도로 전환':'위성 지도로 전환'}
function marker(p,iconName,paint){return L.marker(p,{icon:L.divIcon({className:'',html:'<div class="pin-circle" style="background:'+paint+'">'+ic(iconName)+'</div>',iconSize:[33,33],iconAnchor:[16,16]})})}
function redrawLine(){if(routeLine)routeLine.remove();routeLine=null;let list;if(s.phase==='drive'||s.phase==='home')list=s.route;else if(s.phase==='flight'){list=Array.from({length:75},(_,i)=>globePoint(s.flightFrom,s.flightTo,i/74));for(let i=1;i<list.length;i++){while(list[i][1]-list[i-1][1]>180)list[i][1]-=360;while(list[i][1]-list[i-1][1]<-180)list[i][1]+=360}}else if(pendingWalk)list=pendingWalk.route;if(list)routeLine=L.polyline(list,{color:s.phase==='flight'?'#e2a652':'#ce8243',weight:4,opacity:.95,dashArray:s.phase==='flight'?'7 7':null}).addTo(map)}
function fitView(){if(!map)return;if(followId&&room.peers.has(followId)){map.setView(room.peers.get(followId).pos,13);return}if((s.phase==='drive'||s.phase==='home'||s.phase==='flight')&&routeLine){map.fitBounds(routeLine.getBounds(),{padding:[34,34],animate:false,maxZoom:s.phase==='flight'?8:14})}else map.setView(s.pos,s.phase==='airport'?14:15,{animate:false})}
function drawMap(full=false){if(!map)return;if(full){redrawLine();pins.clearLayers();const display=[...city(s.at).pois,...externalPlaces];display.forEach(p=>{L.marker(p.coord,{icon:L.divIcon({className:'',html:'<div class="poi-pin"></div>',iconSize:[13,13],iconAnchor:[6,6]})}).bindTooltip(esc(p.name)).on('click',()=>openPlace(p)).addTo(pins)});if(s.phase==='drive'||s.phase==='home')marker(city(s.origin).terminal,'plane','#8d6838').bindTooltip(esc(city(s.origin).airport)).addTo(pins);if(userPin)userPin.remove();userPin=marker(s.pos,modeIcon(),color[profile.variant]).bindTooltip(esc(profile.name)+' · '+modeLabel()).addTo(map);if(tracking)fitView();updatePeers()}else{userPin?.setLatLng(s.pos);if(tracking&&!followId&&!map.getBounds().pad(-.15).contains(s.pos))map.panTo(s.pos,{animate:false})}$('#coords').textContent=coords(s.pos)}
function updatePeers(){if(!room)return;if(typeof streetPeers==='function')streetPeers();$('#room-label').textContent=room.code?'여행 방 '+(room.peers.size+1):'함께 여행';if(!friends)return;friends.clearLayers();room.peers.forEach(p=>{marker(p.pos,p.mode==='비행 중'?'plane':p.mode==='운전 중'?'car':'user',color[p.variant]).bindTooltip(esc(p.name)+' · '+esc(p.place)).on('click',()=>openPeer(p.id)).addTo(friends)});if(followId){const p=room.peers.get(followId);if(p)map.panTo(p.pos,{animate:false});else followId=''}}
function renderDeck(){const origin=city(s.origin),dest=city(s.dest),local=city(s.at);const motion=s.phase==='drive'||s.phase==='flight',isFlight=s.phase==='flight';
 let text=({home:'여수시청에서 출발',drive:'공항까지 운전',airport:'탑승 준비',flight:'목적지로 비행',explore:local.city+' 탐험'})[s.phase];
 let sub=({home:'자동차로 여수공항 여객터미널까지 가보세요.',drive:s.routeLabel,airport:local.airport+' 여객터미널',flight:'두 공항을 연결하는 모의 비행입니다.',explore:'지도의 장소를 누르거나 방향 버튼으로 걸어 보세요.'})[s.phase];
 let h=(s.phase==='airport'?'<img class="aircraft-photo" src="'+IMAGES.flight+'" alt="활주로 위를 나는 여객기, 촬영 Chad Chen">':'')+'<h2 class="deck-title">'+esc(text)+'</h2><p class="deck-sub">'+esc(sub)+'</p>';
 h+='<div class="ticket"><strong>'+esc(isFlight||s.phase==='airport'?origin.code:local.code)+ic(isFlight||s.phase==='airport'?'plane':modeIcon())+esc(dest.code)+'</strong><span>'+esc(s.place)+' · '+esc(dest.city)+'</span></div>';
 if(motion||pendingWalk)h+='<div class="readout"><span id="distance"></span><span id="percent"></span></div><div class="meter"><i id="fill"></i></div>';
 h+='<div class="deck-btns">';
 if(s.phase==='home')h+=iconsBtn('start-drive','car','운전석에 앉기','primary')+iconsBtn('local','walk','여수부터 걸어서 탐험');
 if(s.phase==='drive'||isFlight){h+=iconsBtn('run',isFlight?'plane':'car',running?'일시 정지':isFlight?'비행 계속하기':'주행 시작','primary')+'<div class="duo">'+iconsBtn('step','arrow',isFlight?'한 구간 비행':'앞으로 250 m','secondary small-btn')+'<button class="secondary small-btn" data-action="speed">속도 ×'+rate+'</button></div>'}
 if(s.phase==='airport')h+=iconsBtn('takeoff','plane','비행기 탑승 · 이륙','primary')+iconsBtn('choose','search','도착 공항 변경')+iconsBtn('local','walk','공항 주변 탐험');
 if(s.phase==='explore'){h+=pendingWalk?iconsBtn('cancel-walk','close','이동 멈추기','primary'):'<div class="walk-pad">'+[['w','↑','북쪽'],['a','←','서쪽'],['s','↓','남쪽'],['d','→','동쪽']].map(a=>'<button aria-label="'+a[2]+'으로 걷기" data-move="'+a[0]+'">'+a[1]+'</button>').join('')+'</div>';h+=iconsBtn('return-airport','car','공항으로 이동')+iconsBtn('google','panorama','현재 위치 거리뷰')}
 h+='<div class="duo">'+iconsBtn('model','camera','3D 모델','secondary small-btn')+iconsBtn('room','users','동행 보기','secondary small-btn')+'</div></div>';
 if(s.phase==='drive')h+='<p class="help">앞으로 버튼 또는 ↑ 키로 직접 주행할 수 있습니다. 주행 시작을 누르면 경로를 따라 연속 이동합니다.</p><a class="secondary small-btn" href="https://www.google.com/maps/dir/?api=1&amp;origin='+encodeURIComponent(s.route[0].join(','))+'&amp;destination='+encodeURIComponent(city(s.origin).terminal.join(','))+'&amp;travelmode=driving" target="_blank" rel="noopener">Google 실제 도로 길찾기</a>';
 if(s.phase==='explore')h+='<p class="help">화면의 방향 버튼을 누르면 35 m씩 걷습니다. PC에서는 방향키로도 이동할 수 있습니다.</p>';
 if(s.phase==='flight')h+='<p class="help">지도상의 가상 여정이며 실제 직항편 운항 여부와 다를 수 있습니다.</p>';
 $('#console').innerHTML=h;
 renderTouchControls();
 progress();
}
function progress(){const n=$('#percent');if(!n)return;const t=pendingWalk?pendingWalk.t:s.t,dist=pendingWalk?pendingWalk.length:s.phase==='drive'?s.roadKm:km(s.flightFrom,s.flightTo);n.textContent=Math.round(t*100)+'%';$('#distance').textContent=(dist*t).toFixed(dist>100?0:1)+' / '+dist.toFixed(dist>100?0:1)+' km';$('#fill').style.width=(t*100)+'%'}
function renderPlaces(){const c=city(s.at);$('#near-title').textContent=c.city+' 주변 탐험';const list=[...c.pois,...externalPlaces];$('#places').innerHTML=list.length?list.map((p,i)=>'<article class="place"><span class="micro">'+(i<c.pois.length?'FIELD NOTE':'WIKIPEDIA')+'</span><h3>'+esc(p.name)+'</h3><p>'+esc(p.description||'이 장소에 대한 지역 문서를 열어볼 수 있습니다.')+'</p><button class="text-btn" data-poi="'+i+'">장소 살펴보기 '+ic('arrow')+'</button></article>').join(''):'<div class="empty">이 위치에서 주변 명소를 검색하거나 지도의 지점을 선택해 보세요.</div>'}


;
function sync(full=true){storeTrip();if(page==='world'){drawMap(full);renderDeck();renderPlaces()}else if(page==='home')renderHome();room.send()}
function cancelWalk(){walkSeq++;pendingWalk=null;running=false;if(map)redrawLine()}
function pause(){running=false;motionTime=0}
function resetMotion(){pause();cancelWalk();driveRequest++;externalPlaces=[];followId='';tracking=true;rate=1}
async function roadRoute(a,b,signal){const q=[a,b].map(p=>p[1].toFixed(6)+','+p[0].toFixed(6)).join(';');const r=await fetch('https://router.project-osrm.org/route/v1/driving/'+q+'?overview=full&geometries=geojson',{signal});if(!r.ok)throw Error();const json=await r.json(),route=json.routes?.[0];if(!route?.distance||!route.geometry?.coordinates?.length)throw Error();const line=route.geometry.coordinates.map(p=>[p[1],p[0]]);if(!line.every(validPoint))throw Error();return {line,distance:route.distance/1000}}
function startDrive(returning=false){const from=[...s.pos],c=city(s.at),to=c.terminal,base=!returning&&s.at==='yeosu';resetMotion();s.origin=s.at;s.phase='drive';s.t=0;s.route=base?GEO.drive.geometry:[from,to];s.pos=[...s.route[0]];s.roadKm=base?GEO.drive.distanceKm:km(from,to);s.routeLabel=base?GEO.drive.label:'공항까지 두 좌표를 이은 모의 경로';if(s.roadKm<.12){arriveAirport();setPage('world');return}sync();setPage('world');
 const token=++driveRequest;const end=base?GEO.drive.geometry.at(-1):to;routePromise=roadRoute(from,end,AbortSignal.timeout(8500)).then(r=>{if(token!==driveRequest||s.phase!=='drive'||s.t>0)return;s.route=r.line;s.roadKm=r.distance;s.routeLabel='OpenStreetMap 도로망 · OSRM 자동차 경로';s.pos=[...r.line[0]];sync()}).catch(()=>{});toast('운전석에 앉았습니다. 주행을 시작해 보세요.')}
function arriveAirport(){pause();s.phase='airport';s.at=s.origin;s.t=0;const c=city(s.at);s.pos=[...c.terminal];s.place=c.airport;s.poi=null;stamp(c.airport,'airport',s.pos);sync();toast(c.airport+'에 도착했습니다.')}
function takeoff(){if(s.dest===s.origin){chooser();toast('출발지와 다른 도착 공항을 골라 주세요.');return}resetMotion();s.flightFrom=[...city(s.origin).terminal];s.flightTo=[...city(s.dest).terminal];s.phase='flight';s.t=0;s.pos=[...s.flightFrom];s.place=city(s.origin).code+' → '+city(s.dest).code;running=true;motionTime=0;sync();toast(city(s.dest).city+' 방향으로 이륙합니다.')}
function land(){pause();s.phase='explore';s.at=s.dest;s.pos=[...city(s.at).terminal];s.place=city(s.at).airport;s.t=0;s.poi=null;externalPlaces=[];tracking=true;stamp(s.place,'airport',s.pos);sync();toast(city(s.at).city+'에 도착했습니다. 이제 주변 장소를 탐험해 보세요.')}
function advance(t){if(s.phase!=='drive'&&s.phase!=='flight')return;s.t=Math.max(0,Math.min(1,s.t+t));s.pos=s.phase==='drive'?roadPoint(s.route,s.t):globePoint(s.flightFrom,s.flightTo,s.t);if(s.t>=1){if(s.phase==='drive')arriveAirport();else land();return}if(page==='world'){drawMap();progress()}if(performance.now()-lastStore>1800)storeTrip();if(performance.now()-lastWire>1100){room.send();lastWire=performance.now()}}
function step(){if(s.phase==='drive')advance(.25/Math.max(.25,s.roadKm));if(s.phase==='flight')advance(.05);storeTrip();room.send()}
function animate(now){if(running){if(!motionTime)motionTime=now;const dt=Math.min(.25,(now-motionTime)/1000);motionTime=now;if(pendingWalk){const w=pendingWalk;w.t=Math.min(1,w.t+dt/Math.min(18,Math.max(3,w.length*1.2)));s.pos=roadPoint(w.route,w.t);if(w.t>=1){const p=w.p;pendingWalk=null;finishVisit(p)}else if(now-lastMap>80){if(page==='world'){drawMap();progress()}lastMap=now}}else if(now-lastMap>75){advance(Math.min(.35,(now-(tour||now))*.001)*rate/(s.phase==='flight'?24:38));tour=now;lastMap=now} }else{motionTime=0;tour=null}if(modalMode==='model'&&$('#model-status'))$('#model-status').textContent=s.place+' · '+modeLabel()+(s.phase==='drive'||s.phase==='flight'?' · '+Math.round(s.t*100)+'%':'');requestAnimationFrame(animate)}
function walk(key){if(s.phase!=='explore')return;cancelWalk();followId='';tracking=true;const v={w:[1,0],s:[-1,0],a:[0,-1],d:[0,1]}[key];if(!v)return;s.pos=[Math.min(85,Math.max(-85,s.pos[0]+v[0]*.035/111.2)),norm(s.pos[1]+v[1]*.035/(111.2*Math.max(.08,Math.cos(s.pos[0]*rad))))];s.place=city(s.at).city+' 도보 탐험';s.poi=null;const nearest=[...city(s.at).pois,...externalPlaces].find(p=>km(p.coord,s.pos)<.08);if(nearest){s.place=nearest.name;stamp(nearest.name,'place',s.pos)}storeTrip();if(page==='world'){drawMap();renderDeck()}room.send()}
function finishVisit(p){pause();s.pos=[...p.coord];s.place=p.name;s.poi=p.name;stamp(p.name,'place',p.coord);tracking=true;sync();toast(p.name+' 방문을 여권에 기록했습니다.')}
function goToPlace(p){closeModal();if(s.phase!=='explore'){toast('현지에 도착하면 명소로 이동할 수 있습니다.');return}cancelWalk();followId='';tracking=true;const distance=km(s.pos,p.coord);if(distance<.08){finishVisit(p);return}pendingWalk={p,route:[[...s.pos],[...p.coord]],length:distance,t:0};running=true;motionTime=0;s.place=p.name+' 방향 이동';sync();toast('선택한 좌표까지 모의 이동합니다.')}
function localExplore(){resetMotion();s.phase='explore';s.t=0;s.poi=null;sync();setPage('world')}
function openPlace(p,landmark=true){if(!p?.coord)return;selectedPOI=p;const can=s.phase==='explore';
 showModal('place',p.name,'FIELD GUIDE','<div class="panel-note"><b>'+esc(p.en||city(s.at).city)+'</b><p>'+esc(p.description||'현재 위치 주변에서 찾은 장소입니다.')+'</p><span class="micro">'+esc(coords(p.coord))+'</span></div><div class="deck-btns">'+(can?iconsBtn('visit','walk','이 장소로 이동','primary'):'<p class="help">현지 탐험 단계에서 이 장소를 방문할 수 있습니다.</p>')+iconsBtn('place-google','panorama','Google 지도·거리뷰 열기')+(p.source?'<a class="ext secondary" href="'+safeLink(p.source)+'" target="_blank" rel="noopener">장소 자료 보기 '+ic('arrow')+'</a>':'')+'</div>')}
function cityDetail(id){const c=city(id);if(!c)return;targetFocus=c;showModal('destination',c.city,'DESTINATION · '+c.code,'<img class="sheet-photo" data-photo="'+esc(id)+'" src="'+esc(primaryPhoto(id))+'" alt="'+esc(LOCALPHOTOS[id]?.scene||PHOTOS[id]?.scene)+'"><p class="panel-note"><b>'+esc(c.country)+' · '+esc(c.airport)+'</b><br>'+esc(c.pois.map(p=>p.name).join(' · '))+'</p><div class="deck-btns">'+iconsBtn('select-target','plane','이 여행지 선택','primary')+iconsBtn('target-google','pin','실제 장소 미리보기')+'</div>');pictureFallback($('#modal-body img'))}
function chooser(){showModal('choose','도착 공항 선택','DESTINATION SEARCH','<label class="field">도시·공항 이름 또는 IATA 코드<input id="dest-search" placeholder="도쿄, 파리, ICN, London…" autocomplete="off"></label><div class="help">추천 도시 9곳과 Natural Earth 세계 공항 '+catalog.length+'곳을 검색할 수 있습니다.</div><div id="choice-results" class="results"></div>');const input=$('#dest-search');function list(){const q=input.value.trim().toLowerCase();const main=GEO.cities.map(c=>({...c,search:c.city+' '+c.country+' '+c.airport+' '+c.code+' '+c.slug}));const known=new Set(main.map(c=>c.code));const more=catalog.filter(r=>!known.has(r[0])&&(!q||r.join(' ').toLowerCase().includes(q))).slice(0,45).map(r=>custom(r[0]));const choices=[...main.filter(c=>c.search.toLowerCase().includes(q)),...more];$('#choice-results').innerHTML=choices.length?choices.map(c=>'<button class="result" data-select="'+esc(c.slug)+'"><span class="code">'+esc(c.code)+'</span><span><b>'+esc(c.city)+'</b><small>'+esc(c.airport)+'</small></span><span class="end">'+ic('chevron')+'</span></button>').join(''):'<div class="empty">일치하는 공항이 없습니다. 영문 공항명이나 세 글자 공항 코드로 검색해 보세요.</div>'}input.oninput=list;list();input.focus()}
function choose(id){const c=city(id);if(!c)return;if(s.phase==='flight'){toast('착륙한 뒤 다음 여행지를 선택할 수 있습니다.');return}if(s.phase==='airport'&&id===s.origin){toast('현재 공항과 다른 도착지를 선택해 주세요.');return}s.dest=id;closeModal();sync();toast('다음 목적지 · '+c.city);if(page==='home')renderHome()}
async function nearby(){const p=[...s.pos],at=s.at;showModal('near','이 위치 주변 찾기','LOCAL DISCOVERY','<p>반경 10 km 안에서 장소 문서를 찾는 중입니다.</p>');
 async function wiki(lang){const q=new URLSearchParams({action:'query',list:'geosearch',gscoord:p.join('|'),gsradius:'10000',gslimit:'12',format:'json',origin:'*'});const r=await fetch('https://'+lang+'.wikipedia.org/w/api.php?'+q,{signal:AbortSignal.timeout(7000)});if(!r.ok)throw Error();const a=await r.json();return (a.query?.geosearch||[]).filter(v=>validPoint([v.lat,v.lon])).map(v=>({name:v.title,coord:[v.lat,v.lon],description:'현재 검색 위치에서 약 '+(v.dist/1000).toFixed(1)+' km · 위키백과 장소 문서',source:'https://'+lang+'.wikipedia.org/?curid='+v.pageid}))}
 let list=[];try{list=await wiki('ko')}catch{}if(!list.length){try{list=await wiki('en')}catch{}}
 if(s.at!==at||modalMode!=='near')return;externalPlaces=list;if(map){drawMap(true);renderPlaces()}
 const external='<a target="_blank" rel="noopener" class="ext secondary" href="'+gmSearch('관광명소',p)+'">Google 지도에서 주변 명소 검색 '+ic('arrow')+'</a>';
 $('#modal-body').innerHTML=(list.length?'<div class="results">'+list.map((v,i)=>'<button class="result" data-near="'+i+'"><span><b>'+esc(v.name)+'</b><small>'+esc(v.description)+'</small></span>'+ic('chevron')+'</button>').join('')+'</div>':'<p class="panel-note">이 위치에서 온라인 장소 문서를 가져오지 못했습니다. 아래 Google 지도에서 주변 명소를 검색할 수 있습니다.</p>')+external}
function gmSearch(q,p){return 'https://www.google.com/maps/search/'+encodeURIComponent(q)+'/@'+p.join(',')+',14z'}
function googleAt(p,label,street=false){googlePoint=[...p];googleLabel=label;const point=p.map(n=>n.toFixed(6)).join(','),key=sessionKey;
 const mapUrl='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(point);
 const streetUrl='https://www.google.com/maps/@?api=1&map_action=pano&viewpoint='+encodeURIComponent(point);
 const frame='https://maps.google.com/maps?q='+encodeURIComponent(point)+'&hl=ko&z=16&output=embed';
 const en=key?'<button class="primary" data-action="g-pano">동행 거리뷰 시작</button>':'';
 showModal('google',label,'GOOGLE MAPS',en+'<iframe class="g-frame" title="Google 지도 '+esc(label)+'" src="'+esc(frame)+'" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe><div class="duo"><a class="primary ext" target="_blank" rel="noopener" href="'+streetUrl+'">'+ic('panorama')+' 스트리트 뷰 열기</a><a class="secondary ext" target="_blank" rel="noopener" href="'+mapUrl+'">Google 지도 열기 '+ic('arrow')+'</a></div><p class="help">거리뷰는 촬영된 지점에서 열립니다. 새 창의 거리뷰는 개별 탐험용입니다. 동행 거리뷰에서는 걸어간 위치가 방에도 반영됩니다.</p><details><summary>동행 거리뷰 연결하기</summary><p class="help">Maps JavaScript API가 활성화된 브라우저용 키가 필요합니다. 사용량에 따라 Google 요금이 발생할 수 있습니다. 키는 이 탭에서만 사용됩니다.</p><div class="form-row"><input class="search" id="g-key" type="password" placeholder="Maps JavaScript API 브라우저 키" autocomplete="off"><button class="secondary" data-action="key">적용</button></div></details>',true)}
let sessionKey='';
function openRoom(){showModal('room','함께 여행','TRAVEL PARTY','<div id="room-pane"></div>');roster()}
function roster(){const box=$('#room-pane');if(!box)return;if(!room.code){if(box.dataset.form==='yes')return;box.dataset.form='yes';box.innerHTML='<p class="panel-note">친구와 같은 방에 들어가면 서로의 캐릭터, 현재 장소와 이동 경로상의 위치를 볼 수 있습니다.</p>'+iconsBtn('create-room','users','새 여행 방 만들기','primary')+'<div class="separate"><label class="field">초대받은 방 코드 또는 주소<input id="join-code" placeholder="코드 또는 초대 주소 붙여넣기" autocomplete="off"></label>'+iconsBtn('join-room','arrow','여행 방 입장')+'</div>';return}
 box.dataset.form='no';const active=room.peers;box.innerHTML='<div class="panel-note"><b>'+esc(room.state)+'</b> · 현재 '+(1+active.size)+'명<br><small>닉네임과 여행 속 좌표만 교환합니다. 코드가 있는 사람은 입장할 수 있습니다.</small></div><h3>여행 방 코드</h3><div class="room-code">'+esc(room.code)+'</div><div class="duo top-gap">'+iconsBtn('copy-code','users','코드 복사','secondary small-btn')+iconsBtn('copy-link','arrow',!hasShareableAddress()?'초대 안내 복사':'초대 링크 복사','secondary small-btn')+'</div><h3>함께하는 여행자</h3><div class="roster-line"><i class="dot" style="background:'+color[profile.variant]+'"></i>'+esc(profile.name)+' (나)</div>'+[...active.values()].map(p=>'<div class="roster-line"><i class="dot" style="background:'+color[p.variant]+'"></i><div>'+esc(p.name)+'<div class="help">'+esc(p.place)+' · '+esc(p.mode)+'</div></div><button class="secondary small-btn end" data-peer="'+esc(p.id)+'">지도 보기</button></div>').join('')+'<p class="help">'+(room.state==='온라인'?'다른 기기에서도 같은 코드로 입장할 수 있습니다.':'인터넷 중계 연결을 확인 중입니다. 같은 브라우저의 탭 간 연결은 별도로 작동합니다.')+'</p>'+iconsBtn('leave-room','close','방 나가기','secondary small-btn')}
const parseCode=v=>{const t=String(v||'').trim();if(/^[0-9a-f]{32}$/i.test(t))return t.toLowerCase();const m=t.match(/(?:room=|방 코드\s*)([a-f0-9]{32})(?:\b|$)/i);return m?.[1].toLowerCase()||''};
async function join(code){if(!code){toast('초대받은 32자리 방 코드를 입력해 주세요.');return}try{await room.join(code);if(hasShareableAddress())history.replaceState(null,'','#room='+code);openRoom()}catch(e){toast(e.message);openRoom()}}
async function copyText(v){try{await navigator.clipboard.writeText(v);toast('복사했습니다.')}catch{showModal('copy','아래 내용을 복사해 주세요','INVITATION','<label class="field">초대 정보<input id="copy-value" readonly value="'+esc(v)+'"></label>');$('#copy-value').select()}}
function openPeer(id){const p=room.peers.get(id);if(!p)return;showModal('peer',p.name,'FELLOW TRAVELER','<div class="panel-note">현재 '+esc(p.place)+' · '+esc(p.mode)+'<br>'+coords(p.pos)+'</div><div class="deck-btns"><button class="primary" data-follow="'+esc(id)+'">이 여행자의 위치 따라보기</button><button class="secondary" data-peer-model="'+esc(id)+'">여행자 3D 캐릭터 보기</button>'+(p.mode==='도보 탐험'&&city(p.at)?'<button class="secondary" data-meet="'+esc(id)+'">이 장소에서 함께 탐험하기</button>':'')+'</div>')}
function meetPeer(id){const p=room.peers.get(id);if(!p||p.mode!=='도보 탐험'||!city(p.at)){toast('동행자가 이미 다른 곳으로 이동했습니다.');return}resetMotion();s.phase='explore';s.at=s.origin=p.at;s.dest=city(p.dest)?p.dest:p.at;s.pos=[...p.pos];s.t=0;s.place=p.place;s.poi=null;closeModal();setPage('world');sync();toast(p.name+' 여행자와 같은 위치에 도착했습니다.')}
function model(kind,person=profile){const k=kind||(s.phase==='drive'?'car':s.phase==='flight'||s.phase==='airport'?'plane':'traveler');showModal('model',k==='car'?'자동차':k==='plane'?'탑승 항공기':person.name+'의 여행자','MODEL VIEWER','<div class="modelhost" id="modelhost"></div><div class="panel-note" id="model-status"></div>'+((s.phase==='drive'||s.phase==='flight')?'<div class="duo top-gap">'+iconsBtn('step','arrow','직접 전진')+iconsBtn('model-run','plane','연속 이동 / 정지')+'</div>':''),true);const v=mountTravelModel($('#modelhost'),k,{variant:person.variant});modalCleanup=()=>v.destroy()}
function editProfile(){let v=profile.variant;showModal('profile','나의 여행자','TRAVELER PROFILE','<label class="field">여행자 닉네임<input id="nickname" maxlength="20" value="'+esc(profile.name)+'"></label><h3>캐릭터 선택</h3><div id="variants" class="field-color"></div><div class="modelhost" id="modelhost"></div><button class="primary" data-action="save-profile">이 캐릭터로 여행하기</button>');const n=$('#variants');const m=mountTravelModel($('#modelhost'),'traveler',{variant:v});function draw(){n.innerHTML=['솔','노을','바다','보라'].map((name,i)=>'<button class="variant '+(v===i?'sel':'')+'" data-variant="'+i+'"><i class="dot" style="background:'+color[i]+'"></i> '+name+'</button>').join('')}draw();profilePreview=()=>({name:$('#nickname').value.trim().slice(0,20)||'여행자',variant:v});n.onclick=e=>{const b=e.target.closest('[data-variant]');if(b){v=+b.dataset.variant;draw();m.setMode('traveler',{variant:v})}};modalCleanup=()=>m.destroy()}
function panorama(){showModal('panorama','조던 연못, 아카디아 국립공원','360° FIELD VIEW','<div class="pano-box" id="sphere"></div><p class="help">미국 메인주 · 드래그하거나 화살표 키로 주위를 둘러보세요. 마우스 휠로 확대할 수 있습니다.</p><div class="duo"><a class="secondary ext" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=Jordan+Pond+Acadia">실제 위치 보기 '+ic('pin')+'</a></div><small>사진 Matthew Petroff · <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">CC BY-SA 3.0</a></small>',true);modalCleanup=openPhotoSphere($('#sphere'),IMAGES.cubes)}
function credits(){const all=Object.entries(PHOTOS).map(([id,p])=>'<p><b>'+esc(C[id].city)+'</b> · '+esc(p.scene)+'<br>'+esc(p.credit)+' · <a target="_blank" rel="noopener" href="'+safeLink(p.licenseUrl)+'">'+esc(p.license)+'</a> · <a target="_blank" rel="noopener" href="'+safeLink(p.source)+'">원본</a></p>').join('');const offline=Object.values(LOCALPHOTOS).map(p=>'<p>'+esc(p.scene)+' · '+esc(p.credit)+' · <a target="_blank" rel="noopener" href="'+safeLink(p.source)+'">'+esc(p.license)+'</a></p>').join('');showModal('credits','지도·사진 출처','CREDITS','<div class="help"><p>도로 지도 © OpenStreetMap contributors · 경로 OSRM · 위성영상 Esri, Vantor, Earthstar Geographics, GIS User Community. 공항 위치 Natural Earth (public domain). 세계 참고도 three-globe. 지역 문서 Wikipedia.</p><p>미국 조던 연못 360° · Matthew Petroff · <a href="https://github.com/mpetroff/pannellum/tree/master/examples" target="_blank">원본</a> · <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank">CC BY-SA 3.0</a>. 표지 사진은 같은 파노라마에서 투영했습니다.</p><p>3D 모델의 제작자와 이용 허가는 모델 화면에 표시합니다. 지도 라이브러리 Leaflet (BSD-2-Clause), 통신 Eclipse Paho, 3D 렌더러 Google model-viewer (Apache-2.0).</p><h3>여행지 사진</h3><p>활주로 위 항공기 · <a href="https://github.com/Jxck-S/aircraft-photos/blob/main/images/N327JT.jpg" target="_blank">Chad Chen</a> · aircraft-photos 갤러리.</p>'+offline+all+'</div>')}
function depart(){setPage('world');if(s.phase==='home')startDrive()}
function handle(a){switch(a){
 case 'home':case 'world':case 'passport':setPage(a);break;case 'depart':depart();break;case 'choose':chooser();break;case 'select-target':if(targetFocus){if(targetFocus.slug===s.at&&s.phase==='home'){closeModal();localExplore()}else choose(targetFocus.slug)}break;
 case 'start-drive':startDrive();break;case 'return-airport':startDrive(true);break;case 'local':localExplore();break;case 'takeoff':takeoff();break;
 case 'run':case 'model-run':running=!running;motionTime=0;tour=null;renderDeck();break;case 'speed':rate=rate===1?2:rate===2?5:1;renderDeck();break;case 'step':step();break;
 case 'cancel-walk':cancelWalk();s.place=city(s.at).city+' 도보 탐험';sync();break;case 'profile':editProfile();break;case 'save-profile':if(profilePreview){profile=profilePreview();put('profile',profile);closeModal();sync();if(page==='passport')renderPassport();toast('여행자 설정을 저장했습니다.')}break;
 case 'google':googleAt(s.pos,s.place);break;case 'place-google':if(selectedPOI)googleAt(selectedPOI.coord,selectedPOI.name);break;case 'target-google':if(targetFocus){const p=targetFocus.pois[0];googleAt(p?.coord||targetFocus.terminal,p?.name||targetFocus.airport)}break;
 case 'g-map':googleAt(googlePoint,googleLabel);break;case 'g-pano':liveStreet(googlePoint,googleLabel);break;case 'key':{const key=$('#g-key')?.value.trim();if(!/^AIza[\w-]{30,60}$/.test(key||'')){toast('브라우저용 Google API 키 형식을 확인해 주세요.');break}sessionKey=key;liveStreet(googlePoint,googleLabel);break}
 case 'panorama':panorama();break;case 'model':model();break;case 'credits':credits();break;case 'near':nearby();break;case 'visit':goToPlace(selectedPOI);break;
 case 'room':openRoom();break;case 'create-room':join(AtlasRoom.code());break;case 'join-room':join(parseCode($('#join-code').value));break;case 'copy-code':copyText(room.code);break;
 case 'copy-link':copyText(!hasShareableAddress()?'로밍 아틀라스를 열고 [함께 여행]에서 입장하세요. 방 코드 '+room.code:location.origin+location.pathname+'#room='+room.code);break;
 case 'leave-room':room.leave();followId='';if(hasShareableAddress())history.replaceState(null,'',location.pathname+location.search);openRoom();break;
 case 'tiles':tileMode=tileMode==='satellite'?'road':'satellite';setTiles();toast(tileMode==='satellite'?'위성 영상':'도로 지도');break;case 'recenter':followId='';tracking=true;map.setView(s.pos,s.phase==='flight'?5:15);break;
}}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;if(d.action){handle(d.action);return}if(d.filter){filter=d.filter;renderHome()}else if(d.card)cityDetail(d.card);else if(d.select)choose(d.select);else if(d.poi!==undefined)openPlace([...city(s.at).pois,...externalPlaces][+d.poi]);else if(d.near!==undefined)openPlace(externalPlaces[+d.near]);else if(d.move)walk(d.move);else if(d.peer)openPeer(d.peer);else if(d.meet)meetPeer(d.meet);else if(d.follow){followId=d.follow;tracking=false;closeModal();setPage('world');map.setView(room.peers.get(d.follow)?.pos||s.pos,14)}else if(d.peerModel){const p=room.peers.get(d.peerModel);if(p)model('traveler',p)}});
document.addEventListener('keydown',e=>{if(page!=='world'||$('#modal').open||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.altKey||e.ctrlKey||e.metaKey)return;const m={ArrowUp:'w',ArrowDown:'s',ArrowLeft:'a',ArrowRight:'d',w:'w',a:'a',s:'s',d:'d'}[e.key];if(!m)return;e.preventDefault();if(s.phase==='explore')walk(m);else if((s.phase==='drive'||s.phase==='flight')&&m==='w')step()});
window.addEventListener('pagehide',()=>{storeTrip();room.send('bye')});document.documentElement.style.setProperty('--hero','url("'+IMAGES.hero+'")');setPage('home');requestAnimationFrame(animate);const invite=parseCode(location.hash);if(invite){openRoom();$('#join-code').value=invite}

