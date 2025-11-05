import React from 'react';
import MainApp from './MainApp';
import Auth from './components/Auth';
import { useAuth } from './hooks/useAuth';

export default function App() {
    const { user, login, signUp, logout, updateUserAvatar, handleGoogleSignIn, authError, clearAuthError } = useAuth();
    
    if (!user) {
        return <Auth onLogin={login} onSignUp={signUp} onGoogleSignIn={handleGoogleSignIn} error={authError} clearError={clearAuthError} />;
    }

    return <MainApp user={user} onLogout={logout} onAvatarChange={updateUserAvatar} />;
}
