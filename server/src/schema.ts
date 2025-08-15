import { z } from 'zod';

// User profile schema
export const userProfileSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string().email(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type UserProfile = z.infer<typeof userProfileSchema>;

// Input schema for creating user profiles
export const createUserProfileInputSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email()
});

export type CreateUserProfileInput = z.infer<typeof createUserProfileInputSchema>;

// Movie/TV show item schema (from TMDB API)
export const mediaItemSchema = z.object({
  id: z.number(),
  tmdb_id: z.number(),
  title: z.string(),
  media_type: z.enum(['movie', 'tv']),
  poster_path: z.string().nullable(),
  backdrop_path: z.string().nullable(),
  overview: z.string(),
  release_date: z.string().nullable(),
  genres: z.array(z.string()),
  vote_average: z.number(),
  vote_count: z.number(),
  popularity: z.number(),
  adult: z.boolean(),
  original_language: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type MediaItem = z.infer<typeof mediaItemSchema>;

// Input schema for creating media items
export const createMediaItemInputSchema = z.object({
  tmdb_id: z.number(),
  title: z.string(),
  media_type: z.enum(['movie', 'tv']),
  poster_path: z.string().nullable(),
  backdrop_path: z.string().nullable(),
  overview: z.string(),
  release_date: z.string().nullable(),
  genres: z.array(z.string()),
  vote_average: z.number(),
  vote_count: z.number(),
  popularity: z.number(),
  adult: z.boolean(),
  original_language: z.string()
});

export type CreateMediaItemInput = z.infer<typeof createMediaItemInputSchema>;

// User interaction schema (likes, dislikes, watched, etc.)
export const userInteractionSchema = z.object({
  id: z.number(),
  user_id: z.number().nullable(), // null for guest sessions
  session_id: z.string().nullable(), // for guest sessions
  media_item_id: z.number(),
  interaction_type: z.enum(['like', 'dislike', 'watched_liked', 'watched_disliked', 'add_to_watchlist', 'remove_from_watchlist']),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type UserInteraction = z.infer<typeof userInteractionSchema>;

// Input schema for creating user interactions
export const createUserInteractionInputSchema = z.object({
  user_id: z.number().optional(),
  session_id: z.string().optional(),
  media_item_id: z.number(),
  interaction_type: z.enum(['like', 'dislike', 'watched_liked', 'watched_disliked', 'add_to_watchlist', 'remove_from_watchlist'])
});

export type CreateUserInteractionInput = z.infer<typeof createUserInteractionInputSchema>;

// Recommendation schema
export const recommendationSchema = z.object({
  id: z.number(),
  user_id: z.number().nullable(),
  session_id: z.string().nullable(),
  media_item_id: z.number(),
  reason: z.string(), // AI-generated reason like "Because you liked X"
  score: z.number(), // Recommendation confidence score
  shown: z.boolean().default(false), // Whether this recommendation was already shown
  created_at: z.coerce.date()
});

export type Recommendation = z.infer<typeof recommendationSchema>;

// Input schema for creating recommendations
export const createRecommendationInputSchema = z.object({
  user_id: z.number().optional(),
  session_id: z.string().optional(),
  media_item_id: z.number(),
  reason: z.string(),
  score: z.number().min(0).max(1)
});

export type CreateRecommendationInput = z.infer<typeof createRecommendationInputSchema>;

// Watchlist schema
export const watchlistSchema = z.object({
  id: z.number(),
  user_id: z.number().nullable(),
  session_id: z.string().nullable(),
  media_item_id: z.number(),
  created_at: z.coerce.date()
});

export type Watchlist = z.infer<typeof watchlistSchema>;

// Input schema for watchlist operations
export const watchlistInputSchema = z.object({
  user_id: z.number().optional(),
  session_id: z.string().optional(),
  media_item_id: z.number()
});

export type WatchlistInput = z.infer<typeof watchlistInputSchema>;

// Search input schema
export const searchInputSchema = z.object({
  query: z.string().min(1),
  media_type: z.enum(['movie', 'tv', 'all']).default('all'),
  page: z.number().int().positive().default(1)
});

export type SearchInput = z.infer<typeof searchInputSchema>;

// Popular items input schema
export const popularItemsInputSchema = z.object({
  media_type: z.enum(['movie', 'tv', 'all']).default('all'),
  page: z.number().int().positive().default(1)
});

export type PopularItemsInput = z.infer<typeof popularItemsInputSchema>;

// Get recommendations input schema
export const getRecommendationsInputSchema = z.object({
  user_id: z.number().optional(),
  session_id: z.string().optional(),
  limit: z.number().int().positive().default(10)
});

export type GetRecommendationsInput = z.infer<typeof getRecommendationsInputSchema>;

// User interactions query input schema
export const getUserInteractionsInputSchema = z.object({
  user_id: z.number().optional(),
  session_id: z.string().optional(),
  interaction_type: z.enum(['like', 'dislike', 'watched_liked', 'watched_disliked', 'add_to_watchlist', 'remove_from_watchlist']).optional()
});

export type GetUserInteractionsInput = z.infer<typeof getUserInteractionsInputSchema>;

// Session input schema
export const sessionInputSchema = z.object({
  session_id: z.string()
});

export type SessionInput = z.infer<typeof sessionInputSchema>;