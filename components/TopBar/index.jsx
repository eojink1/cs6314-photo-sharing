import { AppBar, Toolbar, Typography } from '@mui/material';

import './styles.css';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import api from '../../lib/api';

function TopBar() {
  // Pulling the userId out of the path ourselves since TopBar is outside the matched route
  const { pathname } = useLocation();
  const parts = pathname.split('/');
  const userId = parts[1] === 'users' ? parts[2] : undefined;
  const isPhotos = parts[3] === 'photos';

  const [user, setUser] = useState(null);

  useEffect(() => {
    // Directory page, nothing to fetch
    if (!userId) return undefined;
    let cancelled = false;

    api.get(`/user/${userId}`)
      .then((response) => {
        if (!cancelled) setUser(response.data);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Only trust the fetched user if it's the one in the current URL
  const currentUser = user && user._id === userId ? user : null;

  let context = 'User directory';
  if (currentUser) {
    const name = `${currentUser.first_name} ${currentUser.last_name}`;
    context = isPhotos ? `Photos of ${name}` : name;
  } else if (userId) {
    context = 'PhotoSharing';
  }

  return (
    <AppBar className="topbar-appBar" position="absolute">
      <Toolbar>
        <Typography variant="h6" style={{ flexGrow: 1 }}>
          Eo Jin Kim
        </Typography>
        <Typography variant="h6">{context}</Typography>
      </Toolbar>
    </AppBar>
  );
}

export default TopBar;
