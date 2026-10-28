import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GatewayTimeoutException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { type AxiosInstance, type AxiosResponse } from 'axios';

import type {
  KeycloakAdminUser,
  KeycloakClientRepresentation,
  KeycloakUserRepresentation,
} from './interfaces/keycloak-admin.interface.js';

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
export class KeycloakAdminClient {
  private readonly logger = new Logger(KeycloakAdminClient.name);
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
  readonly rolesClientId: string;

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

  private async requestWithAuth<T>(
    executor: (token: string) => Promise<AxiosResponse<T>>,
  ): Promise<AxiosResponse<T>> {
    const token = await this.getAccessToken();

    try {
      return await executor(token);
    } catch (error) {
      if (
        axios.isAxiosError(error) &&
        (error.response?.status === 401 || error.response?.status === 403)
      ) {
        const refreshedToken = await this.getAccessToken(true);
        try {
          return await executor(refreshedToken);
        } catch (retryError) {
          return this.handleError(retryError);
        }
      }

      return this.handleError(error);
    }
  }

  async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    const response = await this.requestWithAuth<T>((token) =>
      this.http.get<T>(path, {
        params,
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    return response.data;
  }

  async post<T = void>(
    path: string,
    data?: unknown,
  ): Promise<AxiosResponse<T>> {
    return this.requestWithAuth<T>((token) =>
      this.http.post<T>(path, data, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
  }

  async put<T = void>(
    path: string,
    data?: unknown,
  ): Promise<AxiosResponse<T>> {
    return this.requestWithAuth<T>((token) =>
      this.http.put<T>(path, data ?? {}, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
  }

  async delete<T = void>(
    path: string,
    data?: unknown,
  ): Promise<AxiosResponse<T>> {
    return this.requestWithAuth<T>((token) =>
      this.http.delete<T>(path, {
        data,
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
  }

  extractIdFromLocation(locationHeader?: string): string | null {
    if (!locationHeader) return null;
    const segments = locationHeader.split('/').filter(Boolean);
    return segments[segments.length - 1] ?? null;
  }

  mapUser(raw: KeycloakUserRepresentation): KeycloakAdminUser {
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

  isInternalRealmRole(roleName: string): boolean {
    return (
      INTERNAL_REALM_ROLES.has(roleName) ||
      roleName.startsWith('default-roles-')
    );
  }

  async resolveClientUuid(clientId = this.rolesClientId): Promise<string | null> {
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

  private handleError(error: unknown): never {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const kcMessage =
        (
          error.response?.data as {
            errorMessage?: string;
            error?: string;
          }
        )?.errorMessage ??
        (error.response?.data as { error?: string })?.error;

      if (status === 400) {
        throw new BadRequestException(
          kcMessage ?? 'Datos inválidos en la operación de Keycloak Admin',
        );
      }

      if (status === 401 || status === 403) {
        const method = error.config?.method?.toUpperCase() ?? 'REQUEST';
        const url = error.config?.url ?? '';
        this.logger.warn(
          `Permisos insuficientes (${status}) en ${method} ${url} con cliente "${this.clientId}". Asigna los roles de "realm-management" (manage-users, view-users, query-users, query-groups, view-realm, view-clients) en Clients -> ${this.clientId} -> Service accounts roles.`,
        );
        throw new ForbiddenException(
          kcMessage ??
            `El Service Account de "${this.clientId}" no tiene los roles de realm-management necesarios (${method} ${url}).`,
        );
      }

      if (status === 404) {
        throw new NotFoundException(
          kcMessage ?? 'Recurso no encontrado en Keycloak',
        );
      }

      if (status === 409) {
        throw new ConflictException(
          kcMessage ?? 'Ya existe un grupo con ese nombre en Keycloak',
        );
      }

      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        throw new GatewayTimeoutException(
          'Keycloak Admin no respondió a tiempo',
        );
      }

      this.logger.error(`Keycloak Admin REST error: ${error.message}`);
    }

    throw new BadGatewayException(
      'No se pudo completar la operación en Keycloak Admin',
    );
  }
}

