import { useEffect, useState } from 'react';
import { Grid, GridColumn, GridCellProps } from '@progress/kendo-react-grid';
import { Dialog } from '@progress/kendo-react-dialogs';
import { eventsApi } from '../../services/api';
import { cn } from '../../utils/cn';
import type { LeaderboardEntry, UserStats } from '../../services/types';
import type { LeaderboardProps } from './types';
import styles from './Leaderboard.module.css';

interface RankedEntry extends LeaderboardEntry {
  rank: number;
}

function AvatarNameCell(props: GridCellProps) {
  const entry = props.dataItem as RankedEntry;
  return (
    <td>
      <div className={styles.avatarCell}>
        {entry.avatarUrl ? (
          <img src={entry.avatarUrl} alt="" className={styles.avatarImg} />
        ) : (
          <div className={styles.avatarInitial}>
            {entry.name.charAt(0).toUpperCase()}
          </div>
        )}
        <span>{entry.name}</span>
      </div>
    </td>
  );
}

function ScoreCell(props: GridCellProps) {
  const entry = props.dataItem as RankedEntry;
  return <td><strong>{entry.bayesianScore.toFixed(2)}</strong></td>;
}

function AvgRatingCell(props: GridCellProps) {
  const entry = props.dataItem as RankedEntry;
  return <td>{entry.avgRating.toFixed(1)}</td>;
}

export function Leaderboard({ eventId }: LeaderboardProps) {
  const [entries, setEntries] = useState<RankedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<RankedEntry | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    eventsApi
      .leaderboard(eventId)
      .then(({ data }) =>
        setEntries(data.entries.map((e, i) => ({ ...e, rank: i + 1 })))
      )
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [eventId]);

  const handleRowClick = async (entry: RankedEntry) => {
    setSelectedUser(entry);
    setStatsLoading(true);
    try {
      const { data } = await eventsApi.userStats(eventId, entry.id);
      setUserStats(data);
    } catch {
      setUserStats(null);
    } finally {
      setStatsLoading(false);
    }
  };

  if (loading) return <div className={styles.loading}>Loading leaderboard...</div>;

  return (
    <>
      <Grid
        data={entries}
        className={cn(styles.grid)}
        onRowClick={(e) => void handleRowClick(e.dataItem as RankedEntry)}
      >
        <GridColumn field="rank" title="#" width={50} />
        <GridColumn field="name" title="Name" cells={{ data: AvatarNameCell }} />
        <GridColumn field="role" title="Role" />
        <GridColumn field="bayesianScore" title="Score" cells={{ data: ScoreCell }} />
        <GridColumn field="avgRating" title="Avg Rating" cells={{ data: AvgRatingCell }} />
        <GridColumn field="totalConversations" title="Conversations" />
      </Grid>

      {selectedUser && (
        <Dialog
          title={selectedUser.name}
          onClose={() => { setSelectedUser(null); setUserStats(null); }}
        >
          <div className={styles.dialogContent}>
            <p className={styles.dialogStat}><strong>Role:</strong> {selectedUser.role}</p>
            <p className={styles.dialogStat}><strong>Company:</strong> {selectedUser.company}</p>
            <p className={styles.dialogStat}><strong>Score:</strong> {selectedUser.bayesianScore.toFixed(2)}</p>
            <p className={styles.dialogStat}><strong>Avg Rating:</strong> {selectedUser.avgRating.toFixed(1)}</p>
            <p className={styles.dialogStat}><strong>Conversations:</strong> {selectedUser.totalConversations}</p>
            {statsLoading && <p>Loading stats...</p>}
            {userStats !== null && !statsLoading && (
              <div className={styles.dialogSection}>
                <p className={styles.dialogStat}><strong>Meaningful:</strong> {userStats.meaningfulCount}</p>
                <p className={styles.dialogStat}><strong>Casual:</strong> {userStats.casualCount}</p>
              </div>
            )}
          </div>
        </Dialog>
      )}
    </>
  );
}
