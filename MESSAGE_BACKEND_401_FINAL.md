# 📧 Message pour l'Équipe Backend - Correction Erreur 401 Accès Vidéos d'Audition

## ⚠️ Problème : Erreur 401 (Unauthorized) sur Endpoint Vidéo

Bonjour équipe backend 👋

Nous rencontrons une erreur **401 (Unauthorized)** sur l'endpoint de récupération des vidéos d'audition par les agences.

---

## 🔍 Détails du Problème

### Endpoint concerné :
```
GET /castings/:id/candidates/:acteurId/video
```

### Erreur actuelle :
- **Code HTTP** : `401 Unauthorized`
- **Message** : `{"message":"Token invalide ou expiré","error":"Unauthorized","statusCode":401}`
- **Contexte** : Une agence propriétaire d'un casting essaie d'accéder à la vidéo d'audition d'un candidat

### Cas de test :
- **Casting ID** : `6928c9f8ca3c4c83d6e8278b`
- **Acteur ID** : `690cda42dc65a1a3fc2c6a20`
- **Utilisateur** : Agence propriétaire du casting
- **Vidéo** : Existe bien en base de données (confirmé)
- **Token JWT** : Valide côté frontend (vérifié)

### Logs frontend :
```
⚠️ Erreur 401 (Unauthorized): Token invalide ou expiré
URL: https://cast-mate.vercel.app/castings/6928c9f8ca3c4c83d6e8278b/candidates/690cda42dc65a1a3fc2c6a20/video
Response: {"message":"Token invalide ou expiré","error":"Unauthorized","statusCode":401}
```

---

## ✅ Comportement Attendu

L'endpoint `/castings/:id/candidates/:acteurId/video` doit autoriser l'accès si :

1. ✅ **L'utilisateur est une agence/recruteur ET est propriétaire du casting** 
   - Condition : `casting.recruteur.toString() === user.id`
   - OU : `casting.agenceId === user.agenceId` (si ce champ existe)

2. ✅ **L'utilisateur est l'acteur propriétaire de la vidéo**
   - Condition : `acteurId === user.id`

3. ✅ **L'utilisateur est un administrateur**

---

## 🔧 Vérifications à Effectuer

### 1. Vérifier les Logs Backend Vercel

Avec les logs ajoutés dans le code, vous devriez voir dans les logs Vercel :

#### Logs du Guard JWT (`JwtAuthGuard.handleRequest`) :
```
[JWT Guard] Erreur d'authentification: {
  url: '/castings/.../candidates/.../video',
  method: 'GET',
  error: '...',
  hasToken: true/false
}
```

#### Logs du Controller (`getCandidateVideo`) :
```
[VIDEO] Requête reçue: {
  castingId: '...',
  acteurId: '...',
  hasUser: true/false,
  userId: '...',
  userRole: '...',
  hasAuthHeader: true/false,
  authHeaderPrefix: 'Bearer ...'
}
```

**Action requise** : Vérifier les logs Vercel pour identifier :
- Si le token est présent (`hasToken: true/false`)
- Si l'utilisateur est extrait (`hasUser: true/false`)
- Le message d'erreur exact
- L'ID et le rôle de l'utilisateur

### 2. Vérifier l'Extraction du Token JWT

**Fichier** : `src/auth/strategies/jwt.strategy.ts`

Vérifier que :
- Le token est bien extrait du header `Authorization: Bearer <TOKEN>`
- Le secret JWT (`JWT_SECRET`) correspond à celui utilisé lors du login
- Le token n'est pas expiré (vérifier `exp` dans le payload)

**Test** : Décoder le token JWT sur jwt.io et vérifier :
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

### 3. Vérifier l'Existence de l'Agence

**Fichier** : `src/auth/strategies/jwt.strategy.ts`

Dans la méthode `validate()`, vérifier que :
- L'agence avec l'ID `payload.sub` existe dans la base de données
- L'agence a bien le role `RECRUTEUR`

**Code à vérifier** :
```typescript
if (payload.type === 'AGENCE') {
  const agence = await this.agenceService.findById(payload.sub);
  if (!agence) {
    throw new UnauthorizedException('Agence non trouvée');
  }
  // ...
}
```

### 4. Vérifier la Logique de Permissions

**Fichier** : `src/castings/castings.service.ts` - Méthode `getCandidateVideo()`

