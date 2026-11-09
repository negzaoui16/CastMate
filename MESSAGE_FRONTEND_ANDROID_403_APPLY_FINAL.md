# 📱 Message pour l'équipe Frontend Android - Erreur 403 sur POST /castings/{id}/apply

**Date:** 2025-12-14  
**Sujet:** Diagnostic et résolution de l'erreur 403 lors de la candidature à un casting  
**URGENT:** ⚠️ Vérifier les logs backend dans Vercel pour identifier la cause exacte

---

## 🔴 Problème signalé

Un acteur authentifié reçoit une erreur **403 Forbidden** lors de la candidature à un casting via `POST /castings/{id}/apply`.

### Logs Android observés

```
✅ Token JWT valide et présent (247 caractères)
📋 Token info: id=690cda42dc65a1a3fc2c6a20, role=ACTEUR, type=ACTEUR, email=user@user.com
📋 Toutes les clés du token: email, sub, role, type, iat, exp
✅ Header Authorization confirmé: Bearer eyJhbGciOiJIUzI1NiIsInR...
❌ ERREUR 403: Forbidden
```

**Observation importante :** Le token contient bien `role=ACTEUR` et `type=ACTEUR`, mais la requête est rejetée avec 403.

---

## ✅ Corrections backend effectuées

Le backend a été corrigé avec :

1. **Logs de diagnostic détaillés** dans :
   - `JwtStrategy` : Pour voir comment l'acteur est extrait du token
   - `RolesGuard` : Pour voir la vérification des rôles
   - `CastingsController` : Pour voir l'extraction de l'ID utilisateur

2. **Extraction robuste de l'ID** avec plusieurs fallbacks (`id`, `_id`, `sub`)

3. **Comparaison insensible à la casse** des rôles

---

## 🔍 Diagnostic nécessaire

### Étape 1 : Vérifier les logs backend

**Action requise :** Vérifier les logs dans Vercel pour voir exactement où le problème se produit.

Les logs backend devraient montrer :

```
[JWT Strategy] Recherche acteur avec ID: 690cda42dc65a1a3fc2c6a20
[JWT Strategy] Acteur trouvé: { ... }
[JWT Strategy] Objet utilisateur retourné (ACTEUR): { id: "...", role: "ACTEUR", ... }

[RolesGuard] Vérification des rôles: {
  requiredRoles: ["ACTEUR"],
  userRole: "ACTEUR",
  ...
}
[RolesGuard] ✅ Accès autorisé pour le rôle: ACTEUR
```

**Si ces logs n'apparaissent pas :**
- Le problème est dans `JwtAuthGuard` (authentification)
- L'utilisateur n'est pas correctement extrait du token

**Si les logs montrent une erreur dans RolesGuard :**
- Vérifier que `userRole === "ACTEUR"` et `requiredRoles.includes("ACTEUR")`
- Vérifier que la comparaison fonctionne

---

## 🧪 Tests à effectuer côté Android

### Test 1 : Vérifier le token avant la requête

```kotlin
fun testTokenBeforeApply(castingId: String) {
    val token = tokenManager.getToken()
    val payload = decodeJWT(token ?: "")
    
    Log.d("TEST", "========== TEST TOKEN AVANT APPLY ==========")
    Log.d("TEST", "Token présent: ${token != null}")
    Log.d("TEST", "Token length: ${token?.length}")
    Log.d("TEST", "Payload keys: ${payload?.keys}")
    Log.d("TEST", "Role: ${payload?.get("role")}")
    Log.d("TEST", "Type: ${payload?.get("type")}")
    Log.d("TEST", "Sub: ${payload?.get("sub")}")
    Log.d("TEST", "Email: ${payload?.get("email")}")
    Log.d("TEST", "===========================================")
    
    // Vérifications
    val role = payload?.get("role") as? String
    val type = payload?.get("type") as? String
    
    if (role != "ACTEUR") {
        Log.e("TEST", "❌ PROBLÈME: Role doit être 'ACTEUR', actuel: $role")
    }
    
    if (type != "ACTEUR") {
        Log.e("TEST", "❌ PROBLÈME: Type doit être 'ACTEUR', actuel: $type")
    }
}
```

