# sthlm-signal — Agent instructions

## Scope and workflow

- Preserve the project's intended appearance, gameplay, and interaction model.
  Complete ordinary, reversible work within the requested scope autonomously.
- Before substantial work, read applicable LESSONS.md instructions and inspect
  the relevant code, package scripts, and dependency lockfile.
- Use the existing package manager and build/test tooling. Do not invent
  commands or introduce a replacement framework without a task-based reason.
- Development, builds, and automated validation run in the configured cloud
  environment. The local Windows checkout is an archive mirror.
- These project requirements must remain usable without access to a
  developer's Windows-local global instructions.

## Repeated objects and instancing

- Automatically use THREE.InstancedMesh for repeated objects that share
  compatible geometry and materials, including trees, streetlights, and props.
  Do not create one independent THREE.Mesh per repeated object by default.
- Group instances by geometry, material, and relevant rendering behavior.
  Composite props may use multiple instanced groups, such as trunks and crowns.
- Share reusable geometry, materials, and textures. Do not clone them per
  instance without a demonstrated requirement.
- Partition large instance populations spatially when needed for effective
  culling. Keep instance transforms and bounding volumes correct.
- Keep per-instance gameplay identity and collision data separate from the
  rendering representation.
- If instancing is technically unsuitable, document the concrete reason and
  use an alternative that still satisfies the rendering budget.
  Convenience alone is not an exception.

## Hard rendering budget

- The maximum is 400 draw calls per complete application frame.
  This is a peak limit, not an average or percentile target.
- Count all application rendering within that frame: the main view, shadow
  maps, depth/reflection passes, post-processing, additional views, and
  GPU-rendered overlays. Aggregate across renderers if more than one is used.
- Apply the limit to every supported quality preset and reachable scene state,
  including transitions. Do not silently exclude expensive frames.
- For WebGLRenderer, use renderer.info.render.calls with
  renderer.info.autoReset = false. Capture statistics after all frame passes
  and reset once per application frame. Ensure the first sample starts clean.
- For WebGPURenderer, use the equivalent statistics supported by the installed
  Three.js version and verify their scope. Do not assume the WebGL API applies.
- Treat missing or incomplete instrumentation as unverified, never as zero.
- Maintain a deterministic rendering-budget test covering representative and
  known worst-case scenes, camera positions, and transitions.
  Fail the test if any measured frame exceeds 400 draw calls.
- Report the observed maximum and scenario coverage. A passing sample does
  not prove that every possible runtime state has been exercised.
- Do not raise the limit, weaken the test, or silently reduce required scene
  content or visual quality to make a failing result pass.
- Draw-call compliance is necessary but does not prove acceptable FPS.
  Also consider triangle load, shadows, transparency/overdraw, shader cost,
  texture sizes, and rendering resolution when relevant to the change.

## Dependencies and runtime assets

- Install Three.js and its addons through the project's package manager,
  resolve them through the build system, and commit the dependency lockfile.
- Use a single compatible Three.js version across core and addons.
- Do not load runtime libraries through external CDN URLs, remote script tags,
  remote module imports, or CDN-backed import maps.
- Bundle or self-host required workers, WASM files, and asset decoders with
  the application. Check loader defaults for hidden CDN dependencies.
- Verify that the production build loads required runtime code from its own
  deployment origin. Registry downloads during dependency installation are
  permitted; this rule concerns browser runtime dependencies.

## InputManager and movement coordinates

- Preserve a decoupled InputManager as the single owner of keyboard and
  touch/pointer input state.
- InputManager exposes logical actions and movement/look intent.
  It must not move the player, mutate the camera, or depend on scene objects.
- Gameplay consumes the same input contract for keyboard and touch.
  Do not add device-specific movement implementations inside gameplay code.
- Preserve the existing public input contract when correct. If no contract is
  documented, use horizontal = positive right and forward = positive forward.
- Convert screen-space touch coordinates to logical input exactly once in
  the input adapter. Convert logical movement to world-space exactly once
  in the movement controller.
- Use +Y as world up. For camera-relative ground movement, derive normalized
  forward from the camera's direction projected onto the XZ plane, and derive
  right as forward cross worldUp. Handle a near-vertical camera safely.
- Do not add compensating sign inversions in multiple layers.
  Right input must move camera-right and forward input camera-forward
  for every supported camera heading.
- Clamp combined movement magnitude to at most 1, preserving analog input
  strength and preventing faster diagonal movement.
- Clear held input on blur, visibility loss, pointer cancellation, and teardown.
  Keep simultaneous touch controls independent by tracking pointer identity.
- Maintain regression checks for keyboard/touch direction equivalence,
  opposing inputs, diagonal speed, cancellation, and camera headings
  of 0, 90, 180, and 270 degrees.

## Resource lifecycle

- Reuse resources and avoid unnecessary allocations in per-frame hot paths.
- Dispose obsolete geometries, materials, textures, and render targets when
  their ownership ends. Do not dispose resources still shared by active users.
- For lifecycle changes, check repeated scene entry/exit or restart for
  unexplained resource growth.
- Report renderer geometry/texture counts as counts, not GPU-memory bytes.
  Report heap, process RAM, and estimated graphics memory separately.

## Validation and reporting

- For rendering, scene-content, dependency, or input changes, run the relevant
  build checks and regression tests, including the draw-call budget when
  rendering workload may change. Documentation-only changes do not require
  a graphics run.
- Use the actual production rendering path in automated graphics checks.
  Record any test-only differences.
- Record revision, browser/version, backend, hardware/software rendering,
  scenario, viewport, DPR, quality preset, and sample length.
- Report draw-call peak, relevant resource counts, runtime/shader errors,
  and pass/fail/unverified status. Compare before/after under equivalent
  conditions when claiming an improvement.
- Software-rendered headless checks establish only the functionality,
  visuals, and workload actually observed. They do not certify physical
  device performance, frame pacing, input latency, or touch feel.
- If WebGPU cannot run in the environment, report it as unverified.
  A passing WebGL fallback does not verify the WebGPU path.
- Verify actual performance and interaction on representative physical
  target devices using the deployed build. Record device, browser, settings,
  frame-time measurements, and manual keyboard/touch observations.
- If physical verification is unavailable, explicitly state:
  "Cloud validation completed; target-device performance and interaction
  remain unverified."
  Include the remaining checks without presenting them as completed.

## Git and deployment

- Commit as mrskydiver2015-code <mrskydiver2015@gmail.com>.
- Use Conventional Commits: feat:, fix:, chore:, or docs:.
- Standard pushes of authorized changes to main for Git-triggered Vercel
  deployment are pre-authorized.
- Direct Vercel connector deployments follow the connector's approval policy.
- Verify deployment success and the intended served content before reporting
  a deployment as complete.
