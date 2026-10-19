import * as THREE from 'three';
import type { HardwareKind, HardwareOptions } from './hardware-types';
import { createDimensionHardware } from './hardware-dimension-models';
import { createNutHardware } from './hardware-nut-models';
export type { HardwareKind, HardwareOptions } from './hardware-types';
export { classifyHardware, hardwareModelAvailability } from './hardware-types';

function metal(finish = '') {
  const plastic = /nylon|plastic|polyethylene|ptfe|acetal|delrin/i.test(finish);
  const dark = /black|oxide|phosphate/i.test(finish);
  const gold = /brass|yellow|gold/i.test(finish);
  const bronze = /bronze|copper/i.test(finish);
  const blue = /blue|perma.seal/i.test(finish);
  return new THREE.MeshPhysicalMaterial({
    color: blue ? '#346f9d' : dark ? '#353a3d' : plastic ? '#e5e3d9' : gold ? '#c0a16a' : bronze ? '#a47859' : '#c8ced3',
    metalness: plastic ? 0 : dark ? 0.78 : 1,
    roughness: plastic ? 0.48 : dark ? 0.36 : 0.26,
    clearcoat: 0.14,
    clearcoatRoughness: 0.32,
    envMapIntensity: dark ? 1.5 : 1.15,
  });
}
function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, y = 0) {
  const value = new THREE.Mesh(geometry, material);
  value.position.y = y;
  value.castShadow = true;
  value.receiveShadow = true;
  return value;
}
function lathe(points: [number, number][], material: THREE.Material, segments: number) {
  return mesh(new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segments), material);
}
function roundShape(radius: number, segments = 64) {
  const shape = new THREE.Shape();
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    if (!i) shape.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    else shape.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  return shape;
}
function hole(radius: number, sides = 64) {
  const path = new THREE.Path();
  for (let i = sides; i >= 0; i--) {
    const angle = (i / sides) * Math.PI * 2;
    if (i === sides) path.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    else path.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  return path;
}
function crossHole(radius: number) {
  const path = new THREE.Path();
  const arm = radius * .28;
  const coords = [[-arm,-radius],[-arm,-arm],[-radius,-arm],[-radius,arm],[-arm,arm],[-arm,radius],[arm,radius],[arm,arm],[radius,arm],[radius,-arm],[arm,-arm],[arm,-radius]];
  coords.forEach(([x,y], i) => i ? path.lineTo(x,y) : path.moveTo(x,y));
  path.closePath();
  return path;
}
function extruded(shape: THREE.Shape, depth: number, material: THREE.Material, top: number, bevel = .015) {
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, steps: 1, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 48 });
  geometry.rotateX(Math.PI / 2);
  return mesh(geometry, material, top);
}

function wire(points: [number, number, number][], radius: number, material: THREE.Material, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)), closed, 'centripetal');
  return mesh(new THREE.TubeGeometry(curve, Math.max(32, points.length * 8), radius, 10, closed), material);
}
function ring(outer: number, inner: number, depth: number, top: number, material: THREE.Material, sides = 64) {
  const shape = roundShape(outer, sides);
  shape.holes.push(hole(inner, 48));
  return extruded(shape, depth, material, top, Math.min(.02, depth / 6));
}
function box(width: number, height: number, depth: number, material: THREE.Material, x = 0, y = 0, z = 0) {
  const part = mesh(new THREE.BoxGeometry(width, height, depth), material, y);
  part.position.x = x; part.position.z = z;
  return part;
}

