import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    
    // Logs pour déboguer l'ordre d'exécution
    console.log('[JWT Guard] canActivate appelé:', {
      url: request.url,
      method: request.method,
      contentType: request.headers?.['content-type'],
      isGlobalGuard: !context.getHandler(), // Approximatif
    });
    
    // Rendre Swagger et sa documentation JSON publiques
    if (request.url?.startsWith('/api') || request.url?.startsWith('/api-json')) {
      console.log('[JWT Guard] Route Swagger, accès autorisé');
      return true;
    }
    
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      console.log('[JWT Guard] Route publique, accès autorisé');
      return true;
    }
    
    console.log('[JWT Guard] Route protégée, vérification JWT...');
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    
    // Logs détaillés pour diagnostiquer
    if (err || !user) {
      const authHeader = request.headers?.authorization;
      const tokenPresent = !!authHeader;
      const tokenPrefix = authHeader?.substring(0, 20) || 'N/A';
      
      console.error('[JWT Guard] Erreur d\'authentification:', {
        url: request.url,
        method: request.method,
        error: err?.message || info?.message || 'Token invalide ou manquant',
        infoType: info?.name || 'unknown',
        hasToken: tokenPresent,
        tokenPrefix: tokenPrefix,
        errType: err?.constructor?.name || 'unknown',
      });
      
      // Messages d'erreur plus spécifiques
      if (info?.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token expiré. Veuillez vous reconnecter.');
      }
      if (info?.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Token invalide. Vérifiez votre authentification.');
      }
      if (!tokenPresent) {
        throw new UnauthorizedException('Token manquant. Veuillez vous authentifier.');
      }
      
      throw err || new UnauthorizedException('Token invalide ou expiré');
    }
    
    // Logs de succès pour débogage
    console.log('[JWT Guard] Authentification réussie:', {
      url: request.url,
      method: request.method,
      contentType: request.headers?.['content-type'],
      isMultipart: request.headers?.['content-type']?.includes('multipart/form-data'),
      userId: user?.id || user?._id,
      userRole: user?.role,
      userType: user?.type || 'unknown',
      userEmail: user?.email,
      userObject: {
        id: user?.id || user?._id,
        _id: user?._id ? String(user._id) : undefined,
        role: user?.role,
        type: user?.type,
        email: user?.email,
        nomAgence: user?.nomAgence,
        nom: user?.nom,
        prenom: user?.prenom,
        allKeys: user ? Object.keys(user) : [],
      },
    });
    
    // S'assurer que l'utilisateur est bien attaché à la requête
    request.user = user;
    
    // Log pour confirmer que l'utilisateur est attaché
    console.log('[JWT Guard] Utilisateur attaché à la requête:', {
      hasUser: !!request.user,
      userId: request.user?.id || request.user?._id,
      userRole: request.user?.role,
    });
    
    return user;
  }
}

