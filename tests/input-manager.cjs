const assert=require('node:assert/strict');
const {harness}=require('./deterministic.cjs');
async function reset(page,yaw){
  return page.evaluate(yaw=>{
    resetInput();urban.speedMode=1;
    player.group.position.set(0,0,-14);cam.yaw=yaw;snapCamera();
    camera.updateMatrixWorld(true);
    const forward=camera.getWorldDirection(new THREE.Vector3());forward.y=0;forward.normalize();
    const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0)).normalize();
    return {forward:forward.toArray(),right:right.toArray()};
  },yaw);
}
async function displacement(page){
  return page.evaluate(()=>{
    const intent={...inputManager.movement()};
    const start=player.group.position.clone();
    for(let i=0;i<4;i++)tick();
    return {delta:player.group.position.clone().sub(start).toArray(),intent};
  });
}
function check(result,basis,horizontal,forward,label){
  const dot=(a,b)=>a.reduce((sum,n,i)=>sum+n*b[i],0);
  const r=dot(result.delta,basis.right),f=dot(result.delta,basis.forward);
  assert(horizontal?r*horizontal>.05:Math.abs(r)<1e-6,label+': camera-right sign');
  assert(forward?f*forward>.05:Math.abs(f)<1e-6,label+': camera-forward sign');
  assert(Math.sign(result.intent.horizontal)===horizontal,label+': logical horizontal sign');
  assert(Math.sign(result.intent.forward)===forward,label+': logical forward sign');
}
(async()=>{
  const h=await harness();
  try{
    const page=await h.page({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
    const cdp=await page.context().newCDPSession(page);
    const touch=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{
      type,touchPoints:x===undefined?[]:[{id:1,x,y}]
    });
    for(const yaw of [0,Math.PI/2,Math.PI,3*Math.PI/2]){
      for(const [key,horizontal,forward,x,y] of [
        ['KeyA',-1,0,28,700],['KeyD',1,0,132,700],
        ['KeyW',0,1,80,648],['KeyS',0,-1,80,752]
      ]){
        const basis=await reset(page,yaw);
        await page.keyboard.down(key);
        const keyboard=await displacement(page);
        await page.keyboard.up(key);
        check(keyboard,basis,horizontal,forward,key+' yaw '+yaw);
        const touchBasis=await reset(page,yaw);
        await touch('touchStart',80,700);
        await touch('touchMove',x,y);
        // Poll in wall time: RAF is intentionally test-controlled.
        await page.waitForFunction(()=>joy.active&&Math.hypot(joy.dx,joy.dy)>.9,null,{polling:10});
        const joystick=await displacement(page);
        check(joystick,touchBasis,horizontal,forward,'touch '+key+' yaw '+yaw);
        keyboard.delta.forEach((n,i)=>assert(Math.abs(n-joystick.delta[i])<1e-6,'Keyboard/touch displacement equivalence'));
        await touch('touchEnd');
        await page.waitForFunction(()=>!joy.active,null,{polling:10});
      }
    }
    await reset(page,0);
    await page.keyboard.down('KeyA');await page.keyboard.down('KeyD');
    assert.equal(await page.evaluate(()=>inputManager.movement().horizontal),0,'Opposing keys cancel');
    await page.evaluate(()=>dispatchEvent(new Event('blur')));
    assert.deepEqual(await page.evaluate(()=>({...inputManager.movement()})),{horizontal:0,forward:0});
    await page.keyboard.up('KeyA');await page.keyboard.up('KeyD');
    await reset(page,0);
    await page.keyboard.down('KeyW');
    const straight=await displacement(page);await page.keyboard.up('KeyW');
    await reset(page,0);
    await page.keyboard.down('KeyW');await page.keyboard.down('KeyD');
    const diagonal=await displacement(page);
    assert(Math.abs(Math.hypot(...straight.delta)-Math.hypot(...diagonal.delta))<1e-6,'Diagonal speed stays bounded');
    await page.keyboard.up('KeyW');await page.keyboard.up('KeyD');
    await reset(page,0);
    await touch('touchStart',80,700);await touch('touchMove',132,700);
    await page.waitForFunction(()=>joy.dx>.9,null,{polling:10});
    await touch('touchCancel');
    await page.waitForFunction(()=>!joy.active,null,{polling:10});
    assert.deepEqual(await page.evaluate(()=>({...inputManager.movement()})),{horizontal:0,forward:0});
    assert.deepEqual(h.errors,[]);
    console.log('PASS InputManager: keyboard/touch equivalence at four actual camera headings, opposing keys, diagonal speed, blur and touch cancellation.');
  }finally{await h.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
