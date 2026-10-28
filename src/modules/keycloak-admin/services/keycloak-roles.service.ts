import { Injectable, NotFoundException } from '@nestjs/common';

import { KeycloakAdminClient } from '../keycloak-admin.client.js';
import type {
  KeycloakAdminUser,
  KeycloakCandidateRole,
  KeycloakRoleRepresentation,
  KeycloakUserRepresentation,
} from '../interfaces/keycloak-admin.interface.js';
import type { QueryKeycloakRolesDto } from '../dto/query-keycloak-roles.dto.js';

@Injectable()
export class KeycloakRolesService {
  constructor(private readonly client: KeycloakAdminClient) {}

  async findRealmRoles(
    query?: QueryKeycloakRolesDto,
  ): Promise<KeycloakRoleRepresentation[]> {
    const roles = await this.client.get<KeycloakRoleRepresentation[]>(
      '/roles',
      {
        first: query?.first ?? 0,
        max: query?.max ?? 50,
        briefRepresentation: false,
        ...(query?.search ? { search: query.search } : {}),
      },
    );

    return roles.filter((role) => !this.client.isInternalRealmRole(role.name));
  }

  async findClientRoles(
    query?: QueryKeycloakRolesDto,
    clientId = this.client.rolesClientId,
  ): Promise<KeycloakRoleRepresentation[]> {
    const clientUuid = await this.client.resolveClientUuid(clientId);

    if (!clientUuid) {
      return [];
    }

    return this.client.get<KeycloakRoleRepresentation[]>(
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
      this.findClientRoles(query, this.client.rolesClientId).catch(() => []),
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
        clientId: this.client.rolesClientId,
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
    const clientUuid = await this.client.resolveClientUuid();

    if (clientUuid) {
      try {
        const clientUsers = await this.client.get<KeycloakUserRepresentation[]>(
          `/clients/${encodeURIComponent(clientUuid)}/roles/${encodeURIComponent(roleName)}/users`,
          { first, max },
        );
        return clientUsers.map((u) => this.client.mapUser(u));
      } catch (error) {
        if (!(error instanceof NotFoundException)) {
          throw error;
        }
      }
    }

    const realmUsers = await this.client.get<KeycloakUserRepresentation[]>(
      `/roles/${encodeURIComponent(roleName)}/users`,
      { first, max },
    );

    return realmUsers.map((u) => this.client.mapUser(u));
  }
}

