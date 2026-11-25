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

/**
 * Low-latency pointer moves. Chrome's `pointerrawupdate` arrives as soon as the
 * touch moves instead of waiting for the next frame; plain `pointermove` is the
 * fallback. Duplicates (same pointer, not newer) are dropped.
 */
export function onMove(el: Element, fn: (e: PointerEvent) => void) {
  const last = new Map<number, number>();
  const handler = (ev: Event) => {
    const e = ev as PointerEvent;
    if ((last.get(e.pointerId) ?? -1) >= e.timeStamp) return;
    last.set(e.pointerId, e.timeStamp);
    fn(e);
  };
  if ('onpointerrawupdate' in window) el.addEventListener('pointerrawupdate', handler);
  el.addEventListener('pointermove', handler);
}

/** Run `fn` once per animation frame until the returned stop function is called. */
export function everyFrame(fn: () => void): () => void {
  let id = 0;
  const loop = () => { fn(); id = requestAnimationFrame(loop); };
  id = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(id);
}
