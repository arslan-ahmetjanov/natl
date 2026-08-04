(function () {
  const lightVars = {
    darkMode: false,
    background: "#f1f5f9",
    primaryColor: "#14b8a6",
    primaryTextColor: "#0f172a",
    primaryBorderColor: "#0d9488",
    secondaryColor: "#e2e8f0",
    tertiaryColor: "#f8fafc",
    lineColor: "#64748b",
    textColor: "#0f172a",
    mainBkg: "#ccfbf1",
    nodeBorder: "#0d9488",
    clusterBkg: "#f1f5f9",
    clusterBorder: "#cbd5e1",
    titleColor: "#0f172a",
    edgeLabelBackground: "#ffffff",
    fontFamily: "IBM Plex Sans, Segoe UI, sans-serif",
  };

  const darkVars = {
    darkMode: true,
    background: "#1e293b",
    primaryColor: "#14b8a6",
    primaryTextColor: "#f1f5f9",
    primaryBorderColor: "#2dd4bf",
    secondaryColor: "#334155",
    tertiaryColor: "#0f172a",
    lineColor: "#94a3b8",
    textColor: "#f1f5f9",
    mainBkg: "#134e4a",
    nodeBorder: "#2dd4bf",
    clusterBkg: "#1e293b",
    clusterBorder: "#334155",
    titleColor: "#f1f5f9",
    edgeLabelBackground: "#1e293b",
    fontFamily: "IBM Plex Sans, Segoe UI, sans-serif",
  };

  let loading = null;
  let seq = 0;
  let renderGen = 0;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Failed to load " + src));
      document.head.appendChild(s);
    });
  }

  async function loadMermaid() {
    if (window.mermaid) return window.mermaid;
    if (loading) return loading;
    loading = (async () => {
      const sources = [
        "assets/js/vendor/mermaid.min.js",
        "https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js",
        "https://cdnjs.cloudflare.com/ajax/libs/mermaid/11.4.1/mermaid.min.js",
      ];
      let lastErr;
      for (const src of sources) {
        try {
          await loadScript(src);
          if (window.mermaid) return window.mermaid;
        } catch (err) {
          lastErr = err;
        }
      }
      throw lastErr || new Error("Mermaid failed to load");
    })();
    return loading;
  }

  function isDark() {
    return document.documentElement.getAttribute("data-theme") === "dark";
  }

  function collectTargets() {
    return [...document.querySelectorAll("[data-mermaid], pre.mermaid, div.mermaid")].filter(
      (el) => !el.closest("svg"),
    );
  }

  function readSource(el) {
    if (el.dataset.source) return el.dataset.source;
    const raw = (el.textContent || "").trim();
    el.dataset.source = raw;
    return raw;
  }

  async function renderOne(mermaid, el, source) {
    const id = "natl-mmd-" + ++seq;
    const out = await mermaid.render(id, source);
    el.innerHTML = out.svg;
    el.setAttribute("data-rendered", "1");
    el.classList.add("mermaid");
    el.classList.remove("mermaid-pending");
  }

  async function render() {
    const targets = collectTargets();
    if (!targets.length) return;

    const myGen = ++renderGen;
    let mermaid;
    try {
      mermaid = await loadMermaid();
    } catch (err) {
      targets.forEach((el) => {
        el.classList.add("mermaid-error");
        el.textContent =
          "Diagram failed to load. Check network or assets/js/vendor/mermaid.min.js";
      });
      throw err;
    }
    if (myGen !== renderGen) return;

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "loose",
      theme: "base",
      themeVariables: isDark() ? darkVars : lightVars,
      flowchart: {
        curve: "basis",
        padding: 14,
        htmlLabels: false,
        useMaxWidth: true,
      },
    });

    for (const el of targets) {
      if (myGen !== renderGen) return;
      const source = readSource(el);
      if (!source) continue;
      el.classList.add("mermaid-pending");
      try {
        await renderOne(mermaid, el, source);
      } catch (err) {
        console.error("Mermaid render failed", err);
        el.classList.add("mermaid-error");
        el.textContent = source;
      }
    }
  }

  window.NATLMermaid = { render };

  document.addEventListener("natl:content", () => {
    render().catch((err) => console.error(err));
  });
  document.addEventListener("natl:theme", () => {
    // Drop cached SVG so theme variables re-apply from source text
    collectTargets().forEach((el) => {
      if (el.dataset.source) {
        el.textContent = el.dataset.source;
        el.removeAttribute("data-rendered");
      }
    });
    render().catch((err) => console.error(err));
  });
})();
