/* Neural labyrinth: only connected branches move the dot; completion loads the portrait. */
(() => {
  'use strict';
  const maze = document.getElementById('portrait-maze');
  const source = document.getElementById('nd-neural-data');
  if (!maze || !source) return;
  const { nodes, edges, start, goal, step } = JSON.parse(source.textContent);
  const neighbours = nodes.map(() => []);
  for (const [a, b] of edges) { neighbours[a].push(b); neighbours[b].push(a); }
  const drawing = maze.querySelector('svg');
  const dot = maze.querySelector('.nd-maze-dot');
  const trail = maze.querySelector('.nd-maze-trail');
  const status = document.getElementById('maze-status');
  const instructions = document.getElementById('maze-instructions');
  const figure = maze.parentElement;
  const expand = document.getElementById('nd-expand');
  const viewer = document.getElementById('nd-maze-viewer');
  const viewport = document.getElementById('nd-viewer-scroll');
  const mount = document.getElementById('nd-viewer-mount');
  const zoomIn = document.getElementById('nd-zoom-in');
  const zoomOut = document.getElementById('nd-zoom-out');
  const zoomLevel = document.getElementById('nd-zoom-level');
  const directions = { ArrowUp: [-1, 0], w: [-1, 0], ArrowRight: [0, 1], d: [0, 1], ArrowDown: [1, 0], s: [1, 0], ArrowLeft: [0, -1], a: [0, -1] };
  let position = start;
  let route = [start];
  let state = 'locked';
  let activePointer = null;
  let dragKind = null;
  let lastPoint = null;
  let lastClient = null;
  let portrait = null;
  let revealAttempt = 0;
  let zoom = 1;
  let fitWidth = 432;

  const curve = (a, b) => {
    const [x, y] = nodes[a];
    const [u, v] = nodes[b];
    const dx = u - x, dy = v - y;
    const length = Math.hypot(dx, dy);
    const bend = ((Math.min(a, b) * 37 + Math.max(a, b) * 17) % 9 - 4) * .65 * step / 12;
    const px = -dy / length * bend, py = dx / length * bend;
    return `C${x + dx * .32 + px} ${y + dy * .32 + py} ${x + dx * .68 - px} ${y + dy * .68 - py} ${u} ${v}`;
  };

  const keepInView = (centre = false) => {
    if (!viewer.open) return;
    const point = dot.getBoundingClientRect();
    const box = viewport.getBoundingClientRect();
    const x = point.left + point.width / 2, y = point.top + point.height / 2;
    const pad = Math.min(70, box.width / 4);
    let dx = 0, dy = 0;
    if (centre || x < box.left + pad || x > box.right - pad) dx = x - (box.left + box.width / 2);
    if (centre || y < box.top + pad || y > box.bottom - pad) dy = y - (box.top + box.height / 2);
    viewport.scrollLeft += dx;
    viewport.scrollTop += dy;
  };

  const paint = () => {
    const [x, y] = nodes[position];
    dot.setAttribute('cx', x);
    dot.setAttribute('cy', y);
    // A short trace provides orientation without mapping the whole solution.
    const recent = route.slice(-12);
    let path = `M${nodes[recent[0]][0]} ${nodes[recent[0]][1]}`;
    for (let i = 1; i < recent.length; i += 1) path += curve(recent[i - 1], recent[i]);
    trail.setAttribute('d', path);
    if (viewer.open && activePointer === null) requestAnimationFrame(() => keepInView());
  };

  const releasePointer = () => {
    const pointer = activePointer;
    activePointer = null;
    dragKind = null;
    lastPoint = null;
    lastClient = null;
    if (pointer !== null && maze.hasPointerCapture(pointer)) maze.releasePointerCapture(pointer);
  };

  const reset = () => {
    revealAttempt += 1;
    releasePointer();
    if (portrait) {
      portrait.onload = null;
      portrait.onerror = null;
      portrait.remove();
      portrait = null;
    }
    position = start;
    route = [start];
    state = 'locked';
    maze.dataset.state = state;
    maze.removeAttribute('aria-busy');
    maze.setAttribute('role', 'application');
    maze.setAttribute('aria-label', 'Neural line maze');
    maze.setAttribute('aria-describedby', 'maze-instructions');
    maze.tabIndex = 0;
    status.textContent = 'Returned to the starting junction.';
    paint();
  };

  const reveal = () => {
    state = 'loading';
    maze.dataset.state = state;
    maze.setAttribute('aria-busy', 'true');
    releasePointer();
    const attempt = ++revealAttempt;
    const image = new Image(586, 682);
    portrait = image;
    image.className = 'nd-portrait-photo';
    image.alt = '';
    image.decoding = 'async';
    image.onload = () => {
      if (attempt !== revealAttempt) return;
      maze.append(image);
      requestAnimationFrame(() => {
        if (attempt !== revealAttempt) return;
        state = 'revealed';
        maze.dataset.state = state;
        maze.removeAttribute('aria-busy');
        maze.setAttribute('role', 'img');
        maze.setAttribute('aria-label', 'Portrait of Nalin Dhiman');
        maze.removeAttribute('aria-describedby');
        maze.tabIndex = -1;
        status.textContent = 'Path complete. Portrait of Nalin Dhiman revealed.';
        if (viewer.open) setZoom(1);
      });
    };
    image.onerror = () => {
      if (attempt !== revealAttempt) return;
      maze.removeAttribute('aria-busy');
      state = 'error';
      maze.dataset.state = state;
      status.textContent = 'The portrait could not load. Close the enlarged view and press Escape to try again.';
    };
    image.src = '../nalin.jpeg';
  };

  const move = (next, announce = false) => {
    if (state !== 'locked' || !neighbours[position].includes(next)) return false;
    const visited = route.lastIndexOf(next);
    if (visited !== -1) route.length = visited + 1;
    else route.push(next);
    position = next;
    paint();
    if (position === goal) reveal();
    else if (announce) {
      const exits = neighbours[position].length;
      status.textContent = `Junction ${nodes[position][2] + 1}, ${nodes[position][3] + 1}. ${exits === 1 ? 'This branch ends here.' : `${exits} connections.`}`;
    }
    return true;
  };

  const localPoint = (event) => {
    const box = drawing.getBoundingClientRect();
    return { x: (event.clientX - box.left) * 432 / box.width, y: (event.clientY - box.top) * 528 / box.height };
  };

  const followPoint = (point) => {
    if (state !== 'locked') return false;
    let closest = -1, distance = step * .58;
    for (const node of [position, ...neighbours[position]]) {
      const d = Math.hypot(nodes[node][0] - point.x, nodes[node][1] - point.y);
      if (d < distance) { closest = node; distance = d; }
    }
    if (closest === -1) return false;
    return closest === position || move(closest);
  };

  const setZoom = (value) => {
    zoom = Math.max(1, Math.min(8, value));
    maze.style.width = `${fitWidth * zoom}px`;
    zoomLevel.value = `${Math.round(zoom * 100)}%`;
    zoomIn.disabled = zoom >= 8;
    zoomOut.disabled = zoom <= 1;
    requestAnimationFrame(() => keepInView(true));
  };

  const fit = () => {
    fitWidth = Math.max(200, Math.min(viewport.clientWidth - 48, (viewport.clientHeight - 48) * 432 / 528, 780));
    setZoom(zoom);
  };

  if (typeof viewer.showModal === 'function') {
    expand.hidden = false;
    expand.addEventListener('click', () => {
      releasePointer();
      mount.append(maze, instructions, status);
      viewer.showModal();
      document.documentElement.classList.add('nd-viewer-open');
      zoom = 1;
      fit();
      maze.focus({ preventScroll: true });
    });
    viewer.addEventListener('close', () => {
      releasePointer();
      figure.insertBefore(maze, expand);
      figure.append(instructions, status);
      maze.style.removeProperty('width');
      document.documentElement.classList.remove('nd-viewer-open');
      expand.focus({ preventScroll: true });
    });
    document.getElementById('nd-viewer-close').addEventListener('click', () => viewer.close());
    zoomIn.addEventListener('click', () => setZoom(zoom * 1.5));
    zoomOut.addEventListener('click', () => setZoom(zoom / 1.5));
    window.addEventListener('resize', () => { if (viewer.open) fit(); });
  }

  maze.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (viewer.open) viewer.close(); else reset();
      return;
    }
    if (state !== 'locked') return;
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (route.length > 1) move(route[route.length - 2], true);
      return;
    }
    const direction = directions[event.key] || directions[event.key.toLowerCase()];
    if (!direction) return;
    event.preventDefault();
    const [dr, dc] = direction;
    const next = neighbours[position].find((node) => nodes[node][2] === nodes[position][2] + dr && nodes[node][3] === nodes[position][3] + dc);
    if (next === undefined) status.textContent = 'No connecting branch in that direction.';
    else move(next, true);
  });

  maze.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || !event.isPrimary || activePointer !== null || state !== 'locked') return;
    const point = localPoint(event);
    const onPath = followPoint(point);
    if (state !== 'locked' || (!onPath && !viewer.open)) return;
    maze.focus({ preventScroll: true });
    activePointer = event.pointerId;
    dragKind = onPath ? 'path' : 'pan';
    lastPoint = point;
    lastClient = { x: event.clientX, y: event.clientY };
    maze.setPointerCapture(activePointer);
    event.preventDefault();
  });

  maze.addEventListener('pointermove', (event) => {
    if (event.pointerId !== activePointer || state !== 'locked') return;
    if (dragKind === 'pan') {
      viewport.scrollLeft += lastClient.x - event.clientX;
      viewport.scrollTop += lastClient.y - event.clientY;
      lastClient = { x: event.clientX, y: event.clientY };
      return;
    }
    if (!lastPoint) return;
    const point = localPoint(event), from = lastPoint;
    const samples = Math.max(1, Math.ceil(Math.hypot(point.x - from.x, point.y - from.y) / (step / 5)));
    for (let i = 1; i <= samples && state === 'locked'; i += 1) {
      followPoint({ x: from.x + (point.x - from.x) * i / samples, y: from.y + (point.y - from.y) * i / samples });
    }
    if (state === 'locked') lastPoint = point;
  });
  maze.addEventListener('pointerup', (event) => {
    if (event.pointerId === activePointer) { releasePointer(); keepInView(); }
  });
  maze.addEventListener('pointercancel', (event) => { if (event.pointerId === activePointer) releasePointer(); });
  maze.addEventListener('lostpointercapture', (event) => {
    if (event.pointerId === activePointer) { activePointer = null; dragKind = null; lastPoint = null; lastClient = null; }
  });

  instructions.hidden = false;
  maze.classList.add('is-ready');
  maze.setAttribute('role', 'application');
  maze.setAttribute('aria-label', 'Neural line maze');
  maze.setAttribute('aria-describedby', 'maze-instructions');
  maze.setAttribute('aria-keyshortcuts', 'ArrowUp ArrowRight ArrowDown ArrowLeft W A S D Backspace Escape');
  maze.tabIndex = 0;
})();
