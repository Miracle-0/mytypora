import { marked } from 'marked';
import DOMPurify from 'dompurify';
import './style.css';
import { createLiveEditor, setSourceMode, jumpTo } from './live-editor.js';

const icons = {
sidebar:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
code:'<path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-14-2 18"/>',
chevron:'<path d="m9 5 7 7-7 7"/>',
plus:'<path d="M12 5v14M5 12h14"/>',
more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
file:'<path d="M14 3H5v18h14V8zM14 3v6h5M8 13h8M8 17h6"/>',
moon:'<path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z"/>',
check:'<path d="m5 12 4 4L19 6"/>',
arrow:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const welcome = `# A little space to think.

Good ideas start with a blank page. This is yours.

Welcome to **Paper**, a quiet place for your words. Write in Markdown and watch your thoughts take shape, without anything getting in the way.

## Just you and your words

Write anywhere on the page. Markdown formats as you type; move your cursor into formatted text to reveal its syntax, and move away to let it fade.

> Simplicity boils down to two steps: identify the essential. Eliminate the rest.
>
> — Leo Babauta

## Make yourself at home

- **Make a point** with bold, or add a little *emphasis*.
- Organize your thoughts with headings and lists.
- Keep your code, quotes, and ideas together.

### A small plan for today

- [x] Find a little space to think
- [ ] Write down something worth remembering
- [ ] See where it takes you

## A place for the details

Sometimes, a few lines of code say it best.

\`\`\`javascript
const idea = "Something wonderful";

function begin() {
  return oneSmallStep(idea);
}
\`\`\`

---

Take your time. The page is yours.
`;
let docs;
try { docs = JSON.parse(localStorage.getItem('paper-docs')); } catch {}
if (!Array.isArray(docs) || !docs.length) docs = [{id:Date.now(),name:'Welcome',text:welcome}];
let current = docs[0];
let view = null;
const editorStates = new Map();
let sourceMode = false, tokens = [], sidebar = window.innerWidth > 1000;
const app = document.querySelector('#app');
app.innerHTML = `<header class="titlebar"><div class="brand"><span class="brand-mark">p<span>.</span></span><span>Paper</span></div><button class="document-title" title="Rename document"><span id="title"></span><span class="saved-dot"></span></button><div class="window-tools"><button id="theme" class="icon-button" title="Toggle dark theme">${icon('moon')}</button><button id="menu-toggle" class="icon-button" title="Document actions">${icon('more')}</button></div></header>
<div class="workspace"><aside class="sidebar"><div class="sidebar-heading"><span>WORKSPACE</span><button id="new" class="icon-button" title="New document">${icon('plus')}</button></div><div id="files"></div><div class="outline-heading">ON THIS PAGE</div><nav id="outline"></nav><div class="sidebar-bottom"><span class="local-dot"></span> Saved on this device</div></aside><main><div class="toolbar"><div class="toolbar-left"><button id="sidebar-toggle" class="icon-button" title="Toggle sidebar">${icon('sidebar')}</button><span class="toolbar-divider"></span><span id="breadcrumb">Welcome</span></div><div class="toolbar-right"><span class="mode-label">Live preview</span><button id="source-toggle" class="icon-button" title="Toggle Markdown source (⌘⇧M)">${icon('code')}</button><span class="toolbar-divider"></span><button id="export" class="export-button">${icon('arrow')}<span>Export</span></button></div></div><div class="scroll-area"><article class="paper"><div class="document-meta"><span id="doc-label">YOUR PERSONAL CANVAS</span><span>MARKDOWN</span></div><div id="editor"></div><button id="append" title="Add paragraph">Click here to keep writing…</button><div class="page-end"><span></span><span>✧</span><span></span></div></article></div><footer><div><span class="status-check">${icon('check')}</span><span id="save-status">All changes saved</span></div><div><span id="words"></span><span class="footer-dot">·</span><span id="reading"></span><span class="footer-divider"></span><span>Markdown</span></div></footer></main></div>
<div id="menu" hidden><button id="new-menu">New document <kbd>⌘ N</kbd></button><button id="open">Open Markdown…</button><button id="rename">Rename document</button><hr><button id="download">Export Markdown <kbd>⌘ S</kbd></button><button id="html-export">Export HTML</button><button id="focus">Toggle focus mode</button></div><input id="file-input" type="file" accept=".md,.markdown,.txt" hidden><div id="toast" role="status"></div><dialog id="rename-dialog"><form method="dialog"><h2>Rename document</h2><input id="name-input" aria-label="Document name" required maxlength="100"><div><button value="cancel">Cancel</button><button id="rename-save" value="save">Save</button></div></form></dialog>`;
const $ = s => document.querySelector(s);
const clean = text => DOMPurify.sanitize(marked.parse(text));
function save(){
 try {localStorage.setItem('paper-docs',JSON.stringify(docs));$('#save-status').textContent='All changes saved';} catch {$('#save-status').textContent='Storage full — export to save';}
 stats();
}
function stats(){const n=(current.text.match(/[\p{Script=Han}]|[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)||[]).length;$('#words').textContent=`${n} words`;$('#reading').textContent=`${Math.max(1,Math.ceil(n/220))} min read`;}
function renderFiles(){ $('#files').replaceChildren(...docs.map(d=>{const b=document.createElement('button');b.className='file-item'+(d===current?' selected':'');b.innerHTML=icon('file');const s=document.createElement('span');s.textContent=d.name;b.append(s);b.onclick=()=>{commit();current=d;render();};return b;}));}
function render(){$('#title').textContent=current.name;$('#breadcrumb').textContent=current.name;document.title=`${current.name} — Paper`;renderFiles();renderEditor();stats();}
function renderEditor(){
 if (view) view.destroy();
 view=createLiveEditor($('#editor'), current.text, text=>{current.text=text;save();outline();}, sourceMode);
 if(editorStates.has(current.id)) view.setState(editorStates.get(current.id));
 setSourceMode(view, sourceMode);updateMode();outline();
}
function commit(){if(view) editorStates.set(current.id,view.state);}
function updateMode(){
 $('#append').hidden=sourceMode;
 $('#source-toggle').classList.toggle('active',sourceMode);
 $('.mode-label').textContent=sourceMode?'Markdown source':'Live preview';
}
function outline(){
 tokens=marked.lexer(current.text);const nav=$('#outline');nav.innerHTML='';let offset=0;
 tokens.forEach(t=>{const from=offset;offset+=t.raw.length;if(t.type!=='heading')return;
 const b=document.createElement('button');b.textContent=t.text.replace(/[*_`]/g,'');b.style.paddingLeft=(16+(t.depth-1)*12)+'px';
 b.onclick=()=>{if(sourceMode){sourceMode=false;setSourceMode(view,false);updateMode();}jumpTo(view,from);};nav.append(b);});
}
function newDoc(){commit();sourceMode=false;current={id:Date.now(),name:'Untitled',text:''};docs.unshift(current);save();render();view.focus();}
function toggleSource(){sourceMode=!sourceMode;setSourceMode(view,sourceMode);updateMode();view.focus();}
function download(html=false){commit();const body=html?`<!doctype html><meta charset="utf-8"><title>${DOMPurify.sanitize(current.name)}</title><style>body{max-width:760px;margin:60px auto;font:17px/1.8 Georgia;padding:24px}pre,blockquote{background:#f6f6f6;padding:20px}table{border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px}img{max-width:100%}</style>${clean(current.text)}`:current.text;const url=URL.createObjectURL(new Blob([body],{type:html?'text/html':'text/markdown'}));const a=document.createElement('a');a.href=url;a.download=current.name.replace(/[/\\]/g,'-')+(html?'.html':'.md');a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('#menu').hidden=true;toast('Document exported');}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');setTimeout(()=>$('#toast').classList.remove('visible'),2200);}
function rename(){ $('#menu').hidden=true;$('#name-input').value=current.name;$('#rename-dialog').showModal();$('#name-input').select();}
$('#rename-dialog').addEventListener('close',()=>{if($('#rename-dialog').returnValue==='save'){commit();current.name=$('#name-input').value.trim()||'Untitled';save();render();}});
$('#append').onclick=()=>{const end=view.state.doc.length;const insert=end?'\n\n':'';view.dispatch({changes:{from:end,insert},selection:{anchor:end+insert.length},userEvent:'input'});view.focus();};
$('#new').onclick=$('#new-menu').onclick=newDoc;
$('#sidebar-toggle').onclick=()=>{sidebar=!sidebar;document.body.classList.toggle('sidebar-hidden',!sidebar);};
$('#source-toggle').onclick=toggleSource;
$('#export').onclick=$('#download').onclick=()=>download();$('#html-export').onclick=()=>download(true);
$('#rename').onclick=$('.document-title').onclick=rename;
$('#theme').onclick=()=>{document.body.classList.toggle('dark');localStorage.setItem('paper-theme',document.body.classList.contains('dark')?'dark':'light');};
$('#menu-toggle').onclick=e=>{e.stopPropagation();$('#menu').hidden=!$('#menu').hidden;};document.addEventListener('click',e=>{if(!e.target.closest('#menu'))$('#menu').hidden=true;});
$('#focus').onclick=()=>{document.body.classList.toggle('focus');$('#menu').hidden=true;};
$('#open').onclick=()=>$('#file-input').click();$('#file-input').onchange=async e=>{const file=e.target.files[0];if(!file)return;commit();current={id:Date.now(),name:file.name.replace(/\.(md|markdown|txt)$/i,''),text:await file.text()};docs.unshift(current);save();render();e.target.value='';};
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='s'){e.preventDefault();download();}if((e.metaKey||e.ctrlKey)&&e.shiftKey&&e.key.toLowerCase()==='m'){e.preventDefault();toggleSource();}if(e.key==='Escape')document.body.classList.remove('focus');});
document.body.classList.toggle('sidebar-hidden',!sidebar);document.body.classList.toggle('dark',localStorage.getItem('paper-theme')==='dark');render();
