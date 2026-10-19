'use client';

import {useEffect, useRef, useState} from 'react';
import {ArrowUpRight, Pause, Play} from 'lucide-react';
import type {Product} from '@/lib/types';
import type {HardwareKind} from '@/lib/hardware-geometry';
import HeroFinder from './hero-finder';
import './live-hero.css';

type Props = {
  onSearch: (query: string) => void;
  onOpen: (product: Product) => void;
  onTypes: () => void;
  onBrowse: (category?: string) => void;
};

const parts: {kind: HardwareKind; name: string; category: string}[] = [
  {kind:'socket', name:'Socket screws', category:'Sockets'},
  {kind:'wood', name:'Wood screws', category:'Screws'},
  {kind:'bolt', name:'Hex bolts', category:'Bolts'},
  {kind:'nut', name:'Hex nuts', category:'Nuts'},
  {kind:'washer', name:'Washers', category:'Washers'},
];

type StageControls = {select: (index: number) => void; pause: (value: boolean) => void};

function HardwareStage({onBrowse}: Pick<Props, 'onBrowse'>) {
  const host = useRef<HTMLDivElement>(null);
  const controls = useRef<StageControls | null>(null);
  const [selected, setSelected] = useState(0);
  const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const currentState = useRef({selected, paused});
  currentState.current = {selected, paused};
  const browseRef = useRef(onBrowse);
  browseRef.current = onBrowse;

  useEffect(() => {controls.current?.select(selected)}, [selected]);
  useEffect(() => {controls.current?.pause(paused)}, [paused]);

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let disposed = false;
    let teardown: (() => void) | undefined;
    let entered = false;
    let visible = true;
    let visibilityChanged: (() => void) | undefined;
    const observer = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      visibilityChanged?.();
      if (visible && !entered) {entered = true; void initialize();}
    }, {rootMargin:'90px'}) : undefined;

    async function initialize() {
      try {
        const [THREE, {createHardware}, {RoomEnvironment}] = await Promise.all([
          import('three'),
          import('@/lib/hardware-geometry'),
          import('three/addons/environments/RoomEnvironment.js'),
        ]);
        if (disposed) return;
        const renderer = new THREE.WebGLRenderer({alpha:true, antialias:true, powerPreference:'low-power'});
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
        renderer.setClearColor(0xffffff, 0);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.35;
        const canvas = renderer.domElement;
        canvas.setAttribute('aria-hidden', 'true');
        container!.appendChild(canvas);
        const scene = new THREE.Scene();
        teardown = () => {renderer.dispose();canvas.remove()};
        const camera = new THREE.PerspectiveCamera(32, 1, .1, 60);
        camera.position.set(0, .15, 13.4);
        camera.lookAt(0, 0, 0);
        const studio = new RoomEnvironment();
        const pmrem = new THREE.PMREMGenerator(renderer);
        const environment = pmrem.fromScene(studio, .04);
        scene.environment = environment.texture;
        scene.environmentIntensity = 1.1;
        studio.dispose();
        pmrem.dispose();
        scene.add(new THREE.HemisphereLight(0xffffff, 0xc3cad2, 2.4));
        const key = new THREE.DirectionalLight(0xffffff, 3.2);
        key.position.set(-3, 6, 7);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0xe8ffff, 2.3);
        rim.position.set(5, 2, -4);
        scene.add(rim);
        const world = new THREE.Group();
        scene.add(world);

        const poses = [
          {x:-1.65, y:1.08, z:.15, scale:.72, rx:.46, ry:-.3, rz:-.49},
          {x:1.73, y:1.23, z:-.35, scale:.67, rx:.2, ry:.6, rz:.61},
          {x:.12, y:-1.39, z:.28, scale:.71, rx:.5, ry:-.2, rz:1.03},
          {x:-2.5, y:-1.47, z:-.3, scale:.41, rx:.67, ry:.35, rz:.25},
          {x:2.66, y:-1.46, z:-.7, scale:.42, rx:1.03, ry:.3, rz:.3},
        ];
        const models = parts.map((part, i) => {
          const model = new THREE.Group();
          model.add(createHardware(part.kind, {quality:'low', finish:i===2?'black':'steel'}));
          const pose = poses[i];
          model.scale.setScalar(pose.scale*(i===currentState.current.selected?1.07:1));
          model.position.set(pose.x,pose.y,pose.z);
          model.rotation.set(pose.rx,pose.ry,pose.rz);
          model.userData.partIndex = i;
          model.traverse(child => {child.userData.partIndex = i});
          world.add(model);
          return model;
        });
        let selectedIndex = currentState.current.selected;
        let hoveredIndex = -1;
        let isPaused = currentState.current.paused;
        let contextLost = false;
        let hasRendered = false;
        let frame = 0;
        let elapsed = 0;
        let last = 0;
        let dragPointer = -1;
        let dragX = 0;
        let dragY = 0;
        let travel = 0;
        let yaw = 0;
        let pitch = 0;
        let hoverX = 0;
        let hoverY = 0;
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
        let reduce = reduced.matches;
        setReducedMotion(reduce);
        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();

        const running = () => visible && !document.hidden && !isPaused && !reduce && !contextLost;
        const schedule = () => {if (!frame && visible && !document.hidden && !disposed && !contextLost) frame = requestAnimationFrame(draw)};
        const draw = (now: number) => {
          frame = 0;
          const dt = last ? Math.min((now-last)/1000, .05) : 0;
          last = now;
          if (running()) elapsed += dt;
          const ease = running() ? .08 : 1;
          world.rotation.y += (yaw + hoverX*.11 - world.rotation.y)*ease;
          world.rotation.x += (pitch + hoverY*.07 - world.rotation.x)*ease;
          key.position.x += (-3+hoverX*5-key.position.x)*ease;
          key.position.y += (6+hoverY*2-key.position.y)*ease;
          rim.position.x += (5-hoverX*3-rim.position.x)*ease;
          models.forEach((model, i) => {
            const pose = poses[i];
            model.position.set(pose.x, pose.y + (reduce ? 0 : Math.sin(elapsed*.7+i*1.6)*.1) + (hoveredIndex===i ? .09 : 0), pose.z);
            model.rotation.set(pose.rx + (reduce ? 0 : Math.sin(elapsed*.37+i)*.09), pose.ry + (reduce ? 0 : elapsed*(i%2 ? -.11 : .09)), pose.rz + (reduce ? 0 : Math.cos(elapsed*.35+i)*.05));
            const target = pose.scale*(hoveredIndex===i ? 1.15 : selectedIndex===i ? 1.07 : 1);
            const scale = model.scale.x + (target-model.scale.x)*ease;
            model.scale.setScalar(scale);
          });
          try {
            renderer.render(scene, camera);
          } catch {
            contextLost=true;
            setReady(false);
            setUnavailable(true);
            teardown?.();
            teardown=undefined;
            return;
          }
          if (contextLost) return;
          if (!hasRendered) {hasRendered=true;setReady(true)}
          if (running()) schedule();
        };
        const resize = () => {
          const rect = container!.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          renderer.setSize(rect.width, rect.height);
          camera.aspect = rect.width/rect.height;
          camera.fov = camera.aspect < 1 ? 36 : 32;
          camera.updateProjectionMatrix();
          schedule();
        };
        const pick = (event: PointerEvent) => {
          const rect = canvas.getBoundingClientRect();
          pointer.set((event.clientX-rect.left)/rect.width*2-1, -(event.clientY-rect.top)/rect.height*2+1);
          raycaster.setFromCamera(pointer, camera);
          const hit = raycaster.intersectObjects(models, true)[0];
          return hit ? Number(hit.object.userData.partIndex) : -1;
        };
        const onDown = (event: PointerEvent) => {
          if (event.button !== 0) return;
          dragPointer = event.pointerId;
          dragX = event.clientX;
          dragY = event.clientY;
          travel = 0;
          canvas.setPointerCapture(event.pointerId);
          canvas.style.cursor = 'grabbing';
        };
        const onMove = (event: PointerEvent) => {
          if (dragPointer === event.pointerId) {
            const dx = event.clientX-dragX;
            const dy = event.clientY-dragY;
            travel += Math.abs(dx)+Math.abs(dy);
            yaw += dx*.006;
            pitch = Math.max(-.55, Math.min(.55, pitch+dy*.003));
            dragX = event.clientX;
            dragY = event.clientY;
          } else if (event.pointerType !== 'touch') {
            hoveredIndex = pick(event);
            const rect = canvas.getBoundingClientRect();
            hoverX = (event.clientX-rect.left)/rect.width-.5;
            hoverY = (event.clientY-rect.top)/rect.height-.5;
            canvas.style.cursor = hoveredIndex >= 0 ? 'pointer' : 'grab';
          }
          schedule();
        };
        const endDrag = (event: PointerEvent) => {
          if (dragPointer !== event.pointerId) return;
          if (event.type==='pointerup' && travel<7) {
            const index = pick(event);
            if (index>=0) browseRef.current(parts[index].category);
          }
          if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
          dragPointer = -1;
          canvas.style.cursor = 'grab';
          schedule();
        };
        const leave = () => {hoveredIndex=-1;hoverX=0;hoverY=0;schedule()};
        const motionChange = () => {reduce=reduced.matches;setReducedMotion(reduce);schedule()};
        const onContextLost = (event: Event) => {
          event.preventDefault();
          contextLost=true;
          cancelAnimationFrame(frame);
          frame=0;
          setReady(false);
          setUnavailable(true);
        };
        const pageVisibility = () => {last=0;if (running()) schedule();else if (frame) {cancelAnimationFrame(frame);frame=0}};
        visibilityChanged = pageVisibility;
        const resized = new ResizeObserver(resize);
        resized.observe(container!);
        canvas.addEventListener('pointerdown', onDown);
        canvas.addEventListener('pointermove', onMove);
        canvas.addEventListener('pointerup', endDrag);
        canvas.addEventListener('pointercancel', endDrag);
        canvas.addEventListener('pointerleave', leave);
        canvas.addEventListener('webglcontextlost', onContextLost);
        document.addEventListener('visibilitychange', pageVisibility);
        reduced.addEventListener('change', motionChange);
        controls.current = {
          select(index) {selectedIndex=index;schedule()},
          pause(value) {isPaused=value;last=0;schedule()},
        };
        resize();
        teardown = () => {
          cancelAnimationFrame(frame);
          resized.disconnect();
          canvas.removeEventListener('pointerdown', onDown);
          canvas.removeEventListener('pointermove', onMove);
          canvas.removeEventListener('pointerup', endDrag);
          canvas.removeEventListener('pointercancel', endDrag);
          canvas.removeEventListener('pointerleave', leave);
          canvas.removeEventListener('webglcontextlost', onContextLost);
          document.removeEventListener('visibilitychange', pageVisibility);
          reduced.removeEventListener('change', motionChange);
          scene.traverse(child => {
            if (child instanceof THREE.Mesh) {
              child.geometry.dispose();
              const materials = Array.isArray(child.material) ? child.material : [child.material];
              materials.forEach(material=>material.dispose());
            }
          });
          environment.dispose();
          renderer.dispose();
          canvas.remove();
        };
      } catch {
        teardown?.();
        teardown=undefined;
        if (!disposed) setUnavailable(true);
      }
    }

    if (observer) observer.observe(container);
    else {entered=true;void initialize()}
    return () => {disposed=true;observer?.disconnect();teardown?.();controls.current=null};
  }, []);

  return <div className={'live-hardware '+(ready?'is-ready':'')+(unavailable?' is-unavailable':'')}>
    <div className="lh-stage-shell">
      <div className="lh-stage" ref={host} role="button" tabIndex={ready?0:-1} aria-hidden={!ready} aria-label={'Browse '+parts[selected].name+'. Use left and right arrows to choose a fastener, Enter to browse. Drag to rotate the collection.'} onKeyDown={event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();setSelected(index=>(index+(event.key==='ArrowRight'?1:parts.length-1))%parts.length)}else if(event.key==='Enter'||event.key===' '){event.preventDefault();onBrowse(parts[selected].category)}}}/>
      {ready&&!reducedMotion&&<button className="lh-pause" onClick={()=>setPaused(value=>!value)} aria-label={paused?'Play hardware animation':'Pause hardware animation'} aria-pressed={paused}>{paused?<Play size={13}/>:<Pause size={13}/>}</button>}
    </div>
  </div>;
}

export default function LiveHero({onSearch,onOpen,onTypes,onBrowse}: Props) {
  return <section className="live-hero" aria-label="Find the hardware for your next idea">
    <div className="lh-inner">
      <div className="lh-copy">
        <h1>Small hardware.<br/>Big possibilities<span className="lh-period">.</span></h1>
        <p className="lh-description">The missing piece. The next great build.<br/>Find the part that makes it all click.</p>
        <HeroFinder onSearch={onSearch} onOpen={onOpen} onTypes={onTypes}/>
        <button className="lh-primary-cta" onClick={()=>onBrowse()}>Explore the catalog <ArrowUpRight size={18}/></button>
      </div>
      <HardwareStage onBrowse={onBrowse}/>
    </div>
  </section>;
}
