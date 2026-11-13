# EMPIRES OF AKANU

## PHASE 3.5 --- VISUAL QUALITY, 3D ASSET AND ENVIRONMENT UPGRADE

You are continuing development of **Empires of Akanu**, an
African-inspired historical 3D real-time strategy game.

The existing project already contains: - Phase 1: Core game foundation,
kingdom selection, 3D world, camera and settlement. - Phase 2: Economy,
villagers, occupations, buildings, construction and resource
management. - Phase 3: Military recruitment, soldiers, unit control,
formations, combat and siege foundations.

Your task is to substantially improve the visual quality of the existing
game before Phase 4.

**Read this entire file before making changes.** First inspect the
existing project, then prepare a concise implementation plan, and
finally implement the upgrade incrementally.

------------------------------------------------------------------------

## 1. PROJECT PRESERVATION AND INITIAL AUDIT

Before changing code: 1. Inspect the project structure, rendering
architecture, asset pipeline and visual systems. 2. Inspect existing
character models, procedural geometry, rigs, animations, buildings,
terrain, vegetation, materials, textures, lighting, camera and effects.
3. Identify placeholder assets, repeated patterns, visual
inconsistencies and rendering bottlenecks. 4. Reuse existing systems and
preserve all working features. 5. Do not rebuild the game or replace its
working economy, military, recruitment, movement, combat, formation,
camera, selection, save or loading systems. 6. Do not discard previous
character upgrades or replace quality assets with primitive
placeholders. 7. Make the smallest safe architectural changes and keep
visual systems modular. 8. Never claim to have inspected or tested
something unless you actually did.

This is a visual upgrade, not a gameplay redevelopment.

## 2. TARGET ART DIRECTION

Establish a consistent visual identity: **a premium, highly detailed and
realistic African-inspired historical world with cinematic environmental
presentation**, comparable in visual ambition to a professionally
produced modern 3D strategy game.

Improve geometry, proportions, surface detail, material response,
lighting, animation and composition together.

Avoid generic low-poly assets, primitive human figures, flat untextured
colours, plastic-looking materials, cartoon-like buildings, repetitive
terrain, identical trees or props, floating/intersecting objects,
inconsistent lighting and cheap-looking effects.

The five kingdoms are fictional. Create original visual identities
informed by appropriate African architectural, material, clothing and
craft traditions. Do not homogenise African cultures or claim fictional
designs are historically exact.

## 3. CHARACTER AND ANIMATION UPGRADE

Upgrade all existing character categories: villagers and civilian
occupations; infantry, spearmen, archers, cavalry, Royal Guards, scouts,
commanders and siege engineers.

Improve human anatomy, body proportions, head and facial structure, skin
material response, facial detail, hair, hands, feet, clothing layers and
equipment. Improve cloth, leather, wood and metal material definition.

Create distinct kingdom-specific clothing, armour, colours, hairstyles,
accessories and weapon details. Do not merely recolour the same model
for every kingdom.

Improve idle breathing, walking, running, turning, gathering, carrying,
building, attacking, defending, taking damage, death, victory, bow
shooting and cavalry movement. Reuse the existing rig and animation
system where possible. If procedural animation is necessary, improve it
without breaking existing animation states.

Avoid foot sliding, stiff posture, unnatural limb movement and
incorrectly attached weapons or equipment.

## 4. BUILDINGS AND ARCHITECTURE

Upgrade houses and compounds; farms, granaries, marketplaces and
warehouses; mines, blacksmiths and weapon workshops; barracks, archery
grounds and cavalry stables; palaces, council chambers and treasuries;
walls, gates, towers and fortresses.

Improve structural proportions, foundations, walls, roofs, doors,
windows, pillars, supports, decoration, entrances, surface wear and
material transitions.

Use believable materials where appropriate: mud brick, natural plaster,
stone, clay, timber, thatch, woven materials and metal fittings.

Give the five kingdoms recognisably different architectural identities
while maintaining a coherent world style.

Preserve building placement and construction mechanics. Improve visual
construction stages so foundations, framework, partial walls, roof work
and completed structures correspond to actual construction progress.

## 5. TERRAIN AND REGIONAL ENVIRONMENTS

