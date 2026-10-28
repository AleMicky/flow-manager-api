export interface KeycloakUserRepresentation {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  emailVerified?: boolean;
  enabled: boolean;
  createdTimestamp?: number;
  attributes?: Record<string, string[]>;
}

export interface KeycloakRoleRepresentation {
  id: string;
  name: string;
  description?: string;
  composite?: boolean;
  clientRole?: boolean;
  containerId?: string;
}

export interface KeycloakGroupRepresentation {
  id: string;
  name: string;
  path: string;
  subGroupCount?: number;
  subGroups?: KeycloakGroupRepresentation[];
  attributes?: Record<string, string[]>;
}

export interface KeycloakClientRepresentation {
  id: string;
  clientId: string;
  name?: string;
  enabled?: boolean;
}

export interface KeycloakRoleMappingsRepresentation {
  realmMappings?: KeycloakRoleRepresentation[];
  clientMappings?: Record<
    string,
    {
      id: string;
      client: string;
      mappings: KeycloakRoleRepresentation[];
    }
  >;
}

export interface KeycloakAdminUser {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  enabled: boolean;
  emailVerified: boolean;
}

export interface KeycloakCandidateRole {
  id: string;
  name: string;
  description?: string;
  source: 'client' | 'realm';
  clientId?: string;
}

export interface KeycloakPaginatedUsers {
  data: KeycloakAdminUser[];
  total: number;
  first: number;
  max: number;
}

