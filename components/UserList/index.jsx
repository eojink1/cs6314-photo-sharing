import { Typography, List, ListItemButton, ListItemText } from '@mui/material';

import './styles.css';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import api from '../../lib/api';

function UserList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    api.get('/user/list')
      .then((response) => {
        if (!cancelled) setUsers(response.data);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load the user list.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  let content;
  if (loading) {
    content = <Typography variant="body2">Loading users...</Typography>;
  } else if (error) {
    content = (
      <Typography variant="body2" color="error" role="alert">
        {error}
      </Typography>
    );
  } else {
    content = (
      <List>
        {users.map((user) => (
          <ListItemButton key={user._id} component={Link} to={`/users/${user._id}`}>
            <ListItemText primary={`${user.first_name} ${user.last_name}`} />
          </ListItemButton>
        ))}
      </List>
    );
  }

  return (
    <nav aria-label="Users">
      <Typography variant="h6">Users</Typography>
      {content}
    </nav>
  );
}

export default UserList;
