import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  GatewayTimeoutException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { type AxiosInstance } from 'axios';

import type {
  KeycloakAdminUser,
  KeycloakCandidateRole,
  KeycloakClientRepresentation,
  KeycloakGroupRepresentation,
  KeycloakPaginatedUsers,
  KeycloakRoleMappingsRepresentation,
  KeycloakRoleRepresentation,
  KeycloakUserRepresentation,
} from './interfaces/keycloak-admin.interface.js';
import type { QueryKeycloakUsersDto } from './dto/query-keycloak-users.dto.js';
import type { QueryKeycloakRolesDto } from './dto/query-keycloak-roles.dto.js';
import type { QueryKeycloakGroupsDto } from './dto/query-keycloak-groups.dto.js';

interface KeycloakTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

const INTERNAL_REALM_ROLES = new Set([
  'offline_access',
  'uma_authorization',
]);

@Injectable()
export class KeycloakAdminService {
  private readonly logger = new Logger(KeycloakAdminService.name);
  private readonly http: AxiosInstance;

  private readonly issuer: string;
  private readonly baseUrl: string;
  private readonly realm: string;
  private readonly adminBaseUrl: string;
  private readonly tokenUrl: string;
  private readonly clientId: string;
  private readonly clientSecret?: string;
  private readonly adminUsername?: string;
  private readonly adminPassword?: string;
  private readonly rolesClientId: string;

  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;
  private tokenPromise: Promise<string> | null = null;
  private readonly clientUuidCache = new Map<string, string>();

