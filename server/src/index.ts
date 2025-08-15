import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  createUserProfileInputSchema,
  searchInputSchema,
  popularItemsInputSchema,
  createUserInteractionInputSchema,
  getRecommendationsInputSchema,
  getUserInteractionsInputSchema,
  watchlistInputSchema,
  createMediaItemInputSchema,
  sessionInputSchema
} from './schema';

// Import handlers
import { createUserProfile } from './handlers/create_user_profile';
import { getPopularItems } from './handlers/get_popular_items';
import { searchMedia } from './handlers/search_media';
import { createUserInteraction } from './handlers/create_user_interaction';
import { getUserInteractions } from './handlers/get_user_interactions';
import { generateRecommendations } from './handlers/generate_recommendations';
import { getNextRecommendation } from './handlers/get_next_recommendation';
import { addToWatchlist } from './handlers/add_to_watchlist';
import { removeFromWatchlist } from './handlers/remove_from_watchlist';
import { getWatchlist } from './handlers/get_watchlist';
import { createMediaItem } from './handlers/create_media_item';
import { getMediaItemByTmdbId } from './handlers/get_media_item_by_tmdb_id';
import { createGuestSession } from './handlers/create_guest_session';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // User profile management
  createUserProfile: publicProcedure
    .input(createUserProfileInputSchema)
    .mutation(({ input }) => createUserProfile(input)),

  // Guest session management
  createGuestSession: publicProcedure
    .mutation(() => createGuestSession()),

  // Media content discovery
  getPopularItems: publicProcedure
    .input(popularItemsInputSchema)
    .query(({ input }) => getPopularItems(input)),

  searchMedia: publicProcedure
    .input(searchInputSchema)
    .query(({ input }) => searchMedia(input)),

  // Media item management
  createMediaItem: publicProcedure
    .input(createMediaItemInputSchema)
    .mutation(({ input }) => createMediaItem(input)),

  getMediaItemByTmdbId: publicProcedure
    .input(z.number())
    .query(({ input }) => getMediaItemByTmdbId(input)),

  // User interactions (likes, dislikes, watched, etc.)
  createUserInteraction: publicProcedure
    .input(createUserInteractionInputSchema)
    .mutation(({ input }) => createUserInteraction(input)),

  getUserInteractions: publicProcedure
    .input(getUserInteractionsInputSchema)
    .query(({ input }) => getUserInteractions(input)),

  // Recommendation system
  generateRecommendations: publicProcedure
    .input(getRecommendationsInputSchema)
    .mutation(({ input }) => generateRecommendations(input)),

  getNextRecommendation: publicProcedure
    .input(getRecommendationsInputSchema)
    .query(({ input }) => getNextRecommendation(input)),

  // Watchlist management
  addToWatchlist: publicProcedure
    .input(watchlistInputSchema)
    .mutation(({ input }) => addToWatchlist(input)),

  removeFromWatchlist: publicProcedure
    .input(watchlistInputSchema)
    .mutation(({ input }) => removeFromWatchlist(input)),

  getWatchlist: publicProcedure
    .input(watchlistInputSchema)
    .query(({ input }) => getWatchlist(input)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`Next Watch TRPC server listening at port: ${port}`);
  console.log(`🎬 Movie recommendation API ready!`);
}

start();