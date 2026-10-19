import type { Product } from './types';

export type HardwareKind = 'socket' | 'wood' | 'pan' | 'flat' | 'carriage' | 'bolt' | 'nut' | 'washer' | 'rivet' | 'spacer' | 'pin'
  | 'stud' | 'shoulder' | 'set-screw' | 'thumb-screw' | 'wing-nut' | 'acorn-nut' | 'coupling-nut' | 'clip-nut'
  | 'retaining-ring' | 'spring-pin' | 'cotter-pin' | 'hitch-pin' | 'anchor' | 'wall-anchor' | 'toggle'
  | 'cable-tie' | 'clamp' | 'handle' | 'bottle' | 'driver-bit' | 'hex-key' | 'pliers' | 'rivet-gun';
export interface HardwareOptions { finish?: string; quality?: 'high' | 'low'; product?: Partial<Product> }

/** Style models only: these are not CAD drawings or representations of an individual SKU. */
export function classifyHardware(product: Partial<Product>): HardwareKind | null {
  const name = `${product.name ?? ''} ${product.subcategory ?? ''}`.toLowerCase();
  const head = (product.head ?? product.specs?.['Head Style'] ?? '').toLowerCase();
  const category = (product.category ?? '').toLowerCase();
  // Resolve accessories before broad fastener terms: a rivet gun is not a rivet,
  // and a hanger-bolt driver is not the bolt it installs.
  if (/adhesive|sealant|compound|super glue/.test(name)) return 'bottle';
  if (/pliers/.test(name)) return 'pliers';
  if (/pneumatic.*gun|rivet gun/.test(name)) return 'rivet-gun';
  if (/hex key|allen wrench/.test(name)) return 'hex-key';
  if (/insert bit|driver bit|bolt driver|setting tool/.test(name) && !/included/.test(name)) return 'driver-bit';
  if (/cable tie/.test(name)) return 'cable-tie';
  if (/cable clamp/.test(name)) return 'clamp';
  if (/round handle/.test(name)) return 'handle';
  if (/retaining ring/.test(name)) return 'retaining-ring';
  if (/cotter pin/.test(name)) return 'cotter-pin';
  if (/hitch.*pin|bridge.*pin/.test(name)) return 'hitch-pin';
  if (/spring pin|roll \(spring\)|coiled spring|tension bushing/.test(name)) return 'spring-pin';
  if (/toggle/.test(name)) return 'toggle';
  if (/wallboard|fluted plastic|wood screw anchor|lag screw shield/.test(name)) return 'wall-anchor';
  if (/anchor/.test(name)) return 'anchor';
  if (/spacer|standoff|jack screw/.test(name)) return 'spacer';
  if (/wing nut/.test(name)) return 'wing-nut';
  if (/acorn|cap nut/.test(name)) return 'acorn-nut';
  if (/coupling nut|threaded insert/.test(name)) return 'coupling-nut';
  if (/cage nut|clip nut|spring nut/.test(name)) return 'clip-nut';
  if (/nut|locknut/.test(name) || /nuts/.test(category)) return 'nut';
  if (/washers/.test(category)) return 'washer';
  if (/washer/.test(name) && !/screw|bolt|rivet/.test(name)) return 'washer';
  if (/rivet/.test(name)) return 'rivet';
  if (/dowel pin|straight pin/.test(name) || /pins/.test(category)) return 'pin';
  if (/stud|hanger bolt|dowel screw/.test(name)) return 'stud';
  if (/shoulder screw/.test(name)) return 'shoulder';
  if (/set screw|pipe plug/.test(name)) return 'set-screw';
  if (/thumb screw|wing screw/.test(name)) return 'thumb-screw';
  if (/carriage bolt|step bolt/.test(name)) return 'carriage';
  if (/plow bolt|elevator bolt/.test(name)) return 'flat';
  if (/hex.*bolt|hex.*cap screw|structural bolt|square head.*bolt|lag screw/.test(name) || /hex/.test(head) || /hex washer head|hex flange screw/.test(name)) return 'bolt';
  if (/socket.*cap screw|socket head screw/.test(name) && !/button|flat/.test(name)) return 'socket';
  if (/flat|bugle/.test(`${name} ${head}`)) return /wood|deck|drywall|self.tapping|concrete/.test(name) ? 'wood' : 'flat';
  if (/screw/.test(name) || /screws|sockets/.test(category)) return 'pan';
  if (/washers/.test(category)) return 'washer';
  // Unknown future inventory retains its real photo until a meaningful model
  // family is added. Never turn an unrecognized product into an arbitrary screw.
  return null;
}

