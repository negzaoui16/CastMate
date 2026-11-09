import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ActeurService } from '../../acteur/acteur.service';
import { AgenceService } from '../../agence/agence.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private acteurService: ActeurService,
    private agenceService: AgenceService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    });
    
    // Log pour vérifier que le secret est bien chargé (sans le révéler)
    console.log('[JWT Strategy] Initialisé avec secret:', process.env.JWT_SECRET ? 'PRÉSENT' : 'MANQUANT (utilise la valeur par défaut)');
  }

  async validate(payload: any) {
    // Logs de débogage pour diagnostiquer l'erreur 401
    console.log('[JWT Strategy] Validation du payload:', {
      sub: payload.sub,
      type: payload.type,
      role: payload.role,
      email: payload.email,
      exp: payload.exp,
      isExpired: payload.exp ? Date.now() / 1000 > payload.exp : 'unknown',
    });

    // Vérifier le type dans le payload pour savoir où chercher
    if (payload.type === 'ACTEUR') {
      console.log('[JWT Strategy] Recherche acteur avec ID:', payload.sub);
      const acteur = await this.acteurService.findById(payload.sub);
      if (!acteur) {
        console.error('[JWT Strategy] ERREUR: Acteur non trouvé pour ID:', payload.sub);
        throw new UnauthorizedException('Acteur non trouvé');
      }
      console.log('[JWT Strategy] Acteur trouvé:', {
        _id: String(acteur._id),
        nom: acteur.nom,
        prenom: acteur.prenom,
        role: acteur.role,
        email: acteur.email,
      });
      const acteurObj = acteur.toObject();
      delete acteurObj.motDePasse;
      // S'assurer que l'objet a bien id et role
      const userObj = {
        ...acteurObj,
        id: String(acteurObj._id || acteurObj.id),
        _id: acteurObj._id,
        role: acteurObj.role || payload.role || 'ACTEUR',
      };
      console.log('[JWT Strategy] Objet utilisateur retourné (ACTEUR):', {
        id: userObj.id,
        _id: String(userObj._id),
        role: userObj.role,
        hasEmail: !!userObj.email,
        allKeys: Object.keys(userObj),
      });
      return userObj;
    }

    if (payload.type === 'AGENCE') {
      console.log('[JWT Strategy] Recherche agence avec ID:', payload.sub);
      const agence = await this.agenceService.findById(payload.sub);
      if (!agence) {
        console.error('[JWT Strategy] ERREUR: Agence non trouvée pour ID:', payload.sub);
        throw new UnauthorizedException('Agence non trouvée');
      }
      console.log('[JWT Strategy] Agence trouvée:', {
        _id: String(agence._id),
        nomAgence: agence.nomAgence,
        role: agence.role,
        email: agence.email,
      });
      const agenceObj = agence.toObject();
      delete agenceObj.motDePasse;
      // S'assurer que l'objet a bien id et role
      const userObj = {
        ...agenceObj,
        id: String(agenceObj._id || agenceObj.id),
        _id: agenceObj._id,
        role: agenceObj.role || payload.role || 'RECRUTEUR',
      };
      console.log('[JWT Strategy] Objet utilisateur retourné:', {
        id: userObj.id,
        _id: String(userObj._id),
        role: userObj.role,
        hasEmail: !!userObj.email,
      });
      return userObj;
    }

    // Fallback pour compatibilité (si le token n'a pas de type)
    // Chercher dans les deux
    const acteur = await this.acteurService.findById(payload.sub);
    if (acteur) {
      const acteurObj = acteur.toObject();
      delete acteurObj.motDePasse;
      return {
        ...acteurObj,
        id: String(acteurObj._id || acteurObj.id),
        _id: acteurObj._id,
        role: acteurObj.role || payload.role || 'ACTEUR',
      };
    }

    const agence = await this.agenceService.findById(payload.sub);
    if (agence) {
      const agenceObj = agence.toObject();
      delete agenceObj.motDePasse;
      return {
        ...agenceObj,
        id: String(agenceObj._id || agenceObj.id),
        _id: agenceObj._id,
        role: agenceObj.role || payload.role || 'RECRUTEUR',
      };
    }

    throw new UnauthorizedException('Utilisateur non trouvé');
  }
}
