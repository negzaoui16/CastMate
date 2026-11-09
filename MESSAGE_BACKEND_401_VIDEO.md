# 📧 Message pour l'Équipe Backend - Correction Erreur 401 Accès Vidéos

## ⚠️ Problème : Erreur 401 (Unauthorized) sur l'Endpoint Vidéo

Bonjour équipe backend 👋

Nous rencontrons une erreur **401 (Unauthorized)** lors de l'accès aux vidéos d'audition par les recruteurs propriétaires des castings.

---

## 🔍 Détails du Problème

### Endpoint concerné :
```
GET /castings/:id/candidates/:acteurId/video
```

### Erreur actuelle :
- **Code HTTP** : `401 Unauthorized`
- **Message** : `{"message":"Unauthorized","statusCode":401}`
- **Contexte** : Un recruteur propriétaire d'un casting essaie d'accéder à la vidéo d'audition d'un candidat

### Logs d'erreur :
```
⚠️ Erreur 401 (Unauthorized): Unauthorized
URL: https://cast-mate.vercel.app/castings/6928b6b3ce7e3cc84670b9a1/candidates/690cda42dc65a1a3fc2c6a20/video
```

---

## ✅ Comportement Attendu

L'endpoint `/castings/:id/candidates/:acteurId/video` devrait autoriser l'accès si l'utilisateur connecté est :

1. ✅ **Le recruteur propriétaire du casting** (cas principal)
2. ✅ L'acteur propriétaire de la vidéo (pour voir sa propre vidéo)
3. ✅ Un administrateur

---

## 🔍 Vérifications à Effectuer

### 1. Vérifier que le Guard JWT est bien appliqué

L'endpoint a déjà `@UseGuards(JwtAuthGuard)`, mais vérifiez que :
- Le guard global dans `AppModule` ne cause pas de conflit
- Le token JWT est correctement extrait du header `Authorization: Bearer <token>`

### 2. Vérifier la stratégie JWT

Dans `src/auth/strategies/jwt.strategy.ts`, la méthode `validate()` doit :
- ✅ Extraire correctement le `payload.sub` (ID utilisateur)
- ✅ Trouver l'utilisateur (acteur ou agence) dans la base de données
- ✅ Retourner l'objet utilisateur avec `role` et `id`

### 3. Vérifier le format du token

Le token JWT doit contenir :
```json
{
  "sub": "ID_UTILISATEUR",
  "type": "AGENCE" ou "ACTEUR",
  "role": "RECRUTEUR" ou "ACTEUR",
  "email": "email@example.com"
}
```

### 4. Vérifier que l'utilisateur existe

Dans `JwtStrategy.validate()`, vérifiez que :
- L'agence existe toujours dans la base de données
- L'ID dans le token correspond à un utilisateur valide

### 5. Vérifier les logs backend

Ajoutez des logs pour diagnostiquer :
```typescript
// Dans JwtStrategy.validate()
console.log('JWT Payload:', payload);
console.log('Recherche utilisateur type:', payload.type);
console.log('ID utilisateur:', payload.sub);
```

---

## 🔧 Points de Vérification dans le Code

### 1. Guard JWT (`src/common/guards/jwt-auth.guard.ts`)

Vérifiez que le guard ne bloque pas inutilement :
```typescript
canActivate(context: ExecutionContext) {
  const request = context.switchToHttp().getRequest();
  
  // Vérifier que l'URL n'est pas exclue
  if (request.url?.startsWith('/api') || request.url?.startsWith('/api-json')) {
    return true;
  }
  
  // Vérifier si la route est publique
  const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
    context.getHandler(),
    context.getClass(),
  ]);
  if (isPublic) {
    return true;
  }
  
  // Sinon, appliquer l'authentification JWT
  return super.canActivate(context);
}
```

### 2. Extraction du token (`src/auth/strategies/jwt.strategy.ts`)

Vérifiez que le token est bien extrait :
```typescript
super({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  ignoreExpiration: false,
  secretOrKey: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
});
```

### 3. Validation de l'utilisateur

Dans `JwtStrategy.validate()`, assurez-vous que :
- Pour les agences : `payload.type === 'AGENCE'` et l'agence existe
- Pour les acteurs : `payload.type === 'ACTEUR'` et l'acteur existe
- L'objet retourné contient bien `id`, `role`, etc.

---

## 🧪 Tests à Effectuer

### Test 1 : Vérifier l'extraction du token
```bash
# Vérifier que le header Authorization est bien reçu
curl -X GET \
  https://cast-mate.vercel.app/castings/{id}/candidates/{acteurId}/video \
  -H "Authorization: Bearer <TOKEN>"
```

### Test 2 : Vérifier le payload JWT
Décodez le token JWT (sur jwt.io) et vérifiez qu'il contient :
- `sub` : ID de l'agence
- `type` : "AGENCE"
- `role` : "RECRUTEUR"

### Test 3 : Vérifier que l'agence existe
Dans la base de données, vérifiez que l'agence avec l'ID du token existe toujours.

---

## 🔧 Solutions Possibles

### Solution 1 : Ajouter des logs de débogage

Dans `JwtStrategy.validate()`, ajoutez :
```typescript
async validate(payload: any) {
  console.log('[JWT] Validation payload:', payload);
  
  if (payload.type === 'AGENCE') {
    console.log('[JWT] Recherche agence:', payload.sub);
    const agence = await this.agenceService.findById(payload.sub);
    if (!agence) {
      console.error('[JWT] Agence non trouvée:', payload.sub);
      throw new UnauthorizedException('Agence non trouvée');
    }
    console.log('[JWT] Agence trouvée:', agence._id);
    // ...
  }
}
```

### Solution 2 : Vérifier le secret JWT

Assurez-vous que `JWT_SECRET` dans les variables d'environnement correspond à celui utilisé lors de la création du token.

### Solution 3 : Vérifier l'expiration du token

Vérifiez que le token n'est pas expiré. Par défaut, les tokens JWT peuvent avoir une expiration.

---

## 📋 Informations Techniques

- **Base URL** : `https://cast-mate.vercel.app`
- **Méthode** : `GET`
- **Headers requis** : `Authorization: Bearer <JWT_TOKEN>`
- **Paramètres** :
  - `castingId` : ID du casting
  - `acteurId` : ID de l'acteur (candidat)

---

## 🆘 Impact Utilisateur

Actuellement, les recruteurs ne peuvent pas visualiser les vidéos d'audition de leurs candidats, ce qui bloque le processus de sélection.

---

## 📝 Note

Le code actuel semble correct avec `@UseGuards(JwtAuthGuard)` sur l'endpoint. Le problème est probablement lié à :
1. L'extraction/validation du token JWT
2. L'existence de l'utilisateur dans la base de données
3. Le format du payload JWT

---

Merci pour votre attention ! 🚀

**Date** : 27 novembre 2025  
**Priorité** : 🔴 Haute (bloque une fonctionnalité principale)

