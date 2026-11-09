import { Injectable, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ActeurService } from '../acteur/acteur.service';
import { AgenceService } from '../agence/agence.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto, UserType } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { PasswordResetTokenService } from './password-reset-token.service';

/**
 * Service d'authentification
 * 
 * Ce service gère :
 * - La connexion (login) des utilisateurs (acteurs et agences)
 * - L'oubli de mot de passe (forgot password)
 * - La réinitialisation de mot de passe (reset password)
 * 
 * Exemple d'utilisation :
 * - Un acteur se connecte avec email: "acteur@example.com" et password: "monMotDePasse123"
 * - Le service vérifie les identifiants et retourne un token JWT pour accéder à l'API
 */
@Injectable()
export class AuthService {
  constructor(
    private acteurService: ActeurService, // Service pour gérer les acteurs
    private agenceService: AgenceService, // Service pour gérer les agences
    private jwtService: JwtService, // Service pour créer des tokens JWT (jetons d'authentification)
    private passwordResetTokenService: PasswordResetTokenService, // Service pour gérer les tokens de réinitialisation
  ) {}

  /**
   * Connexion d'un utilisateur (acteur ou agence)
   * 
   * Fonctionnement :
   * 1. On cherche d'abord si l'email existe dans la table des acteurs
   * 2. Si oui, on vérifie le mot de passe
   * 3. Si non, on cherche dans la table des agences
   * 4. Si trouvé, on crée un token JWT et on retourne les infos de l'utilisateur
   * 
   * @param loginDto - Contient l'email et le mot de passe
   * @returns Un objet avec :
   *   - access_token : Le token JWT pour s'authentifier sur les autres requêtes
   *   - user : Les informations de l'utilisateur (nom, email, rôle, etc.)
   * 
   * Exemple :
   * Input: { email: "acteur@example.com", password: "monMotDePasse123" }
   * Output: {
   *   access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
   *   user: { id: "507f1f77bcf86cd799439011", email: "acteur@example.com", nom: "Dupont", prenom: "Jean", role: "ACTEUR" }
   * }
   */
  async login(loginDto: LoginDto) {
    // ÉTAPE 1 : Chercher d'abord dans les acteurs
    // On cherche un acteur avec cet email dans la base de données
    // Exemple : Si loginDto.email = "acteur@example.com", on cherche dans la collection "acteurs"
    const acteur = await this.acteurService.findByEmail(loginDto.email);
    
    // Si on a trouvé un acteur avec cet email
    if (acteur) {
      // ÉTAPE 2 : Vérifier que le mot de passe est correct
      // bcrypt.compare compare le mot de passe en clair avec le hash stocké en base
      // Exemple : Si l'utilisateur tape "monMotDePasse123", on le compare avec "$2b$10$xyz..." stocké en base
      const isPasswordValid = await bcrypt.compare(loginDto.password, acteur.motDePasse);
      
      // Si le mot de passe est incorrect, on refuse la connexion
      if (!isPasswordValid) {
        throw new UnauthorizedException('Email ou mot de passe incorrect');
      }

      // ÉTAPE 3 : Créer le payload (données) du token JWT
      // Le payload contient les infos qu'on veut mettre dans le token
      // Exemple : { email: "acteur@example.com", sub: "507f1f77bcf86cd799439011", role: "ACTEUR", type: "ACTEUR" }
      const payload = { 
        email: acteur.email, // Email de l'acteur
        sub: String(acteur._id), // ID de l'acteur (sub = subject = sujet du token)
        role: acteur.role, // Rôle de l'acteur (toujours "ACTEUR")
        type: 'ACTEUR' // Type d'utilisateur pour différencier acteur/agence
      };
      
      // ÉTAPE 4 : Retourner le token et les infos de l'utilisateur
      return {
        access_token: this.jwtService.sign(payload), // Crée le token JWT avec le payload
        user: {
          id: String(acteur._id), // ID de l'acteur
          email: acteur.email, // Email de l'acteur
          nom: acteur.nom, // Nom de famille
          prenom: acteur.prenom, // Prénom
          role: acteur.role, // Rôle (ACTEUR)
        },
      };
    }

    // ÉTAPE 5 : Si pas d'acteur trouvé, chercher dans les agences
    // On cherche une agence avec cet email dans la base de données
    // Exemple : Si loginDto.email = "agence@example.com", on cherche dans la collection "agences"
    const agence = await this.agenceService.findByEmail(loginDto.email);
    
    // Si on a trouvé une agence avec cet email
    if (agence) {
      // ÉTAPE 6 : Vérifier que le mot de passe est correct
      // Même principe que pour les acteurs
      const isPasswordValid = await bcrypt.compare(loginDto.password, agence.motDePasse);
      
      // Si le mot de passe est incorrect, on refuse la connexion
      if (!isPasswordValid) {
        throw new UnauthorizedException('Email ou mot de passe incorrect');
      }

      // ÉTAPE 7 : Créer le payload du token JWT pour l'agence
      // Exemple : { email: "agence@example.com", sub: "507f1f77bcf86cd799439012", role: "RECRUTEUR", type: "AGENCE" }
      const payload = { 
        email: agence.email, // Email de l'agence
        sub: String(agence._id), // ID de l'agence
        role: agence.role, // Rôle de l'agence (toujours "RECRUTEUR")
        type: 'AGENCE' // Type d'utilisateur pour différencier acteur/agence
      };
      
      // ÉTAPE 8 : Retourner le token et les infos de l'agence
      return {
        access_token: this.jwtService.sign(payload), // Crée le token JWT avec le payload
        user: {
          id: String(agence._id), // ID de l'agence
          nomAgence: agence.nomAgence, // Nom de l'agence (ex: "Agence de Casting Paris")
          responsable: agence.responsable, // Nom du responsable
          email: agence.email, // Email de l'agence
          role: agence.role, // Rôle (RECRUTEUR)
        },
      };
    }

    // ÉTAPE 9 : Si aucun utilisateur trouvé (ni acteur ni agence), on refuse la connexion
    // Exemple : Si l'email "inexistant@example.com" n'existe dans aucune table
    throw new UnauthorizedException('Email ou mot de passe incorrect');
  }

