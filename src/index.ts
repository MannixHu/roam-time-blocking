import type { RoamExtensionAPI } from "./types";
import { registerSettingsPanel, loadSettings } from "./settings/settingsPanel";
import { renderSidebar, unmountSidebar } from "./ui/CalendarSidebar";
import "./ui/styles.css";

let cleanupFunctions: (() => void)[] = [];

function onload({ extensionAPI }: { extensionAPI: RoamExtensionAPI }): void {
  console.log("[TimeBlock] Loading extension...");

  // Register settings panel
  registerSettingsPanel(extensionAPI);

  // Load settings
  const settings = loadSettings(extensionAPI);
  console.log("[TimeBlock] Settings loaded:", settings);

  // Create sidebar button in topbar
  const button = createTopbarButton(() => {
    toggleSidebar(extensionAPI);
  });

  // Add button to topbar
  const topbar = document.querySelector(".rm-topbar");
  if (topbar) {
    const spacer = topbar.querySelector(".rm-topbar__spacer-sm");
    if (spacer) {
      topbar.insertBefore(button, spacer);
    } else {
      topbar.appendChild(button);
    }
  }

  cleanupFunctions.push(() => {
    button.remove();
    unmountSidebar();
  });

  console.log("[TimeBlock] Extension loaded successfully");
}

function onunload(): void {
  console.log("[TimeBlock] Unloading extension...");
  cleanupFunctions.forEach((fn) => fn());
  cleanupFunctions = [];
  console.log("[TimeBlock] Extension unloaded");
}

function createTopbarButton(onClick: () => void): HTMLSpanElement {
  const button = document.createElement("span");
  button.id = "timeblock-topbar-button";
  button.className = "bp3-popover-wrapper";
  button.style.marginRight = "4px";

  const inner = document.createElement("span");
  inner.className = "bp3-popover-target";

  const iconButton = document.createElement("span");
  iconButton.className = "bp3-button bp3-minimal bp3-small";
  iconButton.setAttribute("tabindex", "0");
  iconButton.innerHTML = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/>
      <rect x="7" y="12" width="4" height="2"/>
      <rect x="7" y="16" width="4" height="2"/>
      <rect x="13" y="12" width="4" height="2"/>
    </svg>
  `;
  iconButton.title = "TimeBlock Calendar";
  iconButton.onclick = onClick;

  inner.appendChild(iconButton);
  button.appendChild(inner);

  return button;
}

let sidebarOpen = false;

function toggleSidebar(extensionAPI: RoamExtensionAPI): void {
  if (sidebarOpen) {
    unmountSidebar();
    sidebarOpen = false;
  } else {
    // Ensure right sidebar is open
    window.roamAlphaAPI.ui.rightSidebar.open();
    renderSidebar(extensionAPI);
    sidebarOpen = true;
  }
}

export default {
  onload,
  onunload,
};
