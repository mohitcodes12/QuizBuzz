import mongoose from 'mongoose';

// Connects to MongoDB using the URI from .env.
// We await this BEFORE the server starts listening, so we never accept
// requests while the database is unreachable (fail fast).
export async function connectMongo() {
  // Ignore unknown fields in queries instead of silently returning wrong data
  mongoose.set('strictQuery', true);

  await mongoose.connect(process.env.MONGO_URI);
  console.log(`✅ MongoDB connected: ${mongoose.connection.host}`);

  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB error:', err.message);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB disconnected');
  });
}

export async function disconnectMongo() {
  await mongoose.connection.close();
}
