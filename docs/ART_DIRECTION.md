# Battle Lab — Art direction

## V1.5–V1.6
- Preserve all eight original character identities, outfits and faces.
- Target eight directions (N, NE, E, SE, S, SW, W, NW), eight running frames per direction. Verify actual artwork, not merely renderer indexing. Prioritize striped-shirt character and bear.
- Preserve jungle temple concept, use coherent soft 3D chibi lighting and camera angle. Keep collision geometry aligned with visual obstacles; separate destructible crates from static background.
- Crates: consistent perspective, wood and gold metal, intact/hit/broken states, transparent sprites.
- Mobile landscape: left movement joystick, right tap/hold auto-aim attack, two skill buttons, dash and pickup. Preserve multi-touch.
- Preserve weapon range and cone specifications; grenade lands and explodes in a circle after 0.8s, radius 90, damage 500. Octopus throws over walls.

## Acceptance checks
- Check every direction and frame for all eight characters, including AI rendering.
- No clipping, unwanted rotation, background residue or inconsistent scale.
- Compare wall, river, bridge, bush and crate visuals against gameplay collision.
- Test landscape layout and simultaneous movement/attack on mobile.

## Collaboration
ChatGPT owns art, UI and content; Claude owns technical refactoring, combat, AI and performance. Keep changes on separate branches; review before merging to main. Coordinate asset paths with Claude before changing runtime code. This document is a specification, not evidence of implemented or tested features.