Vérifier que la logique autorise bien les recruteurs :
```typescript
const isRecruteurOwner =
  userRole === Role.RECRUTEUR &&
  casting.recruteur.toString() === userId;
```

**Points à vérifier** :
- `userRole` est bien `Role.RECRUTEUR` (string `'RECRUTEUR'`)
- `casting.recruteur` est bien un ObjectId qui correspond à `userId`
- La conversion `casting.recruteur.toString() === userId` fonctionne

### 5. Vérifier MediaService Permissions

**Fichier** : `src/media/media.service.ts` - Méthode `assertCanAccess()`

Vérifier que la logique autorise bien les recruteurs propriétaires :
```typescript
if (requesterRole === Role.RECRUTEUR && ownerRole === Role.ACTEUR) {
  const castingId = file.metadata?.castingId ? String(file.metadata.castingId) : undefined;
  if (castingId) {
    const casting = await this.castingModel.findById(castingId).exec();
    if (casting && casting.recruteur.toString() === requesterId) {
      return; // Autoriser
    }
  }
}
```

---

## 🐛 Diagnostic Détaillé

### Étape 1 : Vérifier les Logs Vercel

1. Aller dans le dashboard Vercel
2. Ouvrir les logs de la fonction/serverless
3. Chercher les logs `[JWT Guard]` et `[VIDEO]`
4. Identifier où l'erreur se produit exactement

### Étape 2 : Vérifier le Token JWT

**Action** : Ajouter des logs temporaires dans `JwtStrategy.validate()` :

```typescript
async validate(payload: any) {
  console.log('[JWT Strategy] Payload reçu:', {
    sub: payload.sub,
    type: payload.type,
    role: payload.role,
    email: payload.email,
    exp: payload.exp,
    isExpired: payload.exp ? Date.now() / 1000 > payload.exp : 'unknown',
  });

  if (payload.type === 'AGENCE') {
    console.log('[JWT Strategy] Recherche agence ID:', payload.sub);
    const agence = await this.agenceService.findById(payload.sub);
    if (!agence) {
      console.error('[JWT Strategy] Agence non trouvée pour ID:', payload.sub);
      throw new UnauthorizedException('Agence non trouvée');
    }
    console.log('[JWT Strategy] Agence trouvée:', {
      _id: agence._id,
      nomAgence: agence.nomAgence,
      role: agence.role,
    });
    // ...
  }
}
```

### Étape 3 : Vérifier le Format de l'Objet User

**Action** : Vérifier que l'objet retourné par `JwtStrategy.validate()` a bien :
- `id` : string (converti depuis `_id`)
- `_id` : ObjectId
- `role` : string (`'RECRUTEUR'`)

**Code actuel** :
```typescript
return {
  ...agenceObj,
  id: String(agenceObj._id || agenceObj.id),
  _id: agenceObj._id,
  role: agenceObj.role || payload.role || 'RECRUTEUR',
};
```

### Étape 4 : Vérifier le Guard Global vs Local

**Problème possible** : Le guard global dans `AppModule` pourrait interférer.

**Fichier** : `src/app.module.ts`
```typescript
{
  provide: APP_GUARD,
  useClass: JwtAuthGuard, // Guard global
}
```

**Vérification** : Le guard local `@UseGuards(JwtAuthGuard)` sur l'endpoint devrait avoir la priorité, mais vérifier qu'il n'y a pas de conflit.

---

## 🔧 Solutions à Implémenter

### Solution 1 : Ajouter des Logs Détaillés (TEMPORAIRE)

Dans `src/castings/castings.controller.ts`, les logs sont déjà ajoutés. Vérifier qu'ils apparaissent dans les logs Vercel.

### Solution 2 : Vérifier le Secret JWT

**Action** : Vérifier que la variable d'environnement `JWT_SECRET` dans Vercel correspond exactement au secret utilisé lors de la création du token lors du login.

**Fichier** : `src/auth/auth.service.ts`
```typescript
const payload = { 
  email: agence.email, 
  sub: String(agence._id), 
  role: agence.role,
  type: 'AGENCE'
};
return {
  access_token: this.jwtService.sign(payload), // Utilise JWT_SECRET
};
```

### Solution 3 : Vérifier l'Expiration du Token

**Action** : Vérifier que le token n'est pas expiré. Par défaut, les tokens JWT peuvent avoir une expiration.

