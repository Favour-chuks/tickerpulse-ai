// TODO: check back on this and properly handle the callbacks

import React, { useEffect } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../shared/services/api';

export const AuthCallback: React.FC = () => {
  const { initialize } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      // Backend redirects to: /auth-success#access_token=...&refresh_token=...&user_id=...
      
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      
      // Fallback to search if hash is empty (just in case)
      const searchParams = new URLSearchParams(window.location.search);
      
      const token = params.get('access_token') || searchParams.get('access_token');
      const userId = params.get('user_id') || searchParams.get('user_id');
      const error = params.get('error') || searchParams.get('error');

      if (error) {
        console.error('Auth error:', error);
        navigate('/login?error=' + encodeURIComponent(error));
        return;
      }

      if (token && userId) {
        try {
          // Store session data temporarily
          localStorage.setItem('auth_token', token);
          
          // Fetch full user profile
          let user;
          try {
             user = await api.auth.getUserProfile(userId);
          } catch {
             // Fallback minimal user object
             user = { id: userId, email: '', firstName: 'User', lastName: '' };
          }

          localStorage.setItem('auth_user', JSON.stringify(user));
          
          // Update store state
          initialize();
          
          // Redirect to dashboard
          navigate('/');
        } catch (e) {
          console.error("Failed to process auth data", e);
          navigate('/login?error=data_processing_failed');
        }
      } else {
        // If no token found, maybe redirect to login
        console.warn("No token found in callback URL");
        navigate('/login');
      }
    };

    handleCallback();
  }, [initialize, navigate]);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#f8fafc] dark:bg-[#09090b] transition-colors duration-500">
      <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-500">
        <div className="w-16 h-16 bg-brand-50 dark:bg-brand-500/10 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-brand-500/10 border border-brand-100 dark:border-brand-500/20">
          <ShieldCheck className="w-8 h-8 text-brand-600 dark:text-brand-500" />
        </div>
        
        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-2">Verifying Credentials</h2>
        
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-medium">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Secure handshake with provider...</span>
        </div>

        <div className="mt-8 w-48 h-1 bg-slate-100 dark:bg-[#212124] rounded-full overflow-hidden">
          <div className="h-full bg-brand-600 dark:bg-brand-500 rounded-full w-1/3 animate-[shimmer_1.5s_infinite_linear]" style={{
            backgroundImage: 'linear-gradient(to right, transparent, rgba(255,255,255,0.5), transparent)'
          }}></div>
        </div>
      </div>
    </div>
  );
};



// src/features/auth/components/AuthCallback.tsx
// import { useEffect } from 'react';
// import { useNavigate, useSearchParams } from 'react-router-dom';
// import { useAuthStore } from '../store/authStore';
// import { Loader2 } from 'lucide-react';

// export function AuthCallback() {
//   const [searchParams] = useSearchParams();
//   const navigate = useNavigate();
//   const { setToken, setUser } = useAuthStore();

//   useEffect(() => {
//     const handleCallback = async () => {
//       const error = searchParams.get('error');
      
//       if (error) {
//         console.error('Auth callback error:', error);
//         navigate(`/login?error=${error}`);
//         return;
//       }

//       const accessToken = searchParams.get('access_token');
//       const refreshToken = searchParams.get('refresh_token');

//       if (!accessToken) {
//         navigate('/login?error=no_token');
//         return;
//       }

//       try {
//         // Store tokens
//         localStorage.setItem('auth_token', accessToken);
//         if (refreshToken) {
//           localStorage.setItem('refresh_token', refreshToken);
//         }

//         // Fetch user profile
//         const response = await fetch(`${process.env.VITE_API_URL}/api/user/profile`, {
//           headers: {
//             'Authorization': `Bearer ${accessToken}`,
//           },
//         });

//         if (!response.ok) {
//           throw new Error('Failed to fetch user profile');
//         }

//         const userData = await response.json();

//         // Update auth store
//         setToken(accessToken);
//         setUser(userData);

//         // Redirect to dashboard
//         navigate('/', { replace: true });
//       } catch (err) {
//         console.error('Auth callback processing error:', err);
//         navigate('/login?error=processing_failed');
//       }
//     };

//     handleCallback();
//   }, [searchParams, navigate, setToken, setUser]);

//   return (
//     <div className="h-screen flex items-center justify-center">
//       <div className="text-center">
//         <Loader2 className="w-12 h-12 animate-spin text-brand-500 mx-auto mb-4" />
//         <p className="text-slate-600 dark:text-slate-400">Completing sign in...</p>
//       </div>
//     </div>
//   );
// }