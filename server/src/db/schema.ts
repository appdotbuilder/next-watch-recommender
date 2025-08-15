import { serial, text, pgTable, timestamp, numeric, integer, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Define enums
export const mediaTypeEnum = pgEnum('media_type', ['movie', 'tv']);
export const interactionTypeEnum = pgEnum('interaction_type', ['like', 'dislike', 'watched_liked', 'watched_disliked', 'add_to_watchlist', 'remove_from_watchlist']);

// User profiles table
export const userProfilesTable = pgTable('user_profiles', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Media items table (movies and TV shows from TMDB)
export const mediaItemsTable = pgTable('media_items', {
  id: serial('id').primaryKey(),
  tmdb_id: integer('tmdb_id').notNull().unique(), // TMDB API ID
  title: text('title').notNull(),
  media_type: mediaTypeEnum('media_type').notNull(),
  poster_path: text('poster_path'), // Nullable
  backdrop_path: text('backdrop_path'), // Nullable
  overview: text('overview').notNull(),
  release_date: text('release_date'), // Nullable, stored as string from TMDB
  genres: text('genres').array().notNull(), // Array of genre strings
  vote_average: numeric('vote_average', { precision: 3, scale: 1 }).notNull(), // TMDB rating
  vote_count: integer('vote_count').notNull(),
  popularity: numeric('popularity', { precision: 10, scale: 3 }).notNull(),
  adult: boolean('adult').notNull().default(false),
  original_language: text('original_language').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// User interactions table (likes, dislikes, watched, etc.)
export const userInteractionsTable = pgTable('user_interactions', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id'), // Nullable for guest sessions
  session_id: text('session_id'), // For guest sessions
  media_item_id: integer('media_item_id').notNull(),
  interaction_type: interactionTypeEnum('interaction_type').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Recommendations table (AI-generated recommendations)
export const recommendationsTable = pgTable('recommendations', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id'), // Nullable for guest sessions
  session_id: text('session_id'), // For guest sessions
  media_item_id: integer('media_item_id').notNull(),
  reason: text('reason').notNull(), // AI-generated reason
  score: numeric('score', { precision: 5, scale: 4 }).notNull(), // Confidence score 0-1
  shown: boolean('shown').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Watchlist table
export const watchlistTable = pgTable('watchlist', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id'), // Nullable for guest sessions
  session_id: text('session_id'), // For guest sessions
  media_item_id: integer('media_item_id').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Define relations
export const userProfilesRelations = relations(userProfilesTable, ({ many }) => ({
  interactions: many(userInteractionsTable),
  recommendations: many(recommendationsTable),
  watchlistItems: many(watchlistTable),
}));

export const mediaItemsRelations = relations(mediaItemsTable, ({ many }) => ({
  interactions: many(userInteractionsTable),
  recommendations: many(recommendationsTable),
  watchlistItems: many(watchlistTable),
}));

export const userInteractionsRelations = relations(userInteractionsTable, ({ one }) => ({
  user: one(userProfilesTable, {
    fields: [userInteractionsTable.user_id],
    references: [userProfilesTable.id],
  }),
  mediaItem: one(mediaItemsTable, {
    fields: [userInteractionsTable.media_item_id],
    references: [mediaItemsTable.id],
  }),
}));

export const recommendationsRelations = relations(recommendationsTable, ({ one }) => ({
  user: one(userProfilesTable, {
    fields: [recommendationsTable.user_id],
    references: [userProfilesTable.id],
  }),
  mediaItem: one(mediaItemsTable, {
    fields: [recommendationsTable.media_item_id],
    references: [mediaItemsTable.id],
  }),
}));

export const watchlistRelations = relations(watchlistTable, ({ one }) => ({
  user: one(userProfilesTable, {
    fields: [watchlistTable.user_id],
    references: [userProfilesTable.id],
  }),
  mediaItem: one(mediaItemsTable, {
    fields: [watchlistTable.media_item_id],
    references: [mediaItemsTable.id],
  }),
}));

// TypeScript types for the table schemas
export type UserProfile = typeof userProfilesTable.$inferSelect;
export type NewUserProfile = typeof userProfilesTable.$inferInsert;

export type MediaItem = typeof mediaItemsTable.$inferSelect;
export type NewMediaItem = typeof mediaItemsTable.$inferInsert;

export type UserInteraction = typeof userInteractionsTable.$inferSelect;
export type NewUserInteraction = typeof userInteractionsTable.$inferInsert;

export type Recommendation = typeof recommendationsTable.$inferSelect;
export type NewRecommendation = typeof recommendationsTable.$inferInsert;

export type WatchlistItem = typeof watchlistTable.$inferSelect;
export type NewWatchlistItem = typeof watchlistTable.$inferInsert;

// Export all tables and relations for proper query building
export const tables = {
  userProfiles: userProfilesTable,
  mediaItems: mediaItemsTable,
  userInteractions: userInteractionsTable,
  recommendations: recommendationsTable,
  watchlist: watchlistTable,
};