import type {CatalogTaxonomy,TaxonomyGroup,TaxonomyType} from "./types";
export class CatalogInputError extends Error {}
const normalize=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,"");
export function taxonomyGroups(taxonomy:CatalogTaxonomy):TaxonomyGroup[]{return [...taxonomy.groups,...(taxonomy.collections||[])];}
export function taxonomyProductIds(taxonomy:CatalogTaxonomy):string[]{return [...new Set(taxonomyGroups(taxonomy).flatMap((group)=>group.types.flatMap((type)=>type.productIds||[])))];}
export function findTaxonomyGroup(taxonomy:CatalogTaxonomy,value:string):TaxonomyGroup|undefined {
  const aliases:Record<string,string>={pins:"pinsbushings",socketproducts:"sockets",socketscrews:"sockets",militaryspecification:"milspec",militaryspec:"milspec"};
  const key=aliases[normalize(value)]||normalize(value);
  return taxonomyGroups(taxonomy).find((group)=>normalize(group.id)===key||normalize(group.name)===key);
}
export function findTaxonomyType(taxonomy:CatalogTaxonomy,value:string):TaxonomyType|undefined {
  const matches=taxonomyGroups(taxonomy).flatMap((group)=>group.types).filter((type)=>type.id===value);
  if(!matches.length)return undefined;
  return {...matches[0],productIds:[...new Set(matches.flatMap((type)=>type.productIds||[]))]};
}
function groupIds(group:TaxonomyGroup):Set<string>{return new Set(group.types.flatMap((type)=>type.productIds||[]));}
export function resolveTaxonomySelection(taxonomy:CatalogTaxonomy,options:{group?:string;type?:string;category?:string}):{ids:Set<string>|null;category:string;group:string|null;type:string|null} {
  let ids:Set<string>|null=null,category=options.category||"",groupId:string|null=null,typeId:string|null=null;
  const apply=(next:Set<string>)=>{ids=ids===null?next:new Set([...ids].filter((id)=>next.has(id)));};
  if(options.group){const group=findTaxonomyGroup(taxonomy,options.group);if(!group)throw new CatalogInputError("Unknown catalog group.");groupId=group.id;apply(groupIds(group));}
  if(options.type){const type=findTaxonomyType(taxonomy,options.type);if(!type)throw new CatalogInputError("Unknown catalog type.");typeId=type.id;apply(new Set(type.productIds||[]));}
  if(category){
    const mapped=findTaxonomyGroup(taxonomy,category);
    const combined=normalize(category)==="spacersstandoffs"?taxonomyGroups(taxonomy).filter((g)=>["spacers","standoffs"].includes(normalize(g.name))):[];
    if(mapped){apply(groupIds(mapped));category="";groupId=groupId||mapped.id;}
    else if(combined.length){apply(new Set(combined.flatMap((g)=>[...groupIds(g)])));category="";}
    else {const types=taxonomyGroups(taxonomy).flatMap((g)=>g.types).filter((t)=>normalize(t.name)===normalize(category)||normalize(t.id)===normalize(category));if(types.length){apply(new Set(types.flatMap((t)=>t.productIds||[])));category="";typeId=typeId||types[0].id;}}
  }
  return {ids,category,group:groupId,type:typeId};
}
export function withTaxonomyCounts(taxonomy:CatalogTaxonomy,availableIds:Set<string>):CatalogTaxonomy {
  const enrich=(group:TaxonomyGroup):TaxonomyGroup=>{
    const types=group.types.map((type)=>{const count=new Set((type.productIds||[]).filter((id)=>availableIds.has(id))).size;return {...type,skuCount:count,imported:count>0,importStatus:count>0?"sample-imported":"not-imported"};});
    const count=new Set(types.flatMap((type)=>type.productIds||[]).filter((id)=>availableIds.has(id))).size;
    return {...group,types,skuCount:count};
  };
  const groups=taxonomy.groups.map(enrich),collections=(taxonomy.collections||[]).map(enrich);
  return {...taxonomy,groups,collections,complete:false,mappedProductCount:taxonomyProductIds(taxonomy).filter((id)=>availableIds.has(id)).length,totalTypeCount:groups.reduce((sum,g)=>sum+g.types.length,0),uniqueTypeCount:new Set(groups.flatMap((g)=>g.types.map((t)=>t.id))).size};
}
