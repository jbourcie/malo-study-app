## MaloCraft V3.4.1 – Décor chantier progressif

- Stages définis dans `src/world/v3/constructionStages.ts` : progress 0..24→0, 25..49→1, 50..74→2, 75..99→3, 100→4. `shouldShowConstruction` n’affiche l’overlay que si zoneState=`rebuilding` et stage>0.
- Pack-driven overlay : `monuments/<subject>/<zoneSlug>/construction_stage{0..3}.svg` (optionnel stage4). Le monument principal reste `monument_rebuilding.svg`.
- Fallback CSS : classes `mc-construction-stage-*` + `mc-construction-overlay` (rubalise/diagonales) si l’asset stage est absent.
- Intégration :
  - `ZoneMonument` calcule stage via progressPct + zoneState et tente de charger l’overlay (sinon CSS fallback). Badge 🛠️ toujours présent en rebuilding.
  - `ZoneTile` miniatures héritent aussi du stage (pack overlay si dispo, sinon CSS).
- Aucun changement Firestore/routing; debug map et transitions inchangés.

### QA
1) Progress 10% (rebuilding) → stage0 overlay visible.  
2) Progress 30% (rebuilding) → stage1.  
3) Progress 60% (rebuilding) → stage2.  
4) Progress 90% (rebuilding) → stage3.  
5) Progress 100% (rebuilt) → plus d’overlay chantier.  
6) Overlay manquant → fallback CSS sans crash.  
7) `?mapDebug=1` + transitions OK.  
