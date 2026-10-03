export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '/CounterSideViewer_Main';
export const MAIN_BASE_PATH = process.env.NEXT_PUBLIC_MAIN_BASE_PATH ?? '/CounterSideViewer_Main';
export const MINIGAMES_BASE_PATH = process.env.NEXT_PUBLIC_MINIGAMES_BASE_PATH ?? '/CounterSideViewer_Minigames';
export const MODULE: string = 'main';
export function deploymentUrl(url:string):string {
  if (!url.startsWith('/') || url.startsWith('//') || !BASE_PATH || url===BASE_PATH || url.startsWith(BASE_PATH+'/')) return url;
  return BASE_PATH+url;
}
export function deploymentData<T>(data:T):T {
  if (typeof data==='string') return (/^\/(?:minigames|equipment|operator|ships?|collection|unit|ui|story|music|spine|assets)(?:\/|$)/.test(data) ? deploymentUrl(data) : data) as T;
  if (Array.isArray(data)) return data.map(deploymentData) as T;
  if (data && typeof data==='object') return Object.fromEntries(Object.entries(data).map(([k,v])=>[k,deploymentData(v)])) as T;
  return data;
}
export function siteLink(href:string):{href:string;external:boolean} {
  if (!href.startsWith('/') || href.startsWith('//')) return {href,external:/^https?:/.test(href)};
  const raw=BASE_PATH && (href===BASE_PATH || href.startsWith(BASE_PATH+'/')) ? href.slice(BASE_PATH.length)||'/' : href;
  const mini=/^\/minigames(?:\/|$)/.test(raw);
  const owned=MODULE==='minigames' ? mini : !mini;
  return owned ? {href:raw,external:false} : {href:(mini?MINIGAMES_BASE_PATH:MAIN_BASE_PATH)+raw,external:true};
}
