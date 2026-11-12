/**
 * Reset and seed the P3 database from the P1 photo data.
 *
 * This is the P2 async/await loader adapted for P3. Students must first add
 * login_name and password_digest to schema/user.js (Problem 1, Part A).
 *
 * The instructor-supplied bcrypt digest is for the coursework password "weak".
 * Never use that password or this fixed digest for real accounts.
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import models from './modelData/photoApp.js';
import User from './schema/user.js';
import Photo from './schema/photo.js';
import SchemaInfo from './schema/schemaInfo.js';

// Load .env before reading process.env. (Calling dotenv.config() instead of
// importing 'dotenv/config' keeps eslint-plugin-import's resolver happy.)
dotenv.config();

const mongoUrl = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/project3';
const SEEDED_PASSWORD_DIGEST = '$2b$10$mY3x4wONMoZP8Mh3DRA7xuggg88zE8HaGgeW8iFnHAwdDwue.gZUC';

async function loadDatabase() {
  try {
    // Without the P3 schema changes, Mongoose would silently discard the
    // new user fields and seed accounts that cannot log in.
    if (!User.schema.path('login_name') || !User.schema.path('password_digest')) {
      throw new Error('First add login_name and password_digest to schema/user.js (P3 Problem 1).');
    }

    await mongoose.connect(mongoUrl);
    console.log('Connected to MongoDB');

    // Running the loader replaces the seeded collections, including any
    // registrations and comments added during testing.
    await Promise.all([
      User.deleteMany({}),
      Photo.deleteMany({}),
      SchemaInfo.deleteMany({}),
    ]);

    // The supplied P1 IDs are temporary lookup keys. Always create actual
    // MongoDB ObjectIds and remap references as in the P2 loader.
    // insertMany keeps the fixture order and returns the saved documents in
    // that same order, so seeded users always appear in a predictable order.
    const modelUsers = models.userListModel();
    const savedUsers = await User.insertMany(modelUsers.map((user) => ({
      first_name: user.first_name,
      last_name: user.last_name,
      location: user.location,
      description: user.description,
      occupation: user.occupation,
      login_name: user.last_name.toLowerCase(),
      password_digest: SEEDED_PASSWORD_DIGEST,
    })));
    const idMap = new Map(modelUsers.map((user, i) => [user._id, savedUsers[i]._id]));
    modelUsers.forEach((user) => console.log(`Added user: ${user.first_name} ${user.last_name}`));

    const photoDocs = modelUsers
      .flatMap((originalUser) => models.photoOfUserModel(originalUser._id))
      .map((photo) => {
        // Some fixture photos have no comments property at all.
        const savedComments = (photo.comments || []).map((comment) => ({
          comment: comment.comment,
          date_time: comment.date_time,
          user_id: idMap.get(comment.user._id),
        }));
        if (savedComments.some((comment) => !comment.user_id)) {
          throw new Error(`Unknown comment author on photo ${photo.file_name}`);
        }
        return {
          file_name: photo.file_name,
          date_time: photo.date_time,
          user_id: idMap.get(photo.user_id),
          comments: savedComments,
        };
      });
    await Photo.insertMany(photoDocs);
    const photoCount = photoDocs.length;
    const commentCount = photoDocs.reduce((sum, photo) => sum + photo.comments.length, 0);

    await SchemaInfo.create({
      ...models.schemaInfo2(),
      loaded_from: 'loadDatabase.js',
    });
    console.log(`Loaded ${idMap.size} users, ${photoCount} photos, ${commentCount} comments.`);
  } catch (err) {
    console.error('Database load failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

loadDatabase();