Improve terrain geometry, height variation, surface textures, texture
blending, normal detail, natural transitions, vegetation distribution
and environmental composition.

Each region must have a distinct identity:

-   **Golden Savannah:** natural grass variation, dry vegetation,
    acacia-inspired trees, scattered rocks and warm daylight.
-   **Great Forests:** dense varied trees, undergrowth, layered
    vegetation, forest floors and natural shadows.
-   **Northern Highlands:** rocky terrain, elevation changes, hills,
    cliffs, exposed stone and mountain vegetation.
-   **Riverlands:** detailed riverbanks, streams, wetlands, reeds, rich
    soil and natural shoreline transitions.
-   **Coastal Territories:** beaches, sandy terrain, coastal vegetation,
    rock formations and convincing water edges.

Avoid obvious repeated texture tiling and artificial object placement.
Use procedural variation intelligently without excessive geometry or
draw calls.

## 6. VEGETATION AND NATURAL ASSETS

Upgrade trees, bushes, grass, flowers, rocks, fallen logs, crops, reeds,
palms and other regional vegetation. Improve silhouettes, proportions,
geometry, materials and distribution. Add subtle wind animation where
practical.

Preserve harvesting mechanics. Harvested resource objects must visibly
change consistently with the existing resource system.

Use instancing, batching, level of detail and distance culling where
appropriate. Avoid excessive object counts.

## 7. WEAPONS, ARMOUR AND SIEGE ASSETS

Improve swords, spears, bows, arrows, shields, helmets, armour, cavalry
equipment, battering rams, siege towers and catapults.

Use detailed geometry and appropriate materials. Ensure weapons and
shields are correctly attached to characters.

Improve visual feedback for arrow flight, weapon impacts, shield
impacts, siege attacks, structural damage and destruction. Preserve
existing combat calculations and game-state logic.

## 8. LIGHTING, MATERIALS AND RENDERING

Inspect the existing Three.js / React Three Fiber rendering pipeline and
improve it using techniques genuinely supported by the project.

Consider physically based rendering (PBR), appropriate
albedo/roughness/metalness/normal/ambient-occlusion maps, directional
sunlight, environment lighting, higher-quality shadows, affordable
ambient occlusion, tone mapping, anti-aliasing, reflection and material
response, atmospheric fog, distance haze and consistent colour grading.

Create depth and atmosphere without excessively dark scenes, blown
highlights or unrealistic saturation. Daylight should be the default.

Do not add expensive post-processing indiscriminately. Measure
performance costs and provide lower-cost alternatives.

## 9. WATER AND ENVIRONMENTAL EFFECTS

Improve rivers, lakes and coastal water with convincing surface
movement, reflections, transparency where appropriate and natural
shoreline transitions.

Add restrained environmental effects where useful: wind-driven
vegetation, troop dust, settlement smoke, blacksmith sparks,
construction dust and subtle atmospheric particles.

Keep effects believable and performance-conscious. Do not overwhelm the
scene with particles.

## 10. CAMERA AND PRESENTATION

Preserve the current elevated/isometric RTS camera, rotation, zoom and
panning controls.

Improve camera interpolation, framing, clipping, distance visibility and
depth perception where needed. Do not turn the game into a
cinematic-only experience. Players must retain precise control over
settlements and battles.

## 11. ASSET PIPELINE AND REALISTIC CONSTRAINTS

Keep development practical through Google AI Studio and code-based
workflows. Do not assume Google AI Studio automatically supplies
professional 3D models. Do not invent unavailable asset-generation APIs
or capabilities.

Use this priority: 1. Improve existing procedural geometry and
materials. 2. Reuse and improve existing character geometry, rigs and
animations. 3. Generate detailed procedural assets through code where
appropriate. 4. Use genuinely available GLTF/GLB assets when they can be
legally and technically integrated. 5. Use free assets only when their
licences permit the intended use. 6. Build procedural textures and
material maps where appropriate. 7. Organise assets into reusable
libraries.

Do not introduce paid assets, subscriptions, paid APIs or billable
services without explicit approval. Do not describe primitive
placeholders as realistic assets. If the requested fidelity cannot be
achieved with the available pipeline, explain the limitation and
implement the best feasible alternative.