  constructor(private readonly config: ConfigService) {
    this.issuer = this.config
      .getOrThrow<string>('KEYCLOAK_ISSUER')
      .replace(/\/$/, '');

    const match = /^(https?:\/\/.+)\/realms\/([^/]+)$/.exec(this.issuer);

    if (!match) {
      throw new InternalServerErrorException(
        `KEYCLOAK_ISSUER inválido: "${this.issuer}". Formato esperado: http(s)://<host>/realms/<realm>`,
      );
    }

    const [, baseUrl, parsedRealm] = match;
    this.baseUrl = baseUrl;
    this.realm = this.config.get<string>('KEYCLOAK_REALM') ?? parsedRealm;

    this.adminBaseUrl =
      this.config.get<string>('KEYCLOAK_ADMIN_BASE_URL')?.replace(/\/$/, '') ??
      `${this.baseUrl}/admin/realms/${encodeURIComponent(this.realm)}`;

    this.adminUsername = this.config.get<string>('KEYCLOAK_ADMIN_USERNAME');
    this.adminPassword = this.config.get<string>('KEYCLOAK_ADMIN_PASSWORD');

    if (this.adminUsername && this.adminPassword) {
      const adminRealm =
        this.config.get<string>('KEYCLOAK_ADMIN_REALM') ?? 'master';
      this.tokenUrl = `${this.baseUrl}/realms/${encodeURIComponent(adminRealm)}/protocol/openid-connect/token`;
      this.clientId =
        this.config.get<string>('KEYCLOAK_ADMIN_CLIENT_ID') ?? 'admin-cli';
      this.clientSecret = this.config.get<string>(
        'KEYCLOAK_ADMIN_CLIENT_SECRET',
      );
    } else {
      this.tokenUrl = `${this.issuer}/protocol/openid-connect/token`;
      this.clientId =
        this.config.get<string>('KEYCLOAK_ADMIN_CLIENT_ID') ??
        this.config.getOrThrow<string>('KEYCLOAK_BFF_CLIENT_ID');
      this.clientSecret =
        this.config.get<string>('KEYCLOAK_ADMIN_CLIENT_SECRET') ??
        this.config.getOrThrow<string>('KEYCLOAK_BFF_CLIENT_SECRET');
    }

    this.rolesClientId =
      this.config.get<string>('KEYCLOAK_ROLES_CLIENT_ID') ??
      this.config.get<string>('KEYCLOAK_AUDIENCE') ??
      'flow-manager-api';

    this.http = axios.create({
      baseURL: this.adminBaseUrl,
      timeout: 15_000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  private async getAccessToken(forceRefresh = false): Promise<string> {
    if (
      !forceRefresh &&
      this.cachedToken &&
      Date.now() < this.tokenExpiresAt - 30_000
    ) {
      return this.cachedToken;
    }

    if (!forceRefresh && this.tokenPromise) {
      return this.tokenPromise;
    }

    this.tokenPromise = this.fetchAdminToken().finally(() => {
      this.tokenPromise = null;
    });

    return this.tokenPromise;
  }

  private async fetchAdminToken(): Promise<string> {
    try {
      const params: Record<string, string> =
        this.adminUsername && this.adminPassword
          ? {
              grant_type: 'password',
              client_id: this.clientId,
              username: this.adminUsername,
              password: this.adminPassword,
              ...(this.clientSecret ? { client_secret: this.clientSecret } : {}),
            }
          : {
              grant_type: 'client_credentials',
              client_id: this.clientId,
              client_secret: this.clientSecret ?? '',
            };

      const body = new URLSearchParams(params);

      const response = await axios.post<KeycloakTokenResponse>(
        this.tokenUrl,
        body.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 10_000,
        },
      );

      this.cachedToken = response.data.access_token;
      this.tokenExpiresAt =
        Date.now() + (response.data.expires_in ?? 60) * 1000;

      return this.cachedToken;
    } catch (error) {
      this.cachedToken = null;
      this.tokenExpiresAt = 0;

      const detail = axios.isAxiosError(error)
        ? (error.response?.data as { error_description?: string })
            ?.error_description ?? error.message
        : String(error);

      this.logger.error(
        `No se pudo obtener token de administración en Keycloak (${this.clientId}): ${detail}`,
      );

      throw new BadGatewayException(
        `No se pudo autenticar el cliente de administración en Keycloak (${this.clientId}): ${detail}`,
      );
    }
  }

  private async get<T>(
    path: string,
    params?: Record<string, unknown>,
  ): Promise<T> {
    const token = await this.getAccessToken();

    try {
      const response = await this.http.get<T>(path, {
        params,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        const refreshedToken = await this.getAccessToken(true);
        try {
          const retryResponse = await this.http.get<T>(path, {
            params,
            headers: {
              Authorization: `Bearer ${refreshedToken}`,
            },
          });
          return retryResponse.data;
        } catch (retryError) {
          return this.handleError(retryError);
        }
      }

      return this.handleError(error);
    }
  }

  private handleError(error: unknown): never {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;

      if (status === 400) {
        throw new BadRequestException(
          'Parámetros inválidos en la consulta a Keycloak Admin',
        );
      }

      if (status === 401 || status === 403) {
        this.logger.warn(
          `Permisos insuficientes en Keycloak Admin REST (${this.clientId}). Verifica que Service Accounts Roles esté activo y tenga los roles view-users / query-users / view-realm / view-clients en realm-management.`,
        );
        throw new ForbiddenException(
          'El cliente de Keycloak no tiene permisos para consultar recursos de administración (realm-management)',
        );
      }

      if (status === 404) {
        throw new NotFoundException('Recurso no encontrado en Keycloak');
      }

      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        throw new GatewayTimeoutException(
          'Keycloak Admin no respondió a tiempo',
        );
      }

      this.logger.error(`Keycloak Admin REST error: ${error.message}`);
    }

    throw new BadGatewayException(
      'No se pudo completar la consulta en Keycloak Admin',
    );
  }

  private mapUser(raw: KeycloakUserRepresentation): KeycloakAdminUser {
    const fullName = [raw.firstName, raw.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();

    return {
      id: raw.id,
      username: raw.username,
      email: raw.email,
      firstName: raw.firstName,
      lastName: raw.lastName,
      fullName: fullName || raw.username,
      enabled: raw.enabled,
      emailVerified: Boolean(raw.emailVerified),
    };
  }

  private isInternalRealmRole(roleName: string): boolean {
    return (
      INTERNAL_REALM_ROLES.has(roleName) ||
      roleName.startsWith('default-roles-')
    );
  }

  private async resolveClientUuid(clientId: string): Promise<string | null> {
    const cached = this.clientUuidCache.get(clientId);
    if (cached) {
      return cached;
    }

    const clients = await this.get<KeycloakClientRepresentation[]>('/clients', {
      clientId,
    });

    const found = clients.find((c) => c.clientId === clientId);
    if (!found) {
      return null;
    }

    this.clientUuidCache.set(clientId, found.id);
    return found.id;
  }

  // ==========================================
  // USUARIOS
  // ==========================================

  async findUsers(
    query: QueryKeycloakUsersDto,
  ): Promise<KeycloakPaginatedUsers> {
    const filterParams: Record<string, unknown> = {
      ...(query.search ? { search: query.search } : {}),
      ...(query.username ? { username: query.username } : {}),
      ...(query.email ? { email: query.email } : {}),
      ...(query.enabled !== undefined ? { enabled: query.enabled } : {}),
    };

    const [users, total] = await Promise.all([
      this.get<KeycloakUserRepresentation[]>('/users', {
        ...filterParams,
        first: query.first ?? 0,
        max: query.max ?? 20,
        briefRepresentation: true,
      }),
      this.get<number>('/users/count', filterParams),
    ]);

    return {
      data: users.map((u) => this.mapUser(u)),
      total,
      first: query.first ?? 0,
      max: query.max ?? 20,
    };
  }

  async findUserById(userId: string): Promise<KeycloakAdminUser> {
    const user = await this.get<KeycloakUserRepresentation>(
      `/users/${encodeURIComponent(userId)}`,
    );

    return this.mapUser(user);
  }

  async getUserRoles(userId: string): Promise<{
    realmRoles: KeycloakRoleRepresentation[];
    clientRoles: KeycloakRoleRepresentation[];
    effectiveRoles: string[];
  }> {
    const mappings = await this.get<KeycloakRoleMappingsRepresentation>(
      `/users/${encodeURIComponent(userId)}/role-mappings`,
    );

    const realmRoles = (mappings.realmMappings ?? []).filter(
      (role) => !this.isInternalRealmRole(role.name),
    );

    const clientRoles =
      mappings.clientMappings?.[this.rolesClientId]?.mappings ?? [];

    const effectiveRoles = Array.from(
      new Set([
        ...clientRoles.map((r) => r.name),
        ...realmRoles.map((r) => r.name),
      ]),
    );

    return {
      realmRoles,
      clientRoles,
      effectiveRoles,
    };
  }

  async getUserGroups(userId: string): Promise<KeycloakGroupRepresentation[]> {
    return this.get<KeycloakGroupRepresentation[]>(
      `/users/${encodeURIComponent(userId)}/groups`,
    );
  }

  // ==========================================
  // ROLES (CANDIDATE GROUPS BPMN)
  // ==========================================

  async findRealmRoles(
    query?: QueryKeycloakRolesDto,
  ): Promise<KeycloakRoleRepresentation[]> {
    const roles = await this.get<KeycloakRoleRepresentation[]>('/roles', {
      first: query?.first ?? 0,
      max: query?.max ?? 50,
      briefRepresentation: false,
      ...(query?.search ? { search: query.search } : {}),
    });

    return roles.filter((role) => !this.isInternalRealmRole(role.name));
  }

  async findClientRoles(
    query?: QueryKeycloakRolesDto,
    clientId = this.rolesClientId,
  ): Promise<KeycloakRoleRepresentation[]> {
    const clientUuid = await this.resolveClientUuid(clientId);

    if (!clientUuid) {
      return [];
    }

    return this.get<KeycloakRoleRepresentation[]>(
      `/clients/${encodeURIComponent(clientUuid)}/roles`,
      {
        first: query?.first ?? 0,
        max: query?.max ?? 50,
        briefRepresentation: false,
        ...(query?.search ? { search: query.search } : {}),
      },
    );
  }

  async findCandidateRoles(
    query?: QueryKeycloakRolesDto,
  ): Promise<KeycloakCandidateRole[]> {
    const [clientRoles, realmRoles] = await Promise.all([
      this.findClientRoles(query, this.rolesClientId).catch(() => []),
      this.findRealmRoles(query),
    ]);

    const seen = new Set<string>();
    const candidates: KeycloakCandidateRole[] = [];

    for (const role of clientRoles) {
      seen.add(role.name);
      candidates.push({
        id: role.id,
        name: role.name,
        description: role.description,
        source: 'client',
        clientId: this.rolesClientId,
      });
    }

    for (const role of realmRoles) {
      if (!seen.has(role.name)) {
        candidates.push({
          id: role.id,
          name: role.name,
          description: role.description,
          source: 'realm',
        });
      }
    }

    return candidates;
  }

  async findUsersByRole(
    roleName: string,
    first = 0,
    max = 50,
  ): Promise<KeycloakAdminUser[]> {
    const clientUuid = await this.resolveClientUuid(this.rolesClientId);

    if (clientUuid) {
      try {
        const clientUsers = await this.get<KeycloakUserRepresentation[]>(
          `/clients/${encodeURIComponent(clientUuid)}/roles/${encodeURIComponent(roleName)}/users`,
          { first, max },
        );
        return clientUsers.map((u) => this.mapUser(u));
      } catch (error) {
        if (!(error instanceof NotFoundException)) {
          throw error;
        }
      }
    }

    const realmUsers = await this.get<KeycloakUserRepresentation[]>(
      `/roles/${encodeURIComponent(roleName)}/users`,
      { first, max },
    );

    return realmUsers.map((u) => this.mapUser(u));
  }

  // ==========================================
  // GRUPOS
  // ==========================================

  async findGroups(
    query?: QueryKeycloakGroupsDto,
  ): Promise<KeycloakGroupRepresentation[]> {
    return this.get<KeycloakGroupRepresentation[]>('/groups', {
      first: query?.first ?? 0,
      max: query?.max ?? 50,
      briefRepresentation: false,
      ...(query?.search ? { search: query.search } : {}),
    });
  }

  async findGroupById(groupId: string): Promise<KeycloakGroupRepresentation> {
    return this.get<KeycloakGroupRepresentation>(
      `/groups/${encodeURIComponent(groupId)}`,
    );
  }

  async findGroupMembers(
    groupId: string,
    first = 0,
    max = 50,
  ): Promise<KeycloakAdminUser[]> {
    const members = await this.get<KeycloakUserRepresentation[]>(
      `/groups/${encodeURIComponent(groupId)}/members`,
      { first, max },
    );

    return members.map((u) => this.mapUser(u));
  }
}
