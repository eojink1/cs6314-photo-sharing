import { Button, Typography } from '@mui/material';

import './styles.css';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import api from '../../lib/api';

function UserDetail() {
  const { userId } = useParams();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    // Clear the last user's info and any old error so they don't stick around while this loads
    setLoading(true);
    setError(null);
    setUser(null);

    api.get(`/user/${userId}`)
      .then((response) => {
        if (!cancelled) setUser(response.data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.response?.status === 404) setError('User not found.');
        else setError('Could not load this user.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  let content;
  if (loading) {
    content = <Typography variant='body1'>Loading...</Typography>;
  } else if (error) {
    content = (
      <Typography color='error' role='alert'>
        {error}
      </Typography>
    );
  } else {
    content = (
      <>
        <Typography variant='h5'>
          {user.first_name} {user.last_name}
        </Typography>
        <Typography variant='body1'>Location: {user.location}</Typography>
        <Typography variant='body1'>Occupation: {user.occupation}</Typography>
        <Typography variant='body1'>{user.description}</Typography>
        <Button component={Link} to={`/users/${userId}/photos`}>
          View photos
        </Button>
      </>
    );
  }

  return <div>{content}</div>;
}

export default UserDetail;
