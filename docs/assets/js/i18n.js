(function () {
  const LANG_KEY = "natl-lang";
  const langs = ["en", "ru", "zh", "es"];

  function detect() {
    const saved = localStorage.getItem(LANG_KEY);
    if (langs.includes(saved)) return saved;
    const nav = (navigator.language || "en").toLowerCase();
    if (nav.startsWith("ru")) return "ru";
    if (nav.startsWith("zh")) return "zh";
    if (nav.startsWith("es")) return "es";
    return "en";
  }

  async function load(lang) {
    const res = await fetch(`i18n/${lang}.json`, { cache: "no-cache" });
    if (!res.ok) throw new Error(`Missing locale ${lang}`);
    return res.json();
  }

  function fill(dict) {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const val = key.split(".").reduce((o, k) => (o == null ? o : o[k]), dict);
      if (typeof val === "string") el.textContent = val;
    });
    document.querySelectorAll("[data-i18n-html]").forEach((el) => {
      const key = el.getAttribute("data-i18n-html");
      const val = key.split(".").reduce((o, k) => (o == null ? o : o[k]), dict);
      if (typeof val === "string") el.innerHTML = val;
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      const val = key.split(".").reduce((o, k) => (o == null ? o : o[k]), dict);
      if (typeof val === "string") el.setAttribute("placeholder", val);
    });
    const page = document.body.dataset.page || "home";
    const title = dict.pages?.[page]?.title || dict.meta?.title || "NATL";
    document.title = `${title} · NATL`;
    document.documentElement.lang = dict.meta?.htmlLang || "en";
  }

  window.NATLI18n = {
    async init() {
      const select = document.querySelector("[data-lang-select]");
      let lang = detect();
      if (select) select.value = lang;

      async function apply(next) {
        lang = next;
        localStorage.setItem(LANG_KEY, lang);
        const dict = await load(lang);
        fill(dict);
        if (select) select.value = lang;
        document.querySelector("[data-theme-toggle]")?.setAttribute(
          "data-light",
          dict.ui?.themeLight || "Light",
        );
        document.querySelector("[data-theme-toggle]")?.setAttribute(
          "data-dark",
          dict.ui?.themeDark || "Dark",
        );
        document.querySelector("[data-theme-toggle]")?.setAttribute(
          "data-label",
          dict.ui?.theme || "Theme",
        );
        // refresh theme button label
        const theme = document.documentElement.getAttribute("data-theme") || "light";
        const btn = document.querySelector("[data-theme-toggle]");
        if (btn) {
          btn.dataset.light = dict.ui?.themeLight || "Light";
          btn.dataset.dark = dict.ui?.themeDark || "Dark";
          btn.textContent = theme === "dark" ? btn.dataset.light : btn.dataset.dark;
        }
      }

      select?.addEventListener("change", (e) => apply(e.target.value));
      await apply(lang);
    },
  };
})();
