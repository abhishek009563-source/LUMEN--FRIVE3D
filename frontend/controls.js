/**
 * LUMEN-DRIVE 3D | VEHICLE HEADLIGHT CONTROL SIMULATOR
 * Interactive Control Panel Handlers & Hybrid REST API / Cloud Communicator
 */

(function () {
  'use strict';

  window.AutomotiveControls = {
    init,
    syncUIWithState,
    getSimulatedState,
    runCloudSimulationTick
  };

  let currentState = null;
  let isDraggingSlider = false;
  let isCloudMode = false;

  // Standalone Automotive State (matches C backend state machine)
  let cloudState = {
    power: 1,
    mode: 'LOW_BEAM',
    auto_mode: 1,
    ambient_light: 25.0,
    light_threshold: 35.0,
    left_indicator: 0,
    right_indicator: 0,
    hazard_lights: 0,
    environment: 'NIGHT',
    speed: 48.0,
    battery_voltage: 14.24,
    updated_at: new Date().toLocaleTimeString(),
    optical_telemetry: {
      drl_intensity: 1.0,
      low_beam_intensity: 1.0,
      high_beam_intensity: 0.0,
      cone_visible: 1,
      range_meters: 48.0,
      color_temp: '#e0f7fa'
    },
    sensor_telemetry: {
      lux_percent: 25.0,
      threshold_percent: 35.0,
      is_dark: 1,
      decision: 'AUTOMATIC_ILLUMINATION_ENGAGED'
    },
    recent_events: [
      {
        id: 2,
        timestamp: new Date().toLocaleTimeString(),
        source: 'AUTO_SENSOR',
        action: 'AUTO_ACTIVATE',
        details: 'Ambient light below 35.0% threshold. Low beams engaged.',
        ambient_light: 25.0,
        headlight_state: 'LOW_BEAM'
      },
      {
        id: 1,
        timestamp: new Date().toLocaleTimeString(),
        source: 'SYSTEM',
        action: 'INITIALIZATION',
        details: 'Headlight Control Unit booted in Night mode',
        ambient_light: 25.0,
        headlight_state: 'LOW_BEAM'
      }
    ]
  };

  function getSimulatedState() {
    return cloudState;
  }

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
     Hybrid API Communicator (C Backend + Cloud ECU Fallback)
     ======================================================================== */
  async function postAPI(endpoint, payload) {
    if (!isCloudMode) {
      try {
        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (resp.ok) {
          const data = await resp.json();
          updateEngineBadge(false);
          if (window.AppCoordinator) {
            window.AppCoordinator.onStateUpdated(data);
          }
          return data;
        } else if (resp.status === 404) {
          // Cloud deployment detected (Vercel static host without local C backend)
          isCloudMode = true;
          updateEngineBadge(true);
        }
      } catch (e) {
        // Network failure / offline C server
        isCloudMode = true;
        updateEngineBadge(true);
      }
    }

    // Process via Standalone ECU Engine
    const updated = processCloudEcuCommand(endpoint, payload);
    if (window.AppCoordinator) {
      window.AppCoordinator.onStateUpdated(updated);
    }
    return updated;
  }

  function updateEngineBadge(inCloudMode) {
    const badgeText = document.querySelector('.c-badge-text');
    const badge = document.querySelector('.c-badge');
    if (!badgeText || !badge) return;

    if (inCloudMode) {
      badgeText.textContent = 'CLOUD ECU: ACTIVE';
      badge.style.borderColor = 'rgba(0, 240, 255, 0.4)';
      badge.style.background = 'rgba(0, 240, 255, 0.12)';
      badge.style.color = 'var(--accent-cyan)';
    } else {
      badgeText.textContent = 'C99 ENGINE: ONLINE';
      badge.style.borderColor = 'rgba(0, 255, 136, 0.3)';
      badge.style.background = 'rgba(0, 255, 136, 0.1)';
      badge.style.color = 'var(--accent-green)';
    }
  }

  /* ========================================================================
     Standalone Automotive ECU Simulation Engine
     Replicates C backend decision logic on static/Vercel deployments
     ======================================================================== */
  function processCloudEcuCommand(endpoint, payload) {
    const s = cloudState;
    const now = new Date().toLocaleTimeString();

    if (endpoint.includes('/api/headlights/power')) {
      s.power = payload.power ? 1 : 0;
      if (!s.power) {
        s.mode = 'OFF';
      } else if (s.mode === 'OFF') {
        s.mode = 'LOW_BEAM';
      }
      addLog('USER', s.power ? 'POWER_ON' : 'POWER_OFF', `Vehicle headlight power switched ${s.power ? 'ON' : 'OFF'}`, s.ambient_light, s.mode);
    } else if (endpoint.includes('/api/headlights/mode')) {
      s.mode = payload.mode;
      s.power = (s.mode !== 'OFF') ? 1 : 0;
      addLog('USER', 'MODE_CHANGE', `Lighting mode transitioned to ${s.mode}`, s.ambient_light, s.mode);
    } else if (endpoint.includes('/api/headlights/automatic')) {
      s.auto_mode = payload.auto_mode ? 1 : 0;
      if (typeof payload.threshold === 'number') {
        s.light_threshold = payload.threshold;
      }
      addLog('USER', s.auto_mode ? 'AUTO_ENABLED' : 'AUTO_DISABLED', `Automatic ALS light sensing system ${s.auto_mode ? 'Enabled' : 'Disabled'}`, s.ambient_light, s.mode);
      evaluateCloudAls();
    } else if (endpoint.includes('/api/sensor/light')) {
      s.ambient_light = payload.ambient_light;
      addLog('SENSOR', 'ALS_UPDATE', `Photodiode sensor reading adjusted to ${s.ambient_light.toFixed(1)}%`, s.ambient_light, s.mode);
      evaluateCloudAls();
    } else if (endpoint.includes('/api/indicators')) {
      const type = payload.type;
      const state = payload.state;
      if (type === 'LEFT') {
        s.left_indicator = state ? 1 : 0;
        if (state) s.right_indicator = 0; // Safety interlock: left cancels right
        s.hazard_lights = 0;
        addLog('USER', state ? 'INDICATOR_LEFT_ON' : 'INDICATOR_LEFT_OFF', state ? 'Left turn signal activated' : 'Left turn signal cancelled', s.ambient_light, s.mode);
      } else if (type === 'RIGHT') {
        s.right_indicator = state ? 1 : 0;
        if (state) s.left_indicator = 0; // Safety interlock: right cancels left
        s.hazard_lights = 0;
        addLog('USER', state ? 'INDICATOR_RIGHT_ON' : 'INDICATOR_RIGHT_OFF', state ? 'Right turn signal activated' : 'Right turn signal cancelled', s.ambient_light, s.mode);
      } else if (type === 'HAZARD') {
        s.hazard_lights = state ? 1 : 0;
        s.left_indicator = state ? 1 : 0;
        s.right_indicator = state ? 1 : 0;
        addLog('USER', state ? 'HAZARD_ON' : 'HAZARD_OFF', state ? 'Hazard warning flasher engaged' : 'Hazard warning flasher disengaged', s.ambient_light, s.mode);
      } else if (type === 'CANCEL') {
        s.left_indicator = 0;
        s.right_indicator = 0;
        s.hazard_lights = 0;
        addLog('USER', 'INDICATORS_CANCEL', 'All turn signals and flashers deactivated', s.ambient_light, s.mode);
      }
    } else if (endpoint.includes('/api/environment')) {
      s.environment = payload.environment;
      if (s.environment === 'DAYTIME') {
        s.ambient_light = 85.0;
        s.speed = 60.0;
      } else if (s.environment === 'EVENING') {
        s.ambient_light = 38.0;
        s.speed = 52.0;
      } else if (s.environment === 'NIGHT') {
        s.ambient_light = 16.0;
        s.speed = 65.0;
      } else if (s.environment === 'DARK_HIGHWAY') {
        s.ambient_light = 4.0;
        s.speed = 95.0;
      }
      addLog('ENVIRONMENT', 'ENV_CHANGE', `Atmospheric condition shifted to ${s.environment}`, s.ambient_light, s.mode);
      evaluateCloudAls();
    }

    recomputeOpticalAndSensorTelemetry();
    s.updated_at = now;
    return s;
  }

  function evaluateCloudAls() {
    const s = cloudState;
    if (!s.auto_mode) return;

    if (s.ambient_light < s.light_threshold) {
      if (s.mode !== 'LOW_BEAM' && s.mode !== 'HIGH_BEAM') {
        s.mode = 'LOW_BEAM';
        s.power = 1;
        addLog('AUTO_SENSOR', 'AUTO_ACTIVATE', `ALS Photocell (${s.ambient_light.toFixed(1)}%) < threshold (${s.light_threshold.toFixed(1)}%). Low beam headlights engaged.`, s.ambient_light, s.mode);
      }
    } else if (s.ambient_light >= (s.light_threshold + 6.0)) {
      if (s.mode === 'LOW_BEAM' || s.mode === 'HIGH_BEAM') {
        s.mode = (s.environment === 'DAYTIME') ? 'OFF' : 'PARKING';
        s.power = (s.mode !== 'OFF') ? 1 : 0;
        addLog('AUTO_SENSOR', 'AUTO_DEACTIVATE', `Daylight detected (${s.ambient_light.toFixed(1)}% >= ${(s.light_threshold + 6.0).toFixed(1)}%). Headlights turned ${s.mode}.`, s.ambient_light, s.mode);
      }
    }
  }

  function recomputeOpticalAndSensorTelemetry() {
    const s = cloudState;
    let drl = 0.0, low = 0.0, high = 0.0, cone = 0, range = 0.0;

    if (s.power) {
      if (s.mode === 'PARKING') {
        drl = 0.75; range = 12.0;
      } else if (s.mode === 'LOW_BEAM') {
        drl = 1.0; low = 1.0; cone = 1; range = 48.0;
      } else if (s.mode === 'HIGH_BEAM') {
        drl = 1.0; low = 1.0; high = 1.0; cone = 1; range = 115.0;
      }
    }

    s.optical_telemetry = {
      drl_intensity: drl,
      low_beam_intensity: low,
      high_beam_intensity: high,
      cone_visible: cone,
      range_meters: range,
      color_temp: '#e0f7fa'
    };

    s.sensor_telemetry = {
      lux_percent: s.ambient_light,
      threshold_percent: s.light_threshold,
      is_dark: (s.ambient_light < s.light_threshold) ? 1 : 0,
      decision: s.auto_mode
        ? (s.ambient_light < s.light_threshold ? 'AUTOMATIC_ILLUMINATION_ENGAGED' : 'SUFFICIENT_DAYLIGHT_DETECTED')
        : 'STANDBY_MANUAL'
    };
  }

  function addLog(source, action, details, ambient, hstate) {
    const nextId = cloudState.recent_events.length ? (cloudState.recent_events[0].id + 1) : 1;
    cloudState.recent_events.unshift({
      id: nextId,
      timestamp: new Date().toLocaleTimeString(),
      source,
      action,
      details,
      ambient_light: ambient,
      headlight_state: hstate
    });
    if (cloudState.recent_events.length > 25) {
      cloudState.recent_events.pop();
    }
  }

  function runCloudSimulationTick() {
    const s = cloudState;
    s.battery_voltage = 14.18 + (Math.random() * 0.15);
    if (s.speed > 5.0) {
      s.speed += (Math.random() - 0.5) * 0.4;
    }
    evaluateCloudAls();
    recomputeOpticalAndSensorTelemetry();
    return s;
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
          targetPower ? 'Master Power Energized' : 'Headlights Power Cut Off',
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
      if (e.target.tagName === 'INPUT') return;

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
