SHOOT-STREAK EVENT SYSTEM UPDATE

Files:
- index.html: updated page with the event HUD panel.
- game.js: updated Three.js game logic with timed random events.
- event-ui-addon.css: append the entire contents to the END of your existing style.css.

Install:
1. Replace shoot-streak/index.html with this index.html.
2. Replace shoot-streak/game.js with this game.js.
3. Keep your current style.css and append event-ui-addon.css to its end.

Timing:
- 5 minutes of normal gameplay.
- 5 minutes of one randomly selected event.
- Repeats continuously while the game is active.
- Pausing freezes the event timer. Starting/restarting resets it to normal phase.
- The same event cannot occur twice in a row.

Events:
- SLOW-MO: ball simulation runs at 52% speed.
- BIG BALL: ball grows to 1.65x and collision radius is adjusted.
- FULL BOUNCE: floor and bouncer rebounds become stronger.

Validation:
- game.js passed `node --check`.
- Browser gameplay has not been executed in this environment.
