## MaloCraft V3.4.3 – Lisibilité POI

- Tooltip desktop : `PoiTooltip` positionné au-dessus du POI (portal body, clamp écran) affichant label + barre %.
- Mobile : `PoiInfoPanel` en bottom sheet compacte (label, % + barre, CTA session si dispo). ESC/close ferme.
- Wiring `BlockPOI` :
  - Desktop : hover/focus => tooltip. Click conserve l’action existante.
  - Mobile : tap => ouvre le panneau ; CTA déclenche l’action. ESC ferme.
  - aria-label : `Lancer le bloc <label>, maîtrise <pct>%`, focusable.
- Clamp utilitaire testé (`clampTooltipPosition`), ESC géré, debug overlays/transitions inchangés.

QA
1) Hover POI desktop → tooltip avec nom + % + barre.  
2) Tab focus → tooltip visible.  
3) Mobile tap → panneau bas, tap Fermer ferme.  
4) CTA du panneau lance la session (action existante intacte).  
5) prefers-reduced-motion : animations minimes.  
