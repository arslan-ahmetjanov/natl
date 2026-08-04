(function () {
  const light = {
    theme: "base",
    themeVariables: {
      darkMode: false,
      background: "#ffffff",
      primaryColor: "#14b8a6",
      primaryTextColor: "#0f172a",
      primaryBorderColor: "#0d9488",
      secondaryColor: "#f1f5f9",
      tertiaryColor: "#e2e8f0",
      lineColor: "#64748b",
      textColor: "#0f172a",
      mainBkg: "#f8fafc",
      nodeBorder: "#14b8a6",
      clusterBkg: "#f1f5f9",
      clusterBorder: "#cbd5e1",
      titleColor: "#0f172a",
      edgeLabelBackground: "#ffffff",
      fontFamily: "IBM Plex Sans, Segoe UI, sans-serif",
    },
  };

  const dark = {
    theme: "base",
    themeVariables: {
      darkMode: true,
      background: "#0f172a",
      primaryColor: "#14b8a6",
      primaryTextColor: "#f1f5f9",
      primaryBorderColor: "#2dd4bf",
      secondaryColor: "#1e293b",
      tertiaryColor: "#334155",
      lineColor: "#94a3b8",
      textColor: "#f1f5f9",
      mainBkg: "#1e293b",
      nodeBorder: "#14b8a6",
      clusterBkg: "#1e293b",
      clusterBorder: "#334155",
      titleColor: "#f1f5f9",
      edgeLabelBackground: "#1e293b",
      fontFamily: "IBM Plex Sans, Segoe UI, sans-serif",
    },
  };

  let ready = null;

  function loadMermaid() {
    if (window.mermaid) return Promise.resolve(window.mermaid);
    if (ready) return ready;
    ready = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";
      s.async = true;
      s.onload = () => resolve(window.mermaid);
      s.onerror = () => reject(new Error("Failed to load Mermaid"));
      document.head.appendChild(s);
    });
    return ready;
  }

  function themeConfig() {
    const theme = document.documentElement.getAttribute("data-theme") || "light";
    return theme === "dark" ? dark : light;
  }

  async function render() {
    const nodes = [...document.querySelectorAll("pre.mermaid, .mermaid")];
    if (!nodes.length) return;

    const mermaid = await loadMermaid();
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      flowchart: { curve: "basis", padding: 12, htmlLabels: true },
      ...themeConfig(),
    });

    for (const el of nodes) {
      if (!el.dataset.source) {
        el.dataset.source = el.textContent.trim();
      }
      el.removeAttribute("data-processed");
      el.removeAttribute("data-mermaid-id");
      // Reset to source text (theme switch replaces SVG)
      if (el.getAttribute("data-rendered") === "1") {
        el.innerHTML = "";
        el.textContent = el.dataset.source;
      }
      el.classList.add("mermaid");
    }

    await mermaid.run({ nodes });
    nodes.forEach((el) => el.setAttribute("data-rendered", "1"));
  }

  window.NATLMermaid = { render };

  document.addEventListener("natl:content", () => {
    render().catch((err) => console.error(err));
  });
  document.addEventListener("natl:theme", () => {
    render().catch((err) => console.error(err));
  });
})();