## 12. GRAPHICS QUALITY SETTINGS

Implement or refine these presets:

-   **LOW:** reduced shadows, simplified vegetation and effects, lower
    texture resolution and aggressive distance culling.
-   **MEDIUM:** balanced shadows, vegetation, textures and effects.
-   **HIGH:** higher texture quality, better shadows, more environmental
    detail and effects.
-   **ULTRA:** highest quality supported by the device and rendering
    pipeline, including maximum suitable texture, shadow, vegetation and
    environmental detail.

Do not promise unsupported features. Detect device capability where
practical and recommend a suitable preset, while allowing manual
changes. Preserve stable performance on lower-end Android devices.

## 13. VISUAL INSPECTION AND VALIDATION

Create a practical visual inspection workflow. Render and inspect: 1.
Golden Savannah village. 2. Great Forest settlement. 3. Fortified city.
4. Marketplace. 5. Military recruitment building. 6. Infantry group. 7.
Archer formation. 8. Cavalry group. 9. Battlefield with multiple unit
classes. 10. Siege attack on a fortified structure.

Evaluate geometry, proportions, textures, materials, lighting, shadows,
vegetation, animation, consistency and performance.

Identify weak visual areas and improve them. Do not fabricate
screenshots or claim to have visually inspected scenes that were not
actually rendered.

## 14. REGRESSION AND PERFORMANCE TESTING

Verify that the main menu and kingdom selection, camera controls,
building placement and construction, villager movement and resource
collection, storage and economy, recruitment and military spawning, unit
selection and group movement, formations, combat, siege equipment, and
save/reload still work.

Check for rendering errors, broken assets, missing textures, animation
regressions, memory leaks, excessive draw calls and severe frame-rate
drops.

Use instancing, LOD, frustum culling, texture optimisation and
controlled update intervals where appropriate. Report performance
measurements with the actual device/browser and test conditions. Do not
invent benchmark results.

## 15. IMPLEMENTATION ORDER

Work incrementally: 1. Audit existing visual architecture and assets. 2.
Establish visual art direction. 3. Improve rendering and material
foundations. 4. Upgrade characters and animations. 5. Upgrade buildings
and architecture. 6. Upgrade terrain and regional environments. 7.
Upgrade vegetation and natural assets. 8. Upgrade weapons, armour and
siege assets. 9. Improve lighting, shadows, water and atmosphere. 10.
Refine camera presentation. 11. Implement graphics presets. 12. Inspect
representative scenes. 13. Optimise performance. 14. Run regression
tests and fix defects.

Do not replace every asset in one uncontrolled operation. Prioritise
visible and important assets, preserve working code and validate each
major group.

## 16. ACCEPTANCE CRITERIA

This phase is complete only when: - Characters show measurable
improvement in geometry, proportions, materials and animation. -
Buildings have more detailed architecture and believable materials. -
Terrain and vegetation look more natural and varied. - All five regions
have recognisable visual identities. - Military equipment has improved
detail and material quality. - Lighting and shadows provide better depth
and composition. - Water and environmental effects are improved where
applicable. - Existing gameplay and camera controls remain functional. -
Graphics presets work and do not promise unsupported capabilities. -
Mobile performance remains acceptable for the target device class. -
Regression tests pass.

## 17. FINAL TECHNICAL REPORT

At completion, report: 1. Existing rendering architecture inspected. 2.
Visual systems upgraded. 3. Character assets and animations upgraded. 4.
Buildings and architecture upgraded. 5. Terrain, vegetation and
environments upgraded. 6. Weapons and military assets upgraded. 7.
Lighting, materials and rendering changes. 8. New assets created and
existing assets modified. 9. Graphics settings implemented. 10.
Performance measurements and test conditions. 11. Regression tests
performed and results. 12. Remaining visual limitations and incomplete
work. 13. Recommendations before Phase 4.

Do not claim photorealism, AAA quality, completed testing or visual
inspection without evidence.

**Final instruction:** Implement actual visual improvements in the
existing project. Do not merely return a plan, mock-up, concept
description or list of future features. Preserve all working gameplay
systems and report honestly what was completed.
