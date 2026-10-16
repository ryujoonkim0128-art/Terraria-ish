// Renders every style into its phone frame, one after another.
const frames = [...document.querySelectorAll('[data-style]')];
for (const el of frames) {
  try {
    const m = await import(`./${el.dataset.style}.js`);
    await m.render(el.querySelector('.screen'));
    el.classList.add('ready');
  } catch (e) {
    el.querySelector('.screen').textContent = 'This style could not render here: ' + e.message;
  }
}
window.done = true;
