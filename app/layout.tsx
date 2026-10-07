import type { Metadata } from 'next';
import { mainImageAssetUrl } from '@/lib/mainImageAssets';
import './globals.css';
export const metadata: Metadata = {title:'카운터사이드 웹뷰어',description:'카운터사이드 웹뷰어',icons:{icon:mainImageAssetUrl('/favicon.ico')}};
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="ko"><body>{children}</body></html>; }
