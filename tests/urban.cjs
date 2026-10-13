const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer(async(req,res)=>{
  const files={'/':'index.html','/input-manager.js':'input-manager.js', '/vendor/three.min.js':'vendor/three.min.js', '/config.js':'config.js','/urban.js':'urban.js'};
  if(!files[req.url]){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',req.url.endsWith('.js')?'application/javascript':'text/html; charset=utf-8');
  res.end(await fs.readFile(path.join(root,files[req.url])));
});
let browser;
const errors=[];
async function frames(page,n=3){const f=await page.evaluate(()=>renderer.info.render.frame);await page.waitForFunction(f=>renderer.info.render.frame>=f,f+n);}
async function openPage(mobile){
  const context=await browser.newContext(mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2}:{viewport:{width:1000,height:700}});
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
  p.on('console',m=>{if(m.type()==='error'&&/WebGL|THREE|shader/i.test(m.text()))errors.push(m.text());});
  await p.route('https://fonts.googleapis.com/**',r=>r.fulfill({body:'',contentType:'text/css'}));
  await p.goto(`http://127.0.0.1:${server.address().port}/`);
  await p.locator('#skipBtn').click();await p.locator('#devUsername').fill('Kvällsvandrare');await p.locator('#devUsername').press('Enter');
  await p.waitForFunction(()=>state.playing);await frames(p);
  return p;
}
async function interactAt(p,x,z,id,mobile){
  await p.evaluate(({x,z})=>{resetInput();player.group.position.set(x,0,z);snapCamera();promptKey=null;updateInteractions(player.group.position);},{x,z});
  assert.equal(await p.evaluate(()=>promptKey),id);
  if(mobile)await p.locator('#promptBtns button').first().tap();else await p.keyboard.press('KeyE');
}
async function tour(p,mobile){
  for(const id of ['nod','sture']){
    const venue=await p.evaluate(id=>VENUES[id],id);
    await interactAt(p,...venue.entrance,'door_'+id,mobile);
    // Door fade locks movement and clears held keys.
    assert(await p.evaluate(()=>transitioning));
    await p.waitForFunction(id=>urban.venue===id&&!transitioning,id);
    assert(await p.evaluate(id=>state.inside&&player.group.parent===urban.rooms[id]&&urban.rooms[id].visible&&!world.visible,id));
    const fog=await p.evaluate(()=>scene.fog.color.getHex());assert.equal(fog,venue.fog);
    const items=await p.evaluate(id=>EXHIBITS.filter(e=>e.venue===id),id);
    for(const item of items){
      await interactAt(p,item.x,item.z-2,'exhibit_'+item.id,mobile);
      assert.equal(await p.locator('#uiRoot h2').textContent(),item.title);
      if(mobile)await p.locator('#exhibitAction').tap();else await p.locator('#exhibitAction').click();
      assert.equal(await p.locator('#exhibitResponse').textContent(),item.response);
      await p.locator('#exhibitClose').click();
    }
    const npc=await p.evaluate(()=>{const n=npcs.find(n=>n.area===urban.venue);return {i:npcs.indexOf(n),x:n.g.position.x,z:n.g.position.z};});
    await interactAt(p,npc.x,npc.z-1,'citizen_'+npc.i,mobile);
    assert(await p.locator('.chatter').isVisible());
    const line=await p.locator('.chatter').textContent();await p.locator('#talkNext').click();
    assert.notEqual(await p.locator('.chatter').textContent(),line);
    const before=await p.evaluate(()=>urban.talking.g.position.toArray());await frames(p,4);
    assert.deepEqual(await p.evaluate(()=>urban.talking.g.position.toArray()),before);
    await p.locator('#talkClose').click();
    if(id==='sture'){
      // Gallery panels must face the visitor and use a non-black texture multiplier.
      assert(await p.evaluate(()=>artFrames.every(f=>{const panel=f.group.children.find(o=>o.isMesh&&o.geometry.type==='PlaneGeometry');return panel.material.color.getHex()===0xffffff&&panel.rotation.y===Math.PI;})));
      await interactAt(p,500,214,'art_memory',mobile);
      assert(await p.locator('#uiRoot h2').isVisible());await p.locator('#acClose').click();
    }
    await p.evaluate(()=>{const v=VENUES[urban.venue];player.group.position.set(v.spawn[0],0,v.spawn[1]+4);cam.yaw=0;snapCamera();});
    await frames(p,4);
    await p.screenshot({path:path.join(root,`test-results/${mobile?'mobile':'desktop'}-${id}.png`)});
    console.log(mobile?'Mobile room:':'Desktop room:',id,await p.evaluate(()=>sthlmDiagnostics()));
    await interactAt(p,...venue.exit,'exit_'+id,mobile);
    await p.waitForFunction(()=>!state.inside&&!transitioning);
    assert(await p.evaluate(([x,z])=>Math.abs(player.group.position.x-x)<.01&&Math.abs(player.group.position.z-z)<.01,venue.returnTo));
    assert.equal(await p.evaluate(()=>scene.fog.color.getHex()),0x14274a);
  }
  assert.equal(await p.evaluate(()=>urban.discoveries.size),5);
}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  browser=await chromium.launch({...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  await fs.mkdir(path.join(root,'test-results'),{recursive:true});
  const p=await openPage(false);
  // Flood-fill the actual collision map: destinations must be reachable, not just inside rectangles.
  const navigation=await p.evaluate(()=>{
    function route(area,start,target,radius=2.2){
      const queue=[[Math.round(start[0]),Math.round(start[1])]],seen=new Set();
      for(let head=0;head<queue.length;head++){
        const [x,z]=queue[head],key=x+':'+z;if(seen.has(key))continue;seen.add(key);
        if(!isNavigable(x,z,area))continue;
        if(Math.hypot(x-target[0],z-target[1])<radius)return true;
        for(const [dx,dz]of[[1,0],[-1,0],[0,1],[0,-1]]){
          if(isNavigable(x+dx/2,z+dz/2,area)&&isNavigable(x+dx,z+dz,area)&&!seen.has((x+dx)+':'+(z+dz)))queue.push([x+dx,z+dz]);
        }
      }return false;
    }
    const checks=[];
    for(const v of Object.values(VENUES)){
      checks.push([v.id+' entrance',route('out',[0,-14],v.entrance)]);
      checks.push([v.id+' exit',route(v.id,v.spawn,v.exit)]);
      for(const e of EXHIBITS.filter(e=>e.venue===v.id)) checks.push([e.id,route(v.id,v.spawn,[e.x,e.z])]);
    }
    checks.push(['art gallery',route('sture',VENUES.sture.spawn,[500,214])],['studio',route('sture',VENUES.sture.spawn,[480,160])]);
    return checks;
  });
  for(const [name,reachable] of navigation) assert(reachable,'Unreachable: '+name);
  assert(await p.evaluate(()=>!isNavigable(0,186,'out')&&!isNavigable(516,186,'sture')&&!isNavigable(-20,64.5,'out')));
  // Swept collision: even a long step cannot pass through Svampen.
  assert(await p.evaluate(()=>{player.group.position.set(0,0,182);movePlayer(0,8);return player.group.position.z<184.2;}));
  await p.evaluate(()=>{player.group.position.set(0,0,-14);cam.yaw=0;urban.speedMode=1;resetInput();});
  await p.keyboard.down('KeyW');await frames(p);assert.equal(await p.evaluate(()=>player.speed),3.1);
  await p.keyboard.down('ShiftLeft');await frames(p);assert.equal(await p.evaluate(()=>player.speed),6.2);
  await p.keyboard.up('ShiftLeft');await p.keyboard.up('KeyW');
  await p.keyboard.press('Digit3');await p.keyboard.down('KeyW');await frames(p);assert.equal(await p.evaluate(()=>player.speed),12.4);
  await p.keyboard.up('KeyW');await p.keyboard.press('Digit3');assert.equal(await p.evaluate(()=>speedMultiplier()),1);
  assert(await p.evaluate(()=>{resetInput();for(const type of ['keydown','keyup','keydown'])dispatchEvent(new KeyboardEvent(type,{code:'KeyW'}));const sprint=speedMultiplier()===2;dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW'}));return sprint&&speedMultiplier()===1;}));
  await p.locator('[data-speed="2"]').click();assert.equal(await p.evaluate(()=>speedMultiplier()),2);
  await p.locator('[data-speed="1"]').click();
  await tour(p,false);
  const stats=await p.evaluate(()=>({diag:sthlmDiagnostics(),maxFacade:Math.max(...Array.from(new Set([...world.children].filter(o=>o.isMesh&&Array.isArray(o.material)).flatMap(o=>o.material).filter(m=>m.map).map(m=>m.map.image.width))))}));
  assert(stats.diag.batchedMeshes>80);assert(stats.maxFacade<=512);
  console.log('PASS urban desktop:',{navigation,stats});
  await p.context().close();
  const mobile=await openPage(true);
  await mobile.locator('[data-speed="4"]').tap();assert.equal(await mobile.evaluate(()=>speedMultiplier()),4);
  const cdp=await mobile.context().newCDPSession(mobile);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:80,y:700}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:80,y:645}]});
  await frames(mobile,4);assert.equal(await mobile.evaluate(()=>player.speed),12.4);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await mobile.locator('[data-speed="4"]').tap();assert.equal(await mobile.evaluate(()=>speedMultiplier()),1);
  await tour(mobile,true);await mobile.context().close();
  assert.deepEqual(errors,[]);
  console.log('PASS urban mobile: speed HUD, both entrances and exits, all five exhibits, conversations, gallery, no runtime/shader errors.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();server.close();});
