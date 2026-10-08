// Runs before first paint (loaded from layout.tsx) so the page never flashes the
// wrong color mode or role colors. Keep in sync with src/lib/colorMode.ts.
(function () {
  var root = document.documentElement;
  try {
    var mode = localStorage.getItem('gaea_color_mode');
    if (mode !== 'light' && mode !== 'system') mode = 'dark';
    if (mode === 'system') {
      mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    root.dataset.theme = mode;

    var vars = JSON.parse(localStorage.getItem('gaea_role_vars') || '{}');
    for (var name in vars) {
      if (name.indexOf('--role-') === 0) root.style.setProperty(name, vars[name]);
    }
  } catch {
    root.dataset.theme = 'dark';
  }
})();
