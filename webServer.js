import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';

import User from './schema/user.js';
import Photo from './schema/photo.js';

const app = express();
const port = process.env.PORT || 3001;
const mongoUrl = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/project2';

// The Vite frontend runs on localhost:3000; the API runs on localhost:3001.
app.use(cors());

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function sendServerError(err, res) {
  console.error('Database/API error:', err);
  return res.status(500).json({ error: 'Internal server error' });
}

/** GET /user/list — return only _id, first_name, and last_name. */
app.get('/user/list', async (_req, res) => {
  try {
    const users = await User.find({}, '_id first_name last_name').lean();
    return res.json(users.map((u) => ({
      _id: u._id,
      first_name: u.first_name,
      last_name: u.last_name,
    })));
  } catch (err) {
    return sendServerError(err, res);
  }
});

/** GET /user/:id — return user details or a 404 if the user does not exist. */
app.get('/user/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    if (!isValidObjectId(userId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      _id: user._id,
      first_name: user.first_name,
      last_name: user.last_name,
      location: user.location,
      description: user.description,
      occupation: user.occupation,
    });
  } catch (err) {
    return sendServerError(err, res);
  }
});

/** GET /photosOfUser/:id — return photos with comments and nested user data. */
app.get('/photosOfUser/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    if (!isValidObjectId(userId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    // Check whether the user exists before retrieving anything.
    if (!(await User.exists({ _id: userId }))) {
      return res.status(404).json({ error: 'User not found' });
    }

    const photos = await Photo.find({ user_id: userId }).lean();

    // Extract all the authors IDs, fetch the information about them from DB, 
    // then create a hashmap of each author by their ID.
    const authorIds = photos.flatMap((photo) => photo.comments.map((c) => c.user_id));
    const authors = await User.find({ _id: { $in: authorIds } }, '_id first_name last_name').lean();
    const authorsById = new Map(authors.map((a) => [a._id.toString(), a]));

    return res.json(photos.map((photo) => ({
      _id: photo._id,
      user_id: photo.user_id,
      file_name: photo.file_name,
      date_time: photo.date_time,
      comments: photo.comments.map((c) => {
        const author = authorsById.get(c.user_id.toString());
        return {
          _id: c._id,
          comment: c.comment,
          date_time: c.date_time,
          user: {
            _id: author._id,
            first_name: author.first_name,
            last_name: author.last_name,
          },
        };
      }),
    })));
  } catch (err) {
    return sendServerError(err, res);
  }
});

// Only begin accepting HTTP requests after MongoDB is connected.
async function startServer() {
  try {
    await mongoose.connect(mongoUrl);
    console.log('Connected to MongoDB');
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (err) {
    console.error('Could not connect to MongoDB:', err);
    process.exitCode = 1;
  }
}

startServer();
