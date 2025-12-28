import "dotenv/config";
import express from "express";
import OpenAI, { toFile } from "openai";
import path from "path";
import { fileURLToPath } from "url";

// Resolve __dirname since ES modules don't have it by default
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Canvas images can be large; raise JSON limit
app.use(express.json({ limit: "25mb" }));
app.use(express.static(path.join(__dirname, "public")));

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post("/api/bring-to-life", async (req, res) => {
  try {
    const { imageDataUrl, maskDataUrl, extraPrompt = "", colors = "" } = req.body;

    if (!imageDataUrl?.startsWith("data:image/")) {
      return res.status(400).json({ error: "Expected imageDataUrl as a data:image/* base64 string." });
    }

    // Extract base64 payload
    const base64 = imageDataUrl.split(",")[1];
    const bytes = Buffer.from(base64, "base64");

    // Convert to a "file" for the OpenAI SDK
    const imageFile = await toFile(bytes, "sketch.png", { type: "image/png" });
    
    // Create maskFile from maskDataUrl if provided
    let maskFile;
    if (maskDataUrl && typeof maskDataUrl === "string" && maskDataUrl.startsWith("data:image/")) {
      const maskBase64 = maskDataUrl.split(",")[1];
      const maskBytes = Buffer.from(maskBase64, "base64");
      maskFile = await toFile(maskBytes, "mask.png", { type: "image/png" });
    }

    // Build prompt
    // images.edit API has a strict 1000 character limit
    // Keep a concise, fidelity-first base prompt
    const BASE_PROMPT = `Convert hand-drawn sketch to polished 2D cartoon. Preserve exact silhouette, proportions, pose, facial features, and all details. Only improve: smooth linework, add flat cartoon colors, subtle cel-shading. Do not redesign or add features. Output must be fully colored and inked.`.trim();

    const styleNotes = (extraPrompt || "").trim();
    let prompt;
    
    // If user provided custom prompt, use it (but keep it concise)
    if (styleNotes.length && styleNotes !== "Render as a colorful polished 2D cartoon. Flat fills + simple cel shading. Stay faithful to my drawing.") {
      // User provided custom prompt - use it but ensure it fits
      prompt = styleNotes;
    } else {
      // Use base prompt and append color palette if provided
      prompt = BASE_PROMPT;
      const palette = (colors || "").trim();
      if (palette.length) {
        prompt += ` Color palette: ${palette}.`;
      }
    }
    
    // Force transformation instruction (if we have room)
    const forceInstruction = " Output must be fully colored and inked.";
    if (prompt.length + forceInstruction.length <= 1000) {
      prompt += forceInstruction;
    }

    // Enforce 1000 character limit (API requirement)
    const MAX_PROMPT_LENGTH = 1000;
    if (prompt.length > MAX_PROMPT_LENGTH) {
      console.warn(`Prompt is ${prompt.length} characters; truncating to ${MAX_PROMPT_LENGTH}.`);
      // Try to end at a sentence boundary
      const truncated = prompt.substring(0, MAX_PROMPT_LENGTH);
      const lastPeriod = truncated.lastIndexOf('.');
      if (lastPeriod > MAX_PROMPT_LENGTH * 0.8) {
        prompt = truncated.substring(0, lastPeriod + 1);
      } else {
        prompt = truncated;
      }
    }

    // Call OpenAI Images Edit API
    // Try with gpt-image-1.5 first, fallback to default model if org not verified
    let rsp;
    try {
      rsp = await client.images.edit({
        model: "gpt-image-1.5",
        image: imageFile,
        mask: maskFile,
        prompt,
        n: 1,
        size: "1024x1024",
        quality: "high",
        output_format: "png",
        background: "opaque"
      });
    } catch (modelError) {
      // If gpt-image-1.5 requires verification, try without model parameter (uses default)
      if (modelError.status === 403 && modelError.message?.includes("verified")) {
        console.log("gpt-image-1.5 requires verification, trying default model...");
        rsp = await client.images.edit({
          image: imageFile,
          mask: maskFile,
          prompt,
          n: 1,
          size: "1024x1024",
          response_format: "b64_json"
        });
      } else {
        throw modelError;
      }
    }
    
    // Handle different response formats
    let outBase64;
    if (rsp.data?.[0]?.b64_json) {
      outBase64 = rsp.data[0].b64_json;
    } else if (rsp.data?.[0]?.url) {
      // If URL is returned, we'd need to fetch it, but for now expect b64_json
      return res.status(500).json({ error: "API returned URL instead of base64. Please check API response format." });
    } else {
      return res.status(500).json({ error: "No image returned from API.", response: rsp });
    }

    res.json({
      imageDataUrl: `data:image/png;base64,${outBase64}`
    });
  } catch (err) {
    console.error("Error details:", err);
    console.error("Error message:", err.message);
    console.error("Error response:", err.response?.data);
    
    // Provide more helpful error messages
    let errorMessage = "Server error calling image model.";
    let errorDetails = err.message;
    
    // Check for specific error types
    if (err.status === 403 && err.message?.includes("verified")) {
      errorMessage = "Organization verification required.";
      errorDetails = "The gpt-image-1.5 model requires organization verification. The system will try using the default model instead. If you want to use gpt-image-1.5, please verify your organization at https://platform.openai.com/settings/organization/general";
    } else if (err.message?.includes("prompt") || err.message?.includes("length") || err.message?.includes("too long") || err.message?.includes("string_above_max_length")) {
      errorMessage = "Prompt is too long.";
      errorDetails = "The images.edit API has a strict limit of 1000 characters. Your prompt has been automatically truncated, but you may want to shorten it further.";
    } else if (err.status === 400) {
      errorMessage = "Invalid request to OpenAI API.";
      errorDetails = err.message || "Please check your prompt and image format.";
    }
    
    res.status(err.status || 500).json({ 
      error: errorMessage,
      details: errorDetails 
    });
  }
});

app.listen(port, () => {
  console.log(`Sketch Wand running on http://localhost:${port}`);
});
