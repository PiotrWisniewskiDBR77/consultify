/**
 * User Schema
 */

export interface UserCredentials {
    email: string;
    password: string;
}

export interface UserRegistration extends UserCredentials {
    firstName: string;
    lastName: string;
    organizationName?: string;
}

export interface AuthToken {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: string;
}

export const validateUserCredentials = (creds: any): creds is UserCredentials => {
    return (
        typeof creds.email === 'string' &&
        typeof creds.password === 'string' &&
        creds.email.includes('@')
    );
};

export const UserSchema = {
    UserCredentials: {} as UserCredentials,
    UserRegistration: {} as UserRegistration,
    AuthToken: {} as AuthToken,
};

