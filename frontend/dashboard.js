/**
 * LUMEN-DRIVE 3D | VEHICLE HEADLIGHT CONTROL SIMULATOR
 * Advanced Digital Automotive Dashboard & Telemetry Display
 */

(function () {
  'use strict';

  window.AutomotiveDashboard = {
    init,
    renderTelemetry
  };

  // DOM Elements Cache
  let elSpeedVal, elSpeedFill;
  let elBatteryVal, elBatteryFill;
  let elTellLeft, elTellRight, elTellParking, elTellLowBeam, elTellHighBeam, elTellHazard, elTellAuto;
  let elAlsFill, elAlsMarker, elAlsVal, elAlsBadge, elDecisionTitle, elDecisionDesc;
  let elDrlKpi, elRangeKpi, elConeKpi;
  let elHoloMode, elHoloRange, elHoloTemp;
  let elScreenBlinkerLeft, elScreenBlinkerRight;
  let elClusterTag;

  function init() {
    elSpeedVal = document.getElementById('val-speed');
    elSpeedFill = document.getElementById('speed-meter-fill');
    elBatteryVal = document.getElementById('val-battery');
    elBatteryFill = document.getElementById('battery-meter-fill');

    elTellLeft = document.getElementById('tell-left');
    elTellRight = document.getElementById('tell-right');
    elTellParking = document.getElementById('tell-parking');
    elTellLowBeam = document.getElementById('tell-lowbeam');
    elTellHighBeam = document.getElementById('tell-highbeam');
    elTellHazard = document.getElementById('tell-hazard');
    elTellAuto = document.getElementById('tell-auto');

    elAlsFill = document.getElementById('als-fill-bar');
    elAlsMarker = document.getElementById('als-threshold-marker');
    elAlsVal = document.getElementById('val-als-percent');
    elAlsBadge = document.getElementById('als-status-badge');
    elDecisionTitle = document.getElementById('val-decision-title');
    elDecisionDesc = document.getElementById('val-decision-desc');

    elDrlKpi = document.getElementById('val-drl-kpi');
    elRangeKpi = document.getElementById('val-range-kpi');
    elConeKpi = document.getElementById('val-cone-kpi');

    elHoloMode = document.getElementById('holo-mode-text');
    elHoloRange = document.getElementById('holo-range-text');
    elHoloTemp = document.getElementById('holo-temp-text');

    elScreenBlinkerLeft = document.getElementById('screen-blinker-left');
    elScreenBlinkerRight = document.getElementById('screen-blinker-right');
    elClusterTag = document.getElementById('cluster-mode-tag');
  }

  function renderTelemetry(state) {
    if (!state) return;

    // 1. Speedometer Dial (Max 140 km/h, circumference ~264)
    if (elSpeedVal && elSpeedFill) {
      const speed = Math.round(state.speed || 0);
      elSpeedVal.textContent = speed;
      const speedPct = Math.min(Math.max(speed / 140.0, 0), 1);
      const dashOffset = 264 - (speedPct * 200); // 200 unit sweep arc
      elSpeedFill.style.strokeDashoffset = dashOffset;
    }

    // 2. Battery Voltage Dial (11.0V to 15.0V range)
    if (elBatteryVal && elBatteryFill) {
      const volt = (state.battery_voltage || 14.2).toFixed(1);
      elBatteryVal.textContent = volt;
      const voltPct = Math.min(Math.max((state.battery_voltage - 11.0) / 4.0, 0), 1);
      const dashOffset = 264 - (voltPct * 180);
      elBatteryFill.style.strokeDashoffset = dashOffset;
    }

    // 3. Telltale Warning Icons
    const pwr = state.power;
    const mode = state.mode;

    if (elTellParking) {
      elTellParking.classList.toggle('active', pwr && (mode === 'PARKING' || mode === 'LOW_BEAM' || mode === 'HIGH_BEAM'));
    }
    if (elTellLowBeam) {
      elTellLowBeam.classList.toggle('active', pwr && mode === 'LOW_BEAM');
    }
    if (elTellHighBeam) {
      elTellHighBeam.classList.toggle('active', pwr && mode === 'HIGH_BEAM');
    }
    if (elTellAuto) {
      elTellAuto.classList.toggle('active', state.auto_mode === 1);
    }
    if (elTellHazard) {
      elTellHazard.classList.toggle('active', state.hazard_lights === 1);
    }
    if (elTellLeft) {
      elTellLeft.classList.toggle('active', state.left_indicator === 1 || state.hazard_lights === 1);
    }
    if (elTellRight) {
      elTellRight.classList.toggle('active', state.right_indicator === 1 || state.hazard_lights === 1);
    }

    // Screen-edge blinker chevrons
    if (elScreenBlinkerLeft) {
      elScreenBlinkerLeft.classList.toggle('blinking', state.left_indicator === 1 || state.hazard_lights === 1);
    }
    if (elScreenBlinkerRight) {
      elScreenBlinkerRight.classList.toggle('blinking', state.right_indicator === 1 || state.hazard_lights === 1);
    }

    // 4. Ambient Light Sensor (ALS) Bar & Decision
    const ambient = state.ambient_light || 0;
    const thresh = state.light_threshold || 35.0;

    if (elAlsFill) {
      elAlsFill.style.width = `${Math.min(Math.max(ambient, 0), 100)}%`;
    }
    if (elAlsMarker) {
      elAlsMarker.style.left = `${Math.min(Math.max(thresh, 0), 100)}%`;
      const markerText = elAlsMarker.querySelector('.marker-tag');
      if (markerText) markerText.textContent = `TH: ${thresh.toFixed(0)}%`;
    }
    if (elAlsVal) {
      let condName = 'Night';
      if (ambient > 70) condName = 'Daylight';
      else if (ambient > 35) condName = 'Dusk / Twilight';
      else if (ambient < 10) condName = 'Pitch Black';
      elAlsVal.textContent = `${ambient.toFixed(1)}% (${condName})`;
    }
    if (elAlsBadge) {
      if (ambient > 60) elAlsBadge.textContent = 'DAYLIGHT COND.';
      else if (ambient > 35) elAlsBadge.textContent = 'TWILIGHT COND.';
      else elAlsBadge.textContent = 'DARKNESS COND.';
    }

    if (elDecisionTitle && elDecisionDesc) {
      if (state.auto_mode) {
        if (ambient < thresh) {
          elDecisionTitle.textContent = 'AUTOMATIC ILLUMINATION ENGAGED';
          elDecisionDesc.textContent = `Ambient lux (${ambient.toFixed(1)}%) < threshold (${thresh.toFixed(1)}%). Low beam headlights automatically activated by C decision unit.`;
        } else {
          elDecisionTitle.textContent = 'SUFFICIENT DAYLIGHT DETECTED';
          elDecisionDesc.textContent = `Ambient lux (${ambient.toFixed(1)}%) ≥ threshold (${thresh.toFixed(1)}%). Headlights disengaged or in standby by C control engine.`;
        }
      } else {
        elDecisionTitle.textContent = 'MANUAL OVERRIDE ACTIVE';
        elDecisionDesc.textContent = 'Automatic photocell sensor evaluation is bypassed by manual driver command.';
      }
    }

    if (elClusterTag) {
      elClusterTag.textContent = state.auto_mode ? 'AUTO ACTIVE' : 'MANUAL';
    }

    // 5. Optical Telemetry KPIs
    const opt = state.optical_telemetry || {};
    if (elDrlKpi) {
      elDrlKpi.textContent = `${Math.round((opt.drl_intensity || 0) * 100)}%`;
    }
    if (elRangeKpi) {
      elRangeKpi.textContent = `${Math.round(opt.range_meters || 0)} m`;
    }
    if (elConeKpi) {
      elConeKpi.textContent = opt.cone_visible ? 'ACTIVE' : 'STANDBY';
      elConeKpi.classList.toggle('highlight', opt.cone_visible === 1);
    }

    // 6. Hologram Floating Badge
    if (elHoloMode) {
      if (!pwr) {
        elHoloMode.textContent = 'SYSTEM STANDBY (OFF)';
      } else if (mode === 'PARKING') {
        elHoloMode.textContent = 'PARKING / DRL SIGNATURE';
      } else if (mode === 'LOW_BEAM') {
        elHoloMode.textContent = 'LOW BEAM ENGAGED';
      } else if (mode === 'HIGH_BEAM') {
        elHoloMode.textContent = 'HIGH BEAM PROJECTORS ACTIVE';
      }
    }
    if (elHoloRange) {
      elHoloRange.innerHTML = `<i class="fa-solid fa-arrows-left-right-to-line"></i> ${Math.round(opt.range_meters || 0)}m Range`;
    }
    if (elHoloTemp) {
      elHoloTemp.innerHTML = `<i class="fa-solid fa-temperature-half"></i> ${mode === 'HIGH_BEAM' ? '6500K High-Flux' : '6000K Xenon'}`;
    }
  }

})();

