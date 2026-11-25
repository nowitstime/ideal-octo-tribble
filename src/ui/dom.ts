// Tiny DOM helpers: h() for HTML, svg() for SVG.
type Child = Node | string | number | null | undefined | false;
type Props = Record<string, unknown>;

function apply(el: Element, props: Props) {
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.setAttribute('class', String(v));
    else if (k === 'style' && typeof v === 'object') Object.assign((el as HTMLElement).style, v);
    else if (k === 'text') el.textContent = String(v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
}

function append(el: Element, children: Child[]) {
  for (const c of children) if (c != null && c !== false) el.append(typeof c === 'number' ? String(c) : c);
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  apply(el, props);
  append(el, children);
  return el;
}

export function svg<K extends keyof SVGElementTagNameMap>(tag: K, props: Props = {}, ...children: Child[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  apply(el, props);
  append(el, children);
  return el;
}

/** Run `fn` once per animation frame until the returned stop function is called. */
export function everyFrame(fn: () => void): () => void {
  let id = 0;
  const loop = () => { fn(); id = requestAnimationFrame(loop); };
  id = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(id);
}
