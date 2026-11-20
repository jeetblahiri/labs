/* Native details remain readable without JavaScript. Hashes link to individual poems. */
(() => {
  'use strict';
  const poems = [...document.querySelectorAll('.np-poem')];
  const byId = new Map(poems.map((poem) => [poem.id, poem]));
  const hashId = () => {
    try { return decodeURIComponent(window.location.hash.slice(1)); }
    catch { return ''; }
  };
  let openingFromHash = false;
  const setHash = (id) => {
    try { history.replaceState(null, '', `#${id}`); }
    catch { /* Reading still works when history is unavailable. */ }
  };
  const openHash = () => {
    const poem = byId.get(hashId());
    if (!poem) return;
    openingFromHash = true;
    for (const other of poems) other.open = other === poem;
    requestAnimationFrame(() => {
      poem.scrollIntoView({ block: 'start', behavior: 'instant' });
      openingFromHash = false;
    });
  };
  for (const poem of poems) {
    const summary = poem.querySelector('summary');
    const close = poem.querySelector('.np-close');
    close.hidden = false;
    close.addEventListener('click', () => {
      poem.open = false;
      summary.focus({ preventScroll: true });
      poem.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
    poem.addEventListener('toggle', () => {
      if (poem.open) {
        for (const other of poems) if (other !== poem) other.open = false;
        if (!openingFromHash) {
          setHash(poem.id);
          requestAnimationFrame(() => poem.scrollIntoView({ block: 'start', behavior: 'instant' }));
        }
      } else if (hashId() === poem.id && !poems.some((other) => other.open)) {
        setHash(poem.closest('.np-language-section').id);
      }
    });
  }
  window.addEventListener('hashchange', openHash);
  openHash();
  // Webfonts can change the position of a linked poem after the first paint.
  if (document.fonts) document.fonts.ready.then(() => {
    const poem = byId.get(hashId());
    if (poem && poem.open) poem.scrollIntoView({ block: 'start', behavior: 'instant' });
  });
})();
