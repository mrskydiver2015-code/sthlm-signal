# Urban iteration: Biblioteksgatan → Stureplan

The engine remains Three.js r128. This is a playable, intentionally compact interpretation of Stockholm, with fictional exhibits and citizen stories rather than a survey-accurate reconstruction.

## Architecture

- `index.html` owns the renderer, existing city, avatar animation, input dispatch, local profile and UI panels.
- `urban.js` supplies a data-driven layer: `VENUES`, `EXHIBITS`, `VOICES`, collision footprints, travel speed and render batching. Adding an exhibit requires a venue, position, shape, copy and action. Room construction remains explicit so each venue can have its own layout.
- A venue owns its scene group, walkable bounds, spawn, exterior entrance/return position, indoor exit and lighting palette. Only the active room or exterior is visible. Entry locks controls, fades out, reparents the player, snaps the camera, changes lighting and fades in. No live network or secondary renderer is required.
- Interaction candidates use a shared nearest-target selection. Keyboard E and touch buttons invoke the same action. Dialogues stop the speaker, turn them toward the player and offer another line or directions. These are clearly fictional citizens, not connected accounts.
- Inspection panels use CSS object illustrations and small scene geometry; they do not create extra WebGL contexts. Exhibit actions light an object, play an existing synthesized signal or add a session discovery.
- Speed is centralized: base 3.1 m/s × 1, 2 or 4. Shift temporarily requests 2×. Two W presses within 300 ms request 2× while the second press is held. HUD and 1/2/3 select/toggle persistent tiers. Faster movement is swept in at most 0.16 m increments with axis sliding.

## Navigation and prop audit

| Finding | Resolution |
| --- | --- |
| Camera-relative strafe had previously been inverted | Preserve corrected basis and test A/D/W/S at four camera headings. |
| Only the Stureplan portal entered an interior | Add an explicit NOD entrance on Biblioteksgatan, entrance rings, signs and a target/distance guide. Each venue returns to its own street. |
| Crossing walk rectangles overlapped façades | Narrow side-street bounds to the actual gap; flood-fill the collision map from spawn to both entrances. |
| Props had no collision | Add footprints for trees, benches, Svampen, interior columns, sofas and display cases. Test a swept step against Svampen. |
| Abrupt, invisible district boundaries | Add boundary bollards/signage. Streets beyond are intentionally scenic, not playable. |
| Studio pedestal overlapped a structural column | Move the studio interaction and pedestal to a clear corner. |
| Artwork multiplied texture colours by black and faced the wall | Use white tint, correct the facing, and throttle animated uploads to 12 Hz near visitors. |
| Fashion window and salon lacked explicit interactions | Add an explanation of the reactive scarf and a short fika interaction. |
| Ambient people had no social interaction | Give every citizen a voice, signal/thought, proximity talk prompt and destination tip. |
| Six badge textures were allocated but never attached | Remove the unused allocations; dispose replaced badge textures. |
| Exterior sky sphere intersected the remote NOD interior | Hide exterior sky and stars in all interiors. |

All five new exhibits, both exits, the original art gallery and the relocated studio have reachable collision-map routes. Small decorative details and background traffic intentionally remain non-blocking. Only the two marked gallerias are enterable; other façades are scenery. The studio surface is a reflective PBR prop, not a real-time planar mirror.

## Rendering budget

The target is 60 FPS (16.7 ms/frame), but the available cloud browser uses software WebGL. Its wall-clock frame rate cannot validate the phone budget. Profile representative target phones before treating the target as met.

Implemented limits:

- Shared immutable primitive/limb geometry and PBR materials; explicitly clone the animated scarf material.
- Static instances grouped into 24 m cells with explicit world-space bounds, because r128 does not provide useful per-instance frustum bounds.
- Citizen body parts use instancing with per-instance colours. Beyond 32 m, retain a simple standing silhouette; maximum citizen distance is 70 m on mobile and 95 m on desktop. Animation skips inactive areas.
- Façade source textures have a maximum edge of 256 px on mobile / 512 px on desktop. Procedural canvases remain uncompressed GPU textures; no large image/HDR downloads were added. A future authored texture pipeline should supply KTX2/Basis rather than pretending PNG/JPEG saves GPU memory.
- One 512² mobile / 1024² desktop outdoor shadow map; no NPC shadows on mobile. Pixel ratio remains capped at 1.25 / 2 respectively. Environment lighting is prefiltered once, with no real-time reflection capture or postprocessing.
- Existing gallery textures update at 12 Hz only near the active gallery. Hidden exterior traffic and inactive-room NPC animation are skipped.

The current hard regression gate is documented in README.md. It includes shadow passes, fixed simulation time, desktop/mobile profiles, and fails above 400 calls. The earlier baseline-comparison mode has been replaced.

A seeded comparison against the pre-iteration checkout on 2026-10-13 produced:

| Renderer metric | Before | This iteration |
| --- | ---: | ---: |
| Draw calls | 597 | 396 |
| Triangles | 26,778 | 17,834 |
| Renderer-reported geometry allocations | 495 | 123 |
| Unique source texture pixels | 22,912,812 | 15,774,232 |

These historical figures used automatic per-render resets and excluded shadow-pass calls; they do not establish compliance with the new whole-frame 400-call limit. They are not worst-case or device FPS measurements. The new interior views exercised by the tour used approximately 43–69 draw calls depending on room and viewport. Dialogue and artifact discovery were tested separately from rendering-work measurement.

## Validation

`npm test` runs both the existing control/profile suite and the urban suite in desktop and mobile-emulated Chromium. It exercises speed tiers, keyboard and multi-touch, reachable navigation, collision, entry/return, lighting changes, five exhibit actions, dialogue continuation, speaker pausing and the original art gallery. Runtime and shader errors fail the tests. Screenshots include both interiors on desktop and mobile.

The application now serves its pinned Three.js library from the same origin. Tests omit optional external web fonts; no CDN library substitution or TLS override is needed.
