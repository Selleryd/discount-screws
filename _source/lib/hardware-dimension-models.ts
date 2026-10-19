import * as THREE from 'three';
import type { Product } from './types';

type ModelOptions = {
  product?: Partial<Product>;
  material: THREE.Material;
  darkMaterial: THREE.Material;
  radial: number;
  detail: number;
};

// All construction dimensions are millimeters. A caller may normalize the whole
// group uniformly; never normalize each axis independently or the proportions lie.
function magnitude(text: string): number | undefined {
  const value = text.trim().replace(/[″”"]/g, '').replace(/\b(?:mm|inches|inch|in|minimum|min|max|maximum)\b/gi, '').trim();
  const fraction = value.match(/^(?:(\d+)[\s-]+)?(\d+)\s*\/\s*(\d+)/);
  if (fraction && Number(fraction[3])) return Number(fraction[1] || 0) + Number(fraction[2]) / Number(fraction[3]);
  const number = value.match(/^(?:\d+(?:\.\d*)?|\.\d+)/);
  return number ? Number(number[0]) : undefined;
}

/** Tolerance ranges use their midpoint; unitless values inherit the SKU units. */
function dimension(value: string | undefined, metric = false): number | undefined {
  if (!value) return;
  // A hyphen in 1-1/4 is a mixed fraction; in .025-.040 it is a tolerance.
  const normalized = value.replace(/[–—]/g, '-').replace(/(^|[^\d./])(\d+)-(\d+\s*\/\s*\d+)(?=$|[^\d/])/g, '$1$2 $3');
  const parts = normalized.split(/\s*-\s*|\s+to\s+/i);
  const values = parts.map(magnitude).filter((n): n is number => n !== undefined && n > 0);
  if (!values.length) return;
  const mm = /mm\b/i.test(value) || (metric && !/[″”"]|\binch|\bin\b/i.test(value));
  return values.reduce((sum, n) => sum + n, 0) / values.length * (mm ? 1 : 25.4);
}

function specification(product: Partial<Product> | undefined, keys: string[]): string | undefined {
  for (const key of keys) {
    const found = Object.entries(product?.specs || {}).find(([name]) => name.toLowerCase() === key.toLowerCase());
    if (found?.[1]) return found[1];
  }
}

function sizeFor(product: Partial<Product> | undefined) {
  const text = product?.diameter || specification(product, ['Size', 'Thread Size', 'Diameter']) ||
    product?.name?.match(/(?:^|\/\s*)(#?\d+(?:[\s-]+\d+\/\d+|\/\d+|\.\d+)?)(?:"|\s+Washers)/)?.[1] || '';
  const metric = /^M\d/i.test(text);
  const mm = text.match(/^M(\d+(?:\.\d+)?)(?:\s*[-x×]\s*(\d+(?:\.\d+)?))?/i);
  if (mm) return { diameter: Number(mm[1]), pitch: Number(mm[2]) || Number(mm[1]) * .15, metric, specified: true };
  const inch = text.match(/^(#?\d+(?:[\s-]+\d+\/\d+|\/\d+|\.\d+)?)(?:-(\d+))?/);
  if (inch) {
    const bareGaugeSize = /^\d+$/.test(text) && Number(text) >= 2 && Number(text) <= 12 &&
      (/washers/i.test(product?.category || '') || new RegExp(`#${text}\\b`).test(product?.name || '')) &&
      !new RegExp(`(?:^|\\s)${text}\\s*["″”]`).test(product?.name || '');
    const gauge = inch[1].startsWith('#') || bareGaugeSize || (!!inch[2] && !inch[1].includes('/') && Number(inch[1]) > 1 && Number(inch[1]) <= 12);
    const inches = gauge ? .06 + Number(inch[1].replace('#', '')) * .013 : magnitude(inch[1]);
    if (inches) return { diameter: inches * 25.4, pitch: inch[2] ? 25.4 / Number(inch[2]) : inches * 25.4 * .16, metric, specified: true };
  }
  return { diameter: 6.35, pitch: 1.27, metric: false, specified: false };
}

export function readDimension(value: string | undefined, unitHint: 'mm' | 'in' = 'in'): number | null {
  return dimension(value, unitHint === 'mm') ?? null;
}

export function readNominalDiameter(product: Partial<Product>): number | null {
  const value = sizeFor(product);
  return value.specified ? value.diameter : null;
}

function part(geometry: THREE.BufferGeometry, material: THREE.Material, y = 0) {
  const value = new THREE.Mesh(geometry, material);
  value.position.y = y;
  value.castShadow = true;
  value.receiveShadow = true;
  return value;
}

function turned(points: [number, number][], material: THREE.Material, radial: number) {
  let geometry: THREE.BufferGeometry = new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), radial);
  if (radial <= 6) {
    const faceted = geometry.toNonIndexed();
    geometry.dispose(); geometry = faceted; geometry.computeVertexNormals();
  }
  return part(geometry, material);
}

function ring(outer: number, inner: number, thickness: number, y: number, material: THREE.Material, radial: number) {
  // Closed annular section: center remains open from every direction.
  const bevel = Math.min(thickness * .1, (outer - inner) * .04);
  return turned([
    [inner + bevel, y], [outer - bevel, y], [outer, y + bevel],
    [outer, y + thickness - bevel], [outer - bevel, y + thickness],
    [inner + bevel, y + thickness], [inner, y + thickness - bevel],
    [inner, y + bevel], [inner + bevel, y],
  ], material, radial);
}

/** A shallow 60-degree helical ridge with bounded tessellation for long bolts. */
function screwThread(radius: number, core: number, start: number, end: number, pitch: number, material: THREE.Material, detail: number, pointed = false) {
  if (!(end > start) || !(pitch > 0)) return new THREE.Group();
  const turns = (end - start) / pitch;
  const sectionPitch = Math.min(pitch, (end - start) * .25);
  const count = Math.max(24, Math.min(5200, Math.ceil(turns * Math.min(detail, 32))));
  const positions: number[] = [], indices: number[] = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count, angle = t * turns * Math.PI * 2, y = start + t * (end - start);
    const tip = pointed ? Math.min(1, .08 + (y - start) / (radius * 3)) : 1;
    const fade = Math.max(0, Math.min(1, (y - start) / pitch, (end - y) / pitch));
    for (const [r, offset] of [[core, -.36], [core + (radius - core) * fade, -.055], [core + (radius - core) * fade, .055], [core, .36]]) {
      positions.push(Math.cos(angle) * r * tip, y + offset * sectionPitch, Math.sin(angle) * r * tip);
    }
    if (i < count) for (let edge = 0; edge < 3; edge++) {
      const a = i * 4 + edge, b = a + 4;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return part(geometry, material);
}

function addDriveCap(group: THREE.Group, sides: number, radius: number, height: number, floor: number, phillips: boolean, material: THREE.Material, dark: THREE.Material) {
  const outline = Array.from({ length: sides }, (_, i) => new THREE.Vector2(Math.sin(i / sides * Math.PI * 2) * radius, Math.cos(i / sides * Math.PI * 2) * radius));
  const depth = height - floor, driveRadius = radius * .61, slot = radius * .13;
  const addShape = (points: THREE.Vector2[], hole?: THREE.Path) => {
    const shape = new THREE.Shape(points); shape.closePath();
    if (hole) shape.holes.push(hole);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, steps: 1, bevelEnabled: false, curveSegments: 1 });
    geometry.rotateX(-Math.PI / 2);
    if (sides === 4) geometry.rotateY(Math.PI / 4);
    group.add(part(geometry, material, floor));
  };
  if (phillips) {
    const arm = driveRadius * .25;
    const points = [[-arm, -driveRadius], [-arm, -arm], [-driveRadius, -arm], [-driveRadius, arm], [-arm, arm], [-arm, driveRadius], [arm, driveRadius], [arm, arm], [driveRadius, arm], [driveRadius, -arm], [arm, -arm], [arm, -driveRadius]];
    const hole = new THREE.Path(); points.forEach(([x, y], i) => i ? hole.lineTo(x, y) : hole.moveTo(x, y)); hole.closePath();
    addShape(outline, hole);
    group.add(part(new THREE.CylinderGeometry(driveRadius * 1.03, driveRadius * 1.03, height * .002, 24), dark, floor));
  } else {
    // Clip the hex into two raised halves: the slot opens through the two sides,
    // as a real slotted hex drive does, rather than stopping in a fake dark box.
    for (const sign of [-1, 1]) {
      const clipped: THREE.Vector2[] = [];
      for (let i = 0; i < outline.length; i++) {
        const a = outline[i], b = outline[(i + 1) % outline.length];
        const aInside = sign * a.y >= slot, bInside = sign * b.y >= slot;
        if (aInside) clipped.push(a.clone());
        if (aInside !== bInside) {
          const t = (sign * slot - a.y) / (b.y - a.y);
          clipped.push(new THREE.Vector2(a.x + (b.x - a.x) * t, sign * slot));
        }
      }
      if (clipped.length > 2) addShape(clipped);
    }
  }
}

function bolt(kind: 'bolt' | 'carriage', options: ModelOptions) {
  const { product, material, darkMaterial, radial, detail } = options;
  const group = new THREE.Group();
  const size = sizeFor(product), d = size.diameter, radius = d / 2;
  const description = `${product?.name || ''} ${product?.subcategory || ''} ${product?.head || ''} ${product?.drive || ''}`.toLowerCase();
  const measured = (keys: string[]) => dimension(specification(product, keys), size.metric);
  const length = dimension(product?.length || specification(product, ['Length']), size.metric) || d * 5;
  const pointed = /lag screw|lag bolt|wood|self.tapp|self.pierc|sheet metal|concrete/.test(description) && !/type b\b|type f\b|type 25\b/.test(description);
  const pitch = size.pitch;
  const core = Math.max(radius * .55, radius - pitch * .61);
  const knownThread = specification(product, ['Full / Partial Thread', 'Thread Type']) || '';
  const full = /full|tap bolt|din933/i.test(`${knownThread} ${description}`);
  const partial = /partial|din931/i.test(`${knownThread} ${description} ${product?.sourceImage || ''}`);
  const squareNeck = kind === 'carriage';
  const neckHeight = squareNeck ? Math.min(length * .7, measured(['Neck Height', 'Square Neck Length']) || d * (/short neck/.test(description) ? .25 : .5)) : 0;
  const threadAllowance = size.metric ? 2 * d + 6 : 2 * d + 6.35;
  const availableLength = Math.max(length * .01, length - neckHeight);
  const threadLength = Math.min(availableLength, measured(['Thread Length']) ||
    (full || (!partial && length <= threadAllowance) ? availableLength : threadAllowance));
  const threadEnd = -length + threadLength;
  const tip = -length;
  const chamfer = Math.min(pitch * .6, d * .08, threadLength * .10);
  group.add(turned([
    [0, tip], [pointed ? radius * .025 : core * .86, tip],
    [pointed ? core * .06 : core, tip + chamfer],
    ...(pointed ? [[core, Math.min(threadEnd, tip + d * 1.5)] as [number, number]] : []),
    [core, threadEnd], [radius, threadEnd + Math.min(pitch * .35, (0 - threadEnd) * .5)],
    [radius, 0], [0, 0],
  ], material, radial));
  const threadInset = Math.min(pitch * .4, threadLength * .14);
  group.add(screwThread(radius, core, tip + threadInset, threadEnd - threadInset, pitch, material, detail, pointed));
  if (squareNeck) {
    const neckWidth = measured(['Neck Width', 'Width of Square']) || d;
    group.add(part(new THREE.BoxGeometry(neckWidth, neckHeight, neckWidth), material, -neckHeight / 2));
    const headDiameter = measured(['Head Diameter']) || d * (/step bolt/.test(description) ? 2.7 : 2.15);
    const headHeight = measured(['Head Height']) || d * (/step bolt/.test(description) ? .38 : .53);
    const headR = headDiameter / 2;
    const points: [number, number][] = [[0, 0], [headR * .94, 0], [headR, headHeight * .1]];
    for (let i = 0; i <= 14; i++) {
      const theta = i / 14 * Math.PI / 2;
      points.push([Math.cos(theta) * headR, headHeight * (.1 + .9 * Math.sin(theta))]);
    }
    points.push([0, 0]);
    group.add(turned(points, material, radial));
  } else {
    const sides = /square head/.test(description) ? 4 : 6;
    const heavy = /heavy hex|structural/.test(description);
    const headWidth = measured(['Width Across Flats', 'Driver Size', 'Head Width']) || d * (heavy ? 1.7 : size.metric ? 1.6 : 1.5);
    const headHeight = measured(['Head Height']) || d * .64;
    const headR = headWidth / (2 * Math.cos(Math.PI / sides));
    const driven = /phillips|slotted/.test(description) && !/unslotted/.test(description);
    const headTop = driven ? headHeight * .64 : headHeight;
    const head = turned([[0, 0], [headR * .95, 0], [headR, headHeight * .10], [headR, Math.min(headHeight * .82, headTop)], [driven ? headR : headR * .85, headTop], [0, headTop]], material, sides);
    if (sides === 4) head.geometry.rotateY(Math.PI / 4);
    group.add(head);
    if (driven) addDriveCap(group, sides, headR, headHeight, headTop, /phillips/.test(description), material, darkMaterial);
    // Washer face is integral with the head, not an unrelated loose washer.
    group.add(part(new THREE.CylinderGeometry(headWidth * .48, headWidth * .48, d * .045, radial), material, -.01 * d));
    if (/flange|washer head/.test(description)) {
      const flangeRadius = (measured(['Flange Diameter', 'Washer Diameter']) || d * 2.35) / 2;
      group.add(turned([[0, 0], [flangeRadius, 0], [flangeRadius, d * .1], [headWidth * .48, d * .20], [0, d * .2]], material, radial));
    }
  }
  group.userData.dimensionSource = { diameter: size.specified ? 'catalog' : 'family-proportion', length: product?.length ? 'catalog' : 'family-proportion', pitch: 'nominal-thread-size', unlistedHeadDimensions: 'family-proportion', unlistedThreadLength: 'family-proportion' };
  if (/self.drill/.test(description)) group.userData.requiresPhotoReference = 'Drill-point flute geometry is not specified in this catalog snapshot.';
  return group;
}

/** A split washer uses a rectangular helical cross-section, not round wire. */
function splitWasher(outer: number, inner: number, thickness: number, material: THREE.Material, radial: number) {
  const positions: number[] = [], indices: number[] = [];
  const rise = thickness * 1.2, gap = .12, count = Math.max(40, radial);
  for (let i = 0; i <= count; i++) {
    const t = i / count, angle = gap / 2 + t * (Math.PI * 2 - gap), y = (t - .5) * rise;
    for (const [r, h] of [[inner, y - thickness / 2], [outer, y - thickness / 2], [outer, y + thickness / 2], [inner, y + thickness / 2]]) {
      positions.push(Math.cos(angle) * r, h, Math.sin(angle) * r);
    }
    if (i < count) for (let e = 0; e < 4; e++) {
      const a = i * 4 + e, b = i * 4 + (e + 1) % 4, c = a + 4, d = b + 4;
      indices.push(a, c, b, b, c, d);
    }
  }
  indices.push(0, 1, 2, 0, 2, 3);
  const end = count * 4; indices.push(end, end + 2, end + 1, end, end + 3, end + 2);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return part(geometry, material);
}

function tooth(root: number, tip: number, angle: number, width: number, thickness: number, material: THREE.Material) {
  // Each blade is stamped from the annulus and twisted across its width. Slots
  // remain open between the blades; the central hole is never painted over.
  const positions: number[] = [], indices: number[] = [];
  for (const sign of [-1, 1]) for (const [r, tangent, y] of [
    [root, -width / 2, 0], [root, width / 2, 0],
    [tip, width * .36, thickness * .40], [tip, -width * .36, -thickness * .40],
  ]) positions.push(Math.cos(angle) * r - Math.sin(angle) * tangent, y + sign * thickness / 2, Math.sin(angle) * r + Math.cos(angle) * tangent);
  indices.push(0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7);
  for (let e = 0; e < 4; e++) { const n = (e + 1) % 4; indices.push(e, n, e + 4, n, n + 4, e + 4); }
  if (tip < root) for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return part(geometry, material);
}

function beveledWasher(width: number, inner: number, thickness: number, material: THREE.Material, radial: number) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, -width / 2); shape.lineTo(width / 2, -width / 2);
  shape.lineTo(width / 2, width / 2); shape.lineTo(-width / 2, width / 2); shape.closePath();
  const hole = new THREE.Path();
  for (let i = radial; i >= 0; i--) {
    const a = i / radial * Math.PI * 2;
    if (i === radial) hole.moveTo(Math.cos(a) * inner, Math.sin(a) * inner); else hole.lineTo(Math.cos(a) * inner, Math.sin(a) * inner);
  }
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, steps: 1, curveSegments: radial });
  // Standard taper family silhouette; actual angle is not supplied in snapshot.
  const attribute = geometry.getAttribute('position');
  for (let i = 0; i < attribute.count; i++) {
    if (attribute.getZ(i) > thickness / 2) attribute.setZ(i, thickness * (1 + .42 * attribute.getX(i) / (width / 2)));
  }
  geometry.rotateX(-Math.PI / 2); geometry.computeVertexNormals();
  return part(geometry, material);
}

function washer(options: ModelOptions) {
  const { product, material, darkMaterial, radial } = options;
  const group = new THREE.Group(), size = sizeFor(product), d = size.diameter;
  const description = `${product?.name || ''} ${product?.subcategory || ''}`.toLowerCase();
  const measured = (keys: string[]) => dimension(specification(product, keys), size.metric);
  const knownOD = measured(['Outside Diameter', 'Outer Diameter', 'OD']);
  const knownID = measured(['Inside Diameter', 'Inner Diameter', 'ID', 'Hole Diameter']);
  const knownThickness = measured(['Thickness', 'Material Thickness']);
  const internal = /internal/.test(description), external = /external/.test(description);
  const teeth = /tooth|toothed/.test(description);
  const split = /split|helical/.test(description);
  const isCup = /countersunk|finishing|cup washer/.test(description);
  const isShoulder = /shoulder/.test(description);
  const isBonded = /bonded|sealing|epdm|neoprene/.test(description);
  const widthRatio = /fender|dock/.test(description) ? 4 : /wide series/.test(description) ? 2.7 : /narrow series/.test(description) ? 1.8 : 2.1;
  const outer = (knownOD || d * widthRatio) / 2;
  const inner = Math.min(outer * .88, (knownID || d * (size.metric ? 1.075 : 1.06)) / 2);
  const thickness = knownThickness || d * (split ? .22 : /structural|thru hard|beveled/.test(description) ? .22 : .12);
  if (split) group.add(splitWasher(outer, inner, thickness, material, radial));
  else if (/bevel/.test(description)) group.add(beveledWasher(outer * 2, inner, thickness, material, radial));
  else if (teeth) {
    const count = internal && !external ? 10 : 12;
    const toothLength = (outer - inner) * (internal && external ? .30 : .48);
    const bodyInner = internal ? inner + toothLength : inner;
    const bodyOuter = external ? outer - toothLength : outer;
    group.add(ring(bodyOuter, bodyInner, thickness, -thickness / 2, material, radial));
    for (let i = 0; i < count; i++) {
      const a = i / count * Math.PI * 2;
      if (internal) group.add(tooth(bodyInner + thickness * .05, inner, a, 2 * Math.PI * bodyInner / count * .61, thickness, material));
      if (external) group.add(tooth(bodyOuter - thickness * .05, outer, a, 2 * Math.PI * bodyOuter / count * .63, thickness, material));
    }
  } else if (isCup) {
    // Catalog finishing washer 'Thickness' describes overall cup height.
    const sheet = Math.min(thickness * .30, (outer - inner) * .16);
    group.add(turned([[inner, thickness], [inner + sheet, thickness], [outer, sheet], [outer, 0], [outer - sheet, 0], [inner, thickness - sheet], [inner, thickness]], material, radial));
  } else if (isShoulder) {
    const shoulderRadius = Math.min(outer * .76, (measured(['Shoulder Diameter', 'Barrel Diameter']) || d * 1.4) / 2);
    const shoulderHeight = measured(['Shoulder Length', 'Shoulder Height', 'Barrel Length']) || d * .58;
    group.add(ring(outer, inner, thickness, 0, material, radial));
    group.add(ring(shoulderRadius, inner, shoulderHeight, thickness * .8, material, radial));
  } else if (isBonded) {
    const sheet = knownThickness || d * .11, gasket = d * .19;
    group.add(ring(outer * .99, inner * .96, gasket, -gasket, darkMaterial, radial));
    // The shallow dished metal backing is bonded to the dark elastomer ring.
    group.add(turned([[inner, sheet * .25], [outer, 0], [outer, sheet * .75], [inner, sheet], [inner, sheet * .25]], material, radial));
  } else group.add(ring(outer, inner, thickness, -thickness / 2, material, radial));
  group.userData.dimensionSource = {
    outerDiameter: knownOD ? 'catalog' : 'family-proportion',
    innerDiameter: knownID ? 'catalog' : 'nominal-clearance',
    thickness: knownThickness ? 'catalog' : 'family-proportion',
    unlistedFormDimensions: 'family-proportion',
  };
  return group;
}

/** Dimension-aware catalog models; omitted manufacturing details remain illustrative. */
export function createDimensionHardware(kind: 'bolt' | 'carriage' | 'washer', options: ModelOptions): THREE.Group {
  const group = kind === 'washer' ? washer(options) : bolt(kind, options);
  group.name = `Dimension-aware ${kind}`;
  group.userData.representative = true;
  group.userData.hardwareKind = kind;
  return group;
}
