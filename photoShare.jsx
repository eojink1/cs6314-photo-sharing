import ReactDOM from 'react-dom/client';
import { Grid, Paper, Typography } from '@mui/material';
import { createBrowserRouter, Outlet } from 'react-router';
import { RouterProvider } from 'react-router/dom';

import './styles/main.css';
import TopBar from './components/TopBar';
import UserDetail from './components/UserDetail';
import UserList from './components/UserList';
import UserPhotos from './components/UserPhotos';

function UserDirectory() {
  // /users shows this prompt while UserList in the sidebar lists the users.
  return (
    <Typography variant="body1">
      Select a user from the sidebar to view their profile or photos.
    </Typography>
  );
}

function Root() {
  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <TopBar />
      </Grid>
      <div className="main-topbar-buffer" />
      <Grid item xs={12} sm={3}>
        <Paper className="main-grid-item">
          <UserList />
        </Paper>
      </Grid>
      <Grid item xs={12} sm={9}>
        <Paper className="main-grid-item">
          <Outlet />
        </Paper>
      </Grid>
    </Grid>
  );
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <Root />,
    children: [
      { index: true, element: <UserDirectory /> },
      { path: 'users', element: <UserDirectory /> },
      { path: 'users/:userId', element: <UserDetail /> },
      { path: 'users/:userId/photos', element: <UserPhotos /> },
    ],
  },
]);

const root = ReactDOM.createRoot(document.getElementById('photoshareapp'));
root.render(<RouterProvider router={router} />);
