import Image, {type ImageProps} from 'next/image';
import {deploymentUrl} from '@/lib/deployment';
export default function DeploymentImage(props:ImageProps) {return <Image {...props} src={typeof props.src==='string'?deploymentUrl(props.src):props.src}/>;}
