/**
 * LUMEN-DRIVE 3D | VEHICLE HEADLIGHT CONTROL SIMULATOR
 * Three.js 3D Vehicle, Volumetric Headlight Beams & Showroom Environment
 */

(function () {
  'use strict';

  // Master Global Object
  window.VehicleScene = {
    init,
    updateState,
    setEnvironment,
    setCameraView,
    resetCamera
  };

  let scene, camera, renderer, controls;
  let carGroup, floorMesh, roadLinesGroup;
  let hemiLight, sunLight, ambientLight, showroomSpot;

  // Optical Illuminators & Beams
  let leftLowSpot, rightLowSpot;
  let leftHighSpot, rightHighSpot;
  let leftLensGlow, rightLensGlow;
  let leftVolumetricCone, rightVolumetricCone;
  let leftHighVolumetricCone, rightHighVolumetricCone;

  // LED Materials
  let matCarBody, matDrl, matProjectorLow, matProjectorHigh;
  let matBlinkerLeft, matBlinkerRight;
  let leftBlinkerLight, rightBlinkerLight;

  // Camera Interpolation State
  let targetCamPos = new THREE.Vector3(0, 1.25, 5.2);
  let targetLookAt = new THREE.Vector3(0, 0.65, 0);
  let isLerpingCamera = false;

  // Current Target State from C Engine
  let currentTargetState = {
    power: 1,
    mode: 'LOW_BEAM',
    left_indicator: 0,
    right_indicator: 0,
    hazard_lights: 0,
    environment: 'NIGHT',
    drl_intensity: 1.0,
    low_beam_intensity: 1.0,
    high_beam_intensity: 0.0,
    cone_visible: 1,
    color_temp: '#e0f7fa'
  };

  // Blinker Clock
  let blinkerClock = 0;

  function init() {
    const container = document.getElementById('three-canvas-container');
    if (!container) return;

    // 1. Scene Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070a10);
    scene.fog = new THREE.FogExp2(0x070a10, 0.015);

    // 2. Camera Setup
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 300);
    camera.position.set(0, 1.25, 5.2);

    // 3. Renderer Setup
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    // 4. Orbit Controls
    if (typeof THREE.OrbitControls !== 'undefined') {
      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.maxPolarAngle = Math.PI / 2 - 0.02; // Don't go below floor
      controls.minDistance = 1.8;
      controls.maxDistance = 25.0;
      controls.target.copy(targetLookAt);
    }

    // 5. Build Scene Elements
    setupEnvironmentLighting();
    buildFloorAndRoad();
    buildDetailedSportsCar();
    buildHeadlightBeamSystem();

    // 6. Handle Window Resizing
    window.addEventListener('resize', onWindowResize);

    // 7. Initial Environment & Start Animation Loop
    setEnvironment('NIGHT');
    animate();
  }

  /* ========================================================================
     Lighting & Environment Modes
     ======================================================================== */
  function setupEnvironmentLighting() {
    hemiLight = new THREE.HemisphereLight(0xffffff, 0x111622, 0.35);
    scene.add(hemiLight);

    ambientLight = new THREE.AmbientLight(0x0d1525, 0.4);
    scene.add(ambientLight);

    sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
    sunLight.position.set(10, 18, 12);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 50;
    sunLight.shadow.bias = -0.0005;
    const d = 6;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    scene.add(sunLight);

    // Subtle overhead showroom spotlight
    showroomSpot = new THREE.SpotLight(0x38bdf8, 1.2, 25, Math.PI / 4, 0.8);
    showroomSpot.position.set(0, 10, 0);
    showroomSpot.target.position.set(0, 0, 0);
    scene.add(showroomSpot);
    scene.add(showroomSpot.target);
  }

  function setEnvironment(env) {
    if (!scene) return;

    if (env === 'DAYTIME') {
      scene.background.set(0x4a6582);
      scene.fog.color.set(0x4a6582);
      scene.fog.density = 0.006;
      hemiLight.color.set(0xffffff);
      hemiLight.groundColor.set(0x556677);
      hemiLight.intensity = 1.1;
      sunLight.color.set(0xfff7e6);
      sunLight.intensity = 2.2;
      ambientLight.intensity = 0.7;
      showroomSpot.intensity = 0.2;
      if (floorMesh) floorMesh.material.roughness = 0.4;
    } else if (env === 'EVENING') {
      scene.background.set(0x1a1226);
      scene.fog.color.set(0x1a1226);
      scene.fog.density = 0.012;
      hemiLight.color.set(0xff8844);
      hemiLight.groundColor.set(0x221133);
      hemiLight.intensity = 0.6;
      sunLight.color.set(0xff6622);
      sunLight.position.set(15, 6, 12);
      sunLight.intensity = 1.3;
      ambientLight.intensity = 0.35;
      showroomSpot.intensity = 0.5;
    } else if (env === 'NIGHT') {
      scene.background.set(0x06090f);
      scene.fog.color.set(0x06090f);
      scene.fog.density = 0.018;
      hemiLight.color.set(0x112244);
      hemiLight.groundColor.set(0x040608);
      hemiLight.intensity = 0.25;
      sunLight.intensity = 0.1;
      ambientLight.intensity = 0.15;
      showroomSpot.intensity = 1.2;
      if (floorMesh) floorMesh.material.roughness = 0.25;
    } else if (env === 'DARK_HIGHWAY') {
      scene.background.set(0x020305);
      scene.fog.color.set(0x020305);
      scene.fog.density = 0.024;
      hemiLight.intensity = 0.08;
      sunLight.intensity = 0.0;
      ambientLight.intensity = 0.06;
      showroomSpot.intensity = 0.1;
      if (floorMesh) floorMesh.material.roughness = 0.18;
    }
  }

  /* ========================================================================
     Showroom Reflective Floor & Highway Lines
     ======================================================================== */
  function buildFloorAndRoad() {
    // Reflective Asphalt Floor
    const floorGeo = new THREE.PlaneGeometry(160, 160);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x090d14,
      roughness: 0.25,
      metalness: 0.65
    });
    floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // Highway Road Markings (visible in front of car)
    roadLinesGroup = new THREE.Group();
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 });
    const yellowMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.6 });

    // Center divider dashed line
    for (let z = 3; z < 80; z += 5) {
      const dashGeo = new THREE.PlaneGeometry(0.18, 2.5);
      const dashMesh = new THREE.Mesh(dashGeo, yellowMat);
      dashMesh.rotation.x = -Math.PI / 2;
      dashMesh.position.set(0, 0.005, z);
      roadLinesGroup.add(dashMesh);
    }

    // Outer edge lane stripes
    const leftEdgeGeo = new THREE.PlaneGeometry(0.12, 100);
    const leftEdge = new THREE.Mesh(leftEdgeGeo, lineMat);
    leftEdge.rotation.x = -Math.PI / 2;
    leftEdge.position.set(-2.8, 0.005, 45);
    roadLinesGroup.add(leftEdge);

    const rightEdge = new THREE.Mesh(leftEdgeGeo, lineMat);
    rightEdge.rotation.x = -Math.PI / 2;
    rightEdge.position.set(2.8, 0.005, 45);
    roadLinesGroup.add(rightEdge);

    scene.add(roadLinesGroup);
  }

  /* ========================================================================
     Detailed 3D Luxury Sports Car
     ======================================================================== */
  function buildDetailedSportsCar() {
    carGroup = new THREE.Group();

    // Materials
    matCarBody = new THREE.MeshPhysicalMaterial({
      color: 0x081220, // Midnight Obsidian Blue
      metalness: 0.85,
      roughness: 0.2,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      reflectivity: 0.9
    });

    const matCarbon = new THREE.MeshStandardMaterial({
      color: 0x111418,
      roughness: 0.5,
      metalness: 0.2
    });

    const matGlass = new THREE.MeshPhysicalMaterial({
      color: 0x040810,
      metalness: 0.1,
      roughness: 0.05,
      transmission: 0.9,
      transparent: true,
      opacity: 0.75
    });

    const matChrome = new THREE.MeshStandardMaterial({
      color: 0xe6edf3,
      metalness: 0.95,
      roughness: 0.1
    });

    // 1. Main Lower Chassis (Aerodynamic wedge)
    const lowerBodyGeo = new THREE.BoxGeometry(1.88, 0.44, 4.2);
    const lowerBody = new THREE.Mesh(lowerBodyGeo, matCarBody);
    lowerBody.position.set(0, 0.42, 0);
    lowerBody.castShadow = true;
    lowerBody.receiveShadow = true;
    carGroup.add(lowerBody);

    // 2. Sculpted Hood
    const hoodGeo = new THREE.BoxGeometry(1.82, 0.18, 1.4);
    const hood = new THREE.Mesh(hoodGeo, matCarBody);
    hood.position.set(0, 0.56, 1.25);
    hood.rotation.x = 0.07; // Slight slope forward
    hood.castShadow = true;
    carGroup.add(hood);

    // 3. Cabin & Greenhouse (Roof & Windows)
    const cabinGeo = new THREE.BoxGeometry(1.58, 0.48, 2.0);
    const cabin = new THREE.Mesh(cabinGeo, matCarBody);
    cabin.position.set(0, 0.84, -0.2);
    cabin.castShadow = true;
    carGroup.add(cabin);

    // Windshield (Front)
    const windshieldGeo = new THREE.PlaneGeometry(1.5, 0.7);
    const windshield = new THREE.Mesh(windshieldGeo, matGlass);
    windshield.position.set(0, 0.82, 0.82);
    windshield.rotation.x = -0.65;
    carGroup.add(windshield);

    // Rear Windshield
    const rearGlassGeo = new THREE.PlaneGeometry(1.48, 0.65);
    const rearGlass = new THREE.Mesh(rearGlassGeo, matGlass);
    rearGlass.position.set(0, 0.82, -1.22);
    rearGlass.rotation.x = 0.7;
    rearGlass.rotation.y = Math.PI;
    carGroup.add(rearGlass);

    // 4. Front Fascia: Grille & Front Splitter
    const grilleGeo = new THREE.BoxGeometry(1.1, 0.22, 0.1);
    const grille = new THREE.Mesh(grilleGeo, matCarbon);
    grille.position.set(0, 0.35, 2.12);
    carGroup.add(grille);

    // Honeycomb badge
    const badgeGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.02, 16);
    const badge = new THREE.Mesh(badgeGeo, matChrome);
    badge.rotation.x = Math.PI / 2;
    badge.position.set(0, 0.35, 2.18);
    carGroup.add(badge);

    // Front Bumper Lower Splitter
    const splitterGeo = new THREE.BoxGeometry(1.94, 0.05, 0.35);
    const splitter = new THREE.Mesh(splitterGeo, matCarbon);
    splitter.position.set(0, 0.16, 2.08);
    splitter.castShadow = true;
    carGroup.add(splitter);

    // Rear Diffuser & Exhausts
    const diffuserGeo = new THREE.BoxGeometry(1.88, 0.12, 0.25);
    const diffuser = new THREE.Mesh(diffuserGeo, matCarbon);
    diffuser.position.set(0, 0.22, -2.12);
    carGroup.add(diffuser);

    for (let side of [-0.6, -0.45, 0.45, 0.6]) {
      const exhaustGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.12, 16);
      const exhaust = new THREE.Mesh(exhaustGeo, matChrome);
      exhaust.rotation.x = Math.PI / 2;
      exhaust.position.set(side, 0.25, -2.18);
      carGroup.add(exhaust);
    }

    // 5. Wheels & Alloy Rims
    buildWheel(0.96, 0.34, 1.35);   // Front Right
    buildWheel(-0.96, 0.34, 1.35);  // Front Left
    buildWheel(0.96, 0.34, -1.35);  // Rear Right
    buildWheel(-0.96, 0.34, -1.35); // Rear Left

    // 6. Side Mirrors with Integrated LED Turn Repeaters
    buildSideMirror(0.98, 0.78, 0.7, 1);
    buildSideMirror(-0.98, 0.78, 0.7, -1);

    // 7. Headlight Assembly Units (Left & Right)
    buildHeadlightCluster(0.68, 0.52, 2.05, 1);   // Right Headlight
    buildHeadlightCluster(-0.68, 0.52, 2.05, -1); // Left Headlight

    // 8. Taillights (Rear Red Strips)
    const tailGeo = new THREE.BoxGeometry(0.6, 0.06, 0.02);
    const matTail = new THREE.MeshBasicMaterial({ color: 0xff0022 });
    const rightTail = new THREE.Mesh(tailGeo, matTail);
    rightTail.position.set(0.6, 0.52, -2.11);
    carGroup.add(rightTail);
    const leftTail = new THREE.Mesh(tailGeo, matTail);
    leftTail.position.set(-0.6, 0.52, -2.11);
    carGroup.add(leftTail);

    scene.add(carGroup);
  }

  function buildWheel(x, y, z) {
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(x, y, z);

    // Rubber Tire
    const tireGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 24);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x181a1f, roughness: 0.85 });
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    wheelGroup.add(tire);

    // Alloy Rim
    const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.25, 16);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xd0d7de, metalness: 0.9, roughness: 0.15 });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.z = Math.PI / 2;
    wheelGroup.add(rim);

    // Cyan Brake Caliper
    const caliperGeo = new THREE.BoxGeometry(0.08, 0.12, 0.08);
    const caliperMat = new THREE.MeshStandardMaterial({ color: 0x00f0ff, roughness: 0.3 });
    const caliper = new THREE.Mesh(caliperGeo, caliperMat);
    caliper.position.set(x > 0 ? 0.05 : -0.05, 0.14, 0);
    wheelGroup.add(caliper);

    carGroup.add(wheelGroup);
  }

  function buildSideMirror(x, y, z, dir) {
    const mirrorGroup = new THREE.Group();
    mirrorGroup.position.set(x, y, z);

    const stalkGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.12);
    const stalk = new THREE.Mesh(stalkGeo, matCarBody);
    stalk.rotation.z = dir * 0.5;
    mirrorGroup.add(stalk);

    const housingGeo = new THREE.BoxGeometry(0.22, 0.1, 0.14);
    const housing = new THREE.Mesh(housingGeo, matCarBody);
    housing.position.set(dir * 0.1, 0.05, 0);
    mirrorGroup.add(housing);

    // Mirror Blinker LED Strip
    const blinkerGeo = new THREE.PlaneGeometry(0.18, 0.02);
    const blinkerMat = (dir > 0) ? getOrCreateBlinkerMat('RIGHT') : getOrCreateBlinkerMat('LEFT');
    const blinker = new THREE.Mesh(blinkerGeo, blinkerMat);
    blinker.position.set(dir * 0.1, 0.05, 0.075);
    mirrorGroup.add(blinker);

    carGroup.add(mirrorGroup);
  }

  function getOrCreateBlinkerMat(side) {
    if (side === 'LEFT') {
      if (!matBlinkerLeft) {
        matBlinkerLeft = new THREE.MeshBasicMaterial({ color: 0x221100 });
      }
      return matBlinkerLeft;
    } else {
      if (!matBlinkerRight) {
        matBlinkerRight = new THREE.MeshBasicMaterial({ color: 0x221100 });
      }
      return matBlinkerRight;
    }
  }

  /* ========================================================================
     Headlight Cluster Geometry (Lenses, DRL Halos & Turn Ribbons)
     ======================================================================== */
  function buildHeadlightCluster(x, y, z, dir) {
    const cluster = new THREE.Group();
    cluster.position.set(x, y, z);

    // Smoked Polycarbonate Housing
    const housingGeo = new THREE.BoxGeometry(0.38, 0.14, 0.12);
    const housingMat = new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: 0.2 });
    const housing = new THREE.Mesh(housingGeo, housingMat);
    cluster.add(housing);

    // Outer Projector Sphere (Low Beam Lens)
    const lensGeo = new THREE.SphereGeometry(0.045, 16, 16);
    if (!matProjectorLow) {
      matProjectorLow = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        emissive: 0x00f0ff,
        emissiveIntensity: 0.8,
        roughness: 0.05,
        transmission: 0.85
      });
    }
    const outerLens = new THREE.Mesh(lensGeo, matProjectorLow);
    outerLens.position.set(dir * 0.1, 0, 0.05);
    cluster.add(outerLens);

    // Inner Projector Sphere (High Beam Lens)
    if (!matProjectorHigh) {
      matProjectorHigh = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        emissive: 0x000000,
        emissiveIntensity: 0.0,
        roughness: 0.05,
        transmission: 0.85
      });
    }
    const innerLens = new THREE.Mesh(lensGeo, matProjectorHigh);
    innerLens.position.set(-dir * 0.07, 0, 0.05);
    cluster.add(innerLens);

    // LED DRL Halo / Eyebrow Strip
    const drlGeo = new THREE.BoxGeometry(0.34, 0.015, 0.01);
    if (!matDrl) {
      matDrl = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    }
    const drl = new THREE.Mesh(drlGeo, matDrl);
    drl.position.set(0, 0.055, 0.06);
    cluster.add(drl);

    // Headlight Turn Indicator LED Strip (Bottom Edge)
    const indGeo = new THREE.BoxGeometry(0.32, 0.018, 0.01);
    const indMat = (dir < 0) ? getOrCreateBlinkerMat('LEFT') : getOrCreateBlinkerMat('RIGHT');
    const indMesh = new THREE.Mesh(indGeo, indMat);
    indMesh.position.set(0, -0.055, 0.06);
    cluster.add(indMesh);

    carGroup.add(cluster);
  }

  /* ========================================================================
     Volumetric Light Cones & Realistic SpotLights
     ======================================================================== */
  function buildHeadlightBeamSystem() {
    const leftX = -0.68 - 0.1; // Outer left projector
    const rightX = 0.68 + 0.1; // Outer right projector
    const beamY = 0.52;
    const beamZ = 2.12;

    // 1. Low Beam SpotLights (Tilt down toward the road ~40m ahead)
    leftLowSpot = createSpotLight(0xf0faff, 2.5, 45, Math.PI / 7, 0.55);
    leftLowSpot.position.set(leftX, beamY, beamZ);
    leftLowSpot.target.position.set(leftX * 0.4, 0.0, beamZ + 35.0);
    scene.add(leftLowSpot);
    scene.add(leftLowSpot.target);

    rightLowSpot = createSpotLight(0xf0faff, 2.5, 45, Math.PI / 7, 0.55);
    rightLowSpot.position.set(rightX, beamY, beamZ);
    rightLowSpot.target.position.set(rightX * 0.4, 0.0, beamZ + 35.0);
    scene.add(rightLowSpot);
    scene.add(rightLowSpot.target);

    // 2. High Beam SpotLights (Straight forward, intense, extended ~110m)
    leftHighSpot = createSpotLight(0xffffff, 0.0, 110, Math.PI / 5.5, 0.35);
    leftHighSpot.position.set(-0.68 + 0.07, beamY, beamZ);
    leftHighSpot.target.position.set(-0.68 + 0.07, 0.6, beamZ + 90.0);
    scene.add(leftHighSpot);
    scene.add(leftHighSpot.target);

    rightHighSpot = createSpotLight(0xffffff, 0.0, 110, Math.PI / 5.5, 0.35);
    rightHighSpot.position.set(0.68 - 0.07, beamY, beamZ);
    rightHighSpot.target.position.set(0.68 - 0.07, 0.6, beamZ + 90.0);
    scene.add(rightHighSpot);
    scene.add(rightHighSpot.target);

    // 3. Projector Lens PointLights (Local flare glow)
    leftLensGlow = new THREE.PointLight(0x00f0ff, 1.2, 4.0, 1.5);
    leftLensGlow.position.set(leftX, beamY, beamZ + 0.1);
    scene.add(leftLensGlow);

    rightLensGlow = new THREE.PointLight(0x00f0ff, 1.2, 4.0, 1.5);
    rightLensGlow.position.set(rightX, beamY, beamZ + 0.1);
    scene.add(rightLensGlow);

    // 4. Amber Turn Indicator PointLights
    leftBlinkerLight = new THREE.PointLight(0xffaa00, 0.0, 5.0, 1.2);
    leftBlinkerLight.position.set(-1.0, 0.6, 1.9);
    scene.add(leftBlinkerLight);

    rightBlinkerLight = new THREE.PointLight(0xffaa00, 0.0, 5.0, 1.2);
    rightBlinkerLight.position.set(1.0, 0.6, 1.9);
    scene.add(rightBlinkerLight);

    // 5. Volumetric Cones (Semi-transparent atmospheric dust scattering)
    leftVolumetricCone = createVolumetricCone(35.0, 0.08, 3.2, 0x00d2ff);
    leftVolumetricCone.position.set(leftX, beamY, beamZ);
    leftVolumetricCone.rotation.x = -0.06; // Point slightly down onto road
    scene.add(leftVolumetricCone);

    rightVolumetricCone = createVolumetricCone(35.0, 0.08, 3.2, 0x00d2ff);
    rightVolumetricCone.position.set(rightX, beamY, beamZ);
    rightVolumetricCone.rotation.x = -0.06;
    scene.add(rightVolumetricCone);

    // High beam volumetric cone (Longer, brighter)
    leftHighVolumetricCone = createVolumetricCone(75.0, 0.08, 4.8, 0xffffff);
    leftHighVolumetricCone.position.set(-0.68 + 0.07, beamY, beamZ);
    scene.add(leftHighVolumetricCone);

    rightHighVolumetricCone = createVolumetricCone(75.0, 0.08, 4.8, 0xffffff);
    rightHighVolumetricCone.position.set(0.68 - 0.07, beamY, beamZ);
    scene.add(rightHighVolumetricCone);
  }

  function createSpotLight(color, intensity, distance, angle, penumbra) {
    const spot = new THREE.SpotLight(color, intensity, distance, angle, penumbra, 1.2);
    spot.castShadow = true;
    spot.shadow.mapSize.width = 1024;
    spot.shadow.mapSize.height = 1024;
    spot.shadow.bias = -0.0008;
    return spot;
  }

  function createVolumetricCone(length, rTop, rBottom, color) {
    // Cylinder geometry where top is narrow (lens) and bottom is broad (road throw)
    const geo = new THREE.CylinderGeometry(rBottom, rTop, length, 32, 1, true);
    // Align cylinder pointing forward along +Z axis
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0, length / 2);

    const mat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const mesh = new THREE.Mesh(geo, mat);
    return mesh;
  }

  /* ========================================================================
     Dynamic State Synchronization from C Backend
     ======================================================================== */
  function updateState(state) {
    if (!state) return;
    currentTargetState = state;

    // Also sync environment lighting if it changed
    if (state.environment) {
      setEnvironment(state.environment);
    }
  }

  /* ========================================================================
     Camera Navigation & Views
     ======================================================================== */
  function setCameraView(viewName) {
    if (!camera || !controls) return;

    if (viewName === 'front') {
      targetCamPos.set(0, 1.15, 5.2);
      targetLookAt.set(0, 0.65, 0);
    } else if (viewName === 'perspective') {
      targetCamPos.set(3.6, 1.7, 4.2);
      targetLookAt.set(0, 0.65, 0);
    } else if (viewName === 'closeup') {
      targetCamPos.set(1.15, 0.78, 2.7);
      targetLookAt.set(0.68, 0.55, 2.05);
    } else if (viewName === 'cockpit') {
      targetCamPos.set(-0.45, 1.15, 0.1);
      targetLookAt.set(-0.45, 0.8, 15.0);
    } else if (viewName === 'side') {
      targetCamPos.set(5.5, 1.1, 0.0);
      targetLookAt.set(0, 0.65, 0);
    } else if (viewName === 'top') {
      targetCamPos.set(0, 7.5, 0.1);
      targetLookAt.set(0, 0.2, 0);
    }

    isLerpingCamera = true;
  }

  function resetCamera() {
    setCameraView('front');
  }

  function onWindowResize() {
    const container = document.getElementById('three-canvas-container');
    if (!container || !renderer || !camera) return;

    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }

  /* ========================================================================
     Render & Physics / Blinker Animation Loop
     ======================================================================== */
  function animate() {
    requestAnimationFrame(animate);

    blinkerClock += 0.05;

    // 1. Smooth Camera Glide
    if (isLerpingCamera && controls) {
      camera.position.lerp(targetCamPos, 0.08);
      controls.target.lerp(targetLookAt, 0.08);
      controls.update();

      if (camera.position.distanceTo(targetCamPos) < 0.05) {
        camera.position.copy(targetCamPos);
        controls.target.copy(targetLookAt);
        isLerpingCamera = false;
      }
    } else if (controls) {
      controls.update();
    }

    // 2. Headlight Illumination Targets from C State
    const pwr = currentTargetState.power ? 1.0 : 0.0;
    const mode = currentTargetState.mode || 'OFF';

    let targetLowIntensity = 0.0;
    let targetHighIntensity = 0.0;
    let targetDrlIntensity = 0.0;
    let targetLowConeOpacity = 0.0;
    let targetHighConeOpacity = 0.0;
    let targetLensGlow = 0.0;

    if (pwr > 0) {
      if (mode === 'PARKING') {
        targetDrlIntensity = 0.85;
        targetLensGlow = 0.3;
      } else if (mode === 'LOW_BEAM') {
        targetDrlIntensity = 1.0;
        targetLowIntensity = 3.2;
        targetLowConeOpacity = 0.22;
        targetLensGlow = 1.5;
      } else if (mode === 'HIGH_BEAM') {
        targetDrlIntensity = 1.0;
        targetLowIntensity = 2.4;
        targetHighIntensity = 5.5;
        targetLowConeOpacity = 0.25;
        targetHighConeOpacity = 0.35;
        targetLensGlow = 2.8;
      }
    }

    // In daytime, volumetric cone is less visible due to ambient glare
    if (currentTargetState.environment === 'DAYTIME') {
      targetLowConeOpacity *= 0.35;
      targetHighConeOpacity *= 0.4;
    }

    // Smooth Lerp Lighting
    if (leftLowSpot) {
      leftLowSpot.intensity = THREE.MathUtils.lerp(leftLowSpot.intensity, targetLowIntensity, 0.1);
      rightLowSpot.intensity = leftLowSpot.intensity;
    }
    if (leftHighSpot) {
      leftHighSpot.intensity = THREE.MathUtils.lerp(leftHighSpot.intensity, targetHighIntensity, 0.1);
      rightHighSpot.intensity = leftHighSpot.intensity;
    }
    if (leftLensGlow) {
      leftLensGlow.intensity = THREE.MathUtils.lerp(leftLensGlow.intensity, targetLensGlow, 0.1);
      rightLensGlow.intensity = leftLensGlow.intensity;
    }

    // Volumetric Cone Opacity
    if (leftVolumetricCone) {
      leftVolumetricCone.material.opacity = THREE.MathUtils.lerp(leftVolumetricCone.material.opacity, targetLowConeOpacity, 0.1);
      rightVolumetricCone.material.opacity = leftVolumetricCone.material.opacity;
    }
    if (leftHighVolumetricCone) {
      leftHighVolumetricCone.material.opacity = THREE.MathUtils.lerp(leftHighVolumetricCone.material.opacity, targetHighConeOpacity, 0.1);
      rightHighVolumetricCone.material.opacity = leftHighVolumetricCone.material.opacity;
    }

    // DRL Materials Glow
    if (matDrl) {
      const drlColor = new THREE.Color(0x00f0ff).multiplyScalar(targetDrlIntensity);
      matDrl.color.copy(drlColor);
    }
    if (matProjectorLow) {
      matProjectorLow.emissiveIntensity = THREE.MathUtils.lerp(matProjectorLow.emissiveIntensity, targetLowIntensity > 0 ? 1.0 : 0.05, 0.1);
    }
    if (matProjectorHigh) {
      matProjectorHigh.emissiveIntensity = THREE.MathUtils.lerp(matProjectorHigh.emissiveIntensity, targetHighIntensity > 0 ? 1.2 : 0.0, 0.1);
    }

    // 3. Automotive Turn Indicator Flashers (1.5 Hz cycle)
    const isBlinkOn = Math.sin(blinkerClock * 5.0) > 0.0;
    const hasLeft = currentTargetState.left_indicator || currentTargetState.hazard_lights;
    const hasRight = currentTargetState.right_indicator || currentTargetState.hazard_lights;

    const leftAmber = (hasLeft && isBlinkOn) ? new THREE.Color(0xffaa00) : new THREE.Color(0x180d00);
    const rightAmber = (hasRight && isBlinkOn) ? new THREE.Color(0xffaa00) : new THREE.Color(0x180d00);

    if (matBlinkerLeft) matBlinkerLeft.color.copy(leftAmber);
    if (matBlinkerRight) matBlinkerRight.color.copy(rightAmber);

    if (leftBlinkerLight) leftBlinkerLight.intensity = (hasLeft && isBlinkOn) ? 1.8 : 0.0;
    if (rightBlinkerLight) rightBlinkerLight.intensity = (hasRight && isBlinkOn) ? 1.8 : 0.0;

    // 4. Subtle wheel / chassis idle motion when vehicle speed > 0
    if (currentTargetState.speed > 5.0 && carGroup) {
      carGroup.position.y = Math.sin(blinkerClock * 12.0) * 0.003;
    }

    // Render Scene
    renderer.render(scene, camera);
  }

})();

