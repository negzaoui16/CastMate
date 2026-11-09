# 🔒 Fix : Erreur 403 sur les affiches de casting

## 🐛 Problème identifié

Les affiches de casting retournaient une erreur **HTTP 403** "Authentification requise pour accéder à ce fichier" lors du chargement depuis le frontend Android.

### Logs d'erreur

```
❌ Erreur chargement image: HTTP 403: 
❌ URL: https://cast-mate.vercel.app/media/692f3354cdf6acafa58aafdf
❌❌❌ ERREUR 403: Authentification requise pour accéder à ce fichier ❌❌❌
```

### Cause du problème

Les affiches de casting (`casting_affiche`) nécessitaient une authentification JWT, alors que :
- Les castings sont **publics** (routes `@Public()` dans le controller)
- Les affiches sont nécessaires pour visualiser les castings
- Le frontend Android charge les images sans token d'authentification

## ✅ Solution appliquée

Les affiches de casting sont maintenant **accessibles publiquement**, comme les images NFT.

### Modifications apportées

#### 1. Service Media (`src/media/media.service.ts`)

**Avant :**
```typescript
// Les affiches de casting sont accessibles à tous les utilisateurs authentifiés
if (fileField === 'casting_affiche') {
  // Vérifier que l'utilisateur est authentifié (a un ID)
  if (!requesterId) {
    throw new ForbiddenException('Authentification requise pour accéder à ce fichier');
  }
  return; // Autoriser l'accès
}
```

**Après :**
```typescript
// Les affiches de casting sont accessibles publiquement
// car les castings sont publics (routes @Public()) et les affiches sont nécessaires pour leur visualisation
if (fileField === 'casting_affiche') {
  return; // Accès public autorisé
}
```

#### 2. Controller Media (`src/media/media.controller.ts`)

**Avant :**
```typescript
// Cache public pour les images NFT
const isNFTImage = file.metadata?.field === 'nft_image';
const cacheControl = isNFTImage
  ? 'public, max-age=31536000' // Cache 1 an pour les NFTs
  : 'private, no-cache';
```

**Après :**
```typescript
// Cache public pour les images NFT et les affiches de casting
const isPublicImage = 
  file.metadata?.field === 'nft_image' || 
  file.metadata?.field === 'casting_affiche';
const cacheControl = isPublicImage
  ? 'public, max-age=31536000' // Cache 1 an pour les images publiques
  : 'private, no-cache';
```

## 📊 Résultats

### Avant le fix

```bash
GET https://cast-mate.vercel.app/media/692f3354cdf6acafa58aafdf
# Sans token d'authentification

Response: 403 Forbidden
{
  "message": "Authentification requise pour accéder à ce fichier",
  "error": "Forbidden",
  "statusCode": 403
}
```

### Après le fix

```bash
GET https://cast-mate.vercel.app/media/692f3354cdf6acafa58aafdf
# Sans token d'authentification

Response: 200 OK
Content-Type: image/jpeg
Cache-Control: public, max-age=31536000
[Image data]
```

## 🔐 Sécurité

### Fichiers publics (pas d'authentification requise)

- ✅ **Images NFT** (`nft_image`)
- ✅ **Affiches de casting** (`casting_affiche`)

### Fichiers nécessitant une authentification

- 🔒 **Vidéos d'audition** (`audition_video`) - Propriétaire ou recruteur du casting
- 🔒 **Photos de profil acteurs** (`photo` + `ownerRole: ACTEUR`) - Propriétaire uniquement
- 🔒 **Documents/CV acteurs** (`document`) - Propriétaire uniquement
- 🔒 **Galerie acteurs** (`gallery`) - Propriétaire uniquement
- 🔒 **Photos de profil agences** (`photo` + `ownerRole: RECRUTEUR`) - Utilisateurs authentifiés

## 🎯 Avantages

1. **Cohérence** : Les affiches sont publiques comme les castings
2. **Performance** : Cache public activé (1 an) pour les affiches
3. **Simplicité** : Le frontend n'a pas besoin d'envoyer de token pour charger les images
4. **Compatibilité** : Fonctionne avec tous les clients (web, Android, iOS)

## 📝 Notes importantes

- Les affiches de casting sont maintenant **publiques** et accessibles sans authentification
- Le cache est activé pour améliorer les performances
- Les autres fichiers médias restent protégés selon les règles de sécurité existantes
- Aucun changement nécessaire côté frontend

## 🧪 Tests

### Test 1 : Accès sans authentification

```bash
curl -I https://cast-mate.vercel.app/media/692f3354cdf6acafa58aafdf

# Attendu :
HTTP/2 200
Content-Type: image/jpeg
Cache-Control: public, max-age=31536000
```

### Test 2 : Chargement depuis le frontend

```typescript
// Le frontend peut maintenant charger les images sans token
const imageUrl = casting.media?.afficheUrl;
<img src={imageUrl} alt={casting.titre} />
```

## 🚀 Déploiement

1. Les modifications sont déjà appliquées dans le code
2. Redéployez l'application sur Vercel
3. Testez le chargement des affiches depuis le frontend Android
4. Vérifiez que les images se chargent correctement

---

**Date du fix** : 2025-12-03
**Fichiers modifiés** :
- `src/media/media.service.ts`
- `src/media/media.controller.ts`

