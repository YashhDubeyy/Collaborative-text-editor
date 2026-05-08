import React from 'react';
import { useEditorStore, RemoteUser } from '../../store/useEditorStore';

const MAX_VISIBLE = 5;

export function PresenceBar() {
  const { remoteUsers } = useEditorStore();

  if (remoteUsers.length === 0) return null;

  const visible = remoteUsers.slice(0, MAX_VISIBLE);
  const overflow = remoteUsers.length - MAX_VISIBLE;

  return (
    <div className="presence-bar">
      <div className="presence-avatars">
        {visible.map((u: RemoteUser) => (
          <div key={u.socketId} className="presence-avatar-wrap">
            <div
              className="presence-avatar"
              style={{ background: u.color, borderColor: u.color }}
            >
              {u.username[0].toUpperCase()}
            </div>
            <span className="presence-tooltip">{u.username}</span>
          </div>
        ))}
        {overflow > 0 && (
          <div className="presence-avatar presence-more">+{overflow}</div>
        )}
      </div>
      <span className="presence-label">
        {remoteUsers.length === 1
          ? `${remoteUsers[0].username} is here`
          : `${remoteUsers.length} others here`}
      </span>
    </div>
  );
}
