# 🔧 Fix : Erreur 403 sur les médias des acteurs

## 📋 Problème identifié

Les requêtes vers `/media/{fileId}` retournaient une erreur **403 Forbidden** même lorsque l'acteur authentifié tentait d'accéder à ses propres fichiers (photo de profil, galerie, CV).

## ✅ Corrections apportées

### 1. Ajout de logs de diagnostic dans `MediaController`

**Fichier** : `src/media/media.controller.ts`

Ajout de logs pour voir exactement ce qui est reçu dans le controller :

```typescript
console.log('[MediaController] Requête fichier:', {
  fileId: fileId,
  hasUser: !!user,
  userId: user?.id || user?._id,
  userRole: user?.role,
  userType: user?.type,
  userObject: { ... }
});
```

### 2. Amélioration de la logique dans `MediaService.assertCanAccess`

**Fichier** : `src/media/media.service.ts`

#### Changements :

1. **Normalisation des IDs** : Les IDs sont maintenant normalisés avec `.trim()` pour éviter les problèmes d'espaces
2. **Extraction de `ownerId` en amont** : L'`ownerId` est extrait une seule fois au début de la fonction
3. **Logs détaillés** : Ajout de logs à chaque étape pour diagnostiquer les problèmes
4. **Messages d'erreur plus explicites** : Les logs d'erreur incluent toutes les informations nécessaires

#### Avant :
```typescript
const requesterId = requester?._id ? String(requester._id) : requester?.id ? String(requester.id) : undefined;
// ...
const ownerId = file.metadata?.ownerId ? String(file.metadata.ownerId) : undefined;
if (!ownerId || !requesterId || ownerId !== requesterId) {
  throw new ForbiddenException('Accès refusé à ce fichier');
}
```

#### Après :
```typescript
// Normalisation avec trim()
const requesterId = requester?._id
  ? String(requester._id).trim()
  : requester?.id
    ? String(requester.id).trim()
    : undefined;
const ownerId = file.metadata?.ownerId
  ? String(file.metadata.ownerId).trim()
  : undefined;

// Logs de diagnostic
console.log('[MediaService] Vérification accès fichier:', { ... });

// Vérifications avec logs d'erreur détaillés
if (!ownerId || !requesterId) {
  console.error('[MediaService] ERREUR: ID manquant', { ... });
  throw new ForbiddenException('Accès refusé à ce fichier');
}

if (ownerId !== requesterId) {
  console.error('[MediaService] ERREUR: IDs ne correspondent pas', { ... });
  throw new ForbiddenException('Accès refusé à ce fichier');
}
```

## 🔍 Logs de diagnostic

Les logs suivants seront maintenant disponibles dans les logs backend (Vercel) :

### Dans MediaController :
```
[MediaController] Requête fichier: {
  fileId: "693f1ecd12b354cd317d0bed",
  hasUser: true,
  userId: "690cda42dc65a1a3fc2c6a20",
  userRole: "ACTEUR",
  userType: "ACTEUR",
  userObject: { id: "...", _id: "...", role: "ACTEUR", ... }
}
```

### Dans MediaService :
```
[MediaService] Vérification accès fichier: {
  fileId: "693f1ecd12b354cd317d0bed",
  fileField: "photo",
  ownerId: "690cda42dc65a1a3fc2c6a20",
  ownerRole: "ACTEUR",
  requesterId: "690cda42dc65a1a3fc2c6a20",
  requesterRole: "ACTEUR",
  ...
}
```

### En cas d'erreur :
```
[MediaService] ERREUR: IDs ne correspondent pas {
  ownerId: "690cda42dc65a1a3fc2c6a20",
  requesterId: "690cda42dc65a1a3fc2c6a20",
  ownerIdLength: 24,
  requesterIdLength: 24,
  areEqual: false,  // ⚠️ Indique le problème
  ...
}
```

## 🧪 Tests à effectuer

### Test 1 : Accès à sa propre photo de profil

**Requête** :
```bash
GET https://cast-mate.vercel.app/media/{photoFileId}
Authorization: Bearer <token_acteur>
```

**Résultat attendu** : ✅ 200 OK avec image/jpeg

### Test 2 : Accès à sa propre galerie

**Requête** :
```bash
GET https://cast-mate.vercel.app/media/{galleryFileId}
Authorization: Bearer <token_acteur>
```

**Résultat attendu** : ✅ 200 OK avec image/jpeg

### Test 3 : Accès à son propre CV

**Requête** :
```bash
GET https://cast-mate.vercel.app/media/{documentFileId}
Authorization: Bearer <token_acteur>
```

**Résultat attendu** : ✅ 200 OK avec application/pdf

### Test 4 : Accès refusé (fichier d'un autre acteur)

**Requête** :
```bash
GET https://cast-mate.vercel.app/media/{autreActeurPhotoFileId}
Authorization: Bearer <token_acteur>
```

**Résultat attendu** : ❌ 403 Forbidden

## 🔍 Diagnostic avec les logs

Si le problème persiste, vérifier les logs backend pour :

1. **Vérifier que l'utilisateur est bien extrait** :
   ```
   [MediaController] Requête fichier: { hasUser: true, userId: "..." }
   ```

2. **Vérifier que les IDs correspondent** :
   ```
   [MediaService] Vérification accès fichier: {
     ownerId: "...",
     requesterId: "...",
     areEqual: true/false
   }
   ```

3. **Vérifier le format des IDs** :
   - Longueur : doit être 24 caractères (ObjectId MongoDB)
   - Type : doit être string
   - Pas d'espaces : normalisé avec `.trim()`

## 🚨 Points d'attention

1. **Normalisation des IDs** : Les IDs sont maintenant normalisés avec `.trim()` pour éviter les problèmes d'espaces
2. **Extraction de ownerId** : L'`ownerId` est extrait une seule fois au début pour éviter les incohérences
3. **Logs détaillés** : Tous les logs incluent maintenant les informations nécessaires pour diagnostiquer

## 📝 Checklist de vérification

- [x] Logs ajoutés dans `MediaController`
- [x] Logs ajoutés dans `MediaService.assertCanAccess`
- [x] Normalisation des IDs avec `.trim()`
- [x] Extraction de `ownerId` en amont
- [x] Messages d'erreur détaillés
- [ ] Tests effectués avec un acteur authentifié
- [ ] Vérification des logs backend

## 🎯 Résultat attendu

Après ces corrections :
- ✅ Les acteurs peuvent accéder à leurs propres médias (photo, galerie, CV)
- ✅ Les erreurs 403 ont des logs détaillés pour diagnostiquer
- ✅ La comparaison des IDs est plus robuste (normalisation)
- ✅ Les recruteurs peuvent toujours accéder aux fichiers des acteurs

## 📞 Support

Si le problème persiste après ces corrections :
1. Vérifier les logs backend dans Vercel
2. Vérifier que les IDs dans les logs correspondent
3. Vérifier que le token JWT contient bien `type: 'ACTEUR'`
4. Vérifier que l'`ownerId` dans les métadonnées du fichier correspond à l'ID de l'acteur

