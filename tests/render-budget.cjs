// Whole-frame rendering work, including shadows. Software WebGL is not device FPS.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {harness,root}=require('./deterministic.cjs');
const LIMIT=400, WARMUP=12, SAMPLES=60;
function assertBudget(calls,label){
  assert(Number.isInteger(calls)&&calls>0,label+': missing/invalid rendering statistics');
  assert(calls<=LIMIT,label+': '+calls+' draw calls exceeds '+LIMIT);
}
(async()=>{
  const h=await harness();
  const reports=[];
  try{
    for(const profile of [
      {name:'desktop-street',position:[0,0,30],options:{viewport:{width:800,height:600}}},
      {name:'desktop-spawn',position:[0,0,-14],options:{viewport:{width:800,height:600}}},
      {name:'mobile-street',position:[0,0,30],options:{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2}}
    ]){
      const page=await h.page(profile.options);
      const result=await page.evaluate(({warmup,samples,position})=>{
        player.group.position.fromArray(position);cam.yaw=0;cam.pitch=.28;snapCamera();
        renderer.info.autoReset=false;
        const calls=[],triangles=[];
        for(let i=0;i<warmup+samples;i++){
          tick(); // The unchanged production loop includes every render pass.
          calls.push(renderer.info.render.calls);
          triangles.push(renderer.info.render.triangles);
          if(renderer.info.autoReset!==false)throw Error('Frame statistics auto-reset unexpectedly');
          if(renderer.getContext().isContextLost())throw Error('WebGL context lost');
        }
        const gl=renderer.getContext(), debug=gl.getExtension('WEBGL_debug_renderer_info');
        return {calls,triangles,geometryCount:renderer.info.memory.geometries,
          textureCount:renderer.info.memory.textures,threeRevision:THREE.REVISION,
          backend:'WebGL',renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),
          viewport:{width:innerWidth,height:innerHeight},dpr:renderer.getPixelRatio(),
          shadows:renderer.shadowMap.enabled,shadowMapSize:moon.shadow.mapSize.x,
          seed:1842,stepSeconds:1/60,position,yaw:0,pitch:.28};
      },{warmup:WARMUP,samples:SAMPLES,position:profile.position});
      reports.push({profile:profile.name,...result,peak:Math.max(...result.calls)});
      await fs.mkdir(path.join(root,'test-results'),{recursive:true});
      await page.context().close();
    }
    const report={revision:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
      dirty:!!execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim(),
      browser:h.browser.version(),limit:LIMIT,warmupFrames:WARMUP,sampleFrames:SAMPLES,
      note:'Warm-up frames are also gated. Representative street and desktop spawn views; not exhaustive coverage or device FPS.',
      reports,errors:h.errors};
    await fs.mkdir(path.join(root,'test-results'),{recursive:true});
    await fs.writeFile(path.join(root,'test-results/render-budget.json'),JSON.stringify(report,null,2));
    for(const result of reports){
      console.log(result.profile+': peak '+result.peak+' / '+LIMIT+' whole-frame draw calls ('+result.renderer+')');
      assert.equal(result.shadows,true,'Do not disable shadows to pass the budget');
      assert.equal(result.calls.length,WARMUP+SAMPLES);
      result.calls.forEach((calls,i)=>assertBudget(calls,result.profile+' frame '+i));
    }
    assert.deepEqual(h.errors,[]);
    console.log('PASS deterministic rendering budget, including shadow passes.');
  }finally{await h.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
