import { Link } from 'react-router-dom';
import { AccessStateCard, Empty, Loading } from '../components/ui';
import { useAuth } from '../context/Auth';
import { useRepoQuery } from '../hooks/useQuery';
import { fmtDate, label } from '../lib/format';
import { listMyNotifications, markNotificationRead, type NotificationRecord } from '../lib/api';
import { AccountSubnav } from './Profile';

export type Notif = NotificationRecord;

export const channelText = (c: Record<string, string>) =>
  Object.entries(c)
    .filter(([, v]) => v !== 'skipped')
    .map(([k, v]) => `${label(k)}: ${v === 'sent' ? 'sent' : v}`)
    .join(' · ');

export default function Notifications() {
  const { caller } = useAuth();
  const { data, loading, error, errorKind, reload } = useRepoQuery<NotificationRecord>(
    () => listMyNotifications(caller),
    [caller?.uid],
  );

  if (loading) {
    return <div className="wrap" style={{ paddingTop: 32 }}><Loading label="Loading notifications..." /></div>;
  }

  return (
    <div className="wrap" style={{ paddingTop: 28 }}>
      <div className="row spread" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', margin: 0 }}>Notifications</h1>
        </div>
      </div>

      <AccountSubnav />

      {errorKind && <AccessStateCard kind={errorKind} message={error} onRetry={reload} />}

      {data.length === 0 ? (
        <Empty title="No notifications">
          Order updates, technician assignments, and account notices will appear here.
        </Empty>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {data.map((n) => (
            <div
              key={n.id}
              className="card pad"
              style={{
                borderLeft: n.read ? '1px solid var(--line)' : '3px solid var(--navy)',
                background: n.read ? 'var(--surface)' : 'var(--ice-soft)',
              }}
            >
              <div className="row spread">
                <div className="row" style={{ gap: 8 }}>
                  {!n.read && <span className="tag navy">New</span>}
                  <b style={{ fontSize: 15 }}>{n.title}</b>
                </div>
                <span className="muted" style={{ fontSize: 12.5 }}>{fmtDate(n.createdAt as number)}</span>
              </div>
              <p style={{ margin: '8px 0 12px', fontSize: 14 }}>{n.body}</p>
              <div className="row spread">
                <span className="muted" style={{ fontSize: 12 }}>
                  {channelText(n.channels)}
                </span>
                <span className="row" style={{ gap: 8 }}>
                  {n.link && (
                    <Link className="btn ghost sm" to={n.link}>
                      View
                    </Link>
                  )}
                  {!n.read && (
                    <button
                      type="button"
                      className="btn sm"
                      onClick={async () => {
                        await markNotificationRead(caller, n.id);
                        reload();
                      }}
                    >
                      Mark as read
                    </button>
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
