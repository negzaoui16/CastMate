# 📱 Guide Frontend Android - Gestion de l'erreur 403 lors de la création de casting

## 🔍 Diagnostic amélioré

Avec les corrections backend, les erreurs 403 sont maintenant plus explicites. Voici comment les gérer côté Android.

## 📋 Messages d'erreur possibles

### 1. Rôle insuffisant
```
403 Forbidden
"Accès refusé. Rôles requis: RECRUTEUR ou ADMIN. Votre rôle: ACTEUR"
```

**Cause** : L'utilisateur connecté est un acteur, pas un recruteur.

**Solution** :
```kotlin
if (errorMessage.contains("Rôles requis") && errorMessage.contains("ACTEUR")) {
    showError("Seuls les recruteurs peuvent créer des castings. Veuillez vous connecter avec un compte recruteur.")
    navigateToLogin()
}
```

### 2. Utilisateur non authentifié
```
403 Forbidden
"Utilisateur non authentifié. Veuillez vous connecter."
```

**Cause** : Le token n'a pas été correctement attaché à la requête ou l'utilisateur n'a pas été trouvé.

**Solution** :
```kotlin
if (errorMessage.contains("non authentifié")) {
    showError("Session expirée. Veuillez vous reconnecter.")
    tokenManager.clearToken()
    navigateToLogin()
}
```

### 3. Rôle non défini
```
403 Forbidden
"Rôle non défini pour l'utilisateur. Rôles requis: RECRUTEUR ou ADMIN"
```

**Cause** : Le token ne contient pas de rôle ou le rôle n'a pas été correctement extrait.

**Solution** :
```kotlin
if (errorMessage.contains("Rôle non défini")) {
    showError("Erreur d'authentification. Veuillez vous reconnecter.")
    tokenManager.clearToken()
    navigateToLogin()
}
```

## 🔧 Code de gestion d'erreur amélioré

### Intercepteur d'erreur

```kotlin
class ErrorInterceptor : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val response = chain.proceed(request)
        
        if (!response.isSuccessful) {
            val errorBody = response.peekBody(Long.MAX_VALUE).string()
            val errorMessage = try {
                val json = JSONObject(errorBody)
                json.getString("message") ?: errorBody
            } catch (e: Exception) {
                errorBody
            }
            
            when (response.code) {
                403 -> {
                    Log.e("ErrorInterceptor", "❌ Erreur 403: $errorMessage")
                    
                    // Gestion spécifique selon le message
                    when {
                        errorMessage.contains("Rôles requis") -> {
                            Log.e("ErrorInterceptor", "⚠️ Rôle insuffisant")
                            // Vérifier le rôle dans le token
                            val token = tokenManager.getToken()
                            val payload = decodeJWT(token ?: "")
                            val role = payload?.get("role") as? String
                            val type = payload?.get("type") as? String
                            
                            Log.e("ErrorInterceptor", "Rôle dans token: $role")
                            Log.e("ErrorInterceptor", "Type dans token: $type")
                            
                            if (type != "AGENCE" || (role != "RECRUTEUR" && role != "ADMIN")) {
                                // L'utilisateur n'a vraiment pas les droits
                                throw ForbiddenException(
                                    "Seuls les recruteurs peuvent créer des castings. " +
                                    "Rôle actuel: $role, Type: $type"
                                )
                            } else {
                                // Problème backend - le token est bon mais le backend refuse
                                throw ForbiddenException(
                                    "Erreur d'authentification. Contactez le support. " +
                                    "Message: $errorMessage"
                                )
                            }
                        }
                        errorMessage.contains("non authentifié") -> {
                            Log.e("ErrorInterceptor", "⚠️ Utilisateur non authentifié")
                            throw UnauthorizedException("Session expirée. Veuillez vous reconnecter.")
                        }
                        errorMessage.contains("Rôle non défini") -> {
                            Log.e("ErrorInterceptor", "⚠️ Rôle non défini")
                            throw ForbiddenException("Erreur d'authentification. Veuillez vous reconnecter.")
                        }
                        else -> {
                            Log.e("ErrorInterceptor", "⚠️ Erreur 403 générique")
                            throw ForbiddenException(errorMessage)
                        }
                    }
                }
                401 -> {
                    Log.e("ErrorInterceptor", "❌ Erreur 401: $errorMessage")
                    throw UnauthorizedException("Token invalide ou expiré. Veuillez vous reconnecter.")
                }
                else -> {
                    // Autres erreurs
                    throw ApiException(response.code, errorMessage)
                }
            }
        }
        
        return response
    }
}
```

### Vérification avant création

