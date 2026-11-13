// Copies src/index.html into www/, swapping Google Fonts for bundled offline fonts.
import fs from 'node:fs'; import path from 'node:path';
const out='www', fdir=path.join(out,'fonts'); fs.mkdirSync(fdir,{recursive:true});
const fonts=[['Young Serif','young-serif',[400]],['Figtree','figtree',[400,500,600,700]],['JetBrains Mono','jetbrains-mono',[400,600]]];
let css='';
for(const [fam,pkg,ws] of fonts) for(const w of ws){
  const f=`${pkg}-latin-${w}-normal.woff2`;
  fs.copyFileSync(`node_modules/@fontsource/${pkg}/files/${f}`, path.join(fdir,f));
  css+=`@font-face{font-family:"${fam}";font-style:normal;font-weight:${w};font-display:swap;src:url(fonts/${f}) format("woff2")}\n`;
}
let html=fs.readFileSync('src/index.html','utf8');
html=html.replace(/<link rel="preconnect"[^>]*>\n?/,'').replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/,`<style>\n${css}</style>`);
if(html.includes('fonts.googleapis')) throw new Error('font link not replaced');
// Stamp the build number (set by GitHub Actions) so the app can tell when a newer build exists.
const build=parseInt(process.env.BUILD_NUMBER||'0',10)||0;
if(!html.includes('const APP_BUILD = 0; /*__APP_BUILD__*/')) throw new Error('build marker missing');
html=html.replace('const APP_BUILD = 0; /*__APP_BUILD__*/',`const APP_BUILD = ${build};`);
// Installable web app (Cloudflare site): manifest, icons and an offline service worker.
html=html.replace('</head>',`<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#6A3E66">
<link rel="icon" href="icon-192.png">
<link rel="apple-touch-icon" href="icon-192.png">
<script>if('serviceWorker' in navigator && location.protocol==='https:' && !window.Capacitor){ addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{})); }</script>
</head>`);
fs.writeFileSync(path.join(out,'manifest.webmanifest'),JSON.stringify({name:'Hutchmate',short_name:'Hutchmate',description:'Genetics, litters & health for rabbits and guinea pigs',start_url:'./',scope:'./',display:'standalone',background_color:'#F3F5F0',theme_color:'#6A3E66',
  icons:[{src:'icon-192.png',sizes:'192x192',type:'image/png'},{src:'icon-512.png',sizes:'512x512',type:'image/png'},{src:'icon-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}]},null,1));
try{ const sharp=(await import('sharp')).default; for(const n of [192,512]) await sharp('assets/icon-only.png').resize(n,n).png().toFile(path.join(out,`icon-${n}.png`)); }
catch(e){ console.warn('icons skipped:',e.message); }
const stamp=Date.now();
fs.writeFileSync(path.join(out,'sw.js'),`// Network first so updates arrive straight away; cached copy when offline.
const C='hutchmate-${stamp}';
self.addEventListener('install',e=>{ self.skipWaiting(); e.waitUntil(caches.open(C).then(c=>c.addAll(['./','manifest.webmanifest','icon-192.png',${fonts.flatMap(([f,pkg,ws])=>ws.map(w=>`'fonts/${pkg}-latin-${w}-normal.woff2'`)).join(',')}]).catch(()=>{}))); });
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{ const r=e.request; if(r.method!=='GET' || new URL(r.url).origin!==location.origin) return;
  e.respondWith(fetch(r).then(res=>{ if(res.ok){ const cp=res.clone(); caches.open(C).then(c=>c.put(r,cp)); } return res; }).catch(()=>caches.match(r,{ignoreSearch:true}).then(m=>m||caches.match('./')))); });
`);
fs.writeFileSync(path.join(out,'index.html'),html);
console.log('www/ built');
