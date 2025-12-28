# Normalisation des réponses (cas de tests rapides)

Pseudo-tests (alignés avec `src/utils/normalize.ts`) pour éviter régressions/faux positifs :

- `"  Bonjour   "` → `bonjour`
- `"Café"` → `cafe`
- `"élève"` → `eleve`
- `"l’ami"` → `l'ami`
- `"  L'AMI "` → `l'ami`
- `"A  B   C"` → `a b c`
- `"été"` vs `"ete"` doivent matcher (`ete`)
- `"à"` vs `"a"` ne doivent matcher que si tolérance accent est acceptée (ici oui → `a`)
- `"garçon"` → `garcon`
- `"bonheur!"` conserve le `!` (punctuation forte non stripée, évite faux positifs sur homophones)

Notes :
- Les accents sont supprimés (NFD).
- Pas de suppression de ponctuation forte par défaut (on garde `!`, `?`, `.`) pour limiter les faux positifs ; seul l’apostrophe typographique est normalisée.
