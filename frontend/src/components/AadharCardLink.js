import React, { useState } from 'react';
import { userApi } from '../utils/api';

// Opens someone's Aadhaar card in a new tab. The image comes through the server (which checks who may see it)
// and is shown from a temporary in-browser address, so there is no shareable link to the private file.
const AadharCardLink = ({ userId, label = 'View Aadhaar card', style }) => {
  const [busy, setBusy] = useState(false);

  const open = async () => {
    // Open the tab straight away (inside the click) so pop-up blockers allow it, then show the image in it
    const tab = window.open('', '_blank');
    setBusy(true);
    try {
      const res = await userApi.aadharCardImage(userId);
      const url = URL.createObjectURL(res.data);
      if (tab) tab.location.href = url;
      else window.location.href = url;
      // The temporary address isn't needed once the tab has loaded the image
      setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
    } catch (err) {
      if (tab) tab.close();
      let message = 'Could not open the Aadhaar card.';
      // Error bodies arrive as a Blob because of responseType: 'blob'
      try { message = JSON.parse(await err.response.data.text()).message || message; } catch {}
      alert(message);
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
