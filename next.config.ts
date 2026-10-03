import type { NextConfig } from 'next';
const config:NextConfig={output:'export',trailingSlash:true,basePath:process.env.NEXT_PUBLIC_BASE_PATH??'/CounterSideViewer_Main',images:{unoptimized:true},experimental:{cpus:4}};
export default config;
