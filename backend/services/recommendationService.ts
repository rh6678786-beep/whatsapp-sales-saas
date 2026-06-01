import { dbService, pool } from "./dbService";
import { generateEmbedding } from "./embeddingService";
import { Product, Session } from "../../src/types";

export async function searchSimilarProducts(
  adminId: string,
  query: string,
  topK: number = 10
): Promise<Product[]> {
  try {
    const embedding = await generateEmbedding(query, adminId);
    if (!embedding) {
      return fallbackProducts(adminId);
    }

    const embeddingStr = `[${embedding.join(",")}]`;

    const result = await pool.query(
      `SELECT pe.product_id, 1 - (pe.embedding <=> $1::vector) as similarity
       FROM product_embeddings pe
       WHERE pe.admin_id = $2
       ORDER BY pe.embedding <=> $1::vector
       LIMIT $3`,
      [embeddingStr, adminId, topK]
    );

    if (result.rows.length === 0) {
      return fallbackProducts(adminId);
    }

    const allProducts = await dbService.getAllProducts(adminId);
    const productMap = new Map(allProducts.map(p => [p.id, p]));

    const matched: Product[] = [];
    for (const row of result.rows) {
      const product = productMap.get(row.product_id);
      if (product && (product.stock === undefined || product.stock > 0)) {
        matched.push(product);
      }
    }

    if (matched.length < topK) {
      const matchedIds = new Set(matched.map(p => p.id));
      const fillers = allProducts.filter(
        p => !matchedIds.has(p.id) && (p.stock === undefined || p.stock > 0)
      );
      matched.push(...fillers.slice(0, topK - matched.length));
    }

    return matched.slice(0, topK);
  } catch (e) {
    console.error("[RECOMMENDATION] Semantic search error:", (e as any)?.message);
    return fallbackProducts(adminId);
  }
}

async function fallbackProducts(adminId: string): Promise<Product[]> {
  const allProducts = await dbService.getAllProducts(adminId);
  return allProducts.filter(p => p.stock === undefined || p.stock > 0).slice(0, 10);
}

export async function getCrossSellProducts(
  adminId: string,
  productId: string,
  limit: number = 3
): Promise<Product[]> {
  try {
    const productIds = await dbService.getCrossSellProductIds(adminId, productId, limit);
    if (productIds.length === 0) return [];

    const allProducts = await dbService.getAllProducts(adminId);
    const productMap = new Map(allProducts.map(p => [p.id, p]));

    return productIds
      .map(id => productMap.get(id))
      .filter((p): p is Product => !!p && (p.stock === undefined || p.stock > 0));
  } catch (e) {
    console.error("[RECOMMENDATION] Cross-sell error:", (e as any)?.message);
    return [];
  }
}

export async function getPersonalizedRecommendations(
  adminId: string,
  session: Session,
  limit: number = 5
): Promise<Product[]> {
  const allProducts = await dbService.getAllProducts(adminId);
  const inStock = allProducts.filter(p => p.stock === undefined || p.stock > 0);

  const orderedProductIds = await dbService.getCustomerOrderedProductIds(adminId, session.userId);
  const orderedSet = new Set(orderedProductIds);

  const preferences = (session.metadata as any)?.customerPreferences || {};
  const prefKeywords = [
    ...Object.values(preferences).flatMap((v: any) =>
      typeof v === "string" ? v.toLowerCase().split(/[\s,]+/) : []
    ),
    ...((session.metadata as any)?.budget || "").toLowerCase().split(/[\s,]+/),
  ].filter(Boolean);

  function scoreProduct(p: Product): number {
    let score = 0;
    const text = `${p.name} ${(p.features || []).join(" ")}`.toLowerCase();

    if (orderedSet.has(p.id)) score -= 10;

    for (const kw of prefKeywords) {
      if (text.includes(kw)) score += 3;
    }

    const budgetStr = (session.metadata as any)?.budget || "";
    const budgetMatch = budgetStr.match(/\d+/);
    if (budgetMatch && p.price <= parseInt(budgetMatch[0]) * 1.2) {
      score += 2;
    }

    if (session.selectedProductId) {
      const selected = allProducts.find(pr => pr.id === session.selectedProductId);
      if (selected?.features) {
        for (const feat of selected.features) {
          if ((p.features || []).includes(feat)) score += 2;
        }
      }
    }

    return score;
  }

  const scored = inStock
    .map(p => ({ product: p, score: scoreProduct(p) }))
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(s => s.product);
}

export function getProductEmbeddingText(product: Product): string {
  return `${product.name}. Features: ${(product.features || []).join(", ")}. Price: Rs. ${product.price}.`;
}

export async function getFullProductRecommendations(
  adminId: string,
  customerQuery: string,
  session: Session | null
): Promise<{ relevant: Product[]; crossSell: Product[]; personalized: Product[]; all: Product[] }> {
  const relevant = await searchSimilarProducts(adminId, customerQuery, 10);
  const personalized = session
    ? await getPersonalizedRecommendations(adminId, session, 5)
    : [];

  let crossSell: Product[] = [];
  if (session?.selectedProductId) {
    crossSell = await getCrossSellProducts(adminId, session.selectedProductId, 3);
  }

  const seen = new Set<string>();
  const all: Product[] = [];
  for (const list of [relevant, personalized, crossSell]) {
    for (const p of list) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        all.push(p);
      }
    }
  }

  return { relevant, crossSell, personalized, all: all.slice(0, 10) };
}