/** Drive recesses remain open geometry rather than painted-on dark marks. */
function driveRecess(radius: number, description: string) {
  if (/six.lobe|6.lobe|torx/i.test(description)) {
    const path = new THREE.Path();
    for (let i = 96; i >= 0; i--) {
      const angle = i / 96 * Math.PI * 2;
      const r = radius * (.82 + .18 * Math.cos(angle * 6));
      if (i === 96) path.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
      else path.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    return path;
  }
  if (/socket|hex drive/i.test(description)) return hole(radius, 6);
  if (/square/i.test(description)) return hole(radius, 4);
  if (/slotted/i.test(description) && !/unslotted/i.test(description)) {
    const path = new THREE.Path();
    path.moveTo(-radius, -radius * .18); path.lineTo(-radius, radius * .18);
    path.lineTo(radius, radius * .18); path.lineTo(radius, -radius * .18); path.closePath();
    return path;
  }
  return crossHole(radius);
}

/** A continuous, triangular helical ridge; no disconnected stack of rings. */
function thread(coreRadius: number, height: number, from: number, to: number, pitch: number, material: THREE.Material, detail: number, taper = false) {
  const turns = (to - from) / pitch;
  const steps = Math.ceil(turns * detail);
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const progress = i / steps;
    const angle = progress * turns * Math.PI * 2;
    const center = from + progress * (to - from);
    const factor = taper ? Math.min(1, .09 + progress * 3.8) : 1;
    const edgeFade = Math.min(1, progress * 22, (1 - progress) * 22);
    const section = [[coreRadius * factor, center - pitch * .35], [(coreRadius + height * edgeFade) * factor, center - pitch * .035], [(coreRadius + height * edgeFade) * factor, center + pitch * .035], [coreRadius * factor, center + pitch * .35]];
    for (const [radius, y] of section) positions.push(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    if (i < steps) {
      for (let edge = 0; edge < 3; edge++) {
        const a = i * 4 + edge, b = a + 4;
        if (height < 0) indices.push(a, b, a + 1, b, b + 1, a + 1);
        else indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return mesh(geometry, material);
}

/** Centered Y-axis model, maximum dimension 3.6 units, suitable for reusable studio scenes. */
export function createHardware(kind: HardwareKind, options: HardwareOptions = {}): THREE.Group {
  const group = new THREE.Group();
  group.name = `Representative ${kind}`;
  const material = metal(`${options.finish ?? ''} ${options.product?.material ?? ''} ${options.product?.specs?.Material ?? ''}`);
  const darkMaterial = material.clone();
  darkMaterial.color.multiplyScalar(.48);
  darkMaterial.roughness = .38;
  const radial = options.quality === 'low' ? 40 : 72;
  const detail = options.quality === 'low' ? 28 : 48;
  const product = options.product;
  const description = `${product?.name ?? ''} ${product?.subcategory ?? ''} ${product?.head ?? ''} ${product?.drive ?? ''}`.toLowerCase();
  const pointed = /wood|deck|drywall|self.tapp|self.pierc|self.drill|concrete|lag screw/.test(description);
  const add = (...objects: THREE.Object3D[]) => group.add(...objects);
  if (kind === 'bolt' || kind === 'carriage' || kind === 'washer') {
    const model=createDimensionHardware(kind,{product,material,darkMaterial,radial,detail});
    Object.assign(group.userData,model.userData);add(model);
  } else if (['nut','wing-nut','acorn-nut','coupling-nut','clip-nut','spring-clip-nut','cage-nut','rivet-nut','tee-nut','clinch-nut','conduit-nut','weld-nut'].includes(kind)) {
    const model=createNutHardware(kind,{product,material,darkMaterial,radial,detail});
    Object.assign(group.userData,model.userData);add(model);
  } else if (kind === 'socket') {
    add(lathe([[0,-1.65],[.21,-1.65],[.255,-1.60],[.255,1.05],[.27,1.12],[.50,1.12],[.55,1.18],[.55,1.67],[.51,1.73],[0,1.73]], material, radial));
    add(thread(.254,.085,-1.56,1.03,.17,material,detail));
    const top = roundShape(.515, radial);
    top.holes.push(hole(.28, 6));
    // A true recessed socket with interior walls and a dark floor.
    add(extruded(top,.18,material,1.83,.012));
    add(mesh(new THREE.CylinderGeometry(.277,.277,.008,6),darkMaterial,1.735));
    for (let i = 0; i < 32; i++) {
      const angle = i * Math.PI / 16;
      const line = mesh(new THREE.CylinderGeometry(.004,.004,.38,3),darkMaterial,1.43);
      line.position.x = Math.cos(angle) * .551;
      line.position.z = Math.sin(angle) * .551;
      add(line);
    }
  } else if (kind === 'pan') {
    add(lathe([[0,-1.65],[pointed ? .025 : .22,-1.65],[pointed ? .13 : .26,-1.32],[.26,-.88],[.26,1.05],[.52,1.08],[.63,1.17],[.64,1.29],[.60,1.43],[.51,1.56],[.44,1.60],[.38,1.53],[0,1.53]],material,radial));
    add(thread(.258,pointed ? .11 : .085,-1.58,1.02,pointed ? .25 : .175,material,detail,pointed));
    const top = roundShape(.445,radial);
    top.holes.push(driveRecess(.34,description));
    add(extruded(top,.075,material,1.61,.009));
    add(mesh(new THREE.CylinderGeometry(.35,.35,.006,radial),darkMaterial,1.538));
  } else if (kind === 'flat') {
    add(lathe([[0,-1.72],[.21,-1.72],[.255,-1.65],[.255,1.04],[.58,1.44],[.59,1.49],[0,1.49]],material,radial));
    add(thread(.253,.085,-1.64,1.02,.175,material,detail));
    const top = roundShape(.59,radial);
    top.holes.push(driveRecess(.39,description));
    add(extruded(top,.085,material,1.58,.012));
    add(mesh(new THREE.CylinderGeometry(.4,.4,.006,radial),darkMaterial,1.497));
  } else if (kind === 'wood') {
    add(lathe([[0,-1.8],[.04,-1.72],[.18,-1.15],[.235,-.82],[.235,1.05],[.56,1.43],[.58,1.49],[0,1.49]],material,radial));
    add(thread(.232,.13,-1.72,.87,.29,material,detail,true));
    const top = roundShape(.58,radial);
    top.holes.push(driveRecess(.39,description));
    add(extruded(top,.085,material,1.58,.012));
    const floor = roundShape(.41,radial);
    add(extruded(floor,.004,darkMaterial,1.497,0));
  } else if (kind === 'rivet') {
    // Open-end blind rivet with its long, break-away mandrel.
    add(lathe([[0,-1.85],[.068,-1.85],[.083,-1.81],[.083,1.05],[0,1.05]],material,radial));
    add(lathe([[0,-.38],[.22,-.38],[.255,-.30],[.255,1.18],[.22,1.25],[0,1.25]],material,radial));
    add(lathe([[.08,-.28],[.53,-.28],[.56,-.24],[.53,-.16],[.46,-.08],[.31,-.02],[.08,-.02]],material,radial));
  } else if (kind === 'spacer') {
    const shape = roundShape(.57,/hex|jack screw/.test(description) ? 6 : radial);
    shape.holes.push(hole(.31,radial));
    add(extruded(shape,2.1,material,1.05,.035));
    if (/male.female|jack screw/.test(description)) { add(mesh(new THREE.CylinderGeometry(.22,.22,.7,radial),material,-1.38));add(thread(.22,.065,-1.72,-1.06,.14,material,detail)); }
    if (/standoff/.test(description)) add(thread(.312,-.035,.48,1.01,.13,material,detail));
  } else if (kind === 'stud') {
    add(mesh(new THREE.CylinderGeometry(.27,pointed || /hanger|dowel/.test(description) ? .02 : .27,3.4,radial),material));
    add(thread(.27,.09,-1.62,1.62,.19,material,detail,/hanger|dowel/.test(description)));
  } else if (kind === 'shoulder') {
    add(mesh(new THREE.CylinderGeometry(.38,.38,1.85,radial),material,.18));
    add(mesh(new THREE.CylinderGeometry(.24,.24,.7,radial),material,-1.11));
    add(thread(.24,.075,-1.45,-.78,.17,material,detail));
    const cap=roundShape(.61,radial);cap.holes.push(hole(.29,6));add(extruded(cap,.47,material,1.56,.04));
    add(mesh(new THREE.CylinderGeometry(.29,.29,.02,6),darkMaterial,1.2));
  } else if (kind === 'set-screw') {
    const cap=roundShape(.5,radial);cap.holes.push(hole(.28,6));add(extruded(cap,1.65,material,.825,.015));
    add(thread(.5,.07,-.77,.77,.18,material,detail));
    add(mesh(new THREE.CylinderGeometry(.28,.28,.01,6),darkMaterial,.42));
  } else if (kind === 'thumb-screw') {
    add(mesh(new THREE.CylinderGeometry(.23,.23,2.4,radial),material,-.4));add(thread(.23,.075,-1.55,.74,.18,material,detail));
    if (/wing/.test(description)) {
      const wing=box(1.7,.67,.21,material,0,1.04);add(wing);
    } else {
      add(mesh(new THREE.CylinderGeometry(.65,.65,.47,radial),material,1.02));
      for(let i=0;i<32;i++) {const a=i*Math.PI/16;const rib=box(.025,.45,.03,darkMaterial,Math.cos(a)*.65,1.02,Math.sin(a)*.65);rib.rotation.y=-a;add(rib);}
    }
  } else if (kind === 'retaining-ring') {
    const shape=new THREE.Shape();const gap=.36;
    for(let i=0;i<=80;i++){const a=gap+i/80*(Math.PI*2-gap*2);if(!i)shape.moveTo(Math.cos(a),Math.sin(a));else shape.lineTo(Math.cos(a),Math.sin(a));}
    for(let i=80;i>=0;i--){const a=gap+i/80*(Math.PI*2-gap*2);shape.lineTo(Math.cos(a)*.7,Math.sin(a)*.7);}shape.closePath();
    add(extruded(shape,.11,material,.055,.01));
    if(!/e.style/.test(description)) for(const sign of [-1,1]) {const lug=ring(.21,.08,.11,.055,material);lug.position.x=.79;lug.position.z=sign*.36;add(lug);}
  } else if (kind === 'spring-pin') {
    const shape=new THREE.Shape();const gap=.09;
    for(let i=0;i<=64;i++){const a=gap+i/64*(Math.PI*2-gap*2);if(!i)shape.moveTo(Math.cos(a)*.43,Math.sin(a)*.43);else shape.lineTo(Math.cos(a)*.43,Math.sin(a)*.43);}
    for(let i=64;i>=0;i--){const a=gap+i/64*(Math.PI*2-gap*2);shape.lineTo(Math.cos(a)*.3,Math.sin(a)*.3);}shape.closePath();add(extruded(shape,3.2,material,1.6,.012));
  } else if (kind === 'cotter-pin') {
    add(wire([[-.12,-1.6,0],[-.12,.8,0],[-.4,1.17,0],[-.24,1.56,0],[.24,1.56,0],[.4,1.17,0],[.12,.8,0],[.12,-1.35,0]],.11,material));
  } else if (kind === 'hitch-pin') {
    add(wire([[-.2,-1.75,0],[-.2,.88,0],[-.32,1.3,0],[.1,1.6,0],[.6,1.37,0],[.61,.9,0],[.4,.52,0],[.7,.05,0],[.47,-.55,0],[.6,-1.4,0]],.105,material));
  } else if (kind === 'anchor' || kind === 'wall-anchor') {
    if(kind==='wall-anchor') {
      add(ring(.41,.19,2.9,1.45,material));add(ring(.56,.2,.13,1.52,material));
      for(let i=0;i<10;i++) add(ring(.48,.2,.055,-1.24+i*.26,material));
      for(let i=0;i<4;i++){const a=i*Math.PI/2;const slot=box(.055,1.7,.035,darkMaterial,Math.cos(a)*.42,-.3,Math.sin(a)*.42);slot.rotation.y=-a;add(slot);}
    } else if(/drop.in|single expansion|machine screw anchor/.test(description)) {
      add(ring(.53,.28,2.65,1.325,material));add(thread(.282,-.04,.45,1.25,.15,material,detail));
      for(let i=0;i<4;i++){const a=i*Math.PI/2;const cut=box(.045,.95,.04,darkMaterial,Math.cos(a)*.535,-.82,Math.sin(a)*.535);cut.rotation.y=-a;add(cut);}
    } else {
      add(mesh(new THREE.CylinderGeometry(.25,.32,3.3,radial),material));add(thread(.25,.075,.12,1.59,.18,material,detail));
      add(ring(.58,.26,.12,.68,material));add(ring(.46,.26,.4,1.09,material,6));add(ring(.37,.26,.68,-.83,material));
      for(let i=0;i<4;i++){const a=i*Math.PI/2;const slot=box(.04,.65,.035,darkMaterial,Math.cos(a)*.38,-1.17,Math.sin(a)*.38);slot.rotation.y=-a;add(slot);}
    }
  } else if (kind === 'toggle') {
    add(mesh(new THREE.CylinderGeometry(.13,.13,3,radial),material));add(thread(.13,.05,-1.43,1.43,.14,material,detail));
    add(mesh(new THREE.CylinderGeometry(.37,.37,.14,radial),material,1.57));
    for(const sign of [-1,1]) {const wing=box(1.5,.22,.52,material,sign*.67,-.66);wing.rotation.z=-sign*.25;add(wing);}
  } else if (kind === 'cable-tie') {
    const shape=new THREE.Shape();shape.absellipse(0,0,.84,1.24,0,Math.PI*2,false,0);
    const inner=new THREE.Path();inner.absellipse(0,0,.73,1.13,0,Math.PI*2,true,0);shape.holes.push(inner);
    const loop=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.2,bevelEnabled:false,curveSegments:64}),material);add(loop,box(.4,.3,.4,material,.79,.4,.1),box(.11,1.7,.2,material,.92,1.24,.1));
  } else if (kind === 'clamp') {
    add(wire([[-.45,-.69,0],[-.82,-.18,0],[-.8,.61,0],[0,.94,0],[.8,.61,0],[.82,-.18,0],[.45,-.69,0]],.14,material));
    for(const sign of [-1,1]) {const tab=ring(.37,.14,.2,-.56,material);tab.position.x=sign*.4;add(tab);}
  } else if (kind === 'handle') {
    add(wire([[-1.35,-.75,0],[-1.35,.4,0],[-1.12,.7,0],[1.12,.7,0],[1.35,.4,0],[1.35,-.75,0]],.17,material));
  } else if (kind === 'bottle') {
    const body=new THREE.MeshPhysicalMaterial({color:/green/.test(description)?'#2a694b':/blue/.test(description)?'#326b91':'#c6c4bd',roughness:.48,metalness:0});
    add(lathe([[0,-1.5],[.68,-1.5],[.77,-1.4],[.77,.45],[.62,.74],[.26,.92],[.26,1.1],[0,1.1]],body,radial));
    add(lathe([[0,1.03],[.33,1.03],[.3,1.33],[.12,1.76],[0,1.76]],darkMaterial,radial));
    add(mesh(new THREE.CylinderGeometry(.778,.778,1.2,radial),new THREE.MeshStandardMaterial({color:'#e6e6dd',roughness:.78}),-.4));
  } else if (kind === 'driver-bit') {
    add(mesh(new THREE.CylinderGeometry(.35,.35,1.5,6),material,-.75));
    add(mesh(new THREE.CylinderGeometry(.24,.35,1,radial),material,.5));
    add(mesh(new THREE.CylinderGeometry(.25,.25,.65,/torx/.test(description)?12:6),material,1.32));
  } else if (kind === 'hex-key') {
    add(mesh(new THREE.CylinderGeometry(.14,.14,3.1,6),material,-.08));const arm=mesh(new THREE.CylinderGeometry(.14,.14,1.36,6),material,1.4);arm.rotation.z=Math.PI/2;arm.position.x=.6;add(arm);
  } else if (kind === 'pliers') {
    for(const sign of [-1,1]) {add(wire([[sign*.63,-1.6,0],[sign*.42,-.83,0],[0,.15,sign*.06],[sign*.38,.85,0],[sign*.19,1.58,0]],.11,material));add(wire([[sign*.63,-1.6,0],[sign*.51,-1.2,0],[sign*.4,-.81,0]],.19,darkMaterial));}add(mesh(new THREE.CylinderGeometry(.25,.25,.28,radial),material,.15));
  } else if (kind === 'rivet-gun') {
    add(box(1.5,.63,.7,material,0,.81));const nose=mesh(new THREE.CylinderGeometry(.13,.24,1.1,radial),material,.81);nose.rotation.z=Math.PI/2;nose.position.x=-1.21;add(nose,box(.54,1.52,.61,darkMaterial,.28,-.22));
    add(mesh(new THREE.CylinderGeometry(.63,.63,.57,radial),material,-1.29));
  } else {
    add(lathe([[0,-1.7],[.20,-1.7],[.29,-1.61],[.29,1.61],[.20,1.7],[0,1.7]],material,radial));
  }
  const bounds = new THREE.Box3().setFromObject(group);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  for (const child of group.children) child.position.sub(center);
  group.scale.setScalar(3.6 / Math.max(size.x,size.y,size.z));
  group.userData.representative = true;
  group.userData.hardwareKind = kind;
  return group;
}
