import React, { useState, FormEvent, useEffect } from 'react';
import { CortexIcon, EmailIcon, KeyIcon, UserIcon, EyeIcon, EyeOffIcon } from './Icons';
import GsiConfiguration from './GsiConfiguration';

interface AuthProps {
    onLogin: (email: string, password: string) => boolean;
    onSignUp: (username: string, email: string, password: string) => boolean;
    onGoogleSignIn: (credential: string) => void;
    error: string | null;
    clearError: () => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin, onSignUp, onGoogleSignIn, error, clearError }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        // Clear form fields and errors when switching modes
        setUsername('');
        setEmail('');
        setPassword('');
        clearError();
    }, [isLogin, clearError]);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (isLogin) {
            onLogin(email, password);
        } else {
            onSignUp(username, email, password);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-zinc-950 p-4">
            <div className="w-full max-w-md bg-zinc-900/50 border border-zinc-800 rounded-2xl shadow-2xl p-8 space-y-6">
                <div className="text-center">
                    <CortexIcon />
                    <h2 className="mt-4 text-3xl font-bold text-white">
                        {isLogin ? 'Welcome Back' : 'Create an Account'}
                    </h2>
                    <p className="mt-2 text-zinc-400">
                        {isLogin ? 'Sign in to continue to Cortex AI' : 'Get started with your personal AI assistant'}
                    </p>
                </div>

                {error && (
                    <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-sm" role="alert">
                        <p>{error}</p>
                    </div>
                )}

                <form className="space-y-4" onSubmit={handleSubmit}>
                    {!isLogin && (
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"><UserIcon /></span>
                            <input
                                type="text"
                                placeholder="Username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    )}
                    <div className="relative">
                         <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"><EmailIcon /></span>
                        <input
                            type="email"
                            placeholder="Email address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="relative">
                         <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"><KeyIcon /></span>
                        <input
                            type={showPassword ? "text" : "password"}
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-10 pr-10 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                         <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                        </button>
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200"
                    >
                        {isLogin ? 'Sign In' : 'Sign Up'}
                    </button>
                </form>

                <div className="flex items-center justify-center space-x-2">
                    <span className="h-px w-full bg-zinc-700"></span>
                    <span className="text-zinc-500 text-sm font-medium">OR</span>
                    <span className="h-px w-full bg-zinc-700"></span>
                </div>

                <GsiConfiguration onGoogleSignIn={onGoogleSignIn} />

                <div className="text-center">
                    <button onClick={() => setIsLogin(!isLogin)} className="text-sm font-medium text-zinc-400 hover:text-blue-400 transition-colors">
                        {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Auth;
