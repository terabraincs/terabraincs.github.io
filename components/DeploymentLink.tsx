import Link from 'next/link';
import type { ComponentProps } from 'react';
import {siteLink} from '@/lib/deployment';
export default function DeploymentLink(props:ComponentProps<typeof Link>) {
 if(typeof props.href!=='string') return <Link {...props}/>;
 const link=siteLink(props.href);
 if(!link.external) return <Link {...props} href={link.href}/>;
 const {prefetch,replace,scroll,shallow,locale,onNavigate,...anchor}=props;
 return <a {...anchor} href={link.href}/>;
}
