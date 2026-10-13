const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
fs.mkdirSync(path.join(root,'vendor'),{recursive:true});
fs.copyFileSync(path.join(root,'node_modules/three/build/three.min.js'),path.join(root,'vendor/three.min.js'));
fs.copyFileSync(path.join(root,'node_modules/three/LICENSE'),path.join(root,'vendor/three.LICENSE'));
