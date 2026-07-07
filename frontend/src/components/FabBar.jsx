import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { X } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DefaultIcon = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12" y2="16" />
  </svg>
);

const FabBar = ({ role }) => {
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

  if (!buttons.length) return null;

  return (
    <>
      <div className="fab-bar" data-testid="fab-bar">
        {buttons.slice(0, 4).map((b) => (
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
