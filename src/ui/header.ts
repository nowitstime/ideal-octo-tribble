import { h } from './dom';

const backIcon = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 10H4M9 5l-5 5 5 5"/></svg>';

/** Back arrow, title and Play / Settings tabs for an instrument page. */
export function instrumentHeader(route: string, title: string, sub: string, tab: 'play' | 'set'): HTMLElement {
  const back = h('a', { class: 'icon-btn', href: '#/', 'aria-label': 'Back to map' });
  back.innerHTML = backIcon;
  return h('div', { class: 'inst-head' },
    h('div', { class: 'inst-top' },
      back,
      h('nav', { class: 'tabs' },
        h('a', { href: `#/${route}`, class: tab === 'play' ? 'on' : '', text: 'Play' }),
        h('a', { href: `#/${route}/set`, class: tab === 'set' ? 'on' : '', text: 'Settings' }),
      ),
    ),
    h('div', { class: 'inst-title' }, h('h1', { text: title }), h('span', { class: 'mono muted', text: sub })),
  );
}

/** Update the small subtitle next to an instrument's title (e.g. after a sound change). */
export function setSubtitle(text: string) {
  const el = document.querySelector('.inst-title .mono');
  if (el) el.textContent = text;
}

export function backHeader(title: string, action?: HTMLElement): HTMLElement {
  const back = h('a', { class: 'icon-btn', href: '#/', 'aria-label': 'Back to map' });
  back.innerHTML = backIcon;
  return h('div', { class: 'inst-head' },
    h('div', { class: 'inst-top' }, back, action ?? h('span')),
    h('div', { class: 'inst-title' }, h('h1', { text: title })),
  );
}
