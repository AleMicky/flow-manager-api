
export interface AuthUser {
    id: string;
    username: string;
    email?: string;
    name?: string;
    roles: string[];
}
