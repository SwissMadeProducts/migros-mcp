import { load } from 'cheerio';

const recipeSlugs = new Map<string, string>();
const base = 'https://migusto.migros.ch';
const locales: Record<string, {recipes:string; overview:string}> = {
  de: {recipes:'rezepte',overview:'rezept-uebersicht'},
  fr: {recipes:'recettes',overview:'apercu-des-recettes'},
  it: {recipes:'ricette',overview:'panoramica-delle-ricette'},
};
function locale(language = 'de') { return locales[language] ? language : 'de'; }
async function page(path:string) {
  const res = await fetch(base + path, {signal:AbortSignal.timeout(15_000)});
  if(!res.ok) throw new Error(`Migusto returned HTTP ${res.status}`);
  const html = await res.text();
  if(html.length > 5_000_000) throw new Error('Migusto response too large');
  return {html, $:load(html), url:res.url};
}
function structured($:ReturnType<typeof load>): Record<string, any>[] {
  return $('script[type="application/ld+json"]').toArray().flatMap(el=>{
    try {const d=JSON.parse($(el).text());return Array.isArray(d)?d:d['@graph']??[d];} catch {return [];}
  });
}
function serverData($:ReturnType<typeof load>): string {
  return $('script').toArray().map(el=>{
    const match=$(el).text().match(/^self\.__next_f\.push\((\[.*\])\)$/s);
    if(!match)return '';
    try {const [type,text]=JSON.parse(match[1]);return type===1&&typeof text==='string'?text:'';}catch{return '';}
  }).join('').replace(/\\+"/g,'"');
}

export async function searchRecipes(args:{searchTerm?:string;ingredients?:string[];language?:string;limit?:number;offset?:number}) {
  const lang=locale(args.language), limit=args.limit??20, offset=args.offset??0;
  // Migusto's new overview exposes its public search as q, with 24 results/page.
  const query=[args.searchTerm,...(args.ingredients??[])].filter(Boolean).join(' ');
  const first=Math.floor(offset/24)+1, last=Math.floor((offset+limit-1)/24)+1;
  const pages=await Promise.all(Array.from({length:last-first+1},(_,i)=>page(`/${lang}/${locales[lang].overview}?${new URLSearchParams({q:query,page:String(first+i)})}`)));
  let total:number|undefined;
  const recipes=pages.flatMap(({ $ })=>{
    const count=serverData($).match(/"resultsCount":(\d+)/);
    if(count)total=Number(count[1]);
    const list=structured($).find(d=>d['@type']==='ItemList');
    if(!list && total!==0)throw new Error('Migusto recipe search format changed');
    return (list?.itemListElement??[]).map((entry:{url:string})=>{
      const u=new URL(entry.url);const parts=u.pathname.split('/');
      const a=$('a').filter((_,el)=>$(el).attr('href')===u.pathname).first();
      const id=parts.at(-1)!; const slug=parts.slice(-2).join('/');
      if(recipeSlugs.size>1000)recipeSlugs.clear();
      recipeSlugs.set(id,slug);
      return {id,slug,title:a.find('img').first().attr('alt')??parts.at(-2)?.replace(/-/g,' '),url:u.href};
    });
  });
  return {total,recipes:recipes.slice(offset%24,offset%24+limit)};
}

async function recipePage(slug:string,language?:string) {
  const lang=locale(language);
  // Old callers may provide a slug without its numeric ID.
  if(!slug.includes('/')) {
    const found=await searchRecipes({searchTerm:slug.replace(/-/g,' '),language:lang,limit:24});
    const match=found.recipes.find((r:{slug:string})=>r.slug.split('/')[0]===slug);
    if(!match)throw new Error('Recipe not found; use the slug including its numeric ID from search_recipes');
    slug=match.slug;
  }
  return page(`/${lang}/${locales[lang].recipes}/${slug}`);
}
export async function getRecipeDetails(args:{slug:string;language?:string}) {
  const {$,url}=await recipePage(args.slug,args.language);
  const parts=new URL(url).pathname.split('/');
  recipeSlugs.set(parts.at(-1)!,parts.slice(-2).join('/'));
  const d=structured($).find(d=>d['@type']==='Recipe');
  if(!d)throw new Error('Recipe not found or Migusto recipe format changed');
  return {id:new URL(url).pathname.split('/').at(-1),url,name:d.name,description:d.description,keywords:d.keywords,author:d.author,aggregateRating:d.aggregateRating,images:d.image,totalTime:d.totalTime,recipeCategory:d.recipeCategory,recipeCuisine:d.recipeCuisine,recipeInstructions:d.recipeInstructions?.map((step:any)=>typeof step==='string'?step:step.text),recipeYield:d.recipeYield,recipeIngredients:d.recipeIngredient,nutrition:d.nutrition,datePublished:d.datePublished};
}
export async function getRecipeProducts(args:{id:string;slug?:string;language?:string;limit?:number;offset?:number}) {
  if(!/^\d+$/.test(args.id))throw new Error('Use the numeric recipe ID from search_recipes');
  const lang=locale(args.language);
  const slug=args.slug??recipeSlugs.get(args.id);
  if(!slug || !/^[a-zA-Z0-9-]+\/\d+$/.test(slug) || slug.split('/').at(-1)!==args.id)throw new Error('Pass the recipe slug from search_recipes along with its numeric recipeId');
  const {$}=await recipePage(slug,lang);
  const match=serverData($).match(/"productIds":(\[[\d",\s]*\])/);
  if(!match)throw new Error('Migusto ingredient products unavailable for this recipe');
  const ids=JSON.parse(match[1]) as string[];
  return {productIds:ids.slice(args.offset??0,(args.offset??0)+(args.limit??50)),idType:'migrosId',hint:'Use get_product_details with these Migros IDs to see ingredient products.'};
}
