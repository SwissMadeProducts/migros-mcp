import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerReadOnly } from "./register.js";
import {
  SearchProductsSchema, GetProductDetailsSchema, GetStockSchema,
  SearchStoresSchema, GetPromotionsSchema, SearchRecipesSchema,
  GetRecipeDetailsSchema, GetRecipeProductsSchema,
} from "./schemas.js";
import {
  searchProducts, getProductDetails, getStock,
  searchStores, getPromotions, searchRecipes, getRecipeDetails, getRecipeProducts,
} from "./tools.js";

/** Public-data tools only. Never imports account authentication or cart tools. */
export function createAnonymousServer(): McpServer {
  const server = new McpServer({ name: "migros-anonymous", version: "0.3.2" });
// --- Anonymous: search & browse ---

  registerReadOnly(server, "search_products",
  "Search Migros products by name or keyword. Returns product IDs that can be used with get_product_details.",
  SearchProductsSchema.shape, ({ query, language }) => searchProducts(query, language ?? "de"));

  registerReadOnly(server, "get_product_details",
  "Get full product details including nutrition facts, ingredients, allergens, price, and ratings. Use search_products first to get product IDs.",
  GetProductDetailsSchema.shape, ({ productIds }) => getProductDetails(productIds));

  registerReadOnly(server, "get_stock",
  "Check product stock at a specific Migros store. Use search_products and search_stores first to get the IDs. Stock is approximate and updated once a day.",
  GetStockSchema.shape, ({ productId, storeId }) => getStock(productId, storeId));

  registerReadOnly(server, "search_stores",
  "Find Migros stores by location (city name, zip code, etc.). Returns store details including address and opening hours.",
  SearchStoresSchema.shape, ({ query }) => searchStores(query));

  registerReadOnly(server, "get_promotions",
  "Search current Migros promotions and deals. Optionally filter by search query.",
  GetPromotionsSchema.shape, ({ query }) => getPromotions(query ?? ""));

  // --- Anonymous: recipes (Migusto) ---

  registerReadOnly(server, "search_recipes",
  "Search Migusto (Migros' recipe site) by free-text query and/or ingredients. Returns recipe id, slug, title, and source URL. Use get_recipe_details for full info or get_recipe_products to get Migros product IDs for the recipe.",
  SearchRecipesSchema.shape, (args) => searchRecipes(args));

  registerReadOnly(server, "get_recipe_details",
  "Fetch a full Migusto recipe by slug: ingredients with quantities, step-by-step instructions, photos, nutrition. Use search_recipes first to find the slug. (Migusto is Migros' recipe site at migusto.migros.ch.)",
  GetRecipeDetailsSchema.shape, (args) => getRecipeDetails(args));

  registerReadOnly(server, "get_recipe_products",
  "Fetch the Migros products needed for a Migusto recipe — returns product UIDs for looking up ingredient products. Pass the numeric recipe ID and slug from search_recipes.",
  GetRecipeProductsSchema.shape, (args) => getRecipeProducts(args));

  return server;
}
