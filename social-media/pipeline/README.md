# WearBloom — pipeline de contenu social

Ce dossier produit automatiquement des carrousels de conseils mode en anglais à partir d'une bibliothèque fixe de vêtements détourés. Le design reste volontairement simple : fond blanc, texte noir, séparateurs gris, deux à quatre articles maximum par slide.

Le premier lot couvre les dix concepts validés : associations de couleurs, formules de tenues, effet des chaussures, météo, dress codes, correction d'une tenue plate, formule de silhouette, couleurs oubliées, closet math et third-piece rule.

## Ce que produit une commande

Pour chaque post :

- 5 à 7 slides Instagram en 1080 × 1350 ;
- les mêmes slides adaptées au photo mode TikTok en 1080 × 1920 ;
- une légende anglaise et ses hashtags ;
- la recette JSON source ;
- un manifeste exploitable plus tard par un outil de programmation ;
- deux planches de contrôle, une par plateforme.

Un lot contient aussi `queue.csv`, `batch.json` et une planche de toutes les covers.

## Lancer le pipeline

Prérequis : Node.js 20+.

```bash
cd social-media/pipeline
npm install
npm run sample
```

Créer un autre lot déterministe :

```bash
npm run generate -- --count 10 --seed week-2026-34
```

Limiter à une série :

```bash
npm run generate -- --count 1 --seed test --series shoe-changes-outfit
```

Afficher les séries disponibles :

```bash
npm run generate -- --help
```

Le `seed` fixe l'ordre du lot. Relancer la même commande donne le même contenu et remplace uniquement les fichiers du même lot.

## Architecture

```text
catalog.json                   base d'images et métadonnées mode
config.json                    formats, style et limites éditoriales
assets/cutout/                 bibliothèque PNG transparente
src/series.mjs                 dix familles de contenu
src/generate.mjs               planification, validation et exports
src/render.mjs                 moteur visuel déterministe
src/check.mjs                  contrôle des assets et dimensions
recipes/generated/<batch>/     recettes conservées séparément
output/<batch>/                posts prêts pour revue humaine
```

## Ajouter des vêtements à la base

Chaque image doit être un PNG détouré, centré, sans logo ni texte. Elle ne doit être marquée `publishable: true` que si son droit d'utilisation sur les réseaux sociaux est clair.

Ajouter le fichier dans `assets/cutout/`, puis une entrée dans `catalog.json` :

```json
{
  "id": "navy-straight-jeans",
  "name": "navy straight jeans",
  "category": "bottom",
  "color": "navy",
  "colorHex": "#18243B",
  "silhouette": "straight",
  "texture": "denim",
  "warmth": 2,
  "formality": 2,
  "asset": "assets/cutout/navy-straight-jeans.png",
  "source": "owned product photography",
  "publishable": true
}
```

Au début, un JSON versionné est préférable à Airtable : il est plus simple à valider, reproductible et gratuit. Une migration vers Airtable ou une base SQL devient utile quand plusieurs personnes enrichissent plusieurs centaines d'assets.

## Garde-fous automatiques

Le pipeline bloque le rendu si :

- une image référencée n'existe pas ;
- un asset n'est pas explicitement publiable ;
- une slide dépasse quatre articles ;
- une recette sort de la plage de 5 à 7 slides ;
- un titre ou une légende dépasse la longueur autorisée.

Après génération :

```bash
npm run check
```

Le contrôle humain reste volontairement obligatoire. Les manifestes portent le statut `ready-for-human-review`, jamais `published`.

## Comment passer à la production de masse

Le moteur de rendu est déjà indépendant du contenu. La montée en volume consiste donc à enrichir deux couches, sans refaire le design :

1. agrandir `catalog.json` avec des assets dont les droits sont documentés ;
2. ajouter des variantes dans `src/series.mjs` selon la catégorie, la couleur, la coupe, la matière, la formalité et la météo ;
3. produire un lot hebdomadaire ;
4. valider la planche de covers et les previews ;
5. programmer les exports approuvés ;
6. réinjecter les vues, partages, sauvegardes et taux de swipe dans le choix des séries.

Le texte peut ensuite être proposé par un modèle, mais il doit rendre une recette JSON validée par ces mêmes règles. Le modèle ne contrôle jamais directement la mise en page ni le droit de publication d'un visuel.
