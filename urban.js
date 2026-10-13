/* Urban experience layer. Data describes destinations, exhibits and voices;
   the existing Three.js renderer, avatar and panel system remain authoritative. */
const VENUES = {
  sture: {id:'sture', name:'Sturegallerian', street:'Stureplan', entrance:[-26.5,185],
    returnTo:[-24.5,185], returnYaw:Math.PI/2, spawn:[500,157], exit:[500,155],
    bounds:[475.4,524.6,153.4,215.4], fog:0x2a2216, sky:0xffe0b0, ground:0x302319,
    welcome:'Mässing, marmor och sena samtal. Utforska montrarna eller slå dig ner i Salongen.'},
  nod: {id:'nod', name:'NOD-passagen', street:'Biblioteksgatan', entrance:[-5.3,58],
    returnTo:[-4.3,58], returnYaw:Math.PI/2, spawn:[800,44], exit:[800,41.8],
    bounds:[789,811,41,71], fog:0x132e32, sky:0xd5f1e1, ground:0x21342a,
    welcome:'En fiktiv designpassage: keramik, små upplagor och ljus från skärgården.'},
};
const EXHIBITS = [
  {id:'skargard',venue:'nod',x:794,z:51,title:'Skärgårdsljus',kind:'lamp',color:'#dfb16c',
    maker:'Ljusateljén · NOD',detail:'En mässingslykta inspirerad av ett sista fönster i Vaxholm. Den varma kupan möter passagens svala jade.',
    action:'Tänd kvällsljuset',response:'Lyktan lyser nu för nästa kvällsvandrare.'},
  {id:'nattlinje',venue:'nod',x:806,z:59,title:'Nattlinje',kind:'vase',color:'#72b5ab',
    maker:'Keramikstudion · NOD',detail:'En liten upplaga i havsgrön glasyr. Formen lånar sin siluett från kajernas pollare efter regnet.',
    action:'Spara i min kväll',response:'Nattlinje har lagts till i din kvällssamling.'},
  {id:'bibliotek',venue:'nod',x:794,z:66,title:'Bibliotek 23',kind:'book',color:'#db795a',
    maker:'Små upplagor · Biblioteksgatan',detail:'En fiktiv risotryckt bok med nattliga skyltfönster, trapphus och kaffefläckar. Öppna den på en slumpmässig sida.',
    action:'Bläddra i boken',response:'Sida 23: ”Stockholm är som vackrast när någon fortfarande väntar på dig.”'},
  {id:'sturebrass',venue:'sture',x:491,z:179,title:'Blåtimme / 18:42',kind:'vase',color:'#c29a55',
    maker:'Mässingsrummet · Sturegallerian',detail:'En skulptural vas med borstad mässing. Fasetterna fångar gallerians takljus som små bitar av en försenad solnedgång.',
    action:'Spara i min kväll',response:'Blåtimme / 18:42 har lagts till i din kvällssamling.'},
  {id:'sturevinyl',venue:'sture',x:509,z:191,title:'Sista spårvagnen',kind:'record',color:'#83a6df',
    maker:'Kvällsarkivet · Sturegallerian',detail:'Ett fiktivt skivomslag för en stad som aldrig riktigt tystnar. Ett kort, syntetiskt signalmotiv är allt som behövs.',
    action:'Lyssna på signalen',response:'Två toner dröjer kvar under glastaket.'},
];
const VOICES = [
  {name:'Signe · formgivare',signal:'Konst & design',venue:'nod',lines:[
    'Det lilla ljuset i NOD-passagen är min favorit. Det ser ut som ett fönster långt ute i skärgården.',
    'Ryktet säger att nästa utställning bara ska bestå av kvarglömda paraplyer. Jag skulle gå.']},
  {name:'Malik · nattpromenerare',signal:'Promenad & upptäckt',venue:'sture',lines:[
    '”Vi ses vid Svampen” är nog Stockholms mest exakta och mest oprecisa adress samtidigt.',
    'Gallerian är öppen i vår lilla kvällsvärld. Följ de varma portarna väster om Svampen.']},
  {name:'Liv · bokletare',signal:'Små upplagor',venue:'nod',lines:[
    'Det finns en bok i NOD-passagen som verkar minnas varje skyltfönster på den här gatan.',
    'Jag går långsamt här. Man hittar mer när man slutar räkna stegen.']},
  {name:'Olle · kvällsbarista',signal:'Mat & möten',venue:'sture',lines:[
    'Sista kannan kaffe, första riktiga samtalet. Salongen i Sturegallerian har plats.',
    'Någon kallar det blåtimmen. Jag kallar det tiden då kanelbullarna smakar bäst.']},
];
const urban = {
  venue:null, rooms:{}, blockers:[], exhibits:[], batches:[], discoveries:new Set(),
  speedMode:1, wSprint:false, lastW:-Infinity, guide:'sture', talking:null, talkIndex:0,
  lastArtUpdate:-1, stats:{batchedMeshes:0, instanceGroups:0}, frameTimes:[], lastFrameTime:0,
};
const geometryCache=new Map(), materialCache=new Map();
function sharedGeometry(type,...args){
  const key=type+':'+args.join(',');
  if(!geometryCache.has(key)) geometryCache.set(key,new THREE[type+'Geometry'](...args));
  return geometryCache.get(key);
}
function limbGeometry(r1,r2,height){
  const key=`limb:${r1}:${r2}:${height}`;
  if(!geometryCache.has(key)) geometryCache.set(key,new THREE.CylinderGeometry(r1,r2,height,8).translate(0,-height/2,0));
  return geometryCache.get(key);
}
function cachedPBR(color,options={}){
  // Texture-bearing or animated materials remain individually owned.
  const key=String(color)+JSON.stringify(options);
  if(!materialCache.has(key)) materialCache.set(key,new THREE.MeshStandardMaterial(Object.assign({
    color:new THREE.Color(color).convertSRGBToLinear(),roughness:.82,metalness:0,envMapIntensity:.35,
  },options)));
  return materialCache.get(key);
}
function currentRoom(){ return state.inside?urban.rooms[urban.venue]:world; }
function currentSpawn(){ return state.inside?VENUES[urban.venue].spawn:[0,-14]; }
function speedMultiplier(){ return Math.max(urban.speedMode,(keys.ShiftLeft||keys.ShiftRight||urban.wSprint)?2:1); }
function refreshSpeed(){
  const speed=speedMultiplier();
  document.querySelectorAll('[data-speed]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.speed)===speed)));
}
function setSpeed(mode){
  urban.speedMode=mode===urban.speedMode&&mode!==1?1:mode;
  urban.wSprint=false; refreshSpeed();
}
function speedKeyDown(e){
  if(e.code==='KeyW' && !e.repeat){
    const now=performance.now(); urban.wSprint=now-urban.lastW<300; urban.lastW=now;
  }
}
function addBlocker(area,x,z,r){ urban.blockers.push({area,x,z,r}); }
function isNavigable(x,z,area){
  const rects=area==='out'?WALK_OUT:[VENUES[area].bounds];
  return rects.some(r=>inRect(r,x,z)) && !urban.blockers.some(b=>b.area===area && dist2(x,z,b.x,b.z)<(b.r+.28)**2);
}
function movePlayer(dx,dz){
  // Swept substeps keep 4x travel from tunnelling through narrow props.
  const p=player.group.position, steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.16));
  for(let i=0;i<steps;i++){
    const nx=p.x+dx/steps,nz=p.z+dz/steps;
    if(walkable(nx,nz)){p.x=nx;p.z=nz;}
    else if(walkable(nx,p.z)) p.x=nx;
    else if(walkable(p.x,nz)) p.z=nz;
  }
}
function snapCamera(){
  const p=player.group.position;
  camera.position.set(p.x-Math.sin(cam.yaw)*Math.cos(cam.pitch)*cam.dist,
    1.6+Math.sin(cam.pitch)*cam.dist,p.z-Math.cos(cam.yaw)*Math.cos(cam.pitch)*cam.dist);
  camera.lookAt(p.x,1.5,p.z);
}
function goThroughDoor(inside,id='sture'){
  if(transitioning||!player) return;
  const venue=inside?VENUES[id]:VENUES[urban.venue];
  if(!venue) return;
  transitioning=true; resetInput(); closePanel(); hidePrompt(); promptKey=null;
  const fade=document.getElementById('fade');
  fade.style.transition='opacity .35s'; fade.style.opacity=1;
  setTimeout(()=>{
    for(const room of Object.values(urban.rooms)) room.visible=false;
    player.group.parent.remove(player.group);
    state.inside=inside; urban.venue=inside?venue.id:null; world.visible=!inside;
    scene.userData.sky.visible=scene.userData.stars.visible=!inside;
    const parent=inside?urban.rooms[venue.id]:world;
    parent.visible=true; parent.add(player.group);
    const point=inside?venue.spawn:venue.returnTo;
    player.group.position.set(point[0],0,point[1]);
    cam.yaw=inside?0:venue.returnYaw; cam.pitch=inside?.22:.26;
    player.group.rotation.y=cam.yaw;
    scene.fog.color.set(inside?venue.fog:0x14274a);
    scene.fog.near=inside?18:30; scene.fog.far=inside?90:230;
    hemi.color.set(inside?venue.sky:0x5a7ab8);
    hemi.groundColor.set(inside?venue.ground:0x0c1626); hemi.intensity=inside?.85:1;
    document.getElementById('btnExit').style.display=inside?'flex':'none';
    document.getElementById('locationName').textContent=inside?venue.name:venue.street;
    if(audio.humG) audio.humG.gain.linearRampToValueAtTime(inside?.015:.05,audio.ctx.currentTime+.5);
    snapCamera();
    toast(inside?venue.welcome:`Tillbaka på ${venue.street}.`,4200);
    // Fade only once the destination camera and lighting are in place.
    requestAnimationFrame(()=>{fade.style.opacity=0;setTimeout(()=>{transitioning=false;},360);});
  },360);
}
function makeExhibit(item){
  const room=urban.rooms[item.venue],group=new THREE.Group(); group.position.set(item.x,0,item.z); room.add(group);
  box(group,1.6,.85,1.4,M.pbr('#293a3b'),0,.425,0);
  box(group,1.75,.08,1.55,M.pbr('#be995e',{metalness:.65,roughness:.42}),0,.89,0);
  // Open vitrines avoid expensive overlapping glass/transmission passes on phones.
  for(const x of [-.8,.8]) for(const z of [-.65,.65]) box(group,.045,1.3,.045,M.pbr('#be995e'),x,1.5,z);
  const mat=M.pbr(item.color,{metalness:item.kind==='lamp'?.7:.15,roughness:.32});
  let mesh;
  if(item.kind==='lamp'){
    box(group,.12,.9,.12,mat,0,1.38,0);
    mesh=new THREE.Mesh(sharedGeometry('Cylinder',.38,.52,.4,12),mat); mesh.position.y=1.98;
  } else if(item.kind==='vase'){
    mesh=new THREE.Mesh(sharedGeometry('Cylinder',.22,.38,1.0,8),mat); mesh.position.y=1.45;
  } else if(item.kind==='book'){
    mesh=box(group,.7,.1,.95,mat,0,1.12,0);mesh.rotation.z=.15;
    box(group,.63,.06,.88,M.pbr('#e6d7b7'),0,1.18,0);
  } else {
    mesh=new THREE.Mesh(sharedGeometry('Cylinder',.46,.46,.045,24),M.pbr('#15212b',{roughness:.28}));
    mesh.position.y=1.35;mesh.rotation.x=.8;
    const label=new THREE.Mesh(sharedGeometry('Cylinder',.14,.14,.05,16),mat);mesh.add(label);
  }
  if(mesh.parent!==group) group.add(mesh);
  const label=makeSign(item.title.toUpperCase(),'#172b2c','#e7cf9a',2.6); label.position.set(0,2.65,0); group.add(label);
  const gl=glowSprite(item.color,2.0,.14);gl.position.set(0,1.7,0);group.add(gl);
  urban.exhibits.push({...item,group,gl}); addBlocker(item.venue,item.x,item.z,.95);
}
function openExhibit(item){
  const collected=urban.discoveries.has(item.id);
  panel(`<div class="eyebrow">${escapeHTML(item.maker)}</div>
    <h2>${escapeHTML(item.title)}</h2>
    <div class="exhibitPreview" style="--exhibit:${item.color}"><span class="objectPreview ${item.kind}" aria-hidden="true"></span></div>
    <p class="sub">${escapeHTML(item.detail)}</p>
    <p id="exhibitResponse" class="sub" role="status">${collected?'En del av din kvällssamling.':'Kom nära. Ta en stund.'}</p>
    <div class="row"><button class="primary" id="exhibitAction">${item.action}</button><button class="ghost" id="exhibitClose">Tillbaka</button></div>`);
  panelEl.querySelector('#exhibitAction').onclick=()=>{
    urban.discoveries.add(item.id);item.gl.material.opacity=.55;
    panelEl.querySelector('#exhibitResponse').textContent=item.response;
    if(item.kind==='record'){initAudio();chime(true);}
    updateGuide();
  };
  panelEl.querySelector('#exhibitClose').onclick=closePanel;
}
function talkTo(n){
  const voice=n.voice||VOICES[0];
  const name=n.d?n.d.name:voice.name, signal=n.d?sig(n.d.signal).label:voice.signal;
  const line=voice.lines[urban.talkIndex++%voice.lines.length];
  panel(`<div class="eyebrow">Stadens röster · fiktivt samtal</div><h2>${escapeHTML(name)}</h2>
    <p class="sigline">Signal: ${escapeHTML(signal)}</p><blockquote class="chatter">${escapeHTML(line)}</blockquote>
    <div class="row"><button class="primary" id="talkNext">Berätta mer</button>
    <button class="ghost" id="talkTip">Visa mig vägen</button><button class="ghost" id="talkClose">Tack, vi ses</button></div>`);
  urban.talking=n;
  if(player) n.g.rotation.y=Math.atan2(player.group.position.x-n.g.position.x,player.group.position.z-n.g.position.z);
  panelEl.querySelector('#talkNext').onclick=()=>talkTo(n);
  panelEl.querySelector('#talkTip').onclick=()=>{urban.guide=voice.venue;closePanel();updateGuide();toast(`Följ vägvisaren till ${VENUES[voice.venue].name}.`);};
  panelEl.querySelector('#talkClose').onclick=closePanel;
}
function collectUrbanInteractions(consider){
  const area=state.inside?urban.venue:'out';
  if(!state.inside){
    for(const v of Object.values(VENUES)) consider('door_'+v.id,...v.entrance,3.6,()=>showPrompt(`${v.name} · Öppet ikväll`,[{label:'Gå in',fn:()=>doorTransition(true,v.id)}]));
    consider('fashion',5.4,110,2.8,()=>showPrompt('Ateljé Hedvig · Din färg i skyltfönstret',[
      {label:'Betrakta',fn:()=>{panel('<div class="eyebrow">Ateljé Hedvig</div><h2>Din accent, stadens ljus</h2><p class="sub">Halsduken i fönstret lånar din profils accentfärg när du kommer nära. Prova en ny färg i Signalstudion.</p><button id="fashionClose">Tillbaka</button>');panelEl.querySelector('#fashionClose').onclick=closePanel;}}]));
  } else {
    const v=VENUES[urban.venue];
    consider('exit_'+v.id,...v.exit,3.2,()=>showPrompt(`Till ${v.street}`,[{label:'Gå ut',fn:()=>doorTransition(false)}]));
    for(const item of urban.exhibits.filter(e=>e.venue===urban.venue)) consider('exhibit_'+item.id,item.x,item.z,2.8,()=>showPrompt(`${item.maker} · ${item.title}`,[{label:'Utforska',fn:()=>openExhibit(item)}]));
    if(urban.venue==='sture') consider('salon',515,204,2.8,()=>showPrompt('Salongen · Ett bord för ett samtal',[
      {label:'Ta en fikapaus',fn:()=>{panel('<div class="eyebrow">Salongen</div><h2>En minut till</h2><p class="sub">Varmt kaffe, våta rockar och ett bord som alltid har en ledig stol. Kvällens samtalsämne: vilken plats i Stockholm skulle du vilja spara i en glasburk?</p><button id="fikaClose">Tillbaka till kvällen</button>');panelEl.querySelector('#fikaClose').onclick=closePanel;}}]));
  }
  npcs.forEach((n,i)=>{
    if(n.area!==area) return;
    consider('citizen_'+i,n.g.position.x,n.g.position.z,2.6,()=>showPrompt(`${n.voice.name} · ${n.voice.signal}`,[{label:'Prata',fn:()=>talkTo(n)}]));
  });
}
function updateGuide(){
  if(!player) return;
  const p=player.group.position;
  const label=state.inside?VENUES[urban.venue].name:p.z<4?'Norrmalmstorg':p.z<162?'Biblioteksgatan':'Stureplan';
  document.getElementById('locationName').textContent=label;
  const venue=VENUES[urban.guide], target=state.inside?VENUES[urban.venue].exit:venue.entrance;
  const distance=Math.round(Math.hypot(p.x-target[0],p.z-target[1]));
  const angle=Math.atan2(target[0]-p.x,target[1]-p.z)-cam.yaw;
  const direction=Math.cos(angle)<-.5?'↶':Math.sin(angle)>.35?'←':Math.sin(angle)<-.35?'→':'↑';
  document.getElementById('guideText').textContent=`${direction} ${state.inside?'Utgång':venue.name} · ${distance} m`;
  document.getElementById('discoveries').textContent=`${urban.discoveries.size}/${EXHIBITS.length} upptäckter`;
}
function buildNod(){
  const room=new THREE.Group();room.visible=false;scene.add(room);urban.rooms.nod=room;
  box(room,24,.2,32,M.pbr('#253d3b',{roughness:.4}),800,-.12,56);
  for(const x of [788,812]) box(room,.4,6,32,M.pbr('#8fada0'),x,3,56);
  box(room,24,6,.4,M.pbr('#668c83'),800,3,72);box(room,24,6,.4,M.pbr('#668c83'),800,3,40);
  for(let z=43;z<=70;z+=6){
    box(room,24,.16,.22,M.pbr('#b89b66',{metalness:.6,roughness:.5}),800,5.8,z);
    const light=glowSprite('#d4eed4',2.4,.4);light.position.set(800,5.3,z);room.add(light);
  }
  const roof=new THREE.Mesh(sharedGeometry('Plane',24,32),M.bas('#243f50'));roof.rotation.x=Math.PI/2;roof.position.set(800,6,56);room.add(roof);
  // Inlaid wayfinding: low-cost geometry, no new texture atlases.
  for(const x of [798.4,801.6])box(room,.035,.015,27,M.pbr('#be995e',{metalness:.65,roughness:.4}),x,.015,55.5);
  for(const [x,z]of [[788.3,51],[811.7,59],[788.3,66]])box(room,.08,3.4,4.2,M.pbr('#35584f'),x,2.0,z);
  const lamp=new THREE.PointLight(0xffdca7,1.2,32,2);lamp.position.set(800,4,55);room.add(lamp);
  for(const [text,z] of [['NOD · SMÅ UPPLAGOR',69],['TILL BIBLIOTEKSGATAN',40.8]]){
    const sign=makeSign(text,'#18332f','#e6d4a7',5);sign.position.set(800,3.6,z);room.add(sign);
  }
  box(room,3.2,3.2,.08,M.bas('#7095b0'),800,1.6,40.3);
  const welcome=makeSign('ÖPPET · NOD-PASSAGEN','#18332f','#e6d4a7',3.4);welcome.position.set(-7,4,58);world.add(welcome);
  const portal=new THREE.Mesh(sharedGeometry('Plane',3,3.4),M.bas('#abcab1'));portal.rotation.y=Math.PI/2;portal.position.set(-7.3,1.7,58);world.add(portal);
  for(const v of Object.values(VENUES)){
    const marker=new THREE.Mesh(sharedGeometry('Ring',.8,1,24),M.bas('#ddbd7b',{side:THREE.DoubleSide}));
    marker.rotation.x=-Math.PI/2;marker.position.set(v.entrance[0],.035,v.entrance[1]);world.add(marker);
    const sign=makeSign('ENTRÉ · ÖPPET','#352b1e','#ffe2a8',2.8);sign.position.set(v.entrance[0],2.7,v.entrance[1]);world.add(sign);
  }
  const citizen=buildAvatar({style:'atelje',skin:1,accent:'#72b5ab'});citizen.position.set(803,0,65);room.add(citizen);
  npcs.push({g:citizen,idle:true,area:'nod',voice:VOICES[0]});
}
function markBoundaries(){
  const pole=M.pbr('#445664',{metalness:.5,roughness:.5});
  for(const z of [-35,211.8]) for(let x=-22;x<=22;x+=3){
    box(world,.15,.8,.15,pole,x,.4,z);box(world,.18,.08,.18,M.bas('#b9d3db'),x,.65,z);
  }
  for(const x of [-24.8,24.8]) for(let z=66;z<=78;z+=2){box(world,.16,.8,.16,pole,x,.4,z);}
  for(const [x,z] of [[0,-34.8],[0,211],[-24,72],[24,72]]){
    const sign=makeSign('KVÄLLENS KVARTER · VÄND HÄR','#1d2a3a','#d7c493',4);sign.position.set(x,1.6,z);world.add(sign);
  }
}
function batchStaticScene(root){
  root.updateMatrixWorld(true);
  const groups=new Map(), inverse=new THREE.Matrix4().copy(root.matrixWorld).invert();
  root.traverse(mesh=>{
    if(!mesh.isMesh||!mesh.userData.batchStatic||Array.isArray(mesh.material)) return;
    for(let p=mesh;p&&p!==root;p=p.parent) if(p.userData.dynamic) return;
    const pos=new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld);
    const key=[mesh.geometry.uuid,mesh.material.uuid,mesh.castShadow,Math.floor(pos.x/24),Math.floor(pos.z/24)].join(':');
    if(!groups.has(key)) groups.set(key,[]);groups.get(key).push(mesh);
  });
  for(const meshes of groups.values()){
    if(meshes.length<3) continue;
    const first=meshes[0],batch=new THREE.InstancedMesh(first.geometry,first.material,meshes.length);
    batch.castShadow=first.castShadow;batch.receiveShadow=true;batch.frustumCulled=false;
    const bounds=new THREE.Box3();
    first.geometry.computeBoundingBox();
    meshes.forEach((mesh,i)=>{
      batch.setMatrixAt(i,new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld));
      bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld));
    });
    meshes.forEach(mesh=>mesh.parent.remove(mesh));root.add(batch);
    batch.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    urban.batches.push({mesh:batch,bounds,center:bounds.getCenter(new THREE.Vector3())});
    urban.stats.batchedMeshes+=meshes.length;urban.stats.instanceGroups++;
  }
}
const urbanFrustum=new THREE.Frustum(), urbanMatrix=new THREE.Matrix4();
function updateUrban(t){
  updateCitizenInstances();
  if((t*5|0)!==urban.guideTick){urban.guideTick=t*5|0;updateGuide();}
  // Three r128 lacks per-instance bounds. Spatial batches use explicit world bounds.
  camera.updateMatrixWorld();urbanMatrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);urbanFrustum.setFromProjectionMatrix(urbanMatrix);
  for(const b of urban.batches) b.mesh.visible=urbanFrustum.intersectsBox(b.bounds)||(b.mesh.castShadow&&player&&!state.inside&&b.center.distanceToSquared(player.group.position)<900);
  const now=performance.now();
  if(urban.lastFrameTime){urban.frameTimes.push(now-urban.lastFrameTime);if(urban.frameTimes.length>180) urban.frameTimes.shift();}
  urban.lastFrameTime=now;
}
function initUrban(){
  urban.rooms.sture=interior;
  buildNod();
  EXHIBITS.forEach(makeExhibit);
  npcs.forEach((n,i)=>{n.area=n.area||(n.g.parent===interior?'sture':'out');n.voice=n.voice||VOICES[i%VOICES.length];});
  demoNpcs.forEach((n,i)=>{n.area=n.d.area==='in'?'sture':'out';n.voice=VOICES[i%VOICES.length];});
  addBlocker('out',0,186,1.6);
  for(const z of [166,186,206]) for(const x of [484,516]) addBlocker('sture',x,z,.65);
  for(const [x,z] of [[514,204],[519,209],[513,211]]) addBlocker('sture',x,z,1.2);
  addBlocker('sture',515.6,207.8,.7);addBlocker('sture',480,160,.9);
  markBoundaries();
  traffic.forEach(t=>t.m.userData.dynamic=true);fashion.userData.dynamic=true;
  for(const root of [world,...Object.values(urban.rooms)]) batchStaticScene(root);
  batchCitizenAvatars();
  document.querySelectorAll('[data-speed]').forEach(b=>b.onclick=()=>{if(state.playing&&!panelEl&&!transitioning)setSpeed(Number(b.dataset.speed));});
  document.getElementById('guideToggle').onclick=()=>{urban.guide=urban.guide==='sture'?'nod':'sture';updateGuide();};
  refreshSpeed();
  // Expose read-only snapshots for diagnostics, without adding UI or per-frame logging.
  window.sthlmDiagnostics=()=>({venue:urban.venue||'out',speed:speedMultiplier(),...urban.stats,
    draws:renderer.info.render.calls,triangles:renderer.info.render.triangles,
    textures:renderer.info.memory.textures,geometries:renderer.info.memory.geometries,
    averageFrameMs:urban.frameTimes.length?urban.frameTimes.reduce((a,b)=>a+b,0)/urban.frameTimes.length:null});
}

