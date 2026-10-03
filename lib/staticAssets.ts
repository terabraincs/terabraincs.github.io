import {deploymentUrl} from './deployment';
export function createSoundAssetUrl(...parts:string[]) { return deploymentUrl('/assets/sound/'+parts.map(encodeURIComponent).join('/')); }
