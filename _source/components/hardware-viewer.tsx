'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createHardware } from '@/lib/hardware-geometry';
import type { HardwareKind } from '@/lib/hardware-types';
import type { Product } from '@/lib/types';

export type HardwareView = 'perspective' | 'front' | 'side' | 'top';
export interface HardwareViewerProps {
  kind: HardwareKind;
  view?: HardwareView;
  interactive?: boolean;
  autoRotate?: boolean;
  finish?: string;
  product?: Partial<Product>;
  className?: string;
  onReady?: () => void;
}

const viewPositions: Record<HardwareView, [number, number, number]> = {
  perspective: [4.8, 3.1, 6.2], front: [0, .05, 7.9], side: [7.9, .05, 0], top: [0, 7.9, .001],
};
const labels: Partial<Record<HardwareKind, string>> = { socket:'socket cap screw',pan:'pan head screw',flat:'flat head screw',carriage:'carriage bolt',wood:'wood screw',bolt:'bolt',nut:'nut',washer:'washer',rivet:'rivet',spacer:'spacer',pin:'dowel pin' };

/** Lazy-load this component: Three.js is deliberately confined to the interactive viewer bundle. */
export default function HardwareViewer({kind, view = 'perspective', interactive = true, autoRotate = false, finish, product, className = '', onReady}: HardwareViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const changeViewRef = useRef<((next: HardwareView) => void) | null>(null);
  const wakeRef = useRef<(() => void) | null>(null);
  const settings = useRef({view, interactive, autoRotate, onReady});
  settings.current = {view, interactive, autoRotate, onReady};
  const productRef = useRef(product);
  productRef.current = product;
  const modelKey = `${product?.id ?? ''}|${product?.name ?? ''}|${product?.subcategory ?? ''}|${product?.head ?? ''}|${product?.drive ?? ''}`;
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => { changeViewRef.current?.(view); }, [view]);
  useEffect(() => { wakeRef.current?.(); }, [autoRotate]);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    setFailed(false);
    setReady(false);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
    } catch {
      setFailed(true);
      return;
    }
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34,1,.1,40);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    renderer.setClearColor(0x000000,0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const canvas = renderer.domElement;
    canvas.style.cssText = `display:block;width:100%;height:100%;touch-action:${interactive ? 'none' : 'pan-y'};`;
    canvas.tabIndex = interactive ? 0 : -1;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${labels[kind] ?? kind.replaceAll('-', ' ')} representative 3D preview. Drag in any direction to rotate, including on a touchscreen. Pinch or Control-scroll to zoom. Arrow keys rotate; Home resets the view.`);
    container.appendChild(canvas);
    const hardware = createHardware(kind,{finish,quality:window.devicePixelRatio>2?'low':'high',product:productRef.current});
    const pivot = new THREE.Group();
    pivot.add(hardware);
    scene.add(pivot);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const environment = pmrem.fromScene(room,.04);
    scene.environment = environment.texture;
    room.dispose();
    pmrem.dispose();

    scene.add(new THREE.HemisphereLight(0xffffff,0x828887,1.1));
    const key = new THREE.DirectionalLight(0xffffff,4.2);
    key.position.set(-3.5,5,4.5);
    key.castShadow = true;
    key.shadow.mapSize.set(512,512);
    key.shadow.camera.left = -3.1;
    key.shadow.camera.right = 3.1;
    key.shadow.camera.top = 3.1;
    key.shadow.camera.bottom = -3.1;
    key.shadow.normalBias = .035;
    key.shadow.bias = -.0004;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xdce6ed,2.4);
    rim.position.set(4,1,-3);
    scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffffff,1.8);
    fill.position.set(1,-2,4);
    scene.add(fill);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14,14),new THREE.ShadowMaterial({opacity:.11}));
    floor.rotation.x = -Math.PI/2;
    floor.position.y = -2.15;
    floor.receiveShadow = true;
    scene.add(floor);

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = true;
    let disposed = false;
    let contextLost = false;
    let animationFrame = 0;
    let lastTime = 0;
    let dirty = true;
    let dragging = false;
    let pointerId: number | null = null;
    let previousX = 0;
    let previousY = 0;
    let lastInteraction = 0;
    let firstRender = true;
    const pointers = new Map<number, {x:number;y:number}>();
    let pinchDistance = 0;
    let zoom = 1;
    const quaternion = new THREE.Quaternion();
    const arcStart = new THREE.Vector3();
    const arcEnd = new THREE.Vector3();
    const arcAxis = new THREE.Vector3();
    const worldUp = new THREE.Vector3(0,1,0);

    const renderFrame = (time: number) => {
      animationFrame = 0;
      if (disposed || contextLost || !visible || document.hidden) return;
      const delta = lastTime ? Math.min((time-lastTime)/1000,.05) : 0;
      lastTime = time;
      const rotate = settings.current.autoRotate && !reducedMotion.matches && !dragging && time-lastInteraction>1400;
      if (rotate) { quaternion.setFromAxisAngle(worldUp,delta*.22); pivot.quaternion.premultiply(quaternion); dirty = true; }
      if (dirty) {
        renderer.render(scene,camera);
        dirty = false;
        if (firstRender) { firstRender = false; setReady(true); settings.current.onReady?.(); }
      }
      if (settings.current.autoRotate && !reducedMotion.matches) animationFrame = requestAnimationFrame(renderFrame);
    };
    const schedule = () => {
      if (!disposed && !contextLost && !animationFrame && visible && !document.hidden) animationFrame = requestAnimationFrame(renderFrame);
    };
    wakeRef.current = schedule;
    const setView = (next: HardwareView) => {
      const position = viewPositions[next];
      camera.position.set(...position);
      camera.up.set(0,1,0);
      if (next === 'top') camera.up.set(0,0,-1);
      camera.lookAt(0,0,0);
      pivot.rotation.set(0,0,next === 'perspective' ? -.24 : 0);
      zoom = 1;
      lastInteraction = performance.now();
      dirty = true;
      schedule();
    };
    changeViewRef.current = setView;
    setView(settings.current.view);
    const resize = () => {
      const width = Math.max(container.clientWidth,1);
      const height = Math.max(container.clientHeight,1);
      renderer.setSize(width,height,false);
      camera.aspect = width/height;
      // Preserve full hardware and comfortable margins in narrow gallery panels.
      camera.fov = width/height < .75 ? 40 : 34;
      camera.updateProjectionMatrix();
      dirty = true;
      schedule();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();
    const intersection = new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? true;
      lastTime = 0;
      if (visible) { dirty = true; schedule(); }
      else if (animationFrame) { cancelAnimationFrame(animationFrame); animationFrame = 0; }
    }, {threshold:.02});
    intersection.observe(container);

    const projectArc = (x:number,y:number,target:THREE.Vector3) => {
      const rect=canvas.getBoundingClientRect();
      const radius=Math.min(rect.width,rect.height)*.5;
      target.set((x-rect.left-rect.width*.5)/radius,(rect.top+rect.height*.5-y)/radius,0);
      const length=target.lengthSq();
      target.z=length<=.5?Math.sqrt(1-length):.5/Math.sqrt(length);
      return target.normalize();
    };
    const applyZoom = (next:number) => {
      zoom=THREE.MathUtils.clamp(next,.72,1.75);
      camera.position.set(...viewPositions[settings.current.view]).multiplyScalar(1/zoom);
      camera.lookAt(0,0,0);
      lastInteraction=performance.now();dirty=true;schedule();
    };
    const pointerDistance = () => {
      const values=[...pointers.values()];
      return values.length<2?0:Math.hypot(values[1].x-values[0].x,values[1].y-values[0].y);
    };

    const down = (event: PointerEvent) => {
      if (!settings.current.interactive || (event.pointerType === 'mouse' && event.button !== 0)) return;
      event.preventDefault();
      pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
      pinchDistance=pointerDistance();
      pointerId = event.pointerId;
      dragging = true;
      previousX = event.clientX;
      previousY = event.clientY;
      lastInteraction = performance.now();
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = 'grabbing';
    };
    const move = (event: PointerEvent) => {
      if (!dragging || !pointers.has(event.pointerId)) return;
      event.preventDefault();
      pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
      if(pointers.size>1) {
        const distance=pointerDistance();
        if(pinchDistance>0) applyZoom(zoom*distance/pinchDistance);
        pinchDistance=distance;
      } else {
        projectArc(previousX,previousY,arcStart);projectArc(event.clientX,event.clientY,arcEnd);
        arcAxis.crossVectors(arcStart,arcEnd);
        if(arcAxis.lengthSq()>1e-10) {
          const angle=Math.acos(THREE.MathUtils.clamp(arcStart.dot(arcEnd),-1,1));
          arcAxis.normalize().applyQuaternion(camera.quaternion);
          quaternion.setFromAxisAngle(arcAxis,angle);
          pivot.quaternion.premultiply(quaternion).normalize();
        }
      }
      previousX = event.clientX;
      previousY = event.clientY;
      lastInteraction = performance.now();
      dirty = true;
      schedule();
    };
    const up = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.delete(event.pointerId);
      const remaining=pointers.entries().next().value;
      dragging = !!remaining;
      pointerId = remaining?.[0] ?? null;
      if(remaining) {previousX=remaining[1].x;previousY=remaining[1].y;}
      pinchDistance=pointerDistance();
      lastInteraction = performance.now();
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      canvas.style.cursor = settings.current.interactive ? 'grab' : 'default';
      schedule();
    };
    const keyboard = (event: KeyboardEvent) => {
      if (!settings.current.interactive) return;
      if (event.key === 'Home') { event.preventDefault(); setView(settings.current.view); return; }
      const direction = {'ArrowLeft':[-.17,0], 'ArrowRight':[.17,0], 'ArrowUp':[0,-.17], 'ArrowDown':[0,.17]}[event.key];
      if (!direction) return;
      event.preventDefault();
      arcAxis.set(direction[1] ? 1 : 0,direction[0] ? 1 : 0,0).applyQuaternion(camera.quaternion);
      quaternion.setFromAxisAngle(arcAxis,direction[0] || direction[1]);pivot.quaternion.premultiply(quaternion).normalize();
      lastInteraction = performance.now();
      dirty = true;
      schedule();
    };
    const visibility = () => {
      lastTime = 0;
      if (document.hidden) { cancelAnimationFrame(animationFrame); animationFrame = 0; }
      else { dirty = true; schedule(); }
    };
    const motionChange = () => { dirty = true; schedule(); };
    const wheel = (event:WheelEvent) => {
      if(!settings.current.interactive || !canvas.matches(':focus-visible') && !event.ctrlKey) return;
      event.preventDefault();applyZoom(zoom*Math.exp(-event.deltaY*.0015));
    };
    const onContextLost = (event: Event) => { event.preventDefault(); contextLost = true; visible = false; cancelAnimationFrame(animationFrame); animationFrame = 0; setFailed(true); };
    canvas.style.cursor = interactive ? 'grab' : 'default';
    canvas.addEventListener('pointerdown',down);
    canvas.addEventListener('pointermove',move);
    canvas.addEventListener('pointerup',up);
    canvas.addEventListener('pointercancel',up);
    canvas.addEventListener('lostpointercapture',up);
    canvas.addEventListener('wheel',wheel,{passive:false});
    canvas.addEventListener('keydown',keyboard);
    canvas.addEventListener('webglcontextlost',onContextLost);
    document.addEventListener('visibilitychange',visibility);
    reducedMotion.addEventListener('change',motionChange);
    return () => {
      disposed = true;
      changeViewRef.current = null;
      wakeRef.current = null;
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener('visibilitychange',visibility);
      reducedMotion.removeEventListener('change',motionChange);
      canvas.removeEventListener('pointerdown',down);
      canvas.removeEventListener('pointermove',move);
      canvas.removeEventListener('pointerup',up);
      canvas.removeEventListener('pointercancel',up);
      canvas.removeEventListener('lostpointercapture',up);
      canvas.removeEventListener('wheel',wheel);
      canvas.removeEventListener('keydown',keyboard);
      canvas.removeEventListener('webglcontextlost',onContextLost);
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      scene.traverse(object => {
        if (object instanceof THREE.Mesh) {
          geometries.add(object.geometry);
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
        }
      });
      geometries.forEach(geometry=>geometry.dispose());
      materials.forEach(material=>material.dispose());
      environment.dispose();
      key.shadow.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    };
  }, [kind,finish,interactive,modelKey]);

  return <div className={`hardware-viewer ${className}`} style={{position:'relative',width:'100%',height:'100%',minHeight:220}}>
    <div ref={containerRef} style={{position:'absolute',inset:0,opacity:ready&&!failed?1:0,transition:'opacity .4s ease'}} />
    {!ready && !failed && <div role="status" style={{position:'absolute',inset:0,display:'grid',placeItems:'center',fontSize:12,letterSpacing:'.12em',color:'#747c76'}}>Preparing your view…</div>}
    {failed && <div role="status" style={{position:'absolute',inset:0,display:'grid',placeItems:'center',padding:30,textAlign:'center',fontSize:13,color:'#747c76'}}>The 3D view is unavailable on this device. Use the product photo to explore this item.</div>}
  </div>;
}
