import React, { useState } from 'react';
import { userApi } from '../utils/api';

// Opens someone's Aadhaar card in a new tab. The card is private, so a signed link is fetched on click.
const AadharCardLink = ({ userId, label = 'View Aadhaar card', style }) => {
  const [busy, setBusy] = useState(false);

  const open = async () => {
    // Open the tab straight away (inside the click) so pop-up blockers allow it, then point it at the card
    const tab = window.open('', '_blank');
    setBusy(true);
    try {
      const res = await userApi.aadharCardUrl(userId);
      if (tab) tab.location.href = res.data.url;
      else window.location.href = res.data.url;
    } catch (err) {
      if (tab) tab.close();
      alert(err.response?.data?.message || 'Could not open the Aadhaar card.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" onClick={open} disabled={busy} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--accent-primary)', fontSize: '0.9rem', textDecoration: 'underline', ...style }}>
      {busy ? 'Opening…' : label}
    </button>
  );
};

export default AadharCardLink;
