(function () {
  const KEY = "natl-theme";
  const root = document.documentElement;

  function preferred() {
    const saved = localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function apply(theme) {
    root.setAttribute("data-theme", theme);
    localStorage.setItem(KEY, theme);
    const btn = document.querySelector("[data-theme-toggle]");
    if (btn) {
      const next = theme === "dark" ? "light" : "dark";
      btn.textContent = btn.dataset[next] || next;
      btn.setAttribute("aria-label", btn.dataset.label || "Theme");
    }
  }

  window.NATLTheme = {
    init() {
      apply(preferred());
      document.querySelector("[data-theme-toggle]")?.addEventListener("click", () => {
        apply(root.getAttribute("data-theme") === "dark" ? "light" : "dark");
      });
    },
  };
})();
