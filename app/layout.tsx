import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'카운터사이드 웹뷰어',description:'카운터사이드 웹뷰어'};
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="ko"><body>{children}</body></html>; }
