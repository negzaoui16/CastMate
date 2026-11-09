# 📧 Message pour l'Équipe Backend - Erreur 401 Persistante sur Endpoint Vidéo

## ⚠️ Problème : Erreur 401 (Unauthorized) Persistante

Bonjour équipe backend 👋

Malgré les corrections précédentes, l'erreur **401 (Unauthorized)** persiste toujours sur l'endpoint de récupération des vidéos d'audition.

---

## 🔍 Détails de l'Erreur

### Endpoint concerné :
```
GET /castings/6928b6b3ce7e3cc84670b9a1/candidates/690cda42dc65a1a3fc2c6a20/video
```

### Erreur :
- **Code HTTP** : `401 Unauthorized`
- **Message** : `{"message":"Unauthorized","statusCode":401}`
- **Headers reçus** :
  - `content-type: application/json; charset=utf-8`
  - `server: Vercel`
  - Pas de header `Authorization` visible dans les logs (à vérifier)

### Contexte :
- Un recruteur (agence) propriétaire d'un casting essaie d'accéder à la vidéo d'audition d'un candidat
- L'application mobile envoie la requête avec un token JWT (présumé)

---

## 🔧 Corrections Déjà Appliquées

1. ✅ **JwtStrategy** : Normalisation de l'objet utilisateur retourné (`id`, `role`, `_id`)
2. ✅ **JwtAuthGuard** : Ajout de logs de débogage et meilleure gestion des erreurs

---

## 🐛 Diagnostic Nécessaire

### 1. Vérifier les Logs Backend

Avec les nouveaux logs ajoutés dans `JwtAuthGuard.handleRequest()`, vous devriez voir dans les logs Vercel :

```
[JWT Guard] Erreur d'authentification: {
  url: '/castings/.../candidates/.../video',
  method: 'GET',
  error: '...',
  hasToken: true/false
}
```

**Action requise** : Vérifiez les logs Vercel pour voir :
- Si le token est présent (`hasToken: true/false`)
- Le message d'erreur exact
- L'URL complète de la requête

### 2. Vérifier l'Envoi du Token depuis le Frontend

**Problème possible** : Le token JWT n'est peut-être pas envoyé correctement dans les headers.

**Vérification à faire** :
```typescript
// Dans le controller, ajouter un log temporaire
@Get(':id/candidates/:acteurId/video')
@UseGuards(JwtAuthGuard)
async getCandidateVideo(
  @Param('id', ParseObjectIdPipe) id: string,
  @Param('acteurId', ParseObjectIdPipe) acteurId: string,
  @CurrentUser() user: any,
  @Request() req: any, // Ajouter ce paramètre
  @Res({ passthrough: true }) response: Response,
) {
  // Log temporaire pour débogage
  console.log('[DEBUG] Headers Authorization:', req.headers.authorization);
  console.log('[DEBUG] User object:', user);
  console.log('[DEBUG] User ID:', user?.id || user?._id);
  console.log('[DEBUG] User Role:', user?.role);
  
  // ... reste du code
}
```

### 3. Vérifier le Format du Token JWT

**Action requise** : Décoder le token JWT (sur jwt.io) et vérifier qu'il contient :
```json
{
  "sub": "ID_AGENCE",
  "type": "AGENCE",
  "role": "RECRUTEUR",
  "email": "email@example.com",
  "iat": ...,
  "exp": ...
}
```

### 4. Vérifier l'Expiration du Token

**Problème possible** : Le token est peut-être expiré.

**Vérification** :
- Vérifier la date `exp` dans le payload JWT
- Vérifier que le token n'est pas trop ancien

### 5. Vérifier le Secret JWT

**Problème possible** : Le `JWT_SECRET` dans les variables d'environnement Vercel ne correspond pas à celui utilisé lors de la création du token.

**Action requise** :
1. Vérifier la variable `JWT_SECRET` dans Vercel
2. S'assurer qu'elle correspond au secret utilisé lors du login

### 6. Vérifier l'Existence de l'Agence

**Problème possible** : L'agence avec l'ID du token n'existe plus dans la base de données.

**Action requise** : Dans `JwtStrategy.validate()`, ajouter des logs :
```typescript
if (payload.type === 'AGENCE') {
  console.log('[JWT] Recherche agence avec ID:', payload.sub);
  const agence = await this.agenceService.findById(payload.sub);
  if (!agence) {
    console.error('[JWT] Agence non trouvée pour ID:', payload.sub);
    throw new UnauthorizedException('Agence non trouvée');
  }
  console.log('[JWT] Agence trouvée:', agence._id, agence.nomAgence);
  // ...
}
```

---

## 🔧 Solutions à Implémenter

### Solution 1 : Ajouter des Logs Détaillés dans le Controller

Modifier temporairement `castings.controller.ts` :

