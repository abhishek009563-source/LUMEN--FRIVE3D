# LumenDrive 3D | Vehicle Headlight Control Simulator

A complete, production-grade, commercial-style **3D Vehicle Headlight Control Simulator** featuring an ultra-modern automotive HUD interface, interactive **Three.js 3D sports car visualization**, realistic **volumetric headlight projection beams**, and a **100% C programming backend** powered by **Mongoose Embedded C Networking** and **SQLite3**.

---

## 🌟 Executive Overview & Design Vision

In modern automotive engineering, smart lighting control units (such as Adaptive Front-Lighting Systems - AFS and Automatic High-Beam Control - AHBC) are critical electronic control units (ECUs). These systems process analog ambient light sensor (ALS) photodiode inputs, driver steering/turn inputs, vehicle speed, and atmospheric conditions in real time.

**LumenDrive 3D** simulates this entire electronic architecture:
- **Frontend Presentation:** Ultra-modern dark automotive HUD with glassmorphism panels, electric blue/cyan neon highlights, digital circular meters (speedometer, alternator bus voltage), telltale warning icon cluster, and interactive camera controls.
- **3D Vehicle Scene:** Interactive Three.js vehicle with realistic metallic clearcoat paint, carbon-fiber aerodynamic trim, dual projector lenses, LED daytime running light (DRL) eyebrows, mirror repeaters, and volumetric light cones that physically illuminate the dark road.
- **C Application Core:** 100% of lighting state management, turn signal safety interlocks, ambient light threshold evaluations, and decision logging are executed strictly in C99.

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **3D Graphics Engine** | **Three.js (WebGL, r128)** | Procedural 3D luxury sports sedan, dynamic SpotLights, volumetric dust scattering cones, camera transitions, and reflective showroom floor. |
| **Frontend UI** | **HTML5, CSS3, Vanilla ES6** | Glassmorphism dashboard panels, circular SVG gauges, telltale icons, and toast notification system. |
| **Fonts & Icons** | Orbitron, Rajdhani, Font Awesome 6 | High-tech automotive instrument cluster aesthetics. |
| **Backend Language** | **C (C99 Standard)** | **100% of backend processing, sensor threshold rules, safety interlocks, and telemetry calculations.** |
| **Networking Library** | **Mongoose C Library (v7)** | Embedded event-driven HTTP server, CORS preflight handling, REST API, and static file delivery. |
| **Database** | **SQLite3 (Amalgamation)** | Embedded relational database (`database/headlights.db`) persisting live vehicle state and audit decision history. |
| **Interchange Format** | **JSON over HTTP REST** | Standardized, low-latency communication between web client and C backend. |

---

## 📐 System Architecture

```
+----------------------------------------------------------------------------------+
|                            WEB BROWSER (CLIENT)                                  |
|   HTML5 + CSS3 (Glassmorphism HUD)  *  Vanilla JavaScript ES6                     |
|   Three.js 3D Viewport (Volumetric Beams, Projector SpotLights, OrbitControls)    |
|   Digital Dashboard (Speedometer, Battery, Telltales, ALS Meter, Audit Trail)    |
+----------------------------------------------------------------------------------+
                                        |
                 REST JSON API Calls    |   Port 8001
                 fetch() Requests       v
+----------------------------------------------------------------------------------+
|                       MONGOOSE C HTTP SERVER (server.c)                          |
|   - Event-driven non-blocking socket listener                                    |
|   - CORS preflight & header injector                                             |
|   - REST API Route Dispatcher                                                    |
|   - Static Web Asset Delivery (index.html, style.css, script.js, three-scene.js) |
+----------------------------------------------------------------------------------+
                                        |
                                        v
+----------------------------------------------------------------------------------+
|                            C APPLICATION LOGIC                                   |
|   +-----------------------+   +----------------------+   +-------------------+   |
|   |   Headlight Engine    |   |  Ambient Light (ALS) |   |  Turn Indicator   |   |
|   |    (headlights.c)     |   |     (sensor.c)       |   |   (indicators.c)  |   |
|   | Mode & Power State    |   | Threshold Evaluation |   | Safety Interlocks |   |
|   | Optical Beam Math     |   | Hysteresis Logic     |   | Hazard Flashers   |   |
|   +-----------------------+   +----------------------+   +-------------------+   |
|                                       |                                          |
|                                       v                                          |
|   +--------------------------------------------------------------------------+   |
|   |                  BACKGROUND SIMULATION LOOP (main.c)                     |   |
|   |   - 100ms non-blocking network polling                                   |   |
|   |   - 1.5s autonomous sensor evaluation tick                               |   |
|   |   - Alternator voltage & vehicle speed jitter                            |   |
|   +--------------------------------------------------------------------------+   |
+----------------------------------------------------------------------------------+
                                        |
                                        v
+----------------------------------------------------------------------------------+
|                         SQLITE3 EMBEDDED RELATIONAL DB                           |
|                       (database/headlights.db via C API)                         |
|   - system_state: Live vehicle settings, lighting state, ALS & voltage           |
|   - event_logs: Complete chronological audit trail with C decision reasoning     |
+----------------------------------------------------------------------------------+
```