### Test 2 : Vérifier la requête multipart

```kotlin
fun testApplyRequest(castingId: String, videoFile: File?) {
    val formData = MultipartBody.Builder()
        .setType(MultipartBody.FORM)
        .apply {
            if (videoFile != null) {
                addFormDataPart(
                    "video",
                    videoFile.name,
                    RequestBody.create(MediaType.parse("video/mp4"), videoFile)
                )
            }
            // Optionnel : ajouter aiFeedback
        }
        .build()
    
    val request = Request.Builder()
        .url("https://cast-mate.vercel.app/castings/$castingId/apply")
        .post(formData)
        .addHeader("Authorization", "Bearer ${tokenManager.getToken()}")
        .build()
    
    Log.d("REQUEST", "========== REQUÊTE APPLY ==========")
    Log.d("REQUEST", "URL: ${request.url}")
    Log.d("REQUEST", "Method: ${request.method}")
    Log.d("REQUEST", "Headers:")
    request.headers.forEach { name, value ->
        Log.d("REQUEST", "  $name: ${if (name == "Authorization") "Bearer ..." else value}")
    }
    Log.d("REQUEST", "Body type: ${request.body?.contentType()}")
    Log.d("REQUEST", "===================================")
    
    val response = okHttpClient.newCall(request).execute()
    
    Log.d("RESPONSE", "Code: ${response.code}")
    Log.d("RESPONSE", "Message: ${response.message}")
    if (!response.isSuccessful) {
        val errorBody = response.peekBody(Long.MAX_VALUE).string()
        Log.e("RESPONSE", "Error body: $errorBody")
    }
}
```

---

## ⚠️ Points à vérifier

### 1. Message d'erreur Android incorrect

**Le message dans les logs Android dit :**
```
⚠️ Erreur 403 (Forbidden) - Vérifier le rôle de l'utilisateur (RECRUTEUR ou ADMIN requis)
```

**Ce message est INCORRECT** pour l'endpoint `/castings/{id}/apply` qui nécessite le rôle **ACTEUR**, pas RECRUTEUR.

**Action :** Corriger le message d'erreur dans votre `AuthInterceptor` pour qu'il affiche le bon message selon l'endpoint.

### 2. Vérifier que c'est bien l'endpoint apply

**Confirmer que l'erreur vient bien de :**
- `POST /castings/{id}/apply` (candidature) ✅
- **PAS** de `POST /castings` (création de casting) ❌

### 3. Vérifier le format multipart

Assurez-vous que la requête est bien au format `multipart/form-data` :
- Même sans vidéo, envoyez un FormData vide
- Ne pas envoyer de JSON directement

---

## 🔧 Corrections suggérées côté Android

### 1. Corriger le message d'erreur dans AuthInterceptor

```kotlin
// Dans votre AuthInterceptor ou ErrorInterceptor
when {
    request.url.toString().contains("/castings") && 
    request.url.toString().contains("/apply") -> {
        // Candidature à un casting - nécessite ACTEUR
        Log.e("ERROR", "⚠️ Erreur 403 (Forbidden) - Vérifier le rôle de l'utilisateur (ACTEUR requis)")
        showError("Seuls les acteurs peuvent postuler à un casting")
    }
    request.url.toString().contains("/castings") && 
    request.method == "POST" -> {
        // Création de casting - nécessite RECRUTEUR ou ADMIN
        Log.e("ERROR", "⚠️ Erreur 403 (Forbidden) - Vérifier le rôle de l'utilisateur (RECRUTEUR ou ADMIN requis)")
        showError("Seuls les recruteurs peuvent créer des castings")
    }
    else -> {
        Log.e("ERROR", "⚠️ Erreur 403 (Forbidden)")
        showError("Accès refusé")
    }
}
```

