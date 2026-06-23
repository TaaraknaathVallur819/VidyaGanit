// Reward-shop catalog. The same catalog is mirrored on the client
// (vidya-ganit/src/lib/shop.ts) for rendering; the server copy is the
// authority for price and item validity so coins can't be bypassed. Keep the
// two in sync when adding items.

export type ShopItemKind = "avatar" | "theme";

export interface ShopCatalogItem {
  id: string;
  kind: ShopItemKind;
  name: string;
  emoji: string;
  price: number;
}

export const SHOP_CATALOG: ShopCatalogItem[] = [
  { id: "avatar_fox", kind: "avatar", name: "Clever Fox", emoji: "🦊", price: 50 },
  { id: "avatar_owl", kind: "avatar", name: "Wise Owl", emoji: "🦉", price: 50 },
  { id: "avatar_tiger", kind: "avatar", name: "Brave Tiger", emoji: "🐯", price: 80 },
  { id: "avatar_robot", kind: "avatar", name: "Math Bot", emoji: "🤖", price: 120 },
  { id: "avatar_unicorn", kind: "avatar", name: "Number Unicorn", emoji: "🦄", price: 200 },
  { id: "avatar_dragon", kind: "avatar", name: "Algebra Dragon", emoji: "🐲", price: 300 },
  { id: "theme_ocean", kind: "theme", name: "Ocean Blue", emoji: "🌊", price: 60 },
  { id: "theme_forest", kind: "theme", name: "Forest Green", emoji: "🌳", price: 60 },
  { id: "theme_sunset", kind: "theme", name: "Sunset Orange", emoji: "🌅", price: 100 },
  { id: "theme_galaxy", kind: "theme", name: "Galaxy Purple", emoji: "🌌", price: 150 },
];

export function findShopItem(id: string): ShopCatalogItem | undefined {
  return SHOP_CATALOG.find((i) => i.id === id);
}