---

## ⚡ Core C Backend Decision Logic & Safety Rules

### 1. Automatic Headlight Activation (Ambient Light Sensor)
Located in [`backend/sensor.c`](file:///c:/Users/Lenovo/Desktop/ant.gvt1/headlight_control_simulator/backend/sensor.c):
- **Activation Rule:** When `auto_mode == 1`, if `ambient_light < light_threshold`, and current mode is `OFF` or `PARKING`:
  $$\text{Mode} \leftarrow \text{LOW\_BEAM}, \quad \text{Power} \leftarrow 1$$
  The event is immediately written to SQLite with source `AUTO_SENSOR` and action `AUTO_ACTIVATE`.
- **Hysteresis Deactivation Rule:** To prevent flickering when driving under bridges or tree canopies, a $6.0\%$ hysteresis margin is enforced:
  $$\text{ambient\_light} \ge (\text{light\_threshold} + 6.0\%)$$
  When satisfied, the system autonomously switches back to `PARKING` (or `OFF` in daytime mode) and logs `AUTO_DEACTIVATE`.

### 2. Turn Signal Safety Interlocks
Located in [`backend/indicators.c`](file:///c:/Users/Lenovo/Desktop/ant.gvt1/headlight_control_simulator/backend/indicators.c):
- **Opposing Cancel Rule:** Activating the `LEFT` indicator automatically cancels the `RIGHT` indicator, and vice versa.
- **Hazard Priority:** Engaging `HAZARD` warning mode activates both left and right indicators simultaneously with emergency blinking priority.

### 3. Optical Telemetry Calculations
Located in [`backend/headlights.c`](file:///c:/Users/Lenovo/Desktop/ant.gvt1/headlight_control_simulator/backend/headlights.c):
- Computes daytime running light (DRL) intensity, low beam throw ($48\,\text{m}$), high beam throw ($115\,\text{m}$), and volumetric cone visibility flags sent to Three.js.

---

## 📡 REST API Reference (All Processed in C)

| Method | Endpoint | Description | Sample Request / Response |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/status` | Returns complete live system telemetry | `{ "power": 1, "mode": "LOW_BEAM", "ambient_light": 25.0, ... }` |
| `POST` | `/api/headlights/power` | Master power toggle | `{"power": 1}` or `{"power": 0}` |
| `POST` | `/api/headlights/mode` | Set lighting mode | `{"mode": "OFF" \| "PARKING" \| "LOW_BEAM" \| "HIGH_BEAM"}` |
| `POST` | `/api/headlights/automatic` | Set automatic mode & threshold | `{"auto_mode": 1, "threshold": 35.0}` |
| `POST` | `/api/sensor/light` | Inject simulated ambient light lux | `{"ambient_light": 18.5}` |
| `POST` | `/api/indicators` | Toggle turn signal / hazard | `{"type": "LEFT" \| "RIGHT" \| "HAZARD" \| "CANCEL", "state": 1}` |
| `POST` | `/api/environment` | Change atmospheric mode | `{"environment": "DAYTIME" \| "EVENING" \| "NIGHT" \| "DARK_HIGHWAY"}` |
| `GET` | `/api/history` | Retrieve chronological SQLite logs | `[{"id": 1, "timestamp": "...", "action": "AUTO_ACTIVATE", ...}]` |
| `POST` | `/api/simulation/tick` | Trigger manual simulation step | Returns updated status JSON |

---

## 🚀 How to Run the Application

The C backend is **currently running** on port `8001`.

### Option A: Open Directly in Browser
Navigate to:
```
http://localhost:8001/
```

### Option B: Windows One-Click Launcher (`run.bat`)
Double-click [`run.bat`](file:///c:/Users/Lenovo/Desktop/ant.gvt1/headlight_control_simulator/run.bat) in the project root:
```cmd
cd headlight_control_simulator
run.bat
```
This batch script compiles `server.exe` with GCC if needed, automatically opens your default browser to `http://localhost:8001/`, and displays the live console output.

### Option C: Manual Terminal Build & Run
```powershell
cd headlight_control_simulator\backend
gcc -O2 -Wall -Wextra -std=c99 -DSQLITE_THREADSAFE=0 -DMG_ENABLE_LINES=1 main.c server.c database.c headlights.c sensor.c indicators.c mongoose.c sqlite3.c -lws2_32 -o server.exe
.\server.exe 8001 ../frontend ../database/headlights.db
```

---

## ⌨️ Interactive Keyboard Controls

| Key | Action |
| :--- | :--- |
| <kbd>L</kbd> | Activate Low Beam Headlights |
| <kbd>H</kbd> | Activate High Beam Projectors |
| <kbd>P</kbd> | Activate Parking / DRL Lights |
| <kbd>O</kbd> | Turn Headlights OFF |
| <kbd>A</kbd> | Toggle Automatic ALS Light Sensing Mode |
| <kbd>←</kbd> | Toggle Left Turn Indicator |
| <kbd>→</kbd> | Toggle Right Turn Indicator |
| <kbd>Space</kbd> | Toggle Emergency Hazard Warning Flashers |
| <kbd>Esc</kbd> | Cancel All Turn Indicators & Hazards |

---

## 🎓 Viva Questions & Project Faculty Answers

### Q1: Why did you choose C for the backend instead of Python or Node.js?
**Answer:** In the automotive industry, vehicle ECUs (Electronic Control Units) run on embedded microcontrollers (such as ARM Cortex-M or Infineon AURIX) where deterministic real-time execution, minimal memory consumption, and direct hardware register access are mandatory. By writing the backend entirely in C99, we simulate the actual firmware architecture of an automotive lighting controller rather than a generic web application.

### Q2: How does the server handle HTTP requests without Apache, Nginx, or Node.js?
**Answer:** We integrated the **Mongoose C Networking Library** directly into our codebase. Mongoose compiles as part of our binary (`server.exe`) and manages non-blocking network I/O through Windows Sockets (`winsock2`). It parses incoming HTTP requests, matches URI routes, handles CORS preflight, serves static files (`index.html`, `style.css`, Three.js scripts), and formats JSON responses with standard status codes.

### Q3: How is persistent storage handled in C?
**Answer:** We embedded the official **SQLite3 Amalgamation** (`sqlite3.c` & `sqlite3.h`). Through the SQLite C API (`sqlite3_prepare_v2`, `sqlite3_bind_*`, and `sqlite3_step`), the application stores the vehicle's state and an audit log of all manual and automatic events in a local database file (`headlights.db`). Even if the server is stopped and restarted, all settings and history persist.

### Q4: Explain the automatic headlight decision logic and why hysteresis is necessary.
**Answer:** The Ambient Light Sensor (ALS) continuously monitors ambient illumination. In automatic mode, if the ambient light drops below the threshold (e.g., $35\%$), the C logic engages low beam headlights. However, if headlights deactivated immediately at $35.1\%$, passing under roadside lights or tree shadows would cause the headlights to rapidly flicker on and off. To prevent this, our C logic enforces a **$6\%$ hysteresis band**—the lights only turn off once illumination reaches $\ge \text{threshold} + 6\%$ (e.g., $41\%$), ensuring stable, realistic automotive operation.

### Q5: How do the volumetric headlight beams work in Three.js?
**Answer:** We combine two complementary techniques:
1. **Three.js `SpotLight` objects:** Positioned at the projector lenses and targeted onto the road surface ahead, casting realistic directional light and soft shadow maps on the asphalt.
2. **Volumetric Cones:** Custom tapered cylinder meshes extending forward from each lens with additive blending and transparent opacity falloff. When Low Beam is active, the cones tilt downward and illuminate the road up to $48\,\text{m}$. In High Beam, high-flux inner projectors activate, the volumetric cones expand in length and opacity, and illumination extends past $110\,\text{m}$.

