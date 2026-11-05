// Client-side mirror of the server's yatra rules, used to decide which buttons to show.
// The server enforces them regardless.
const idOf = (value) => (value && value._id ? String(value._id) : value ? String(value) : null);

export const userCentreId = (user) => idOf(user?.centreId);

// The manager who created it, or an admin of its centre (any admin for yatras from before centres)
export const canManageYatra = (user, yatra) => {
  if (!user || !yatra) return false;
  if (idOf(yatra.createdBy) === String(user._id || user.id)) return true;
  if (user.role !== 'Admin' || !userCentreId(user)) return false;
  return !yatra.centre || idOf(yatra.centre) === userCentreId(user);
};

// Describe who can see a yatra, e.g. "Vrindavan + Mayapur" or "All centres"
export const visibilityLabel = (yatra) => {
  if (!yatra.centre) return 'All centres';
  if (yatra.visibility?.allCentres) return 'All centres';
  const names = [yatra.centre.name, ...(yatra.visibility?.centres || []).map(c => c.name)].filter(Boolean);
  return names.join(' + ');
};

export const visibilityValue = (yatra) => ({
  // Yatras from before centres are visible to every centre
  allCentres: !yatra?.centre || Boolean(yatra?.visibility?.allCentres),
  centres: (yatra?.visibility?.centres || []).map(idOf)
});
