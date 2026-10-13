const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
async function harness(){
  assert.deepEqual(await fs.readFile(path.join(root,'vendor/three.min.js')),
    await fs.readFile(path.join(root,'node_modules/three/build/three.min.js')),
    'Vendored Three.js must match the locked package');
  const files={'/':'index.html','/config.js':'config.js','/urban.js':'urban.js',
    '/input-manager.js':'input-manager.js','/vendor/three.min.js':'vendor/three.min.js'};
  const server=http.createServer(async(req,res)=>{
    const file=files[req.url];
    if(!file){res.writeHead(404);res.end();return;}
    try{
      res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':'text/html; charset=utf-8');
      res.end(await fs.readFile(path.join(root,file)));
    }catch(error){res.writeHead(500);res.end(error.message);}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try{
    browser=await chromium.launch({
      ...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{}),
      args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']
    });
  }catch(error){server.close();throw error;}
  const origin='http://127.0.0.1:'+server.address().port;
  const errors=[];
  return {
    browser,errors,
    async page(options={}){
      const context=await browser.newContext({viewport:{width:800,height:600},deviceScaleFactor:1,...options});
      const page=await context.newPage();
      page.on('pageerror',error=>errors.push(error.message));
      page.on('console',message=>{
        if(message.type()==='error'&&/THREE|WebGL|shader/i.test(message.text()))errors.push(message.text());
      });
      await page.route('**/*',route=>{
        const request=route.request();
        if(request.url().startsWith(origin+'/'))return route.continue();
        if(['script','worker'].includes(request.resourceType()))errors.push('External runtime code: '+request.url());
        // Optional web typography is intentionally excluded from deterministic tests.
        return route.fulfill({body:'',contentType:'text/plain'});
      });
      await page.addInitScript(()=>{
        let seed=1842;
        Math.random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
        // Own scheduling, not rendering: each test step calls the real production tick.
        window.requestAnimationFrame=()=>0;
      });
      await page.goto(origin);
      await page.evaluate(()=>{
        clock.elapsedTime=0;
        clock.getDelta=()=>{clock.elapsedTime+=1/60;return 1/60;};
        state.intro=false;state.profile=defaultProfile();state.profile.name='Regression';
        closePanel();enterCity();resetInput();
        document.getElementById('intro').style.display='none';
      });
      return page;
    },
    async close(){await browser.close();await new Promise(resolve=>server.close(resolve));}
  };
}
module.exports={harness,root};