```kotlin
fun createCasting(castingData: CreateCastingDto, imageFile: File?) {
    // 1. Vérifier que l'utilisateur est connecté
    val token = tokenManager.getToken()
    if (token == null) {
        showError("Vous devez être connecté")
        navigateToLogin()
        return
    }
    
    // 2. Vérifier le token avant d'envoyer la requête
    val payload = decodeJWT(token)
    val type = payload?.get("type") as? String
    val role = payload?.get("role") as? String
    
    Log.d("CASTING", "========== VÉRIFICATION AVANT CRÉATION ==========")
    Log.d("CASTING", "Type dans token: $type")
    Log.d("CASTING", "Role dans token: $role")
    
    // 3. Vérifications critiques
    if (type != "AGENCE") {
        Log.e("CASTING", "❌ ERREUR: Type doit être 'AGENCE', actuel: $type")
        showError(
            "Seules les agences peuvent créer des castings. " +
            "Veuillez vous reconnecter avec un compte recruteur."
        )
        return
    }
    
    if (role != "RECRUTEUR" && role != "ADMIN") {
        Log.e("CASTING", "❌ ERREUR: Role doit être 'RECRUTEUR' ou 'ADMIN', actuel: $role")
        showError(
            "Votre compte n'a pas les permissions nécessaires pour créer un casting. " +
            "Rôle actuel: $role"
        )
        return
    }
    
    Log.d("CASTING", "✅ Vérifications OK, envoi de la requête...")
    Log.d("CASTING", "================================================")
    
    // 4. Procéder à la création avec gestion d'erreur
    viewModelScope.launch {
        try {
            val result = castingRepository.createCasting(castingData, imageFile)
            onSuccess(result)
        } catch (e: ForbiddenException) {
            Log.e("CASTING", "❌ Erreur 403: ${e.message}")
            handle403Error(e.message ?: "Accès refusé")
        } catch (e: UnauthorizedException) {
            Log.e("CASTING", "❌ Erreur 401: ${e.message}")
            showError("Session expirée. Veuillez vous reconnecter.")
            tokenManager.clearToken()
            navigateToLogin()
        } catch (e: Exception) {
            Log.e("CASTING", "❌ Erreur: ${e.message}")
            showError("Erreur lors de la création: ${e.message}")
        }
    }
}

private fun handle403Error(message: String) {
    when {
        message.contains("Rôles requis") && message.contains("ACTEUR") -> {
            showError("Seuls les recruteurs peuvent créer des castings.")
        }
        message.contains("non authentifié") -> {
            showError("Session expirée. Veuillez vous reconnecter.")
            tokenManager.clearToken()
            navigateToLogin()
        }
        message.contains("Rôle non défini") -> {
            showError("Erreur d'authentification. Veuillez vous reconnecter.")
            tokenManager.clearToken()
            navigateToLogin()
        }
        else -> {
            showError("Accès refusé: $message")
        }
    }
}
```

## 🧪 Tests de diagnostic

### Test 1 : Vérifier le token après login

```kotlin
fun testTokenAfterLogin(loginResponse: LoginResponse) {
    val token = loginResponse.access_token
    val payload = decodeJWT(token)
    
    Log.d("TEST", "========== TEST TOKEN ==========")
    Log.d("TEST", "Type: ${payload?.get("type")}")
    Log.d("TEST", "Role: ${payload?.get("role")}")
    Log.d("TEST", "Sub: ${payload?.get("sub")}")
    Log.d("TEST", "Email: ${payload?.get("email")}")
    
    // Vérifications
    val type = payload?.get("type") as? String
    val role = payload?.get("role") as? String
    
    if (type != "AGENCE") {
        Log.e("TEST", "❌ PROBLÈME: Type doit être 'AGENCE'")
    } else {
        Log.d("TEST", "✅ Type correct: AGENCE")
    }
    
    if (role != "RECRUTEUR" && role != "ADMIN") {
        Log.e("TEST", "❌ PROBLÈME: Role doit être 'RECRUTEUR' ou 'ADMIN'")
    } else {
        Log.d("TEST", "✅ Role correct: $role")
    }
    
    Log.d("TEST", "===============================")
}
```

### Test 2 : Vérifier avant chaque requête

```kotlin
fun verifyTokenBeforeRequest(endpoint: String) {
    val token = tokenManager.getToken()
    if (token == null) {
        Log.e("VERIFY", "❌ Pas de token")
        return
    }
    
    val payload = decodeJWT(token)
    Log.d("VERIFY", "Token pour $endpoint:")
    Log.d("VERIFY", "  - Type: ${payload?.get("type")}")
    Log.d("VERIFY", "  - Role: ${payload?.get("role")}")
    Log.d("VERIFY", "  - Exp: ${payload?.get("exp")}")
    
    // Vérifier expiration
    val exp = payload?.get("exp") as? Number
    if (exp != null) {
        val expTime = exp.toLong() * 1000
        val now = System.currentTimeMillis()
        if (now > expTime) {
            Log.e("VERIFY", "❌ Token expiré")
        } else {
            Log.d("VERIFY", "✅ Token valide")
        }
    }
}
```

## 📊 Logs à surveiller

### Logs backend (dans Vercel/console)
```
[JWT Guard] Authentification réussie: { userRole: 'RECRUTEUR', ... }
[RolesGuard] Vérification des rôles: { userRole: 'RECRUTEUR', ... }
[RolesGuard] ✅ Accès autorisé pour le rôle: RECRUTEUR
```

### Logs Android
```
✅ Token JWT présent et valide
📋 Rôle dans le token: RECRUTEUR
📋 Type dans le token: AGENCE
✅ Vérifications OK, envoi de la requête...
```

## 🚨 Actions en cas d'erreur 403

1. **Vérifier le token** : Décoder le JWT et vérifier `type` et `role`
2. **Vérifier les logs backend** : Voir exactement où ça bloque
3. **Vérifier la session** : Peut-être que le token a changé ou expiré
4. **Se reconnecter** : Si le problème persiste, forcer une nouvelle connexion

## ✅ Checklist

- [ ] Vérifier que le token contient `type: "AGENCE"` après login
- [ ] Vérifier que le token contient `role: "RECRUTEUR"` ou `"ADMIN"`
- [ ] Ajouter la gestion d'erreur 403 avec messages explicites
- [ ] Ajouter des logs de diagnostic avant chaque requête
- [ ] Tester avec un compte recruteur valide
- [ ] Tester avec un compte acteur (doit échouer avec message clair)
- [ ] Tester sans token (doit échouer avec 401)

## 📞 Support

Si le problème persiste après ces vérifications :
1. Vérifier les logs backend dans Vercel
2. Vérifier que le `JWT_SECRET` est correct
3. Vérifier que l'agence existe en base avec le bon rôle
4. Contacter l'équipe backend avec les logs complets

