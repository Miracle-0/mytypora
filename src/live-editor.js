import { EditorState, StateField, StateEffect } from '@codemirror/state';
import { EditorView, Decoration, WidgetType, keymap, placeholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const modeEffect = StateEffect.define();
const focusEffect = StateEffect.define();
const compositionEffect = StateEffect.define();

class MarkerWidget extends WidgetType {
  constructor(text, from, task = null) { super(); Object.assign(this, {text, from, task}); }
  eq(other) { return this.text === other.text && this.from === other.from && this.task === other.task; }
  toDOM(view) {
    if (this.task !== null) {
      const box = document.createElement('input');
      box.type = 'checkbox'; box.checked = this.task; box.className = 'live-task';
      box.setAttribute('aria-label', 'Toggle task');
      box.addEventListener('mousedown', e => e.preventDefault());
      box.addEventListener('click', () => {
        view.dispatch({changes: {from: this.from + 1, to: this.from + 2, insert: box.checked ? 'x' : ' '}, userEvent: 'input'});
      });
      return box;
    }
    const span = document.createElement('span'); span.className = 'live-bullet'; span.textContent = this.text; return span;
  }
  ignoreEvent() { return this.task !== null; }
}
class RenderWidget extends WidgetType {
  constructor(raw, from, kind) { super(); Object.assign(this, {raw, from, kind}); }
  eq(other) { return this.raw === other.raw && this.from === other.from && this.kind === other.kind; }
  toDOM(view) {
    const dom = document.createElement(this.kind === 'Image' ? 'span' : 'div'); dom.className = 'live-rendered md-block';
    dom.innerHTML = DOMPurify.sanitize(this.kind === 'Image' ? marked.parseInline(this.raw) : marked.parse(this.raw));
    dom.setAttribute('aria-label', `Edit ${this.kind}`); dom.title = 'Click to edit Markdown';
    dom.addEventListener('mousedown', e => {e.preventDefault(); view.dispatch({selection: {anchor: this.from}}); view.focus();});
    return dom;
  }
  ignoreEvent() { return true; }
}

// Decorations change the presentation only. The original Markdown remains the
// single document, so selection, undo, clipboard and IME use CodeMirror's model.
function decorate(state, tree, focused, source, composing) {
  if (source) return Decoration.none;
  const ranges = [];
  const add = (from, to, spec) => { if (to > from) ranges.push(Decoration.mark(spec).range(from, to)); };
  const hide = (from, to, widget) => { if (to > from) ranges.push(Decoration.replace(widget ? {widget} : {}).range(from, to)); };
  const touches = (from, to) => composing || (focused && state.selection.ranges.some(r => r.from <= to && r.to >= from));
  const activeLine = pos => {const line = state.doc.lineAt(pos); return touches(line.from, line.to);};
  const lineClasses = new Map();
  const lineClass = (pos, cls) => {const start = state.doc.lineAt(pos).from; lineClasses.set(start, `${lineClasses.get(start) || ''} ${cls}`);};
  const lines = (from, to, cls) => {for (let n=state.doc.lineAt(from).number; n<=state.doc.lineAt(to).number; n++) lineClass(state.doc.line(n).from, cls);};
  tree.iterate({enter(node) {
    const {from, to, name} = node;
    const syntax = node.node;
    if (/^(Table|HorizontalRule)$/.test(name) && !touches(from, to)) {
      ranges.push(Decoration.replace({widget: new RenderWidget(state.sliceDoc(from, to), from, name), block: true}).range(from, to));
      return false;
    }
    if (name === 'Image' && !touches(from, to)) {
      hide(from, to, new RenderWidget(state.sliceDoc(from, to), from, name)); return false;
    }
    if (/^ATXHeading[1-6]$/.test(name)) lineClass(from, 'live-h' + name.slice(-1));
    if (/^SetextHeading/.test(name)) lineClass(from, 'live-h' + name.slice(-1));
    if (name === 'Blockquote') lines(from, to, 'live-quote');
    if (name === 'FencedCode' || name === 'CodeBlock') {
      lines(from, to, 'live-code-line');
      if (name === 'FencedCode' && !touches(from, to)) {
        for(let child=syntax.firstChild;child;child=child.nextSibling) {
          if(child.name === 'CodeMark') {
            const line=state.doc.lineAt(child.from);hide(line.from,line.to);
            lineClass(line.from,'live-fence');
          }
        }
      }
    }
    if (name === 'StrongEmphasis') add(from, to, {class: 'live-strong'});
    if (name === 'Emphasis') add(from, to, {class: 'live-em'});
    if (name === 'Strikethrough') add(from, to, {class: 'live-strike'});
    if (name === 'InlineCode') add(from, to, {class: 'live-inline-code'});
    if (name === 'Link') {
      add(from, to, {class: 'live-link'});
      if (!touches(from, to)) {
        const children = []; for(let child=syntax.firstChild;child;child=child.nextSibling) children.push(child);
        const marks = children.filter(c => c.name === 'LinkMark');
        if (marks.length >= 2) {hide(marks[0].from, marks[0].to);hide(marks[1].from, to);}
      }
    }
    if (name === 'HeaderMark') {
      if (!activeLine(from)) {
        const end = state.doc.lineAt(to).to;
        hide(from, to + (state.sliceDoc(to, to + 1) === ' ' && to < end ? 1 : 0));
      } else add(from, to, {class:'live-syntax'});
    }
    if (name === 'EmphasisMark' || name === 'StrikethroughMark' || (name === 'CodeMark' && syntax.parent?.name === 'InlineCode')) {
      const parent = syntax.parent;
      if (parent && !touches(parent.from, parent.to)) hide(from, to);
      else add(from, to, {class:'live-syntax'});
    }
    if (name === 'ListMark' && !activeLine(from)) {
      const raw = state.sliceDoc(from, to);
      hide(from, to, new MarkerWidget(/^\d/.test(raw) ? raw : '•', from));
    }
    if (name === 'QuoteMark' && !activeLine(from)) hide(from, to);
    if (name === 'TaskMarker' && !activeLine(from)) hide(from, to, new MarkerWidget('', from, /x/i.test(state.sliceDoc(from, to))));
    if (name === 'Task' && /^\[[xX]\]/.test(state.sliceDoc(from, from + 3))) add(from, to, {class:'live-completed'});
  }});
  for(let n=1;n<=state.doc.lines;n++) {const line=state.doc.line(n);if(!line.length) lineClass(line.from,'live-empty');}
  for (const [from, cls] of lineClasses) ranges.push(Decoration.line({attributes:{class:cls.trim()}}).range(from));
  return Decoration.set(ranges, true);
}
const liveField = StateField.define({
  create(state) {
    const tree = markdownLanguage.parser.parse(state.doc.toString());
    return {tree, focused:false, source:false, composing:false, decorations:decorate(state, tree, false, false, false)};
  },
  update(value, tr) {
    let {tree, focused, source, composing} = value;
    let changed = tr.docChanged || !!tr.selection;
    if (tr.docChanged) tree = markdownLanguage.parser.parse(tr.newDoc.toString());
    for (const effect of tr.effects) {
      if (effect.is(modeEffect)) {source=effect.value;changed=true;}
      if (effect.is(focusEffect)) {focused=effect.value;changed=true;}
      if (effect.is(compositionEffect)) {composing=effect.value;changed=true;}
    }
    if (!changed) return value;
    return {tree, focused, source, composing, decorations:decorate(tr.state, tree, focused, source, composing)};
  },
  provide: field => EditorView.decorations.from(field, v => v.decorations)
});

export function createLiveEditor(parent, text, onChange, source=false) {
  const view = new EditorView({parent, state:EditorState.create({doc:text, extensions:[
    markdown({base:markdownLanguage, completeHTMLTags:false}),
    history(), keymap.of([...defaultKeymap, ...historyKeymap]),
    syntaxHighlighting(defaultHighlightStyle), EditorView.lineWrapping,
    placeholder('Start writing…'), liveField,
    EditorView.contentAttributes.of({'aria-label':'Markdown editor', spellcheck:'true'}),
    EditorView.focusChangeEffect.of((state, focused) => focusEffect.of(focused)),
    EditorView.domEventHandlers({
      compositionstart: (event, view) => {view.dispatch({effects:compositionEffect.of(true)});},
      compositionend: (event, view) => {setTimeout(() => {if(view.dom.isConnected) view.dispatch({effects:compositionEffect.of(false)});}, 0);}
    }),
    EditorView.updateListener.of(update => {if(update.docChanged) onChange(update.state.doc.toString());})
  ]})});
  setSourceMode(view, source);
  return view;
}
export function setSourceMode(view, source) {
  view.dispatch({effects:modeEffect.of(source)});
  view.dom.classList.toggle('source-mode', source);
}
export function jumpTo(view, from) {
  view.dispatch({selection:{anchor:from}, effects:EditorView.scrollIntoView(from, {y:'center'})}); view.focus();
}
