# FRUIT FRENZY — KIWAMI STUDIOS

Premium 3D fruit-slicing arcade game controlled with one hand through the player's webcam.

## Locked direction

- Title: FRUIT FRENZY
- Genre: 3D arcade / fruit slicing
- Camera: Perspective 3D gameplay camera
- Input: One hand, tracked locally in the browser
- Menu cursor: Index fingertip
- Menu selection: Full open palm to click; index fingertip controls the cursor
- Gameplay slicing: Fast index-fingertip movement draws the energy-blade trail and slices fruit
- Art direction: Premium 3D, dark cinematic presentation, vivid fruit colors and warm orange energy accents
- Platform: Desktop and mobile browsers with a camera

## Planned modes

1. Classic — Score points, avoid hazards and manage three lives.
2. Time Attack — Score as much as possible before the timer ends.
3. Zen — Relaxed slicing without life pressure.
4. Challenge — Complete objective-based rounds with rising difficulty.

Classic is the first playable mode. Time Attack, Zen and Challenge remain planned.

## Technical architecture

| Layer | Technology | Responsibility |
|---|---|---|
| 3D rendering | Three.js 0.170.0 | Perspective scene, camera, lights and 3D environment |
| Hand tracking | MediaPipe Tasks Vision / Hand Landmarker 0.10.14 | Single-hand landmark detection |
| Camera | Browser getUserMedia | Explicit webcam permission and local video stream |
| Input | JavaScript | Fingertip-to-screen mapping, pointing pose and point-to-click selection |
| UI | HTML + CSS | Menu, status, calibration feedback and dialogs |

## Phase 1 — Hand input foundation

- Dedicated game page at /fruit-frenzy/.
- Premium 3D perspective scene with floating fruit forms and atmospheric lighting.
- Explicit camera permission flow.
- Single-hand MediaPipe tracking.
- Mirrored index fingertip cursor mapping.
- Index-point gesture recognition.
- Point-to-click menu selection with a short repeat cooldown.
- Hand-detection, camera and tracking status.
- Local camera preview with disconnect control.
- Permission/model-load error messaging.
- Mouse/touch accessibility fallback for interface buttons.
- Camera starts only after user action; video is not uploaded by this code.

## Phase 2 — Classic Mode gameplay (implemented in this branch)

- Fast index-fingertip movement creates a short-lived glowing blade trail.
- 3D fruit waves launch with gravity, spin and perspective-aware horizontal bounds.
- Swept segment collision checks the full fingertip movement between tracking frames.
- Fruit split into two animated halves with particle bursts.
- Score, consecutive-slice combos and multipliers up to ×5.
- Classic survival rules: three lives; missed fruit and sliced bombs cost one life.
- Pause, resume, restart, return-to-menu and game-over flow.
- Mouse/touch pointer movement is available as an input fallback.

## Phase 3+ — Modes and polish

- Time Attack, Zen and Challenge modes.
- Sound design and accessibility options.
- Difficulty progression and local best-score persistence.
- Mobile camera layout and performance tuning.
- KIWAMI homepage card and final thumbnail after the game is playable.

## Run locally

Camera access requires a secure context: use HTTPS or localhost. Open KIWAMI/fruit-frenzy/ through a local static server, or deploy the static site. No build step is required.

The browser downloads Three.js and MediaPipe from CDNs. A network connection is needed on first load. The MediaPipe model is fetched from Google's public model storage.

## Privacy and permissions

- The camera is not requested until the player selects Enable Camera.
- The game uses one hand only.
- MediaPipe inference runs in the browser; this prototype contains no code that uploads camera frames.
- The user can disconnect the camera at any time.
- Browser camera access generally requires HTTPS or localhost.

## Current limitations

- Hand-tracking and slicing need physical webcam testing across different lighting, camera angles and devices.
- Fruit physics and hit detection are initial gameplay tuning and may need balancing after playtesting.
- Time Attack, Zen and Challenge are not implemented yet.
- Hand tracking performance depends on device capability, lighting, browser support and CDN/model availability.
- The first version uses a GPU delegate; a CPU fallback may be needed after real-device compatibility testing.
- A short click cooldown prevents repeated activations while the index finger remains pointed at a button.
