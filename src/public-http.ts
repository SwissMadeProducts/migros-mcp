import axios from 'axios';
import { Agent } from 'node:https';

const migrosPaths = new Map([
  ['/authentication/public/v1/api/guest', 'GET'],
  ['/onesearch-oc-seaapi/public/v5/search', 'POST'],
  ['/product-display/public/v2/product-detail', 'GET'],
  ['/store/public/v1/stores/search', 'GET'],
  ['/product-display/public/web/v2/products/promotion/search', 'POST'],
]);

/** Default-deny destination and route validation for all application API calls. */
export function assertPublicDestination(input: string, method: string): URL {
  const url = new URL(input);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) throw new Error('Outbound destination blocked');
  const migros = url.hostname === 'www.migros.ch' && (
    migrosPaths.get(url.pathname) === method ||
    (method === 'GET' && /^\/store-availability\/public\/v2\/availabilities\/products\/\d+$/.test(url.pathname))
  );
  const migusto = url.hostname === 'migusto.migros.ch' && method === 'GET' && (
    /^\/(de\/rezept-uebersicht|fr\/apercu-des-recettes|it\/panoramica-delle-ricette)$/.test(url.pathname) ||
    /^\/(de\/rezepte|fr\/recettes|it\/ricette)\/[a-zA-Z0-9-]+\/\d+$/.test(url.pathname)
  );
  if (!migros && !migusto) throw new Error('Outbound destination blocked');
  return url;
}

const client = axios.create({
  httpsAgent: new Agent({minVersion:'TLSv1.3'}),
  timeout:15_000,
  maxRedirects:0,
  maxContentLength:5_000_000,
  maxBodyLength:65_536,
  proxy:false,
});

/** Fixed headers only: never forward host cookies, auth, IPs, or MCP headers. */
export async function publicRequest(input:string, options:{method?:'GET'|'POST';body?:unknown;guestToken?:string;asText?:boolean} = {}) {
  const method=options.method??'GET';
  const url=assertPublicDestination(input,method);
  const headers: Record<string,string> = {
    accept: options.asText ? 'text/html' : 'application/json',
    'User-Agent':'Mozilla/5.0 (X11; Linux x86_64; rv:144.0) Gecko/20100101 Firefox/144.0',
  };
  if(options.body!==undefined) headers['Content-Type']='application/json';
  if(options.guestToken) {
    if(url.hostname!=='www.migros.ch')throw new Error('Guest token destination blocked');
    headers.leshopch=options.guestToken;
  }
  try {
    return await client.request({url:url.href,method,headers,data:options.body,responseType:options.asText?'text':'json'});
  } catch(error) {
    const status=axios.isAxiosError(error)?error.response?.status:undefined;
    throw new Error(status ? `Public grocery API returned HTTP ${status}` : 'Public grocery API unavailable');
  }
}
