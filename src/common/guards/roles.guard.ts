import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../enums/role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si aucun rôle requis, autoriser l'accès
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = request;

    // Logs détaillés pour déboguer
    console.log('[RolesGuard] Vérification des rôles:', {
      url: request.url,
      method: request.method,
      requiredRoles: requiredRoles,
      userRole: user?.role,
      userType: user?.type,
      userId: user?.id || user?._id,
      hasUser: !!user,
      userObject: user ? {
        id: user.id || user._id,
        role: user.role,
        type: user.type,
        email: user.email,
      } : null,
    });

    // Vérifier que l'utilisateur existe
    if (!user) {
      console.error('[RolesGuard] ERREUR: Utilisateur non trouvé dans la requête');
      throw new ForbiddenException(
        'Utilisateur non authentifié. Veuillez vous connecter.',
      );
    }

    // Vérifier que le rôle de l'utilisateur est défini
    if (!user.role) {
      console.error('[RolesGuard] ERREUR: Rôle non défini pour l\'utilisateur:', {
        userId: user.id || user._id,
        userObject: user,
      });
      throw new ForbiddenException(
        `Rôle non défini pour l'utilisateur. Rôles requis: ${requiredRoles.join(' ou ')}`,
      );
    }

    // Comparer les rôles (insensible à la casse pour plus de robustesse)
    const userRole = String(user.role).toUpperCase().trim();
    const hasRequiredRole = requiredRoles.some((role) => {
      // Gérer à la fois les enums et les strings
      const roleValue = typeof role === 'string' ? role : (role as any)?.valueOf?.() || String(role);
      const roleStr = String(roleValue).toUpperCase().trim();
      const matches = userRole === roleStr;
      console.log('[RolesGuard] Comparaison rôle:', {
        userRole,
        requiredRole: roleStr,
        requiredRoleType: typeof role,
        requiredRoleValue: roleValue,
        matches,
        userRoleLength: userRole.length,
        requiredRoleLength: roleStr.length,
      });
      return matches;
    });

    if (!hasRequiredRole) {
      console.error('[RolesGuard] ERREUR: Rôle insuffisant:', {
        requiredRoles: requiredRoles,
        userRole: user.role,
        userType: user.type,
        userId: user.id || user._id,
        url: request.url,
        method: request.method,
      });
      throw new ForbiddenException(
        `Accès refusé. Rôles requis: ${requiredRoles.join(' ou ')}. Votre rôle: ${user.role || 'non défini'}`,
      );
    }

    console.log('[RolesGuard] ✅ Accès autorisé pour le rôle:', user.role);
    return true;
  }
}

