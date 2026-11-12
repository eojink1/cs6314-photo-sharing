import { Card, CardContent, CardMedia, Divider, Typography } from '@mui/material';

import './styles.css';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import api from '../../lib/api';
import { formatDateTime } from '../../lib/formatDate';

// A single comment displaying when it was posted, who wrote it (links to their profile), and the text
function Comment({ comment }) {
  return (
    <div>
      <Typography variant="caption" color="text.secondary">
        {formatDateTime(comment.date_time)} ·{' '}
        <Link to={`/users/${comment.user._id}`}>
          {comment.user.first_name} {comment.user.last_name}
        </Link>
      </Typography>
      <Typography variant="body2">{comment.comment}</Typography>
    </div>
  );
}

// Card for one photo, with its date and the comments underneath
function PhotoCard({ photo }) {
  const taken = formatDateTime(photo.date_time);
  return (
    <Card style={{ marginBottom: 16 }}>
      <CardMedia
        component="img"
        image={`/images/${photo.file_name}`}
        alt={`Photo posted ${taken}`}
      />
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          {taken}
        </Typography>
        <Divider style={{ margin: '8px 0' }} />
        <Typography variant="subtitle2">Comments</Typography>
        {photo.comments.length === 0 ? (
          <Typography variant="body2">No comments.</Typography>
        ) : (
          photo.comments.map((comment) => <Comment key={comment._id} comment={comment} />)
        )}
      </CardContent>
    </Card>
  );
}

function UserPhotos() {
  const { userId } = useParams();

  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    // Clear the last user's photos and any old error so they don't stick around while this loads
    setLoading(true);
    setError(null);
    setPhotos([]);

    api.get(`/photosOfUser/${userId}`)
      .then((response) => {
        if (!cancelled) setPhotos(response.data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.response?.status === 404) setError('User not found.');
        else setError('Could not load photos.');
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
    content = <Typography variant="body1">Loading...</Typography>;
  } else if (error) {
    content = (
      <Typography color="error" role="alert">
        {error}
      </Typography>
    );
  } else if (photos.length === 0) {
    // Valid user, just no photos (a bad id is a 404 and handled above)
    content = <Typography variant="body1">This user has no photos.</Typography>;
  } else {
    content = photos.map((photo) => <PhotoCard key={photo._id} photo={photo} />);
  }

  return <div>{content}</div>;
}

export default UserPhotos;
