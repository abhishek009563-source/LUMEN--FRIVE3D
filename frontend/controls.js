/**
 * LUMEN-DRIVE 3D | VEHICLE HEADLIGHT CONTROL SIMULATOR
 * Interactive Control Panel Handlers & REST API Communicator
 */

(function () {
  'use strict';

  window.AutomotiveControls = {
    init,
    syncUIWithState
  };

  let currentState = null;
  let isDraggingSlider = false;

  function init() {
    bindPowerButton();
    bindModeButtons();
    bindAutoAndSliders();
    bindIndicatorButtons();
    bindEnvironmentButtons();
    bindCameraButtons();
    bindKeyboardShortcuts();
  }

  /* ========================================================================
     REST API Fetch Helpers
     ======================================================================== */
  async function postAPI(endpoint, payload) {
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }
      const data = await resp.json();
      if (window.AppCoordinator) {
        window.AppCoordinator.onStateUpdated(data);
      }
      return data;
    } catch (e) {
      console.error(`[API ERROR] ${endpoint}:`, e);
      if (window.AppCoordinator) {
        window.AppCoordinator.showToast(`Command Failed: ${e.message}`, 'danger');
      }
    }
  }

  /* ========================================================================
     Control Binders
     ======================================================================== */
  function bindPowerButton() {
    const btn = document.getElementById('btn-master-power');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const targetPower = currentState && currentState.power ? 0 : 1;
      postAPI('/api/headlights/power', { power: targetPower });
      if (window.AppCoordinator) {
        window.AppCoordinator.showToast(
          targetPower ? 'Master Power Energized (C Unit)' : 'Headlights Power Cut Off',
          targetPower ? 'success' : 'warning'
        );
      }
    });
  }

  function bindModeButtons() {
    const btns = document.querySelectorAll('.mode-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        postAPI('/api/headlights/mode', { mode });
        if (window.AppCoordinator) {
          window.AppCoordinator.showToast(`Lighting Mode: ${mode.replace('_', ' ')}`, 'success');
        }
      });
    });
  }

  function bindAutoAndSliders() {
    const toggleAuto = document.getElementById('toggle-auto-mode');
    if (toggleAuto) {
      toggleAuto.addEventListener('change', (e) => {
        const autoMode = e.target.checked ? 1 : 0;
        postAPI('/api/headlights/automatic', { auto_mode: autoMode });
        if (window.AppCoordinator) {
          window.AppCoordinator.showToast(
            autoMode ? 'Automatic Photocell Sensing Active' : 'Switched to Manual Control',
            'success'
          );
        }
      });
    }

    const sliderLux = document.getElementById('input-ambient-lux');
    const readoutLux = document.getElementById('slider-lux-val');
    if (sliderLux) {
      sliderLux.addEventListener('mousedown', () => { isDraggingSlider = true; });
      sliderLux.addEventListener('touchstart', () => { isDraggingSlider = true; });
      sliderLux.addEventListener('input', (e) => {
        if (readoutLux) readoutLux.textContent = `${e.target.value}%`;
      });
      sliderLux.addEventListener('change', (e) => {
        isDraggingSlider = false;
        const lux = parseFloat(e.target.value);
        postAPI('/api/sensor/light', { ambient_light: lux });
      });
    }

    const sliderThresh = document.getElementById('input-threshold');
    const readoutThresh = document.getElementById('slider-threshold-val');
    if (sliderThresh) {
      sliderThresh.addEventListener('input', (e) => {
        if (readoutThresh) readoutThresh.textContent = `${e.target.value}%`;
      });
      sliderThresh.addEventListener('change', (e) => {
        const thresh = parseFloat(e.target.value);
        postAPI('/api/headlights/automatic', {
          auto_mode: currentState ? currentState.auto_mode : 1,
          threshold: thresh
        });
      });
    }
  }

  function bindIndicatorButtons() {
    const btnLeft = document.getElementById('btn-ind-left');
    const btnRight = document.getElementById('btn-ind-right');
    const btnHazard = document.getElementById('btn-ind-hazard');
    const btnCancel = document.getElementById('btn-ind-cancel');

    if (btnLeft) {
      btnLeft.addEventListener('click', () => {
        const newState = (currentState && currentState.left_indicator) ? 0 : 1;
        postAPI('/api/indicators', { type: 'LEFT', state: newState });
      });
    }

    if (btnRight) {
      btnRight.addEventListener('click', () => {
        const newState = (currentState && currentState.right_indicator) ? 0 : 1;
        postAPI('/api/indicators', { type: 'RIGHT', state: newState });
      });
    }

    if (btnHazard) {
      btnHazard.addEventListener('click', () => {
        const newState = (currentState && currentState.hazard_lights) ? 0 : 1;
        postAPI('/api/indicators', { type: 'HAZARD', state: newState });
        if (window.AppCoordinator) {
          window.AppCoordinator.showToast(
            newState ? 'Hazard Flashers Engaged' : 'Hazard Flashers Cancelled',
            newState ? 'warning' : 'success'
          );
        }
      });
    }

    if (btnCancel) {
      btnCancel.addEventListener('click', () => {
        postAPI('/api/indicators', { type: 'CANCEL', state: 0 });
      });
    }
  }

  function bindEnvironmentButtons() {
    const envBtns = document.querySelectorAll('.env-btn');
    envBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const env = btn.dataset.env;
        postAPI('/api/environment', { environment: env });
        if (window.AppCoordinator) {
          window.AppCoordinator.showToast(`Atmospheric Mode: ${env}`, 'success');
        }
      });
    });
  }

  function bindCameraButtons() {
    const camBtns = document.querySelectorAll('.cam-btn');
    camBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        camBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const view = btn.dataset.view;
        if (window.VehicleScene) {
          window.VehicleScene.setCameraView(view);
        }
      });
    });

    const btnReset = document.getElementById('btn-reset-view');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        if (window.VehicleScene) {
          window.VehicleScene.resetCamera();
        }
        camBtns.forEach(b => b.classList.remove('active'));
        const frontBtn = document.querySelector('.cam-btn[data-view="front"]');
        if (frontBtn) frontBtn.classList.add('active');
      });
    }

    const btnToggleHud = document.getElementById('btn-toggle-hud');
    if (btnToggleHud) {
      btnToggleHud.addEventListener('click', () => {
        document.body.classList.toggle('compact-hud');
        const isCompact = document.body.classList.contains('compact-hud');
        btnToggleHud.innerHTML = isCompact ? '<i class="fa-solid fa-compress"></i>' : '<i class="fa-solid fa-expand"></i>';
      });
    }
  }

  function bindKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return; // Ignore while typing in inputs

      const k = e.key.toUpperCase();
      if (k === 'L') {
        postAPI('/api/headlights/mode', { mode: 'LOW_BEAM' });
      } else if (k === 'H') {
        postAPI('/api/headlights/mode', { mode: 'HIGH_BEAM' });
      } else if (k === 'P') {
        postAPI('/api/headlights/mode', { mode: 'PARKING' });
      } else if (k === 'O') {
        postAPI('/api/headlights/mode', { mode: 'OFF' });
      } else if (k === 'A') {
        const newAuto = currentState && currentState.auto_mode ? 0 : 1;
        postAPI('/api/headlights/automatic', { auto_mode: newAuto });
      } else if (e.key === 'ArrowLeft') {
        postAPI('/api/indicators', { type: 'LEFT', state: 1 });
      } else if (e.key === 'ArrowRight') {
        postAPI('/api/indicators', { type: 'RIGHT', state: 1 });
      } else if (e.code === 'Space') {
        e.preventDefault();
        const newHaz = currentState && currentState.hazard_lights ? 0 : 1;
        postAPI('/api/indicators', { type: 'HAZARD', state: newHaz });
      } else if (e.key === 'Escape') {
        postAPI('/api/indicators', { type: 'CANCEL', state: 0 });
      }
    });
  }

  /* ========================================================================
     Sync UI Elements with C Backend State
     ======================================================================== */
  function syncUIWithState(state) {
    if (!state) return;
    currentState = state;

    // 1. Power Button
    const pwrBtn = document.getElementById('btn-master-power');
    if (pwrBtn) {
      pwrBtn.classList.toggle('active', state.power === 1);
    }

    // 2. Mode Selector Buttons
    const modeBtns = document.querySelectorAll('.mode-btn');
    modeBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === state.mode);
    });

    // 3. Environment Buttons
    const envBtns = document.querySelectorAll('.env-btn');
    envBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.env === state.environment);
    });

    // 4. Auto Mode Checkbox
    const toggleAuto = document.getElementById('toggle-auto-mode');
    if (toggleAuto) {
      toggleAuto.checked = (state.auto_mode === 1);
    }

    // 5. Sliders (Only sync if user is not currently dragging)
    if (!isDraggingSlider) {
      const sliderLux = document.getElementById('input-ambient-lux');
      const readoutLux = document.getElementById('slider-lux-val');
      if (sliderLux) sliderLux.value = Math.round(state.ambient_light);
      if (readoutLux) readoutLux.textContent = `${Math.round(state.ambient_light)}%`;

      const sliderThresh = document.getElementById('input-threshold');
      const readoutThresh = document.getElementById('slider-threshold-val');
      if (sliderThresh) sliderThresh.value = Math.round(state.light_threshold);
      if (readoutThresh) readoutThresh.textContent = `${Math.round(state.light_threshold)}%`;
    }

    // 6. Indicator Buttons
    const btnLeft = document.getElementById('btn-ind-left');
    const btnRight = document.getElementById('btn-ind-right');
    const btnHazard = document.getElementById('btn-ind-hazard');

    if (btnLeft) btnLeft.classList.toggle('active', state.left_indicator === 1 && !state.hazard_lights);
    if (btnRight) btnRight.classList.toggle('active', state.right_indicator === 1 && !state.hazard_lights);
    if (btnHazard) btnHazard.classList.toggle('active', state.hazard_lights === 1);
  }

})();