/* Keep citizen skeletons for animation/dialogue, but render their repeated parts
   with instance colours. Distant citizens retain a simple standing silhouette. */
function batchCitizenAvatars(){
  const groups=new Map();
  for(const citizen of [...npcs,...demoNpcs]){
    citizen.g.traverse(mesh=>{
      if(!mesh.isMesh||!mesh.material.isMeshStandardMaterial||mesh.material.map) return;
      const key=[citizen.area,mesh.geometry.uuid,mesh.material.roughness,mesh.material.metalness,mesh.castShadow].join(':');
      if(!groups.has(key)) groups.set(key,[]);
      groups.get(key).push({citizen,mesh});mesh.visible=false;
    });
  }
  urban.npcBatches=[];
  for(const entries of groups.values()){
    const source=entries[0], material=source.mesh.material.clone();material.color.setRGB(1,1,1);
    const mesh=new THREE.InstancedMesh(source.mesh.geometry,material,entries.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;
    mesh.castShadow=source.mesh.castShadow;mesh.receiveShadow=true;
    const area=source.citizen.area,root=area==='out'?world:urban.rooms[area];root.add(mesh);
    urban.npcBatches.push({mesh,entries,area});
  }
  urban.stats.citizenInstances=[...groups.values()].reduce((n,g)=>n+g.length,0);
  urban.stats.citizenDrawGroups=urban.npcBatches.length;
}
function updateCitizenInstances(){
  const area=state.inside?urban.venue:'out',maxDistance=state.mobile?70:95;
  for(const n of [...npcs,...demoNpcs]){
    if(n.area!==area)continue;
    n.g.updateMatrixWorld(true);
    if(n.g.userData.parts.badge)n.g.userData.parts.badge.visible=n.g.position.distanceToSquared(camera.position)<maxDistance**2;
  }
  for(const batch of urban.npcBatches){
    if(batch.area!==area)continue;
    let count=0;
    for(const {citizen,mesh} of batch.entries){
      const d=citizen.g.position.distanceToSquared(camera.position);
      if(d>maxDistance**2)continue;
      const parts=citizen.g.userData.parts;
      if(d>32**2&&![parts.head,parts.torso,parts.legL,parts.legR].includes(mesh))continue;
      batch.mesh.setMatrixAt(count,mesh.matrixWorld);batch.mesh.setColorAt(count,mesh.material.color);count++;
    }
    batch.mesh.count=count;batch.mesh.visible=count>0;
    if(count){batch.mesh.instanceMatrix.needsUpdate=true;batch.mesh.instanceColor.needsUpdate=true;}
  }
}
