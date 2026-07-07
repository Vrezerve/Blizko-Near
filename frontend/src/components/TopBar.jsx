import React from 'react';
import { Menu, User } from 'lucide-react';

const TopBar = ({ user, onMenuClick, statusOnline, statusText, menuTestId = 'menu-btn' }) => {
  const avatarSrc = user?.avatar
    ? (user.avatar.startsWith('/') ? process.env.REACT_APP_BACKEND_URL + user.avatar : user.avatar)
    : null;

  return (
    <div className="top-bar" data-testid="top-bar">
      <button
        type="button"
        className="top-bar-menu"
        onClick={onMenuClick}
        data-testid={menuTestId}
        aria-label="Меню"
      >
        <Menu className="w-6 h-6" />
      </button>

      <div className="top-bar-user">
        <div className="top-bar-avatar">
          {avatarSrc ? (
            <img src={avatarSrc} alt="" />
          ) : (
            <User className="w-4 h-4 text-slate-400" />
          )}
        </div>
        <span className="top-bar-name" data-testid="top-bar-name">
          {user?.name || user?.phone || 'Пользователь'}
        </span>
      </div>

      <div
        className={`top-bar-status ${statusOnline ? 'online' : 'offline'}`}
        data-testid="top-bar-status"
      >
        <span className="top-bar-status-dot" />
        <span>{statusText}</span>
      </div>
    </div>
  );
};

export default TopBar;
