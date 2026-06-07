import { Router } from "express";
import { dbService } from "../services/dbService.js";
import { getAdminId } from "../middleware/auth.js";
import { generateEnhancedPost, getAIClient } from "../services/aiService.js";
import fs from "fs";
import path from "path";
import axios from "axios";
import { randomUUID } from "crypto";
import { sendWhatsAppMessage, isWhatsAppReady } from "../lib/whatsappClient.js";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("route:publish");
const router = Router();

const PUBLICATIONS_FILE = path.join(process.cwd(), "publications.json");

function readPublications(): any[] {
  if (!fs.existsSync(PUBLICATIONS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(PUBLICATIONS_FILE, "utf8"));
  } catch {
    return [];
  }
}

function writePublications(pubs: any[]) {
  fs.writeFileSync(PUBLICATIONS_FILE, JSON.stringify(pubs, null, 2), "utf8");
}

router.get("/publish/history", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const allPubs = readPublications();
    const adminPubs = allPubs.filter(p => p.adminId === adminId);
    res.json(adminPubs.reverse());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/publish/ai-enhance", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }
    const enhancedText = await generateEnhancedPost(adminId, text);
    res.json({ success: true, enhancedText });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/publish", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const { content, mediaUrl, mediaType, platforms, scheduledTime } = req.body;

    const newPub: any = {
      id: randomUUID(),
      adminId,
      content,
      mediaUrl,
      mediaType: mediaType || 'none',
      platforms,
      status: scheduledTime ? 'scheduled' : 'published',
      scheduledTime,
      createdAt: new Date().toISOString(),
    };

    if (!scheduledTime) {
      const settings = await dbService.getSettings(adminId);
      const errors: string[] = [];

      for (const platform of platforms) {
        try {
          if (platform === 'telegram') {
            const tg = settings.telegram;
            if (!tg || !tg.botToken || !tg.isActive) {
              errors.push("Telegram is not configured or active");
              continue;
            }
            const chatId = settings.telegramChannelId || settings.telegramChatId || "@my_test_channel";
            if (mediaType === 'image' && mediaUrl) {
              await axios.post(`https://api.telegram.org/bot${tg.botToken}/sendPhoto`, {
                chat_id: chatId,
                photo: mediaUrl,
                caption: content
              });
            } else if (mediaType === 'video' && mediaUrl) {
              await axios.post(`https://api.telegram.org/bot${tg.botToken}/sendVideo`, {
                chat_id: chatId,
                video: mediaUrl,
                caption: content
              });
            } else {
              await axios.post(`https://api.telegram.org/bot${tg.botToken}/sendMessage`, {
                chat_id: chatId,
                text: content
              });
            }
          } else if (platform === 'facebook') {
            const fb = settings.facebook;
            if (!fb || !fb.pageAccessToken || !fb.pageId || !fb.isActive) {
              errors.push("Facebook Messenger/Page is not configured or active");
              continue;
            }
            if (mediaType === 'image' && mediaUrl) {
              await axios.post(`https://graph.facebook.com/v18.0/${fb.pageId}/photos`, {
                url: mediaUrl,
                message: content,
                access_token: fb.pageAccessToken
              });
            } else if (mediaType === 'video' && mediaUrl) {
              await axios.post(`https://graph.facebook.com/v18.0/${fb.pageId}/videos`, {
                file_url: mediaUrl,
                description: content,
                access_token: fb.pageAccessToken
              });
            } else {
              await axios.post(`https://graph.facebook.com/v18.0/${fb.pageId}/feed`, {
                message: content,
                access_token: fb.pageAccessToken
              });
            }
          } else if (platform === 'instagram') {
            const ig = settings.instagram;
            if (!ig || !ig.igBusinessId || !ig.pageAccessToken || !ig.isActive) {
              errors.push("Instagram is not configured or active");
              continue;
            }
            if (mediaType === 'image' && mediaUrl) {
              const containerRes = await axios.post(`https://graph.facebook.com/v18.0/${ig.igBusinessId}/media`, {
                image_url: mediaUrl,
                caption: content,
                access_token: ig.pageAccessToken
              });
              const creationId = containerRes.data.id;
              await axios.post(`https://graph.facebook.com/v18.0/${ig.igBusinessId}/media_publish`, {
                creation_id: creationId,
                access_token: ig.pageAccessToken
              });
            } else if (mediaType === 'video' && mediaUrl) {
              const containerRes = await axios.post(`https://graph.facebook.com/v18.0/${ig.igBusinessId}/media`, {
                media_type: 'REELS',
                video_url: mediaUrl,
                caption: content,
                access_token: ig.pageAccessToken
              });
              const creationId = containerRes.data.id;
              setTimeout(async () => {
                try {
                  await axios.post(`https://graph.facebook.com/v18.0/${ig.igBusinessId}/media_publish`, {
                    creation_id: creationId,
                    access_token: ig.pageAccessToken
                  });
                } catch (e: any) {
                  log.error({ err: e, platform: 'instagram', adminId: '(scheduled)' }, "IG Video publish failed");
                }
              }, 5000);
            }
          } else if (platform === 'whatsapp') {
            if (!isWhatsAppReady(adminId)) {
              errors.push("WhatsApp client is not authenticated or ready");
              continue;
            }
            await sendWhatsAppMessage(adminId, "status-update", content);
          }
        } catch (platErr: any) {
          log.error({ err: platErr, adminId, platform }, "Publish platform error");
          errors.push(`${platform}: ${platErr?.response?.data?.error?.message || platErr.message}`);
        }
      }

      if (errors.length > 0) {
        newPub.status = 'failed';
        newPub.errorMessage = errors.join("; ");
      }
    }

    const allPubs = readPublications();
    allPubs.push(newPub);
    writePublications(allPubs);

    if (newPub.status === 'failed') {
      return res.status(400).json({ success: false, error: newPub.errorMessage });
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/publish/generate-media", async (req, res) => {
  let adminId = "";
  try {
    adminId = getAdminId(req);
    const { prompt, mediaType } = req.body;
    if (!prompt || !mediaType) {
      return res.status(400).json({ error: "prompt and mediaType are required" });
    }

    if (mediaType === 'video') {
      return res.json({ success: false, error: 'Video generation is not available yet. Please use Image generation or upload a video manually.' });
    }    const genAI = await getAIClient(adminId);
    if (!genAI) {
      return res.status(400).json({ error: "AI client not available. Check your API key configuration." });
    }

    const response = await genAI.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: [{ text: `Generate a high-quality, realistic product or marketing image based on this description. Make it look professional and suitable for social media. Description: ${prompt}

Return ONLY the image, no extra text.` }],
      config: {
        temperature: 1.0,
        topP: 1.0,
        topK: 32,
      },
    } as any);

    let imageData: string | null = null;
    let mimeType = 'image/png';

    const candidate = response?.candidates?.[0];
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if ((part as any)?.inlineData?.data) {
          imageData = (part as any).inlineData.data;
          mimeType = (part as any).inlineData.mimeType || mimeType;
          break;
        }
      }
    }

    if (!imageData) {
      return res.json({ success: false, error: 'AI could not generate an image for this prompt. Try a more detailed description.' });
    }

    const UPLOADS_DIR = path.join(process.cwd(), "uploads");
    const ext = mimeType === 'image/jpeg' ? '.jpg' : mimeType === 'image/png' ? '.png' : '.png';
    const filename = `${randomUUID()}${ext}`;
    const filePath = path.join(UPLOADS_DIR, filename);
    fs.writeFileSync(filePath, Buffer.from(imageData, 'base64'));

    res.json({ success: true, url: `/uploads/${filename}` });
  } catch (error: any) {
    log.error({ err: error, adminId }, "Generate media error");
    res.status(500).json({ error: error.message || 'Failed to generate media' });
  }
});

