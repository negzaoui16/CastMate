# 🔧 Configuration des URLs de Production

## 📋 Variables d'environnement requises

Pour que les URLs d'affiches de casting utilisent l'URL de production au lieu de `localhost:3000`, configurez les variables d'environnement suivantes :

### Option 1 : Utiliser PRODUCTION_URL (recommandé)

```env
# .env
PRODUCTION_URL=https://cast-mate.vercel.app
```

### Option 2 : Utiliser API_BASE_URL

```env
# .env
API_BASE_URL=https://cast-mate.vercel.app
```

### Priorité des variables

Le backend utilise les variables dans cet ordre de priorité :

1. **PRODUCTION_URL** (priorité la plus haute)
2. **API_BASE_URL** (si PRODUCTION_URL n'est pas définie)
3. **http://localhost:3000** (valeur par défaut en développement)

## 🚀 Configuration pour différents environnements

### Développement local

```env
# .env (développement)
PRODUCTION_URL=http://localhost:3000
# ou simplement ne pas définir PRODUCTION_URL
```

### Staging / Production

```env
# .env (production)
PRODUCTION_URL=https://cast-mate.vercel.app
```

### Vercel

Sur Vercel, ajoutez la variable d'environnement dans les paramètres du projet :

1. Allez dans **Settings** > **Environment Variables**
2. Ajoutez :
   - **Name**: `PRODUCTION_URL`
   - **Value**: `https://cast-mate.vercel.app`
   - **Environment**: Production, Preview, Development (selon vos besoins)

Ou utilisez `vercel.json` :

```json
{
  "env": {
    "PRODUCTION_URL": "https://cast-mate.vercel.app"
  }
}
```

## ✅ Vérification

Après avoir configuré les variables d'environnement, vérifiez que les URLs sont correctes :

### Test 1 : Créer un nouveau casting avec affiche

```bash
POST /castings
# Réponse attendue :
{
  "media": {
    "afficheUrl": "https://cast-mate.vercel.app/media/6915b9169293304d0e454646"
  }
}
```

### Test 2 : Récupérer un casting existant

```bash
GET /castings/:id
# L'URL devrait être normalisée automatiquement même si elle était en localhost avant
```

## 🔄 Normalisation automatique

Le backend normalise automatiquement les URLs existantes qui contiennent `localhost` :

- `http://localhost:3000` → `https://cast-mate.vercel.app`
- `http://127.0.0.1:3000` → `https://cast-mate.vercel.app`
- `https://localhost:3000` → `https://cast-mate.vercel.app`

Cela garantit que même les castings créés avant la configuration utilisent les bonnes URLs.

## 📝 Notes importantes

1. **HTTPS en production** : Assurez-vous que l'URL de production utilise `https://` et non `http://`

2. **Pas de slash final** : L'URL ne doit pas se terminer par un slash :
   - ✅ `https://cast-mate.vercel.app`
   - ❌ `https://cast-mate.vercel.app/`

3. **Redémarrage requis** : Après avoir modifié les variables d'environnement, redémarrez le serveur backend

4. **Vercel** : Les variables d'environnement sont automatiquement déployées lors du prochain déploiement

## 🐛 Dépannage

### Les URLs contiennent encore localhost

1. Vérifiez que la variable `PRODUCTION_URL` est bien définie
2. Redémarrez le serveur backend
3. Vérifiez les logs au démarrage pour confirmer la valeur utilisée

### Les images ne se chargent pas

1. Vérifiez que l'URL est accessible (testez dans un navigateur)
2. Vérifiez que le endpoint `/media/:fileId` est accessible publiquement ou avec authentification
3. Vérifiez les CORS si vous testez depuis un frontend différent

