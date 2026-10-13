// Repeatable rendering-work comparison. Timings from software WebGL are NOT phone FPS.
const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=http.createServer(async(req,res)=>{
  const target=req.url==='/baseline'?process.env.STHLM_BASELINE:{'/':path.join(root,'index.html'),'/config.js':path.join(root,'config.js'),'/urban.js':path.join(root,'urban.js')}[req.url];
  if(!target){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',req.url.endsWith('.js')?'application/javascript':'text/html; charset=utf-8');res.end(await fs.readFile(target));
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
 const reports=[];
 for(const variant of process.env.STHLM_BASELINE?['baseline','candidate']:['candidate']){
  const page=await browser.newPage({viewport:{width:800,height:600}});
  await page.addInitScript(()=>{let seed=1842;Math.random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(process.env.THREE_JS_FIXTURE){await page.route('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',r=>r.fulfill({path:process.env.THREE_JS_FIXTURE,contentType:'application/javascript'}));await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({body:'',contentType:'text/css'}));}
  await page.goto(`http://127.0.0.1:${server.address().port}/${variant==='baseline'?'baseline':''}`);
  await page.evaluate(()=>{state.intro=false;state.profile=defaultProfile();state.profile.name='Budget';closePanel();enterCity();player.group.position.set(0,0,30);cam.yaw=0;cam.pitch=.28;});
  const frame=await page.evaluate(()=>renderer.info.render.frame);await page.waitForFunction(f=>renderer.info.render.frame>f,frame+20);
  reports.push({variant,...await page.evaluate(()=>{
   const textures=new Set();scene.traverse(o=>{for(const m of [].concat(o.material||[]))for(const field of ['map','emissiveMap','bumpMap'])if(m[field])textures.add(m[field]);});
   const texels=[...textures].reduce((sum,t)=>sum+(t.image?.width||0)*(t.image?.height||0),0);
   return {draws:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometryAllocations:renderer.info.memory.geometries,sourceTextureTexels:texels,webglRenderer:renderer.getContext().getParameter(renderer.getContext().RENDERER)};
  }),errors});
  await page.close();
 }
 await fs.mkdir(path.join(root,'test-results'),{recursive:true});
 await fs.writeFile(path.join(root,'test-results/render-budget.json'),JSON.stringify(reports,null,2));
 console.log(JSON.stringify(reports,null,2));if(reports.some(r=>r.errors.length))process.exitCode=1;
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
