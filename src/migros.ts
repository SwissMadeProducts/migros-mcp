import { publicRequest } from './public-http.js';
const base = 'https://www.migros.ch';
let token:string|null = null;
let tokenFlight:Promise<string>|null = null;
async function getToken():Promise<string> {
  if(token)return token;
  if(tokenFlight)return tokenFlight;
  tokenFlight=(async()=>{
    const r=await publicRequest(`${base}/authentication/public/v1/api/guest?authorizationNotRequired=true`);
    const t=r.headers.leshopch;
    if(typeof t!=='string'||!t)throw new Error('Anonymous guest token unavailable');
    token=t;return t;
  })().finally(()=>{tokenFlight=null;});
  return tokenFlight;
}
async function api(path:string,body?:unknown):Promise<any> {
  for(let attempt=0;attempt<2;attempt++) {
    try {return (await publicRequest(base+path,{method:body===undefined?'GET':'POST',body,guestToken:await getToken()})).data;}
    catch(error) {
      if(attempt===0 && /HTTP (401|403)$/.test((error as Error).message)){token=null;continue;}
      throw error;
    }
  }
}
export async function searchProducts(query:string,language:string):Promise<{productIds:string[];numberOfProducts:number}> {
  const r=await api('/onesearch-oc-seaapi/public/v5/search',{regionId:'national',language,productIds:[],query,sortFields:[],sortOrder:'asc',algorithm:'DEFAULT'});
  return {productIds:(r.productIds??[]).map(String),numberOfProducts:r.numberOfProducts??0};
}
export async function getProductDetails(ids:string[]):Promise<unknown[]> {
  const params=new URLSearchParams({warehouseId:'1',storeType:'OFFLINE',region:'national'});
  params.set(ids.every(id=>/^\d{12,}$/.test(id))?'migrosIds':'uids',ids.join(','));
  return await api(`/product-display/public/v2/product-detail?${params}`)??[];
}
export async function getStock(productId:string,storeId:string):Promise<{catalogItemId:string;stock:number|null}> {
  if(!/^\d+$/.test(productId)||!/^\d+$/.test(storeId))throw new Error('Stock requires numeric product and store IDs');
  const r=await api(`/store-availability/public/v2/availabilities/products/${productId}?${new URLSearchParams({costCenterIds:storeId})}`);
  const match=r?.availabilities?.find((a:{id:string})=>a.id===storeId);
  return {catalogItemId:r?.catalogItemId??productId,stock:match?.stock??null};
}
export async function getCategories():Promise<unknown> {throw new Error('The upstream category endpoint is unavailable');}
export async function searchStores(query:string):Promise<unknown[]> {
  return await api(`/store/public/v1/stores/search?${new URLSearchParams({query})}`)??[];
}
export async function getPromotions(query:string):Promise<unknown> {
  const r=await api('/product-display/public/web/v2/products/promotion/search',{storeType:'OFFLINE',period:'CURRENT',language:'de',filters:{},sortFields:['categoryLevel'],sortOrder:'asc',from:0,until:100,region:'national',warehouse:'1',query});
  return r?.items??[];
}
export {searchRecipes,getRecipeDetails,getRecipeProducts} from './migusto.js';
