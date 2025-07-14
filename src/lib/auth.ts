import type { User, LoginCredentials } from '../models/Auth';

const dummyUsers: User[] = [
  {
    id: '1',
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'admin'
  }
];

export const loginUser = async (credentials: LoginCredentials): Promise<User> => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const user = dummyUsers.find(u => u.email === credentials.email);
  
  if (!user || credentials.password !== 'password') {
    throw new Error('Credenciales inválidas');
  }
  
  localStorage.setItem('auth_user', JSON.stringify(user));
  return user;
};

export const logoutUser = (): void => {
  localStorage.removeItem('auth_user');
};

export const getCurrentUser = (): User | null => {
  const userStr = localStorage.getItem('auth_user');
  return userStr ? JSON.parse(userStr) : null;
}; 