router.post("/publish/generate-product-post", async (req, res) => {
  let adminId = "";
  try {
    adminId = getAdminId(req);
    const { productId } = req.body;
    log.info({ adminId, productId }, "Product post request received");
    if (!productId) {
      return res.status(400).json({ error: "productId is required" });
    }

    const products = await dbService.getAllProducts(adminId);
    log.info({ adminId, count: products.length }, "Products fetched for product post");
    const product = products.find(p => p.id === productId);
    if (!product) {
      log.warn({ adminId, productId }, "Product not found for post generation");
      return res.status(404).json({ error: "Product not found" });
    }
    log.info({ adminId, productName: product.name, imageCount: product.images?.length || 0 }, "Found product for post generation");

    const settings = await dbService.getSettings(adminId);
    const genAI = await getAIClient(adminId);
    if (!genAI) {
      return res.status(400).json({ error: "AI client not available. Check your API key configuration." });
    }

    const productImage = product.images?.[0] || null;
    const featuresText = product.features?.join(", ") || "No features listed";

    const systemPrompt = `You are an expert social media copywriter and digital marketer for a Pakistani e-commerce brand. Your job is to create a high-impact, engagement-driven social media post based on product details and its image.

OUTPUT REQUIREMENTS:
- Start with a scroll-stopping hook (question, bold statement, or curiosity gap)
- 3-4 short paragraphs with line breaks for readability
- Use 3-5 emojis strategically — one near hook, one near CTA, rest to highlight benefits
- Include ALL factual product details (name, price, features) — never alter facts
- End with a clear, urgent call to action
- Add 4-6 relevant hashtags at the bottom (mix of broad + niche)

TONE: Warm, confident, conversational — like a top Pakistani brand owner talking to customers. Use the language that matches the product context.

FORMAT:
[Hook line — attention grabbing]

[Body — describe the product, key features, and benefits. Use the product image to inform visual descriptions]

[Call to action — "Order now", "DM to order", "Limited stock" etc.]

[4-6 hashtags]`;

    const parts: any[] = [];
    parts.push({ text: `Create an engaging social media post for this product:

Product Name: ${product.name}
Price: Rs. ${product.price}
Cost Price: Rs. ${product.costPrice}
Features: ${featuresText}

Use the product image (if provided) to analyze the product visually and incorporate visual descriptions into the post. Make the post highly engaging and professional.` });

    if (productImage) {
      try {
        let imageBuffer: Buffer | null = null;
        let mimeType = 'image/jpeg';

        if (productImage.startsWith('http://') || productImage.startsWith('https://')) {
          log.info({ adminId }, "Downloading remote image for product post");
          const imgResponse = await fetch(productImage);
          if (imgResponse.ok) {
            const arrayBuffer = await imgResponse.arrayBuffer();
            imageBuffer = Buffer.from(arrayBuffer);
            mimeType = imgResponse.headers.get('content-type') || 'image/jpeg';
            log.info({ adminId, size: imageBuffer.length, mimeType }, "Remote image downloaded");
          } else {
            log.warn({ adminId, status: imgResponse.status }, "Failed to download remote image");
          }
        } else {
          const imagePath = path.join(process.cwd(), productImage.replace(/^\//, ""));
          log.info({ adminId, imagePath }, "Looking for local image");
          if (fs.existsSync(imagePath)) {
            imageBuffer = fs.readFileSync(imagePath);
            mimeType = productImage.endsWith('.png') ? 'image/png' : 'image/jpeg';
            log.info({ adminId, size: imageBuffer.length, mimeType }, "Local image found");
          } else {
            log.warn({ adminId, imagePath }, "Local image file not found");
          }
        }

        if (imageBuffer) {
          parts.push({
            inlineData: { data: imageBuffer.toString('base64'), mimeType }
          });
        }
      } catch (imgErr) {
        log.warn({ err: imgErr, adminId }, "Could not process product image");
      }
    }

    log.info({ adminId, parts, model: settings.geminiModel || "gemini-2.0-flash" }, "Calling Gemini API for product post");

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Gemini API timed out after 30 seconds')), 30000)
    );

    const geminiPromise = genAI.models.generateContent({
      model: settings.geminiModel || "gemini-2.0-flash",
      contents: [{ parts }],
      config: { systemInstruction: systemPrompt, temperature: 0.8 },
    } as any);

    const response = await Promise.race([geminiPromise, timeoutPromise]) as any;

    const generatedContent = response.text || "";
    log.info({ adminId, contentLength: generatedContent.length }, "Gemini response received for product post");

    if (!generatedContent.trim()) {
      return res.json({
        success: true,
        content: `🌟 ${product.name} — Rs. ${product.price}\n\n${featuresText}\n\nOrder now! Limited stock available.`,
        mediaUrl: productImage || undefined,
      });
    }

    res.json({
      success: true,
      content: generatedContent,
      mediaUrl: productImage || undefined,
    });
  } catch (error: any) {
    log.error({ err: error, adminId }, "Product post generate error");
    res.status(500).json({ error: error.message || "Failed to generate product post" });
  }
});

export default router;
