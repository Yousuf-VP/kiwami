# FRUIT FRENZY — KIWAMI STUDIOS

Premium 3D fruit-slicing arcade game controlled with one hand through the player's webcam.

## Locked direction

- Title: FRUIT FRENZY
- Genre: 3D arcade / fruit slicing
- Camera: Perspective 3D gameplay camera
- Input: One hand, tracked locally in the browser
- Menu cursor: Index fingertip
- Menu selection: Point at a button to select it (point-to-click with a short repeat cooldown)
- Gameplay slicing: Quick index-finger movement creates the energy-blade trail
- Art direction: Premium 3D, dark cinematic presentation, vivid fruit colors and warm orange energy accents
- Platform: Desktop and mobile browsers with a camera

## Planned modes

1. Classic — Score points, avoid hazards and manage three lives.
2. Time Attack — Score as much as possible before the timer ends.
3. Zen — Relaxed slicing without life pressure.
4. Challenge — Complete objective-based rounds with rising difficulty.

These modes are planned; they are not playable in Phase 1.

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

## Phase 2 — Gameplay engine

- Index-finger velocity trail with smoothing and a minimum movement threshold.
- 3D fruit launch/spawn system and perspective depth.
- Swept-trail collision detection to reduce missed slices between frames.
- Fruit split animation and cut surfaces.
- Juice particles, blade glow, combo feedback and impact effects.
- Classic mode with three lives, missed-fruit penalty and hazard objects.
- Score, timer, pause and game-over flow.

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

## Known Phase 1 limitations

- No fruit slicing, scoring, lives, hazard logic or playable game modes yet.
- Hand tracking performance depends on device capability, lighting, browser support and CDN/model availability.
- The first version uses a GPU delegate; a CPU fallback may be needed after real-device compatibility testing.
- A short click cooldown prevents repeated activations while the index finger remains pointed at a button.
