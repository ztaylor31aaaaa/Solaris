/* Solaris site configuration. Edit these values when creating a branded version. */
window.SOLARIS_CONFIG = Object.freeze({
  name: "Solaris",
  tagline: "Your space, your way.",
  accent: "#ffc928",
  defaultTheme: "dark",
  modules: {
    webSearch: true,
    gameLibrary: true,
    aiAssistant: true,
    feedback: true,
    changelog: true
  },
  apiBase: ""
});
document.addEventListener("DOMContentLoaded", () => {
  const config = window.SOLARIS_CONFIG;
  if (!config) return;
  document.title = config.name || "Solaris";
  document.querySelectorAll(".brand span, .crumb").forEach(el => {
    if (el.classList.contains("crumb")) el.textContent = (config.name || "Solaris").toUpperCase();
    else el.textContent = (config.name || "Solaris").toLowerCase();
  });
});
