import { BadGatewayException, Injectable } from '@nestjs/common';

import { KeycloakAdminClient } from '../keycloak-admin.client.js';
import type {
  KeycloakAdminUser,
  KeycloakGroupRepresentation,
  KeycloakUserRepresentation,
} from '../interfaces/keycloak-admin.interface.js';
import type { QueryKeycloakGroupsDto } from '../dto/query-keycloak-groups.dto.js';
import type {
  CreateKeycloakGroupDto,
  UpdateKeycloakGroupDto,
} from '../dto/manage-keycloak-group.dto.js';

@Injectable()
export class KeycloakGroupsService {
  constructor(private readonly client: KeycloakAdminClient) {}

  async findGroups(
    query?: QueryKeycloakGroupsDto,
  ): Promise<KeycloakGroupRepresentation[]> {
    return this.client.get<KeycloakGroupRepresentation[]>('/groups', {
      first: query?.first ?? 0,
      max: query?.max ?? 50,
      briefRepresentation: false,
      ...(query?.search ? { search: query.search } : {}),
    });
  }

  async findGroupById(groupId: string): Promise<KeycloakGroupRepresentation> {
    return this.client.get<KeycloakGroupRepresentation>(
      `/groups/${encodeURIComponent(groupId)}`,
    );
  }

  async createGroup(
    dto: CreateKeycloakGroupDto,
  ): Promise<KeycloakGroupRepresentation> {
    const endpoint = dto.parentId
      ? `/groups/${encodeURIComponent(dto.parentId)}/children`
      : '/groups';

    const response = await this.client.post(endpoint, {
      name: dto.name.trim(),
    });
    const location = response.headers.location as string | undefined;
    const groupId = this.client.extractIdFromLocation(location);

    if (groupId) {
      return this.findGroupById(groupId);
    }

    const groups = await this.findGroups({
      search: dto.name.trim(),
      first: 0,
      max: 20,
    });
    const found = groups.find((g) => g.name === dto.name.trim());

    if (!found) {
      throw new BadGatewayException(
        'Grupo creado pero no se pudo recuperar su información en Keycloak',
      );
    }

    return found;
  }

  async updateGroup(
    groupId: string,
    dto: UpdateKeycloakGroupDto,
  ): Promise<KeycloakGroupRepresentation> {
    const existing = await this.findGroupById(groupId);

    await this.client.put(`/groups/${encodeURIComponent(groupId)}`, {
      ...existing,
      name: dto.name.trim(),
    });

    return this.findGroupById(groupId);
  }

  async deleteGroup(groupId: string): Promise<void> {
    await this.client.delete(`/groups/${encodeURIComponent(groupId)}`);
  }

  async findGroupMembers(
    groupId: string,
    first = 0,
    max = 50,
  ): Promise<KeycloakAdminUser[]> {
    const members = await this.client.get<KeycloakUserRepresentation[]>(
      `/groups/${encodeURIComponent(groupId)}/members`,
      { first, max },
    );

    return members.map((u) => this.client.mapUser(u));
  }

  async addGroupMember(groupId: string, userId: string): Promise<void> {
    await this.client.put(
      `/users/${encodeURIComponent(userId)}/groups/${encodeURIComponent(groupId)}`,
    );
  }

  async removeGroupMember(groupId: string, userId: string): Promise<void> {
    await this.client.delete(
      `/users/${encodeURIComponent(userId)}/groups/${encodeURIComponent(groupId)}`,
    );
  }
}

