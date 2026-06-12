import prisma from '../lib/prisma';
import { withTelemetry } from '../utils/withTelemetry';

interface GoogleProfile {
  id: string;
  displayName: string;
  emails: Array<{ value: string }>;
  photos: Array<{ value: string }>;
}

export const OAuthService = {
  async upsertGoogleUser(profile: GoogleProfile) {
    return withTelemetry('OAuthService', 'upsertGoogleUser', {}, async () => {
      const email = profile.emails[0]?.value;
      if (!email) throw new Error('Google profile has no email');

      const avatarUrl = profile.photos[0]?.value ?? null;

      const existing = await prisma.user.findUnique({ where: { email } });

      if (existing) {
        if (avatarUrl && existing.avatarUrl !== avatarUrl) {
          return prisma.user.update({
            where: { id: existing.id },
            data: { avatarUrl },
          });
        }
        return existing;
      }

      return prisma.user.create({
        data: {
          name: profile.displayName,
          email,
          role: '',
          company: '',
          bio: '',
          interests: [],
          avatarUrl,
        },
      });
    });
  },
};
