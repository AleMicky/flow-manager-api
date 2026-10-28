import { Injectable } from '@nestjs/common';

import { KeycloakAdminClient } from '../keycloak-admin.client.js';
import type {
  KeycloakAdminUser,
  KeycloakGroupRepresentation,
  KeycloakPaginatedUsers,
  KeycloakRoleMappingsRepresentation,
  KeycloakRoleRepresentation,
  KeycloakUserRepresentation,
} from '../interfaces/keycloak-admin.interface.js';
import type { QueryKeycloakUsersDto } from '../dto/query-keycloak-users.dto.js';

@Injectable()
export class KeycloakUsersService {
  constructor(private readonly client: KeycloakAdminClient) {}

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
      this.client.get<KeycloakUserRepresentation[]>('/users', {
        ...filterParams,
        first: query.first ?? 0,
        max: query.max ?? 20,
        briefRepresentation: true,
      }),
      this.client.get<number>('/users/count', filterParams),
    ]);

    return {
      data: users.map((u) => this.client.mapUser(u)),
      total,
      first: query.first ?? 0,
      max: query.max ?? 20,
    };
  }

  async findUserById(userId: string): Promise<KeycloakAdminUser> {
    const user = await this.client.get<KeycloakUserRepresentation>(
      `/users/${encodeURIComponent(userId)}`,
    );

    return this.client.mapUser(user);
  }

  async getUserRoles(userId: string): Promise<{
    realmRoles: KeycloakRoleRepresentation[];
    clientRoles: KeycloakRoleRepresentation[];
    effectiveRoles: string[];
  }> {
    const mappings = await this.client.get<KeycloakRoleMappingsRepresentation>(
      `/users/${encodeURIComponent(userId)}/role-mappings`,
    );

    const realmRoles = (mappings.realmMappings ?? []).filter(
      (role) => !this.client.isInternalRealmRole(role.name),
    );

    const clientRoles =
      mappings.clientMappings?.[this.client.rolesClientId]?.mappings ?? [];

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
    return this.client.get<KeycloakGroupRepresentation[]>(
      `/users/${encodeURIComponent(userId)}/groups`,
    );
  }

  async assignUserToGroup(userId: string, groupId: string): Promise<void> {
    await this.client.put(
      `/users/${encodeURIComponent(userId)}/groups/${encodeURIComponent(groupId)}`,
    );
  }

  async removeUserFromGroup(userId: string, groupId: string): Promise<void> {
    await this.client.delete(
      `/users/${encodeURIComponent(userId)}/groups/${encodeURIComponent(groupId)}`,
    );
  }
}

