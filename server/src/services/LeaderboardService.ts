import prisma from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { withTelemetry } from '../utils/withTelemetry';

interface LeaderboardRow {
  id: string;
  name: string;
  role: string;
  company: string;
  avatarUrl: string | null;
  bayesianScore: number;
  avgRating: number;
  totalReviews: number;
  totalConversations: number;
}

interface UserStats {
  totalConversations: number;
  avgRating: number;
  meaningfulCount: number;
  casualCount: number;
}

export const LeaderboardService = {
  async getRanked(eventId: string, page: number, limit: number): Promise<LeaderboardRow[]> {
    return withTelemetry('LeaderboardService', 'getRanked', { eventId }, async () => {
      const rows = await prisma.$queryRaw<LeaderboardRow[]>`
        WITH event_stats AS (
          SELECT
            AVG(l.rating)::float  AS global_mean,
            3                     AS confidence_threshold
          FROM learnings l
          JOIN user_events ue ON ue.user_id = l.target_id AND ue.event_id = ${eventId}
          JOIN matches m ON m.id = l.match_id AND m.event_id = ${eventId}
          WHERE l.rating IS NOT NULL
        )
        SELECT
          u.id,
          u.name,
          u.role,
          u.company,
          u.avatar_url        AS "avatarUrl",
          ROUND(
            (es.confidence_threshold * es.global_mean + SUM(l.rating))
            / (es.confidence_threshold + COUNT(l.id)),
            2
          )::float             AS "bayesianScore",
          ROUND(AVG(l.rating)::numeric, 1)::float AS "avgRating",
          COUNT(l.id)::int     AS "totalReviews",
          COUNT(DISTINCT l.match_id)::int AS "totalConversations"
        FROM users u
        JOIN user_events ue  ON ue.user_id = u.id AND ue.event_id = ${eventId}
        JOIN learnings l     ON l.target_id = u.id
        JOIN matches m       ON m.id = l.match_id AND m.event_id = ${eventId}
        CROSS JOIN event_stats es
        WHERE l.rating IS NOT NULL
        GROUP BY u.id, u.name, u.role, u.company, u.avatar_url,
                 es.global_mean, es.confidence_threshold
        ORDER BY "bayesianScore" DESC, "totalConversations" DESC
        LIMIT ${limit} OFFSET ${(page - 1) * limit}
      `;
      return rows;
    });
  },

  async getUserStats(userId: string, eventId: string): Promise<UserStats> {
    return withTelemetry('LeaderboardService', 'getUserStats', { userId, eventId }, async () => {
      const [conversations, ratings, meaningful] = await Promise.all([
        prisma.match.count({
          where: {
            eventId,
            status: 'COMPLETED',
            OR: [{ user1Id: userId }, { user2Id: userId }],
          },
        }),
        prisma.learning.aggregate({
          where: { targetId: userId, match: { eventId }, rating: { not: null } },
          _avg: { rating: true },
        }),
        prisma.match.findMany({
          where: {
            eventId,
            status: 'COMPLETED',
            OR: [{ user1Id: userId }, { user2Id: userId }],
          },
          select: { user1Id: true, user2Id: true, user1Meaningful: true, user2Meaningful: true },
        }),
      ]);

      let meaningfulCount = 0;
      let casualCount = 0;
      for (const m of meaningful) {
        const flag = m.user1Id === userId ? m.user1Meaningful : m.user2Meaningful;
        if (flag === true) meaningfulCount++;
        else if (flag === false) casualCount++;
      }

      return {
        totalConversations: conversations,
        avgRating: ratings._avg.rating ?? 0,
        meaningfulCount,
        casualCount,
      };
    });
  },

  async assertVisible(eventId: string) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
    if (event.status === 'ONGOING') {
      throw new AppError(403, 'LEADERBOARD_HIDDEN', 'Leaderboard is hidden during ONGOING events');
    }
    return event;
  },
};
