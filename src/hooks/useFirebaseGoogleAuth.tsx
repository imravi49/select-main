import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { toast } from 'sonner';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const REDIRECT_URI = `${window.location.origin}/auth/callback`;

export const useFirebaseGoogleAuth = () => {
  const [loading, setLoading] = useState(false);

  const initiateGoogleAuth = () => {
    const params = new URLSearchParams({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email',
      access_type: 'offline',
      prompt: 'consent',
    });

    window.location.href = `${GOOGLE_AUTH_URL}?${params.toString()}`;
  };

  const exchangeCodeForTokens = async (code: string, userId: string) => {
    setLoading(true);
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
          client_secret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET || '',
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to exchange code for tokens');
      }

      const data = await response.json();

      // Store tokens in Firestore
      const profileRef = doc(db, 'profiles', userId);
      await updateDoc(profileRef, {
        google_access_token: data.access_token,
        google_refresh_token: data.refresh_token,
        google_token_expiry: new Date(Date.now() + data.expires_in * 1000).toISOString(),
        google_drive_connected: true,
      });

      toast.success('Google Drive connected successfully!');
      return true;
    } catch (error) {
      console.error('Token exchange error:', error);
      toast.error('Failed to connect Google Drive');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const disconnectGoogleDrive = async (userId: string) => {
    try {
      const profileRef = doc(db, 'profiles', userId);
      await updateDoc(profileRef, {
        google_access_token: null,
        google_refresh_token: null,
        google_token_expiry: null,
        google_drive_connected: false,
      });

      toast.success('Google Drive disconnected');
      return true;
    } catch (error) {
      console.error('Disconnect error:', error);
      toast.error('Failed to disconnect Google Drive');
      return false;
    }
  };

  return {
    initiateGoogleAuth,
    exchangeCodeForTokens,
    disconnectGoogleDrive,
    loading,
  };
};
