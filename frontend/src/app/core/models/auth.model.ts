export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: UserDto;
}

export interface UserDto {
  id: string;
  email: string;
  name: string;
}

// Decoded JWT payload — claim names match what the backend puts in the token
export interface UserInfo {
  sub: string;   // userId
  email: string;
  name: string;
  exp: number;   // expiry unix timestamp
}
