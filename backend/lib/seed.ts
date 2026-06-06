import { dbService } from "../services/dbService";

const products = [
  {
    name: "Pure Silk Saree - Emerald Green",
    price: 8500,
    costPrice: 4500,
    features: ["Handwoven", "100% Pure Silk", "Zari Work", "Lacquered Finish"],
    images: ["https://images.unsplash.com/photo-1610030469983-98e550d6193c?q=80&w=500"]
  },
  {
    name: "Luxury Leather Wallet - Tan",
    price: 2500,
    costPrice: 1200,
    features: ["Genuine Leather", "8 Card Slots", "RFID Protection", "Gift Box Included"],
    images: ["https://images.unsplash.com/photo-1627123424574-724758594e93?q=80&w=500"]
  },
  {
    name: "Designer Mens Kurta - Royal Blue",
    price: 4500,
    costPrice: 2100,
    features: ["Egyptian Cotton", "Intricate Embroidery", "Slim Fit", "Breathable Fabric"],
    images: ["https://images.unsplash.com/photo-1597983073493-88cd35cf93b0?q=80&w=500"]
  }
];

export async function seedDatabase(adminId: string = "default-admin") {
  try {
    // Ensure the admin exists first (required for foreign key constraint)
    const adminExists = await dbService.adminExists(adminId);
    if (!adminExists) {
      await dbService.registerAdmin(adminId, "");
    }

    const existing = await dbService.getAllProducts(adminId);
    if (existing.length > 0) {
      console.log("Products already exist, skipping.");
      return;
    }
    console.log("Seeding products...");
    for (const product of products) {
      await dbService.addProduct(adminId, product);
    }
    console.log("Products seeded.");
    console.log("Database seeding complete.");
  } catch (err) {
    console.error("Seeding failed:", err);
  }
}
