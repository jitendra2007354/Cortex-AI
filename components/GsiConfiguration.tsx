import React, { useEffect } from 'react';

declare global {
  interface Window {
    google: any;
  }
}

interface GsiConfigurationProps {
  onGoogleSignIn: (credential: string) => void;
}

const GsiConfiguration: React.FC<GsiConfigurationProps> = ({ onGoogleSignIn }) => {
  const handleCredentialResponse = (response: any) => {
    onGoogleSignIn(response.credential);
  };

  useEffect(() => {
    const initializeGsi = () => {
      const clientId = import.vite.env.GOOGLE_CLIENT_ID;

      // Check if the client ID is missing or is still the placeholder value
      if (!clientId || clientId === 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com') {
        // The UI will show the message, no need for a console error.
        const buttonContainer = document.getElementById('google-signin-button');
        if (buttonContainer) {
            buttonContainer.innerHTML = '<p class="text-xs text-red-400 text-center py-3">Google Sign-In is not configured by the developer.</p>';
        }
        return;
      }
      
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredentialResponse,
        });
        window.google.accounts.id.renderButton(
          document.getElementById('google-signin-button'),
          { theme: 'outline', size: 'large', type: 'standard', text: 'signin_with', shape: 'pill' }
        );
      }
    };
    
    // Check if the script has already loaded
    if (window.google) {
      initializeGsi();
    } else {
      // Fallback in case the script is slow to load
      const script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (script) {
        script.addEventListener('load', initializeGsi);
        return () => script.removeEventListener('load', initializeGsi);
      } else {
        // If script isn't found for some reason, still run initialize to show the error state.
        initializeGsi();
      }
    }
  }, [onGoogleSignIn]);

  return <div id="google-signin-button" className="flex justify-center"></div>;
};

export default GsiConfiguration;
