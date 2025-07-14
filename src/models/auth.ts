export interface User {
  email: string;
  role: string;
  createdAt: string;
  updatedAt: string;
  id: string;
}

export interface DecodedToken extends User {
  iat: number;
  exp: number;
}
