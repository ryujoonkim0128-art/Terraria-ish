// If something breaks, say what instead of leaving a frozen screen: the error, and a way to reload or start a new
// garden. A plain script that runs before everything else, so it also notices a file that fails to load.
(function () {
  var shown = false;
  function show(msg) {
    if (shown) return;
    shown = true;
    var d = document.createElement('div');
    d.id = 'crash';
    d.innerHTML = '<div class="blk box"><b>Something went wrong</b><p>Try reloading. If it keeps happening, a screenshot of this helps fix it.</p><pre></pre>' +
      '<div class="btns"><button class="blk" data-a="reload">Reload</button><button class="blk red" data-a="reset">Start over</button></div></div>';
    d.querySelector('pre').textContent = String(msg || 'Unknown error').slice(0, 700);
    d.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      // tapping outside the box keeps playing
      if (!b) { if (!e.target.closest('.box')) { d.remove(); shown = false; } return; }
      if (b.getAttribute('data-a') === 'reset') {
        if (!b.getAttribute('data-sure')) { b.setAttribute('data-sure', '1'); b.textContent = 'Erase garden?'; return; }
        try { localStorage.removeItem('voxel-garden-save-v3'); } catch (_) { /* storage blocked */ }
      }
      location.reload();
    });
    (document.getElementById('app') || document.body).appendChild(d);
  }
  window.addEventListener('error', function (e) {
    var t = e.target;
    // a font or picture that fails to load is fine; a script that fails to load is not
    if (t && t !== window) { if (t.tagName === 'SCRIPT') show('Could not load ' + (t.src || 'a script')); return; }
    show(e.error && e.error.stack ? e.error.message + '\n' + e.error.stack : e.message);
  }, true);
  window.addEventListener('load', function () { setTimeout(function () { if (!window.game) show('The game did not start.'); }, 15000); });
  window.crashReport = function (e) { show(e && e.stack ? e.message + '\n' + e.stack : e); };
})();
