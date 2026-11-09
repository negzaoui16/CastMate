# ✅ Fix : Normalisation des URLs d'affiches pour la production

## 🎯 Problème résolu

Les URLs d'affiches de casting contenaient `http://localhost:3000` au lieu de l'URL de production `https://cast-mate.vercel.app`, ce qui empêchait le frontend Android de charger les images.

## ✅ Modifications apportées

### 1. Service Castings (`src/castings/castings.service.ts`)

#### Changement 1 : Priorité des variables d'environnement

**Avant :**
```typescript
this.baseUrl =
  this.configService.get<string>('API_BASE_URL') ||
  'http://localhost:3000';
```

**Après :**
```typescript
// Priorité : PRODUCTION_URL > API_BASE_URL > localhost
this.baseUrl =
  this.configService.get<string>('PRODUCTION_URL') ||
  this.configService.get<string>('API_BASE_URL') ||
  'http://localhost:3000';
```

#### Changement 2 : Ajout de la normalisation des URLs

Nouvelle méthode `normalizeUrl()` qui remplace automatiquement les URLs contenant `localhost` :

```typescript
private normalizeUrl(url: string): string {
  if (!url) {
    return url;
  }

  // Remplacer localhost par l'URL de production
  const normalizedUrl = url
    .replace(/http:\/\/localhost:3000/g, this.baseUrl)
    .replace(/http:\/\/127\.0\.0\.1:3000/g, this.baseUrl)
    .replace(/https:\/\/localhost:3000/g, this.baseUrl)
    .replace(/https:\/\/127\.0\.0\.1:3000/g, this.baseUrl);

  return normalizedUrl;
}
```

#### Changement 3 : Normalisation dans `transformCasting()`

La méthode `transformCasting()` normalise maintenant aussi les URLs existantes :

```typescript
private transformCasting(casting: any): any {
  // ... code existant pour générer l'URL ...
  
  // Normaliser l'URL existante si elle contient localhost
  // (pour les castings créés avant le fix)
  if (casting.media?.afficheUrl) {
    casting.media.afficheUrl = this.normalizeUrl(casting.media.afficheUrl);
  }

  return casting;
}
```

## 🔧 Configuration requise

### Variables d'environnement

Ajoutez dans votre fichier `.env` ou dans les variables d'environnement Vercel :

```env
# Option 1 : Utiliser PRODUCTION_URL (recommandé)
PRODUCTION_URL=https://cast-mate.vercel.app

# Option 2 : Utiliser API_BASE_URL (si PRODUCTION_URL n'est pas définie)
API_BASE_URL=https://cast-mate.vercel.app
```

### Configuration Vercel

1. Allez dans **Settings** > **Environment Variables**
2. Ajoutez :
   - **Name**: `PRODUCTION_URL`
   - **Value**: `https://cast-mate.vercel.app`
   - **Environment**: Production, Preview, Development

## 📊 Résultats attendus

### Avant le fix

```json
{
  "media": {
    "afficheFileId": "6915b9169293304d0e454646",
    "afficheUrl": "http://localhost:3000/media/6915b9169293304d0e454646"
  }
}
```

### Après le fix

```json
{
  "media": {
    "afficheFileId": "6915b9169293304d0e454646",
    "afficheUrl": "https://cast-mate.vercel.app/media/6915b9169293304d0e454646"
  }
}
```

## ✅ Avantages

1. **Normalisation automatique** : Les castings existants avec des URLs `localhost` sont automatiquement normalisés
2. **Nouveaux castings** : Les nouveaux castings utilisent directement l'URL de production
3. **Rétrocompatibilité** : Fonctionne avec les castings créés avant le fix
4. **Flexibilité** : Support de `PRODUCTION_URL` et `API_BASE_URL`

## 🧪 Tests effectués

- ✅ Génération d'URLs avec l'URL de production
- ✅ Normalisation des URLs existantes contenant localhost
- ✅ Support de différentes variantes de localhost (127.0.0.1, http/https)
- ✅ Fallback vers localhost en développement si aucune variable n'est définie

## 📝 Notes

- Les URLs sont normalisées à chaque fois qu'un casting est retourné par l'API
- Aucun changement de base de données n'est nécessaire
- Les castings existants seront automatiquement corrigés lors de la prochaine récupération
- Le frontend n'a pas besoin de modifications supplémentaires

## 🚀 Déploiement

1. Ajoutez la variable `PRODUCTION_URL` dans Vercel
2. Redéployez l'application
3. Testez en créant un nouveau casting avec une affiche
4. Vérifiez qu'un casting existant retourne une URL normalisée

---

**Date du fix** : $(date)
**Fichiers modifiés** :
- `src/castings/castings.service.ts`
- `ENV_SETUP.md` (documentation mise à jour)
- `CONFIGURATION_URL_PRODUCTION.md` (nouveau guide)

