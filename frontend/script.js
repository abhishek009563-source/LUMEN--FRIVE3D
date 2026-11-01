/**
 * LUMEN-DRIVE 3D | VEHICLE HEADLIGHT CONTROL SIMULATOR
 * Main Application Coordinator, Polling Loop & Audit Trail Renderer
 */

(function () {
  'use strict';

  window.AppCoordinator = {
    onStateUpdated,
    showToast
  };

  let isPolling = false;
  let isCloudActive = false;
  let lastKnownState = null;

  document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize 3D Engine & Modules
    if (window.VehicleScene) window.VehicleScene.init();
    if (window.AutomotiveDashboard) window.AutomotiveDashboard.init();
    if (window.AutomotiveControls) window.AutomotiveControls.init();

    // 2. Setup Collapsible Audit Drawer
    setupAuditDrawer();

    // 3. Initial Fetch & Start Polling
    fetchInitialStatus();
    startPollingLoop();
  });

  /* ========================================================================
     Polling & State Synchronization
     ======================================================================== */
  async function fetchInitialStatus() {
    try {
      const resp = await fetch('/api/status');
      if (resp.ok) {
        const state = await resp.json();
        onStateUpdated(state);
        return;
      }
    } catch (e) {
      // Local C backend offline / running on static cloud host (Vercel)
    }

    // Fallback: Standalone Cloud ECU Simulation
    activateCloudSimulationMode();
  }

  function activateCloudSimulationMode() {
    isCloudActive = true;
    if (window.AutomotiveControls) {
      const simulated = window.AutomotiveControls.getSimulatedState();
      onStateUpdated(simulated);
    }
    const badgeText = document.querySelector('.c-badge-text');
    const badge = document.querySelector('.c-badge');
    if (badgeText && badge) {
      badgeText.textContent = 'CLOUD ECU: ACTIVE';
      badge.style.borderColor = 'rgba(0, 240, 255, 0.4)';
      badge.style.background = 'rgba(0, 240, 255, 0.12)';
      badge.style.color = 'var(--accent-cyan)';
    }
  }

  function startPollingLoop() {
    setInterval(async () => {
      if (isPolling) return;
      isPolling = true;

      if (!isCloudActive) {
        try {
          const resp = await fetch('/api/status');
          if (resp.ok) {
            const state = await resp.json();
            onStateUpdated(state);
            isPolling = false;
            return;
          } else if (resp.status === 404) {
            activateCloudSimulationMode();
          }
        } catch (err) {
          activateCloudSimulationMode();
        }
      }

      // If in Cloud Mode, execute autonomous simulation tick locally
      if (isCloudActive && window.AutomotiveControls) {
        const tickState = window.AutomotiveControls.runCloudSimulationTick();
        onStateUpdated(tickState);
      }

      isPolling = false;
    }, 750); // High responsiveness
  }

  function onStateUpdated(state) {
    if (!state) return;
    lastKnownState = state;

    // 1. Pass to 3D Scene
    if (window.VehicleScene) {
      window.VehicleScene.updateState(state);
    }

    // 2. Update Digital Cluster & Dashboard
    if (window.AutomotiveDashboard) {
      window.AutomotiveDashboard.renderTelemetry(state);
    }

    // 3. Sync Control Buttons
    if (window.AutomotiveControls) {
      window.AutomotiveControls.syncUIWithState(state);
    }

    // 4. Render Audit Events
    if (state.recent_events) {
      renderAuditEvents(state.recent_events);
    }
  }

  /* ========================================================================
     SQLite Audit Trail Table Renderer
     ======================================================================== */
  function renderAuditEvents(events) {
    const tbody = document.getElementById('audit-table-body');
    const badge = document.getElementById('log-count-badge');
    if (!tbody || !events) return;

    if (badge) {
      badge.textContent = `${events.length} Events`;
    }

    tbody.innerHTML = events.map(evt => {
      let sourceClass = 'system';
      if (evt.source === 'AUTO_SENSOR') sourceClass = 'auto';
      else if (evt.source === 'USER') sourceClass = 'user';

      return `
        <tr>
          <td>#${evt.id}</td>
          <td>${escapeHtml(evt.timestamp)}</td>
          <td><span class="source-badge ${sourceClass}">${escapeHtml(evt.source)}</span></td>
          <td><strong>${escapeHtml(evt.action)}</strong></td>
          <td>${escapeHtml(evt.details || '-')}</td>
          <td>${(evt.ambient_light || 0).toFixed(1)}%</td>
          <td><code>${escapeHtml(evt.headlight_state || 'OFF')}</code></td>
        </tr>
      `;
    }).join('');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ========================================================================
     Collapsible Drawer Handlers
     ======================================================================== */
  function setupAuditDrawer() {
    const drawer = document.getElementById('history-drawer');
    const toggleBtn = document.getElementById('drawer-toggle');
    if (!drawer || !toggleBtn) return;

    toggleBtn.addEventListener('click', () => {
      drawer.classList.toggle('expanded');
    });
  }

  /* ========================================================================
     Toast Notification System
     ======================================================================== */
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    else if (type === 'warning') icon = 'fa-triangle-exclamation';
    else if (type === 'danger') icon = 'fa-circle-xmark';

    toast.innerHTML = `
      <i class="fa-solid ${icon}"></i>
      <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'toast-out 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 2800);
  }

})();
