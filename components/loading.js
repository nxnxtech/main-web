
(function () {
  window.NxNxComponents = window.NxNxComponents || {};

  window.NxNxComponents.loadingState = function (label, options) {
    const opts = options || {};
    const fullWidth = opts.fullWidth ? ' style="grid-column:1 / -1;"' : '';
    const safeLabel = String(label || 'Loading…');

    return `
      <div class="loading-state"${fullWidth} role="status" aria-live="polite">
        <span class="loading-spinner" aria-hidden="true"></span>
        <span class="loading-label">${safeLabel}</span>
      </div>
    `;
  };
})();