document.addEventListener("DOMContentLoaded", async () => {
  window.NATLTheme?.init();
  try {
    await window.NATLI18n?.init();
  } catch (err) {
    console.error(err);
    const main = document.querySelector("[data-i18n-html]");
    if (main) {
      main.innerHTML =
        "<p>Failed to load translations. Check <code>docs/i18n/*.json</code>.</p>";
    }
  }
});