```typescript
@Get(':id/candidates/:acteurId/video')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
async getCandidateVideo(
  @Param('id', ParseObjectIdPipe) id: string,
  @Param('acteurId', ParseObjectIdPipe) acteurId: string,
  @CurrentUser() user: any,
  @Request() req: any,
  @Res({ passthrough: true }) response: Response,
) {
  // Logs de débogage
  console.log('[VIDEO] Requête reçue:', {
    castingId: id,
    acteurId: acteurId,
    hasUser: !!user,
    userId: user?.id || user?._id,
    userRole: user?.role,
    hasAuthHeader: !!req.headers.authorization,
    authHeader: req.headers.authorization?.substring(0, 20) + '...',
  });

  if (!user) {
    console.error('[VIDEO] User est null/undefined');
    throw new UnauthorizedException('Utilisateur non authentifié');
  }

  return this.castingsService.getCandidateVideo(
    id,
    acteurId,
    String(user.id || user._id),
    user.role,
    response,
  );
}
```

### Solution 2 : Vérifier le Guard Global

Le guard global dans `AppModule` pourrait interférer. Vérifiez que :
- Le guard local `@UseGuards(JwtAuthGuard)` a bien la priorité
- Le guard global ne bloque pas avant le guard local

### Solution 3 : Vérifier CORS et Headers

Assurez-vous que CORS permet bien l'envoi du header `Authorization` :

```typescript
// Dans main.ts, vérifier :
app.enableCors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'], // ⚠️ Vérifier que Authorization est bien là
});
```

### Solution 4 : Vérifier le Format du Header Authorization

Le frontend doit envoyer :
```
Authorization: Bearer <TOKEN>
```

**Pas** :
- `Authorization: <TOKEN>` (sans "Bearer")
- `Authorization: bearer <TOKEN>` (minuscule)
- Autre format

---

## 🧪 Tests à Effectuer

### Test 1 : Vérifier avec curl

```bash
# Remplacer <TOKEN> par un token JWT valide
curl -X GET \
  "https://cast-mate.vercel.app/castings/6928b6b3ce7e3cc84670b9a1/candidates/690cda42dc65a1a3fc2c6a20/video" \
  -H "Authorization: Bearer <TOKEN>" \
  -v
```

### Test 2 : Vérifier les logs Vercel

1. Aller dans le dashboard Vercel
2. Ouvrir les logs de la fonction
3. Chercher les logs `[JWT Guard]` et `[VIDEO]`
4. Vérifier les erreurs

### Test 3 : Tester avec Postman/Insomnia

1. Créer une requête GET vers l'endpoint
2. Ajouter le header `Authorization: Bearer <TOKEN>`
3. Vérifier la réponse

---

## 📋 Checklist de Diagnostic

- [ ] Vérifier les logs Vercel pour les messages `[JWT Guard]`
- [ ] Vérifier que le token JWT est bien envoyé dans les headers
- [ ] Décoder le token JWT et vérifier son contenu
- [ ] Vérifier que le token n'est pas expiré
- [ ] Vérifier que `JWT_SECRET` correspond
- [ ] Vérifier que l'agence existe dans la base de données
- [ ] Vérifier que CORS permet le header `Authorization`
- [ ] Ajouter des logs détaillés dans le controller
- [ ] Tester avec curl/Postman

---

## 🆘 Informations Supplémentaires

### Structure Attendue du User Object

Après validation JWT, l'objet `user` devrait avoir :
```typescript
{
  _id: ObjectId,
  id: string, // Converti depuis _id
  role: 'RECRUTEUR' | 'ACTEUR',
  email: string,
  nomAgence?: string, // Pour les agences
  // ... autres champs
}
```

### Endpoint Concerné

```typescript
// src/castings/castings.controller.ts
@Get(':id/candidates/:acteurId/video')
@UseGuards(JwtAuthGuard) // ⚠️ Guard local
@ApiBearerAuth('JWT-auth')
```

### Guard Global

```typescript
// src/app.module.ts
{
  provide: APP_GUARD,
  useClass: JwtAuthGuard, // ⚠️ Guard global
}
```

**Note** : Le guard local devrait avoir la priorité, mais vérifiez qu'il n'y a pas de conflit.

---

## 📝 Prochaines Étapes

1. **Immédiat** : Ajouter les logs de débogage dans le controller
2. **Court terme** : Vérifier les logs Vercel pour identifier la cause exacte
3. **Moyen terme** : Corriger le problème identifié
4. **Long terme** : Retirer les logs de débogage une fois le problème résolu

---

## 🔗 Fichiers à Modifier

1. `src/castings/castings.controller.ts` - Ajouter logs de débogage
2. `src/auth/strategies/jwt.strategy.ts` - Ajouter logs si nécessaire
3. `src/common/guards/jwt-auth.guard.ts` - Vérifier les logs existants

---

Merci pour votre attention ! 🚀

**Date** : 27 novembre 2025  
**Priorité** : 🔴 Haute (bloque une fonctionnalité principale)  
**Status** : En attente de diagnostic

