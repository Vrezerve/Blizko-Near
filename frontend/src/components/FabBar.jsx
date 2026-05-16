import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { X } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Default icon if admin didn't provide one
const DefaultIcon = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12" y2="16" />
  </svg>
);

const FabBar = ({ role, onPrimaryClick, primaryLabel, primaryIconSvg }) => {
  const [buttons, setButtons] = useState([]);
  const [openBtn, setOpenBtn] = useState(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    axios
      .get(`${API}/settings/fab-buttons`, { params: { role } })
      .then((res) => setButtons(res.data || []))
      .catch(() => setButtons([]));
  }, [role]);

  // Primary button is fixed (first slot)
  const renderIcon = (svgText) => {
    if (svgText && svgText.includes('<svg')) {
      return (
        <span
          className="fab-icon-wrap"
          dangerouslySetInnerHTML={{ __html: svgText }}
        />
      );
    }
    return <DefaultIcon />;
  };

  return (
    <>
      <div className="fab-bar" data-testid="fab-bar">
        <button
          type="button"
          className="fab-btn fab-btn-primary"
          onClick={onPrimaryClick}
          data-testid="fab-btn-primary"
        >
          {primaryIconSvg ? renderIcon(primaryIconSvg) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 17h14M7 17l-2-7h14l-2 7M9 6h6l1 4H8z" />
              <circle cx="8" cy="17" r="2" />
              <circle cx="16" cy="17" r="2" />
            </svg>
          )}
          <span className="fab-label">{primaryLabel}</span>
        </button>
        {buttons.slice(0, 3).map((b) => (
          <button
            key={b.id}
            type="button"
            className="fab-btn"
            onClick={() => setOpenBtn(b)}
            data-testid={`fab-btn-${b.id}`}
          >
            {renderIcon(b.icon_svg)}
            <span className="fab-label">{b.label}</span>
          </button>
        ))}
      </div>

      {openBtn && (
        <div className="fab-modal-overlay" onClick={() => setOpenBtn(null)} data-testid="fab-modal">
          <div
            className="fab-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="fab-modal-close"
              onClick={() => setOpenBtn(null)}
              aria-label="Закрыть"
              data-testid="fab-modal-close"
            >
              <X className="w-5 h-5" />
            </button>
            {openBtn.title && <h2 className="fab-modal-title">{openBtn.title}</h2>}
            <div
              className="fab-modal-content"
              dangerouslySetInnerHTML={{ __html: openBtn.content_html || '' }}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default FabBar;
