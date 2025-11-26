import { useState, useEffect, useCallback } from 'react';
import { type User } from '../types';

const USERS_STORAGE_KEY = 'cortex-users';
const CURRENT_USER_STORAGE_KEY = 'cortex-current-user';

// A simple utility to decode JWTs for Google Sign-In
const jwt_decode = (token: string): any => {
    try {
        return JSON.parse(atob(token.split('.')[1]));
    } catch (e) {
        return null;
    }
}

export const useAuth = () => {
    const [user, setUser] = useState<User | null>(null);
    const [authError, setAuthError] = useState<string | null>(null);

    useEffect(() => {
        try {
            const storedUser = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
            if (storedUser) {
                setUser(JSON.parse(storedUser));
            }
        } catch (error) {
            console.error('Failed to load current user from storage:', error);
        }
    }, []);

    const clearAuthError = useCallback(() => setAuthError(null), []);

    const login = useCallback((email: string, password: string):boolean => {
        try {
            const storedUsers = localStorage.getItem(USERS_STORAGE_KEY);
            const users: User[] = storedUsers ? JSON.parse(storedUsers) : [];
            const foundUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());

            if (foundUser && !foundUser.isGoogleUser && foundUser.password === password) {
                setUser(foundUser);
                localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(foundUser));
                setAuthError(null);
                return true;
            } else {
                setAuthError('Invalid email or password.');
                return false;
            }
        } catch (error) {
            console.error('Login error:', error);
            setAuthError('An unexpected error occurred during login.');
            return false;
        }
    }, []);

    const signUp = useCallback((username: string, email: string, password: string):boolean => {
        try {
            const storedUsers = localStorage.getItem(USERS_STORAGE_KEY);
            const users: User[] = storedUsers ? JSON.parse(storedUsers) : [];

            if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
                setAuthError('An account with this email already exists.');
                return false;
            }

            const newUser: User = {
                id: Date.now().toString(),
                username,
                email,
                password,
                avatar: null,
            };

            const updatedUsers = [...users, newUser];
            localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedUsers));
            setUser(newUser);
            localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(newUser));
            setAuthError(null);
            return true;

        } catch (error) {
            console.error('Sign-up error:', error);
            setAuthError('An unexpected error occurred during sign-up.');
            return false;
        }
    }, []);
    
    const handleGoogleSignIn = useCallback((credential: string) => {
        try {
            const payload = jwt_decode(credential);
            if (!payload) {
                setAuthError('Invalid Google sign-in credential.');
                return;
            }

            const { email, name, picture, sub } = payload;
            
            const storedUsers = localStorage.getItem(USERS_STORAGE_KEY);
            const users: User[] = storedUsers ? JSON.parse(storedUsers) : [];
            let userToLogin = users.find(u => u.email.toLowerCase() === email.toLowerCase());

            if (userToLogin) {
                if (!userToLogin.isGoogleUser) {
                    setAuthError('An account with this email exists. Please sign in with your password.');
                    return;
                }
            } else {
                userToLogin = {
                    id: sub,
                    username: name,
                    email: email,
                    avatar: picture,
                    isGoogleUser: true,
                };
                const updatedUsers = [...users, userToLogin];
                localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedUsers));
            }

            setUser(userToLogin);
            localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(userToLogin));
            setAuthError(null);

        } catch (error) {
            console.error('Google sign-in error:', error);
            setAuthError('An unexpected error occurred with Google Sign-In.');
        }
    }, []);

    const logout = useCallback(() => {
        setUser(null);
        try {
            localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
        } catch (error) {
            console.error('Failed to logout:', error);
        }
    }, []);

    const updateUserAvatar = useCallback((avatarDataUrl: string) => {
        if (!user) return;
        
        try {
            const updatedUser = { ...user, avatar: avatarDataUrl };
            setUser(updatedUser);
            localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(updatedUser));

            const storedUsers = localStorage.getItem(USERS_STORAGE_KEY);
            const users: User[] = storedUsers ? JSON.parse(storedUsers) : [];
            const updatedUsers = users.map(u => u.id === user.id ? updatedUser : u);
            localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedUsers));

        } catch (error) {
            console.error('Failed to update avatar:', error);
        }
    }, [user]);

    return { user, login, signUp, logout, updateUserAvatar, handleGoogleSignIn, authError, clearAuthError };
};
