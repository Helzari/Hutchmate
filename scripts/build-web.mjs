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
fs.writeFileSync(path.join(out,'index.html'),html);
console.log('www/ built');
