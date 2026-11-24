# Battle Lab QA plan

Updated design: one primary weapon, three sequentially regenerating attack charges, tap auto-aim and drag manual aim, consumable grenades (max 3), accessories disabled but retained in code, crates drop weapons/grenades/instant healing. Preserve existing characters, skills and dash.

## P0 regression
- All eight characters selectable; existing eight-direction movement and skills preserved.
- Three attacks consume three charges; fourth blocked; charges recover individually, never exceed three.
- Tap auto-aim prioritizes enemies then crates; drag previews direction; release attacks; simultaneous movement works.
- Weapon-specific range, angle, damage and wall collision preserved.
- Grenades consume inventory independently, never regenerate, max three, arc over walls and river, explode after 0.8s; empty button disabled.
- Accessories cannot drop, equip or affect stats for players or bots; UI hidden.
- Crates drop only approved categories; healing capped at max HP.
- Bear sprint uses four-legged animation and restores normal movement afterward.
- Mobile landscape layout, touch cancellation, restart, victory and defeat.

## Balance observations
Record character, weapon, match duration, damage, survival, crate drops and control issues. Recharge timings, drop probabilities and heal amounts remain tunable; do not treat suggested values as final.

Status: test specification only; no execution or main branch changes.
