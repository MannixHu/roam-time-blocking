/**
 * Shared utility functions
 */

// Escape special characters for use in RegExp
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Check if a color is light (for text contrast)
export function isLightColor(hex: string): boolean {
  const color = hex.replace("#", "");
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);
  // Using relative luminance formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

// Check if a date is today
export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

// Simple toast notification (uses console + optional DOM notification)
let toastContainer: HTMLDivElement | null = null;

export function showToast(message: string, type: "success" | "error" | "info" = "info"): void {
  // Always log to console
  const logMethod = type === "error" ? console.error : type === "success" ? console.log : console.info;
  logMethod(`[TimeBlock] ${message}`);

  // Create toast container if not exists
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "timeblock-toast-container";
    toastContainer.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
    `;
    document.body.appendChild(toastContainer);
  }

  // Create toast element
  const toast = document.createElement("div");
  const bgColor = type === "error" ? "#e53935" : type === "success" ? "#43a047" : "#1976d2";
  toast.style.cssText = `
    background: ${bgColor};
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 12px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    opacity: 0;
    transform: translateX(100%);
    transition: all 0.3s ease;
    pointer-events: auto;
  `;
  toast.textContent = message;

  toastContainer.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateX(0)";
  });

  // Auto remove after 3 seconds
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

// Cleanup toast container (call on sidebar unmount to prevent memory leaks)
export function cleanupToastContainer(): void {
  if (toastContainer && toastContainer.parentNode) {
    toastContainer.parentNode.removeChild(toastContainer);
  }
  toastContainer = null;
}
