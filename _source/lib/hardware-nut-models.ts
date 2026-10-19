import * as THREE from 'three';
import type { Product } from './types';
import type { HardwareKind } from './hardware-types';
import { readDimension, readNominalDiameter } from './hardware-dimension-models';

interface NutOptions { product?: Partial<Product>; material: THREE.Material; darkMaterial: THREE.Material; radial: number; detail: number }
function polygon(r: number, sides = 64) {
  const shape = new THREE.Shape();
  for (let i=0;i<=sides;i++) { const a=i/sides*Math.PI*2; i ? shape.lineTo(r*Math.cos(a),r*Math.sin(a)) : shape.moveTo(r,0); }
  return shape;
}
function bore(radius: number, x=0, z=0, sides=48) {
  const path=new THREE.Path();
  for(let i=sides;i>=0;i--) { const a=i/sides*Math.PI*2; i===sides ? path.moveTo(x+radius*Math.cos(a),z+radius*Math.sin(a)) : path.lineTo(x+radius*Math.cos(a),z+radius*Math.sin(a)); }
  return path;
}
function rectangle(w:number,l:number,r=0) {
  const s=new THREE.Shape(),x=w/2,z=l/2, c=Math.min(r,x,z);
  s.moveTo(-x+c,-z);s.lineTo(x-c,-z);s.quadraticCurveTo(x,-z,x,-z+c);s.lineTo(x,z-c);s.quadraticCurveTo(x,z,x-c,z);s.lineTo(-x+c,z);s.quadraticCurveTo(-x,z,-x,z-c);s.lineTo(-x,-z+c);s.quadraticCurveTo(-x,-z,-x+c,-z);return s;
}
function plate(shape:THREE.Shape,t:number,y:number,material:THREE.Material,bevel=0) {
  const g=new THREE.ExtrudeGeometry(shape,{depth:t,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:2,curveSegments:32});
  g.rotateX(Math.PI/2);const m=new THREE.Mesh(g,material);m.position.y=y+t/2;return m;
}
function ring(outer:number,inner:number,t:number,y:number,material:THREE.Material,sides=64,bevel=0) {
  // Extrusion bevels grow the supplied contour; inset it first so catalog width
  // and thickness remain the outside dimensions of the completed nut.
  const b=Math.min(bevel,t*.2,(outer-inner)*.2),s=polygon(outer-b/Math.cos(Math.PI/sides),sides);
  s.holes.push(bore(inner+b));return plate(s,t-2*b,y,material,b);
}
function block(w:number,h:number,l:number,x:number,y:number,z:number,material:THREE.Material) {
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,l),material);m.position.set(x,y,z);return m;
}
function internalThread(radius:number,height:number,pitch:number,material:THREE.Material,detail:number,left=false) {
  const points:number[]=[],indices:number[]=[],depth=Math.min(pitch*.38,radius*.12),turns=height/pitch;
  const n=Math.max(16,Math.ceil(turns*Math.min(detail,32)));
  for(let i=0;i<=n;i++) {
    const f=i/n,a=f*turns*Math.PI*2*(left?-1:1), y=-height/2+f*height;
    const taper=Math.min(1,f*20,(1-f)*20);
    for(const [r,h] of [[radius,y-pitch*.35],[radius-depth*taper,y],[radius,y+pitch*.35]]) points.push(Math.cos(a)*r,h,Math.sin(a)*r);
    if(i<n)for(let j=0;j<2;j++){const a0=i*3+j,b=a0+3;left?indices.push(a0,a0+1,b,b,a0+1,b+1):indices.push(a0,b,a0+1,b,b+1,a0+1);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.setIndex(indices);g.computeVertexNormals();return new THREE.Mesh(g,material);
}
function arcSheet(width:number,radius:number,thickness:number,z:number,material:THREE.Material) {
  const p:number[]=[],idx:number[]=[],steps=28;
  for(let i=0;i<=steps;i++)for(const [x,r] of [[-width/2,radius-thickness/2],[width/2,radius-thickness/2],[width/2,radius+thickness/2],[-width/2,radius+thickness/2]]) {
    const a=i/steps*Math.PI;p.push(x,Math.cos(a)*r,z-Math.sin(a)*r);
  }
  for(let i=0;i<steps;i++)for(let e=0;e<4;e++){const a=i*4+e,b=i*4+(e+1)%4,c=a+4,d=b+4;idx.push(a,c,b,b,c,d);}
  idx.push(0,1,2,0,2,3,steps*4,steps*4+2,steps*4+1,steps*4,steps*4+3,steps*4+2);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();return new THREE.Mesh(g,material);
}
function serrations(outer:number,inner:number,count:number,top:number,thickness:number,material:THREE.Material) {
  const s=new THREE.Shape();for(let i=0;i<count*4;i++){const a=i/(count*4)*Math.PI*2,r=i%4<2?outer:outer*.94;i?s.lineTo(r*Math.cos(a),r*Math.sin(a)):s.moveTo(r,0);}s.closePath();s.holes.push(bore(inner));return plate(s,thickness,top,material);
}

/** SKU dimensions drive proportions where the catalog specifies them. Stamped details are photo-based. */
export function createNutHardware(kind: HardwareKind, options:NutOptions):THREE.Group {
  const {product={},material,darkMaterial,radial,detail}=options,group=new THREE.Group();
  const name=`${product.name??''} ${product.subcategory??''}`.toLowerCase(),spec=product.specs??{};
  const units=/^m\d/i.test(spec.Size??'')?'mm':'in';
  const dim=(...keys:string[])=>{for(const key of keys){const n=readDimension(spec[key],units);if(n!==null&&n>0)return n;}return null;};
  const nominal=readNominalDiameter(product)??6.35,scale=1/nominal;
  const width=(dim('Width Across Flats')??nominal*(/heavy|structural/.test(name)?1.7:1.5))*scale;
  const thickness=(dim('Thickness','thickness')??nominal*(/jam|panel|thin style|double serrated/.test(name)?.42:.85))*scale;
  const holeR=.5,add=(...parts:THREE.Object3D[])=>group.add(...parts);
  const threadSpec=(spec['Thread Pitch']??spec.Size??'').match(/[-x]\s*([.\d]+)\s*$/i);
  const pitch=threadSpec?(units==='mm'?Number(threadSpec[1]):25.4/Number(threadSpec[1]))*scale:.16;
  const safePitch=Math.max(.045,Math.min(.3,pitch));
  const threaded=(height:number,y=0,r=holeR)=>{const m=internalThread(r,height,safePitch,material,detail,/left.hand/.test(name));m.position.y=y;add(m);};
  group.userData.dimensionSource={diameter:readNominalDiameter(product)?'catalog':'family-proportion',width:dim('Width Across Flats')?'catalog':'family-proportion',thickness:dim('Thickness','thickness')?'catalog':'family-proportion'};
  if(kind==='spring-clip-nut') {
    // C8102-832-4: supplier drawing L .520, W .500, D .234, T .017 inch.
    // Other U-type inventory uses its own supplied dimensions when present.
    const reference=/C8102-832-4/i.test(product.name??'')||product.id==='215183';
    const s=5.5,L=(dim('Clip Length')??(reference?.52: .65)*25.4)/25.4*s,W=(dim('Clip Width')??(reference?.5:.5)*25.4)/25.4*s;
    const T=(dim('Material Thickness')??(reference?.017:.022)*25.4)/25.4*s;
    const D=(dim('Hole Center to Edge')??(reference?.234:.3)*25.4)/25.4*s;
    const gap=(reference?.0325:.04)*s,r=(gap+T)/2,zc=-L/2+r+T/2,holeZ=L/2-D;
    const screwRadius=nominal/25.4*s/2,opening=screwRadius*1.07,lip=L*.14;
    const lower=rectangle(W,L-r-T/2,.05);lower.holes.push(bore(opening,0,holeZ-(r+T/2)/2));
    const bottom=plate(lower,T,-r,material);bottom.position.z=(r+T/2)/2;add(bottom);
    const upper=rectangle(W,L-r-T/2-lip,.05),upperZ=(r+T/2-lip)/2;
    const slot=new THREE.Path();slot.moveTo(-opening*.86,holeZ-upperZ-opening*1.8);slot.lineTo(-opening*.86,holeZ-upperZ+opening*1.8);slot.lineTo(opening*.86,holeZ-upperZ+opening*1.8);slot.lineTo(opening*.86,holeZ-upperZ-opening*1.8);slot.closePath();upper.holes.push(slot);
    const top=plate(upper,T,r,material);top.position.z=upperZ;add(top,arcSheet(W*.75,r,T,zc,material));
    // Opposing formed spring tongues bite the screw. There is no captive hex nut.
    for(const sign of [-1,1]) {
      const tongue=new THREE.Shape();const a=opening*1.8,b=opening*.69;
      tongue.moveTo(-opening*.82,sign*a);tongue.lineTo(opening*.82,sign*a);tongue.lineTo(opening*.62,sign*b);tongue.quadraticCurveTo(0,sign*opening*.92,-opening*.62,sign*b);tongue.closePath();
      const t=plate(tongue,T*.8,r+T*.28,material);t.rotation.x=-sign*.23;t.position.z=holeZ;t.position.y+=opening*.16;add(t);
    }
    const entry=block(W,T,lip,0,r+lip*.12,L/2-lip/2,material);entry.rotation.x=-.24;add(entry);
    group.userData.dimensionSource={length:reference?'supplier-drawing':'catalog',width:reference?'supplier-drawing':'catalog',sheetThickness:reference?'supplier-drawing':'catalog',holeCenter:reference?'supplier-drawing':'catalog'};
    group.userData.construction='folded U-type spring steel with two formed thread-engaging tongues';
    group.userData.nominalInches=reference?{length:.52,width:.5,holeCenterToEdge:.234,materialThickness:.017}:undefined;
  } else if(kind==='cage-nut'||kind==='clip-nut') {
    const square=ring(.92,holeR,.62,.06,material,4,.025);square.rotation.y=Math.PI/4;add(square);threaded(.55,.06);
    const lower=rectangle(1.64,1.72,.07);lower.holes.push(bore(.56));add(plate(lower,.065,-.32,material));
    if(kind==='cage-nut') {
      for(const sign of [-1,1]) {
        add(block(.065,.63,1.64,sign*.83,-.015,0,material));
        const hook=block(.29,.065,1.64,sign*.72,.32,0,material);add(hook);
        for(const edge of [-1,1]) {const ear=block(.24,.48,.34,sign*.72,.49,edge*.61,material);ear.rotation.z=-sign*.24;add(ear);}
      }
      for(const sign of [-1,1])add(block(1.25,.28,.065,0,-.19,sign*.84,material));
    } else {
      add(arcSheet(1.64,.35,.065,-.68,material));
      const top=rectangle(1.64,1.6,.035);top.holes.push(bore(.56));add(plate(top,.065,.38,material));
      for(const sign of [-1,1])add(block(.065,.46,.55,sign*.79,-.06,0,material));
      const lip=block(1.64,.065,.32,0,.43,.79,material);lip.rotation.x=-.3;add(lip);
    }
  } else if(kind==='rivet-nut') {
    // Thin-walled circular insert, small mounting flange, axial knurling, inner female thread.
    const outer=.7,bodyLength=1.95,flange=.81;
    add(ring(outer,holeR,bodyLength,0,material,radial,.018),ring(flange,holeR,.11,-bodyLength/2,material,radial,.012));
    threaded(bodyLength*.48,.43);
    for(let i=0;i<36;i++){const a=i/36*Math.PI*2;const rib=block(.025,bodyLength*.7,.025,Math.cos(a)*outer,-.11,Math.sin(a)*outer,material);rib.rotation.y=-a;add(rib);}
  } else if(kind==='tee-nut') {
    const length=(dim('Length')??nominal*1.6)*scale,flangeR=1.25;
    add(ring(.68,holeR,length,length/2,material,radial,.014),ring(flangeR,holeR,.12,0,material,radial,.012));threaded(length-.06,length/2);
    for(let i=0;i<4;i++){const a=i*Math.PI/2;const p=new THREE.Shape();p.moveTo(-.18,0);p.lineTo(.18,0);p.lineTo(.06,.75);p.lineTo(-.06,.75);p.closePath();const tooth=new THREE.Mesh(new THREE.ExtrudeGeometry(p,{depth:.06,bevelEnabled:false}),material);tooth.position.set(Math.cos(a)*1.04,.04,Math.sin(a)*1.04);tooth.rotation.y=-a;add(tooth);}
  } else if(kind==='clinch-nut') {
    add(ring(.92,holeR,.48,-.12,material,radial,.025),ring(.65,holeR,.18,.25,material,radial,.01),serrations(.83,holeR,28,.16,.09,material));threaded(.64);
  } else if(kind==='conduit-nut') {
    const shape=new THREE.Shape(),count=8;
    for(let i=0;i<count*6;i++){const a=i/(count*6)*Math.PI*2,r=i%6<3?1.15:1; i?shape.lineTo(Math.cos(a)*r,Math.sin(a)*r):shape.moveTo(r,0);}shape.closePath();shape.holes.push(bore(.81));add(plate(shape,.19,0,material,.015));threaded(.16,0,.81);
  } else if(kind==='weld-nut') {
    const plateShape=rectangle(2.65,1.18,.24);plateShape.holes.push(bore(holeR));add(plate(plateShape,.2,0,material,.025),ring(.64,holeR,.12,.15,material));threaded(.29,.06);
    for(const sign of [-1,1]){const p=new THREE.Mesh(new THREE.SphereGeometry(.16,16,8,0,Math.PI*2,0,Math.PI/2),material);p.position.set(sign*.95,.1,0);add(p);}
  } else {
    const sides=/square/.test(name)?4:6, radius=width/(2*Math.cos(Math.PI/sides));
    const isCoupling=kind==='coupling-nut', isWing=kind==='wing-nut', isCap=kind==='acorn-nut';
    const h=isCoupling?(dim('Length')??nominal*2.5)*scale:thickness;
    const outer=isWing?Math.max(.72,radius*.84):radius;
    const body=ring(outer,holeR,h,0,material,isWing?radial:sides,Math.min(.06,h*.07,(outer-holeR)*.2));
    if(sides===4)body.rotation.y=Math.PI/4;add(body);threaded(h*.88);
    if(isCap) {
      const low=/low crown/.test(name),r=Math.max(holeR+.12,width*.38),domeHeight=r*(low?.9:1.25);
      const pts:[[number,number],...[number,number][]]=[[r,h/2-.025]];
      for(let i=0;i<=24;i++){const a=i/24*Math.PI/2;pts.push([r*Math.cos(a),h/2+domeHeight*Math.sin(a)]);}pts.push([0,h/2-.025]);
      add(new THREE.Mesh(new THREE.LatheGeometry(pts.map(p=>new THREE.Vector2(...p)),radial),material));
    }
    if(isWing)for(const sign of [-1,1]){
      const s=new THREE.Shape();s.moveTo(sign*.58,-.1);s.lineTo(sign*1.55,.44);s.quadraticCurveTo(sign*1.8,1.02,sign*1.42,1.04);s.quadraticCurveTo(sign*.98,1.03,sign*.7,.45);s.closePath();const m=new THREE.Mesh(new THREE.ExtrudeGeometry(s,{depth:.15,bevelEnabled:true,bevelThickness:.04,bevelSize:.04,bevelSegments:2}),material);m.position.z=-.075;add(m);
    }
    if(/flange|keps/.test(name)) {
      const flangeR=radius*1.2,fy=-h/2-.04;
      add(/keps/.test(name)?serrations(flangeR,holeR,12,fy,.1,material):ring(flangeR,holeR,.13,fy,material,radial,.015));
    }
    if(/nylon insert/.test(name)) {
      add(ring(width*.48,holeR,h*.36,h*.53,material,radial,.015));
      const nylon=new THREE.MeshStandardMaterial({color:'#b9bcb2',roughness:.73,metalness:0});add(ring(width*.44,holeR*.96,.09,h*.73,nylon));
    }
    if(/flex lock|castle|slotted hex/.test(name)) {
      const count=/flex/.test(name)?6:6,inner=holeR,outer=/slotted hex/.test(name)?radius:Math.max(width*.42,inner+.13),rise=/flex/.test(name)?h*.36:h*.58;
      for(let i=0;i<count;i++) {
        const s=new THREE.Shape(),a0=i/count*Math.PI*2+.10,a1=(i+1)/count*Math.PI*2-.10;
        for(let j=0;j<=9;j++){const a=a0+(a1-a0)*j/9;j?s.lineTo(outer*Math.cos(a),outer*Math.sin(a)):s.moveTo(outer*Math.cos(a),outer*Math.sin(a));}
        for(let j=9;j>=0;j--){const a=a0+(a1-a0)*j/9;s.lineTo(inner*Math.cos(a),inner*Math.sin(a));}s.closePath();add(plate(s,rise,h/2+rise/2,material,.006));
      }
    }
    if(/double serrated/.test(name))for(const sign of [-1,1])add(serrations(radius*.96,holeR,24,sign*(h/2+.012),.025,material));
    if(/stover/.test(name)) add(ring(width*.43,holeR,.17,h/2+.06,material,radial,.02));
  }
  group.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});
  return group;
}