  /**
   * Demande de réinitialisation de mot de passe (oubli de mot de passe)
   * 
   * Fonctionnement :
   * 1. L'utilisateur oublie son mot de passe et entre son email
   * 2. On vérifie que l'email existe dans la base de données
   * 3. On génère un token unique et sécurisé
   * 4. On crée un lien de deep link pour l'application Android
   * 5. On retourne le token et le lien
   * 
   * @param dto - Contient l'email, le type d'utilisateur (ACTEUR ou RECRUTEUR), et optionnellement un token
   * @returns Un objet avec :
   *   - success : true si tout s'est bien passé
   *   - message : Message de confirmation
   *   - token : Le token de réinitialisation (ex: "a1b2c3d4e5f6...")
   *   - link : Le lien deep link pour Android (ex: "castmate://reset-password?token=...&email=...&type=ACTEUR")
   *   - expiresIn : Durée de validité en secondes (3600 = 1 heure)
   * 
   * Exemple :
   * Input: { email: "acteur@example.com", userType: "ACTEUR" }
   * Output: {
   *   success: true,
   *   message: "Reset email sent",
   *   token: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6",
   *   link: "castmate://reset-password?token=a1b2c3d4...&email=acteur%40example.com&type=ACTEUR",
   *   expiresIn: 3600
   * }
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    // ÉTAPE 1 : Définir le schéma de deep link pour l'application Android
    // Le deep link permet d'ouvrir l'app Android directement avec les paramètres
    // Exemple : "castmate://reset-password?token=abc123&email=user@example.com&type=ACTEUR"
    const deepLinkBase = 'castmate://reset-password';

    // ÉTAPE 2 : Vérifier que l'utilisateur existe dans la base de données
    // On initialise une variable pour savoir si l'utilisateur existe
    let userExists = false;
    
    // Si c'est un acteur qui demande la réinitialisation
    if (dto.userType === UserType.ACTEUR) {
      // Chercher l'acteur par email
      // Exemple : Si dto.email = "acteur@example.com", on cherche dans la collection "acteurs"
      const acteur = await this.acteurService.findByEmail(dto.email);
      // !!acteur convertit l'objet en booléen : true si trouvé, false si null
      // Exemple : Si acteur = { _id: "...", email: "..." }, alors userExists = true
      userExists = !!acteur;
    } 
    // Si c'est une agence qui demande la réinitialisation
    else if (dto.userType === UserType.RECRUTEUR) {
      // Chercher l'agence par email
      // Exemple : Si dto.email = "agence@example.com", on cherche dans la collection "agences"
      const agence = await this.agenceService.findByEmail(dto.email);
      // !!agence convertit l'objet en booléen : true si trouvé, false si null
      userExists = !!agence;
    } 
    // Si le type n'est ni ACTEUR ni RECRUTEUR, c'est une erreur
    else {
      throw new BadRequestException('Type utilisateur invalide');
    }

    // ÉTAPE 3 : Si l'utilisateur n'existe pas, on refuse la demande
    // Exemple : Si l'email "inexistant@example.com" n'existe pas, on retourne une erreur
    if (!userExists) {
      throw new NotFoundException('Compte introuvable');
    }

    // ÉTAPE 4 : Générer ou utiliser un token de réinitialisation
    // Si un token est fourni (vient d'Android), on l'utilise
    // Sinon, on en génère un nouveau automatiquement
    // 
    // Exemple avec token fourni (Android) :
    //   dto.token = "token-from-android-123"
    //   On stocke ce token dans la base de données
    //
    // Exemple sans token fourni (web) :
    //   dto.token = undefined
    //   On génère un nouveau token aléatoire (ex: "a1b2c3d4e5f6...")
    const token = dto.token 
      ? await this.passwordResetTokenService.storeToken(dto.email, dto.userType, dto.token)
      : await this.passwordResetTokenService.storeToken(dto.email, dto.userType);

    // ÉTAPE 5 : Créer le lien deep link avec tous les paramètres
    // encodeURIComponent encode les caractères spéciaux pour les URLs
    // Exemple : "user@example.com" devient "user%40example.com" dans l'URL
    // 
    // Résultat final :
    // "castmate://reset-password?token=a1b2c3d4...&email=acteur%40example.com&type=ACTEUR"
    const link = `${deepLinkBase}?token=${encodeURIComponent(token)}&email=${encodeURIComponent(dto.email)}&type=${dto.userType}`;

    // ÉTAPE 6 : Retourner les informations de réinitialisation
    return {
      success: true, // Tout s'est bien passé
      message: dto.token ? 'Token stored successfully' : 'Reset email sent', // Message selon la source
      token, // Le token généré ou fourni
      link, // Le lien deep link pour ouvrir l'app Android
      expiresIn: 3600, // Le token expire dans 3600 secondes = 1 heure
    };
  }

  /**
   * Réinitialisation du mot de passe avec un token
   * 
   * Fonctionnement :
   * 1. L'utilisateur clique sur le lien dans l'email ou dans l'app Android
   * 2. Il entre son nouveau mot de passe
   * 3. On vérifie que le token est valide et non expiré
   * 4. On vérifie que le nouveau mot de passe respecte les critères (min 8 caractères)
   * 5. On hash le nouveau mot de passe et on le sauvegarde
   * 6. On marque le token comme utilisé (pour qu'il ne puisse plus être réutilisé)
   * 
   * @param dto - Contient le token, l'email et le nouveau mot de passe
   * @returns Un objet avec success: true et un message de confirmation
   * 
   * Exemple :
   * Input: { 
   *   token: "a1b2c3d4e5f6...", 
   *   email: "acteur@example.com", 
   *   newPassword: "nouveauMotDePasse123" 
   * }
   * Output: { success: true, message: "Password updated" }
   */
  async resetPassword(dto: ResetPasswordDto) {
    // ÉTAPE 1 : Valider le token dans la table dédiée
    // On vérifie que :
    // - Le token existe dans la base de données
    // - Le token correspond à l'email fourni
    // - Le token n'a pas déjà été utilisé
    // - Le token n'est pas expiré (max 1 heure)
    //
    // Exemple : Si dto.token = "a1b2c3d4..." et dto.email = "acteur@example.com"
    // On cherche dans la table "password-reset-tokens" un document avec ces valeurs
    const resetToken = await this.passwordResetTokenService.validateToken(
      dto.token, // Le token fourni par l'utilisateur
      dto.email, // L'email fourni par l'utilisateur
    );

    // ÉTAPE 2 : Vérifier que le nouveau mot de passe respecte les critères de sécurité
    // Critères : minimum 8 caractères
    // 
    // Exemples :
    // - "abc123" → ❌ Trop court (6 caractères)
    // - "nouveauMotDePasse123" → ✅ Valide (20 caractères)
    if (!dto.newPassword || dto.newPassword.length < 8) {
      throw new BadRequestException('Mot de passe invalide (min 8 caractères).');
    }

    // ÉTAPE 3 : Trouver l'utilisateur selon le type et mettre à jour son mot de passe
    // On initialise une variable pour savoir si l'utilisateur a été trouvé et mis à jour
    let userFound = false;
    
    // Si c'est un acteur
    if (resetToken.userType === 'ACTEUR') {
      // Chercher l'acteur par email
      // Exemple : Si dto.email = "acteur@example.com", on cherche dans la collection "acteurs"
      const acteur = await this.acteurService.findByEmail(dto.email);
      
      // Si l'acteur existe
      if (acteur) {
        // Hasher le nouveau mot de passe avec bcrypt
        // bcrypt.hash transforme "nouveauMotDePasse123" en "$2b$10$xyz..." (hash sécurisé)
        // Le 10 est le nombre de "rounds" (tours) de hachage (plus c'est élevé, plus c'est sécurisé mais plus lent)
        const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
        
        // Mettre à jour le mot de passe dans la base de données
        // On remplace l'ancien hash par le nouveau hash
        await this.acteurService.updatePassword(dto.email, hashedPassword);
        
        // Marquer que l'utilisateur a été trouvé et mis à jour
        userFound = true;
      }
    } 
    // Si c'est une agence
    else if (resetToken.userType === 'RECRUTEUR') {
      // Chercher l'agence par email
      // Exemple : Si dto.email = "agence@example.com", on cherche dans la collection "agences"
      const agence = await this.agenceService.findByEmail(dto.email);
      
      // Si l'agence existe
      if (agence) {
        // Hasher le nouveau mot de passe avec bcrypt
        // Même principe que pour les acteurs
        const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
        
        // Mettre à jour le mot de passe dans la base de données
        await this.agenceService.updatePassword(dto.email, hashedPassword);
        
        // Marquer que l'utilisateur a été trouvé et mis à jour
        userFound = true;
      }
    }

    // ÉTAPE 4 : Si l'utilisateur n'a pas été trouvé, on retourne une erreur
    // Cela ne devrait normalement pas arriver car on a validé le token avant
    // Mais c'est une sécurité supplémentaire
    if (!userFound) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // ÉTAPE 5 : Marquer le token comme utilisé
    // Une fois le mot de passe changé, on marque le token comme "used: true"
    // Cela empêche de réutiliser le même token plusieurs fois
    // Exemple : Si quelqu'un intercepte le lien, il ne pourra plus l'utiliser après la première utilisation
    await this.passwordResetTokenService.markAsUsed(dto.token);

    // ÉTAPE 6 : Retourner un message de succès
    return { 
      success: true, // Tout s'est bien passé
      message: 'Password updated' // Message de confirmation
    };
  }
}
