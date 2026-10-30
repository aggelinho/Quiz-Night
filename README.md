# Quiz Night

Στατική σελίδα (HTML/CSS/JS, χωρίς build) με τρία quiz:

- **Quizball**: ποδόσφαιρο. Οι παίκτες διαλέγουν εναλλάξ 8 από τις 12 κατηγορίες. Ταμπλό 16/18/20 ερωτήσεων (εύκολη 1, μέτρια 2, δύσκολη 3 πόντοι). Γραπτή ή φωνητική απάντηση, χωρίς χρόνο· όταν το σύστημα απορρίπτει μια απάντηση, ο αντίπαλος μπορεί να την κάνει δεκτή.
- **Crunch Time**: μπάσκετ. 4 περίοδοι × 4 επιθέσεις ανά παίκτη. Βολή = 1 (εύκολη), δίποντο = 2 (μέτρια), τρίποντο = 3 (δύσκολη). Ισοπαλία → παράταση.
- **Γεωγραφία**: σημαίες, χάρτες, πρωτεύουσες, γείτονες, πληθυσμός, έκταση, νομίσματα, βουνά, ποτάμια, ήπειροι, Ελλάδα.

Τρόποι: με τον υπολογιστή (3 επίπεδα), 2 παίκτες στην ίδια συσκευή, online με κωδικό δωματίου.

Οι ερωτήσεις παράγονται τυχαία σε κάθε παιχνίδι από τα δεδομένα στο `js/data/`, χωρίς επαναλήψεις μέσα στο ίδιο παιχνίδι.

## Δομή

```
index.html            αρχική
play.html             παιχνίδι (?quiz=football | basketball | geo)
css/style.css
js/data/              δεδομένα (εδώ προσθέτεις/ενημερώνεις)
js/questions.js       γεννήτριες ερωτήσεων ανά κατηγορία
js/engine.js          κανόνες, αντίπαλος Η/Υ, session
js/online.js          Firebase δωμάτια
js/map.js             χάρτης (d3 + world-atlas από CDN)
js/firebase-config.js στοιχεία Firebase
tools/                script που ξαναχτίζει τα δεδομένα χωρών
```

## Hosting σε GitHub Pages

1. Ανέβασε τον φάκελο σε ένα repo.
2. Settings → Pages → Source: *Deploy from a branch* → `main` / `/ (root)`.
3. Η σελίδα θα είναι στο `https://<user>.github.io/<repo>/`.

Τοπικά: `python3 -m http.server` μέσα στον φάκελο και άνοιξε `http://localhost:8000`.

## Ενεργοποίηση online (Firebase)

1. https://console.firebase.google.com → Create project (το Google Analytics δεν χρειάζεται).
2. Build → **Realtime Database** → Create database → τοποθεσία `europe-west1` → *Start in locked mode*.
3. Στην καρτέλα **Rules** βάλε:

```json
{
  "rules": {
    "rooms": {
      "$code": {
        ".read": true,
        ".write": true,
        ".validate": "$code.length === 5"
      }
    }
  }
}
```

4. Project settings → Your apps → Web (`</>`) → Register app. Αντέγραψε το `firebaseConfig` στο `js/firebase-config.js` (πρέπει να υπάρχει και το `databaseURL`).
5. Ανέβασε ξανά στο GitHub.

Οι κανόνες αυτοί επιτρέπουν σε οποιονδήποτε να γράφει στο `rooms/`. Για παρέα αρκεί· αν η σελίδα γίνει δημόσια με πολλή κίνηση, θέλει αυστηρότερους κανόνες (π.χ. Anonymous Auth).

Πώς δουλεύει: ο οικοδεσπότης κρατά το παιχνίδι και γράφει την κατάσταση στο `rooms/<code>/state`. Ο φιλοξενούμενος στέλνει τις κινήσεις του στο `rooms/<code>/actions`. Όταν φύγει ο οικοδεσπότης, το δωμάτιο σβήνεται αυτόματα.

## Ενημέρωση δεδομένων

### Quizball (`js/data/quizball.js`)
Παράγεται με scripts από Wikipedia/Wikidata (τρέχουν με Python 3, `pip install beautifulsoup4`):

```
python3 tools/fetch_finals.py    # τελικοί CL / Μουντιάλ / Euro / Europa / Conference
python3 tools/parse_finals.py    # 11άδες, σκορ, σκόρερ, εθνικότητες
python3 tools/fetch_people.py    # καριέρες παικτών & προπονητών (infobox) + Wikidata
python3 tools/parse_people.py
python3 tools/fetch_top5.py      # λίστες Top 5 από πίνακες Wikipedia
python3 tools/build_qb.py        # γράφει το js/data/quizball.js
```
Τα scripts γράφουν ενδιάμεσα αρχεία στο `/tmp/qb/` (άλλαξέ το στην αρχή τους αν θες).

- **Ποδόσφαιρο / μπάσκετ**: `js/data/football.js`, `js/data/basketball.js`. Πρόσθεσε νέες χρονιές (π.χ. νικητή Champions League 2026), παίκτες στο `careers` με δυσκολία `d: 1-3`, κ.λπ. Οι μετρήσεις «ποιος έχει περισσότερα» για Champions League και Μουντιάλ υπολογίζονται αυτόματα από τις λίστες νικητών· οι τίτλοι NBA/Euroleague στο `nbaTitles` / `euroleagueTitles` ενημερώνονται με το χέρι.
- **Χώρες**: `js/data/geo-countries.js` παράγεται από το `tools/build_geo.js` (πακέτα npm `world-countries`, `i18n-iso-countries`, `world-atlas`, `country-json` + ερωτήματα Wikidata στο `tools/*.rq`).
- **Ελλάδα / ποτάμια**: `js/data/geo-extra.js`.

Τα ιστορικά στοιχεία φτάνουν μέχρι τη σεζόν 2024-25.