### 2. Vérifier le token avant chaque requête

```kotlin
fun verifyTokenBeforeApply(castingId: String): Boolean {
    val token = tokenManager.getToken()
    if (token == null) {
        Log.e("VERIFY", "❌ Pas de token")
        return false
    }
    
    val payload = decodeJWT(token)
    val role = payload?.get("role") as? String
    val type = payload?.get("type") as? String
    
    Log.d("VERIFY", "Vérification avant apply:")
    Log.d("VERIFY", "  Role: $role")
    Log.d("VERIFY", "  Type: $type")
    
    if (role != "ACTEUR" || type != "ACTEUR") {
        Log.e("VERIFY", "❌ Token invalide pour postuler: role=$role, type=$type")
        showError("Vous devez être un acteur pour postuler à un casting")
        return false
    }
    
    Log.d("VERIFY", "✅ Token valide pour postuler")
    return true
}
```

---

## 📊 Logs backend à vérifier

Après avoir testé, vérifier les logs backend dans Vercel pour :

### 1. JwtStrategy
```
[JWT Strategy] Recherche acteur avec ID: 690cda42dc65a1a3fc2c6a20
[JWT Strategy] Acteur trouvé: { ... }
[JWT Strategy] Objet utilisateur retourné (ACTEUR): { id: "...", role: "ACTEUR", ... }
```

**Si ces logs n'apparaissent pas :**
- Le token n'est pas correctement décodé
- L'acteur n'existe pas en base de données

### 2. RolesGuard
```
[RolesGuard] Vérification des rôles: {
  requiredRoles: ["ACTEUR"],
  userRole: "ACTEUR",
  ...
}
[RolesGuard] Comparaison rôle: { userRole: "ACTEUR", requiredRole: "ACTEUR", matches: true }
[RolesGuard] ✅ Accès autorisé pour le rôle: ACTEUR
```

**Si ces logs montrent `matches: false` :**
- Problème de comparaison des rôles
- Le rôle dans l'objet utilisateur ne correspond pas

### 3. CastingsController
```
[CastingsController] Candidature à un casting: {
  castingId: "...",
  hasUser: true,
  userId: "690cda42dc65a1a3fc2c6a20",
  userRole: "ACTEUR",
  ...
}
[CastingsController] ID utilisateur extrait: 690cda42dc65a1a3fc2c6a20
```

**Si ces logs n'apparaissent pas :**
- Le RolesGuard bloque avant d'atteindre le controller
- Vérifier les logs du RolesGuard

---

## 🚨 Actions immédiates

1. **Vérifier les logs backend dans Vercel** pour voir exactement où ça bloque
2. **Corriger le message d'erreur Android** qui affiche "RECRUTEUR ou ADMIN" au lieu de "ACTEUR"
3. **Tester avec les logs de diagnostic** ci-dessus
4. **Partager les logs backend** avec l'équipe backend si le problème persiste

---

## 📞 Informations à fournir si problème persiste

Si après vérification des logs backend le problème persiste, fournir :

1. **Logs backend complets** (depuis Vercel) :
   - Logs `[JWT Strategy]`
   - Logs `[RolesGuard]`
   - Logs `[CastingsController]`

2. **Logs Android complets** :
   - Token décodé complet
   - Tous les headers de la requête
   - Body de la réponse d'erreur

3. **Informations sur le casting** :
   - ID du casting : `693f0a9897caff2222dc87f1`
   - Le casting est-il ouvert ?
   - L'acteur a-t-il déjà postulé ?

---

## ✅ Résumé

- ✅ Le backend a été corrigé avec logs détaillés
- ⚠️ Le message d'erreur Android est incorrect (dit RECRUTEUR au lieu de ACTEUR)
- 🔍 Les logs backend permettront d'identifier rapidement le problème
- 📋 Tester avec les scénarios ci-dessus et vérifier les logs backend

**Merci de vérifier les logs backend et de nous faire un retour !** 🙏

