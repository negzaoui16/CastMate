# 🔧 Fix : Erreur 403 sur POST /castings/{id}/apply

## 📋 Problème identifié

Les acteurs authentifiés recevaient une erreur **403 Forbidden** lors de la candidature à un casting via `POST /castings/{id}/apply`.

### Symptômes
- Token JWT valide avec `role=ACTEUR` et `type=ACTEUR`
- Le token contient `sub` (ID de l'acteur) mais pas de champ `id` directement
- Erreur 403 avant même d'atteindre la méthode du controller

## ✅ Corrections apportées

### 1. Ajout de logs dans `JwtStrategy` pour les acteurs

**Fichier** : `src/auth/strategies/jwt.strategy.ts`

Ajout de logs détaillés pour les acteurs (comme pour les agences) :

```typescript
if (payload.type === 'ACTEUR') {
  console.log('[JWT Strategy] Recherche acteur avec ID:', payload.sub);
  // ... recherche acteur ...
  console.log('[JWT Strategy] Acteur trouvé:', { ... });
  console.log('[JWT Strategy] Objet utilisateur retourné (ACTEUR):', {
    id: userObj.id,
    _id: String(userObj._id),
    role: userObj.role,
    allKeys: Object.keys(userObj),
  });
}
```

### 2. Amélioration de l'extraction de l'ID dans `CastingsController`

**Fichier** : `src/castings/castings.controller.ts`

#### Avant :
```typescript
async applyToCasting(
  @Param('id', ParseObjectIdPipe) id: string,
  @CurrentUser() user: any,
  ...
) {
  return this.castingsService.applyToCasting(
    id,
    String(user.id || user._id),
    video,
    dto,
  );
}
```

#### Après :
```typescript
async applyToCasting(
  @Param('id', ParseObjectIdPipe) id: string,
  @CurrentUser() user: any,
  ...
) {
  // Logs de diagnostic
  console.log('[CastingsController] Candidature à un casting:', {
    castingId: id,
    hasUser: !!user,
    userId: user?.id || user?._id,
    userObject: { ... },
  });

  // Extraction de l'ID avec plusieurs fallbacks
  const acteurId = user?.id 
    ? String(user.id)
    : user?._id 
      ? String(user._id)
      : user?.sub
        ? String(user.sub)
        : null;

  if (!acteurId) {
    throw new ForbiddenException('Impossible d\'identifier l\'utilisateur.');
  }

  return this.castingsService.applyToCasting(id, acteurId, video, dto);
}
```

## 🔍 Logs de diagnostic

Les logs suivants sont maintenant disponibles :

### Dans JwtStrategy (pour les acteurs) :
```
[JWT Strategy] Recherche acteur avec ID: 690cda42dc65a1a3fc2c6a20
[JWT Strategy] Acteur trouvé: { _id: "...", nom: "...", role: "ACTEUR", ... }
[JWT Strategy] Objet utilisateur retourné (ACTEUR): {
  id: "690cda42dc65a1a3fc2c6a20",
  _id: ObjectId("..."),
  role: "ACTEUR",
  allKeys: ["id", "_id", "role", "email", ...]
}
```

### Dans CastingsController :
```
[CastingsController] Candidature à un casting: {
  castingId: "693f0a9897caff2222dc87f1",
  hasUser: true,
  userId: "690cda42dc65a1a3fc2c6a20",
  userRole: "ACTEUR",
  userObject: { id: "...", _id: "...", role: "ACTEUR", ... }
}
[CastingsController] ID utilisateur extrait: 690cda42dc65a1a3fc2c6a20
```

### Dans RolesGuard :
```
[RolesGuard] Vérification des rôles: {
  requiredRoles: ["ACTEUR"],
  userRole: "ACTEUR",
  userId: "690cda42dc65a1a3fc2c6a20",
  ...
}
[RolesGuard] ✅ Accès autorisé pour le rôle: ACTEUR
```

## 🧪 Tests à effectuer

### Test 1 : Candidature avec vidéo

**Requête** :
```bash
POST /castings/{id}/apply
Authorization: Bearer <token_acteur>
Content-Type: multipart/form-data

video: <fichier>
aiFeedback: <json>
```

**Résultat attendu** : ✅ 200 OK

### Test 2 : Candidature sans vidéo

**Requête** :
```bash
POST /castings/{id}/apply
Authorization: Bearer <token_acteur>
Content-Type: multipart/form-data

Body: vide
```

**Résultat attendu** : ✅ 200 OK

### Test 3 : Vérification des logs

Vérifier dans les logs backend :
1. Que l'acteur est bien trouvé par JwtStrategy
2. Que l'objet utilisateur contient bien `id` et `role`
3. Que le RolesGuard autorise l'accès
4. Que l'ID est correctement extrait dans le controller

## 🔍 Diagnostic avec les logs

Si le problème persiste, vérifier les logs backend pour :

1. **Vérifier que l'acteur est trouvé** :
   ```
   [JWT Strategy] Acteur trouvé: { ... }
   ```

2. **Vérifier que l'objet utilisateur a bien un ID** :
   ```
   [JWT Strategy] Objet utilisateur retourné (ACTEUR): { id: "...", ... }
   ```

3. **Vérifier que le RolesGuard autorise** :
   ```
   [RolesGuard] ✅ Accès autorisé pour le rôle: ACTEUR
   ```

4. **Vérifier que l'ID est extrait dans le controller** :
   ```
   [CastingsController] ID utilisateur extrait: ...
   ```

## 🚨 Points d'attention

1. **Extraction de l'ID** : L'ID est maintenant extrait avec plusieurs fallbacks (`id`, `_id`, `sub`)
2. **Logs détaillés** : Tous les logs incluent maintenant les informations nécessaires pour diagnostiquer
3. **Gestion d'erreur** : Si l'ID ne peut pas être extrait, une exception explicite est lancée

## 📝 Checklist de vérification

- [x] Logs ajoutés dans `JwtStrategy` pour les acteurs
- [x] Logs ajoutés dans `CastingsController.applyToCasting`
- [x] Extraction de l'ID améliorée avec fallbacks
- [x] Gestion d'erreur si ID manquant
- [ ] Tests effectués avec un acteur authentifié
- [ ] Vérification des logs backend

## 🎯 Résultat attendu

Après ces corrections :
- ✅ Les acteurs peuvent postuler aux castings
- ✅ Les erreurs 403 ont des logs détaillés pour diagnostiquer
- ✅ L'extraction de l'ID est plus robuste (plusieurs fallbacks)
- ✅ Les logs permettent d'identifier rapidement les problèmes

## 📞 Support

Si le problème persiste après ces corrections :
1. Vérifier les logs backend dans Vercel
2. Vérifier que l'acteur est bien trouvé par JwtStrategy
3. Vérifier que l'objet utilisateur contient bien `id` et `role`
4. Vérifier que le RolesGuard autorise l'accès

