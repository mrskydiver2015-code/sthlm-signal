const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const THREE=require('three');
const context=vm.createContext({THREE});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../urban.js'),'utf8')+'\nglobalThis.compact=compactMaterialGroups;',context);
const side=new THREE.MeshStandardMaterial(),roof=new THREE.MeshStandardMaterial(),front=new THREE.MeshStandardMaterial();
const mesh=new THREE.Mesh(new THREE.BoxGeometry(12,20,15),[front,side,roof,side,side,side]);
const original=mesh.geometry;
function triangles(mesh){
  const g=mesh.geometry,result=[];
  for(const group of g.groups)for(let i=group.start;i<group.start+group.count;i+=3)
    result.push(mesh.material[group.materialIndex].uuid+':'+[0,1,2].map(n=>g.index.getX(i+n)).join(','));
  return result.sort();
}
const before=triangles(mesh);
let disposed=false;original.addEventListener('dispose',()=>disposed=true);
context.compact(mesh);
assert.equal(mesh.geometry.groups.length,3,'Six box faces should use three material submissions');
assert.deepEqual(triangles(mesh),before,'Every triangle keeps its winding and exact material');
for(const attribute of ['position','normal','uv'])
  assert.deepEqual(mesh.geometry.attributes[attribute].array,original.attributes[attribute].array,attribute+' preserved');
assert(disposed,'Release the replaced, exclusively owned building geometry');
const compact=mesh.geometry;
context.compact(mesh);
assert.equal(mesh.geometry,compact,'Compaction is idempotent');
mesh.geometry.dispose();side.dispose();roof.dispose();front.dispose();
console.log('PASS material-group compaction: triangle/material mapping, geometry attributes and ownership.');
