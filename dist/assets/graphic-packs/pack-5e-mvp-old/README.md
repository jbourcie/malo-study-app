# pack-5e-mvp

Pack graphique minimal pour tester la pipeline MaloCraft.

## Contenu
- `pack.json` : manifeste du pack
- `base/map.svg` : fond 1920x1080
- `theme.css` : classes requises (biome/zone + is-highlighted/is-weathered/is-locked)
- `effects/*.css` : fichiers vides (placeholders), référencés dans `pack.json`

## Test rapide
1) Copier le dossier dans `/public/assets/graphic-packs/pack-5e-mvp/`
2) Charger le pack via ton loader (pack.json) et injecter les CSS listés.
3) Vérifier visuellement que les classes changent bien l’apparence :
   - `biome-damaged` / `biome-improving` / `biome-rebuilt`
   - `zone-intact` / `zone-rebuilding` / `zone-rebuilt` / `zone-degraded`
   - `is-highlighted`, `is-weathered`, `is-locked`
