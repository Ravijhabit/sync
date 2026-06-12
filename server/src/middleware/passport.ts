import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { OAuthService } from '../services/OAuthService';

export function configurePassport() {
  const clientID = process.env['GOOGLE_CLIENT_ID'];
  const clientSecret = process.env['GOOGLE_CLIENT_SECRET'];
  const callbackURL = `${process.env['SERVER_URL'] ?? 'http://localhost:4000'}/api/auth/google/callback`;

  if (!clientID || !clientSecret) {
    return;
  }

  passport.use(
    new GoogleStrategy(
      { clientID, clientSecret, callbackURL },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const user = await OAuthService.upsertGoogleUser({
            id: profile.id,
            displayName: profile.displayName,
            emails: profile.emails ?? [],
            photos: profile.photos ?? [],
          });
          done(null, user);
        } catch (err) {
          done(err as Error);
        }
      }
    )
  );
}