**Vérification** : Dans le payload JWT, vérifier le champ `exp` et comparer avec l'heure actuelle.

### Solution 4 : Vérifier CORS et Headers

**Fichier** : `src/main.ts`

Vérifier que CORS permet bien l'envoi du header `Authorization` :
```typescript
app.enableCors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'], // ⚠️ Vérifier
});
```

---

## 🧪 Tests à Effectuer

### Test 1 : Vérifier avec curl

```bash
# Remplacer <TOKEN> par un token JWT valide d'une agence
curl -X GET \
  "https://cast-mate.vercel.app/castings/6928c9f8ca3c4c83d6e8278b/candidates/690cda42dc65a1a3fc2c6a20/video" \
  -H "Authorization: Bearer <TOKEN>" \
  -v
```

### Test 2 : Vérifier le Token JWT

1. Décoder le token sur jwt.io
2. Vérifier le payload
3. Vérifier l'expiration
4. Vérifier le secret (si possible)

### Test 3 : Tester le Login

1. Se connecter en tant qu'agence
2. Vérifier que le token retourné est valide
3. Vérifier que le token contient bien `type: 'AGENCE'` et `role: 'RECRUTEUR'`

### Test 4 : Vérifier la Base de Données

1. Vérifier que l'agence avec l'ID du token existe
2. Vérifier que le casting existe et que `casting.recruteur` correspond à l'ID de l'agence
3. Vérifier que le candidat existe dans ce casting

---

## 📋 Checklist de Diagnostic

- [ ] Vérifier les logs Vercel pour `[JWT Guard]` et `[VIDEO]`
- [ ] Vérifier que le token JWT est bien envoyé dans les headers
- [ ] Décoder le token JWT et vérifier son contenu
- [ ] Vérifier que le token n'est pas expiré
- [ ] Vérifier que `JWT_SECRET` correspond
- [ ] Vérifier que l'agence existe dans la base de données
- [ ] Vérifier que `casting.recruteur` correspond à l'ID de l'agence
- [ ] Vérifier que CORS permet le header `Authorization`
- [ ] Vérifier le format de l'objet `user` retourné par `JwtStrategy`
- [ ] Tester avec curl/Postman pour isoler le problème

---

## 🔗 Fichiers Concernés

1. `src/auth/strategies/jwt.strategy.ts` - Validation du token JWT
2. `src/common/guards/jwt-auth.guard.ts` - Guard JWT avec logs
3. `src/castings/castings.controller.ts` - Endpoint avec logs de débogage
4. `src/castings/castings.service.ts` - Logique de permissions
5. `src/media/media.service.ts` - Permissions d'accès aux fichiers
6. `src/app.module.ts` - Guard global

---

## 📝 Informations Supplémentaires

### Structure Attendue du User Object

Après validation JWT, l'objet `user` devrait avoir :
```typescript
{
  _id: ObjectId,
  id: string, // Converti depuis _id
  role: 'RECRUTEUR',
  email: string,
  nomAgence: string,
  // ... autres champs
}
```

### Endpoint Concerné

```typescript
// src/castings/castings.controller.ts
@Get(':id/candidates/:acteurId/video')
@UseGuards(JwtAuthGuard) // Guard local
@ApiBearerAuth('JWT-auth')
async getCandidateVideo(...)
```

### Message d'Erreur Actuel

Le message `"Token invalide ou expiré"` vient de `JwtAuthGuard.handleRequest()`, ce qui indique que :
- Soit le token n'est pas présent dans les headers
- Soit le token est invalide (secret incorrect, format incorrect)
- Soit le token est expiré
- Soit l'utilisateur n'existe pas dans la base de données

---

## 🆘 Priorité

**🔴 Haute** - Cette fonctionnalité est essentielle pour le processus de sélection des candidats par les agences.

---

## 📞 Prochaines Étapes

1. **Immédiat** : Vérifier les logs Vercel pour identifier la cause exacte
2. **Court terme** : Corriger le problème identifié (token, secret, utilisateur, etc.)
3. **Moyen terme** : Retirer les logs de débogage une fois le problème résolu
4. **Long terme** : Ajouter des tests automatisés pour éviter la régression

---

Merci pour votre attention et votre prompte action ! 🚀

**Date** : 27 novembre 2025  
**Status** : En attente de diagnostic et correction

