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
      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
      <path d="M12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
    </svg>
  `;
  iconButton.title = "TimeBlock";
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
