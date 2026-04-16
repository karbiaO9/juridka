const { GoogleGenAI } = require('@google/genai');

/**
 * Enhances a photo to look like a professional headshot using Google Gemini.
 * @param {Buffer} imageBuffer - the original image buffer
 * @param {string} mimeType - the mime type of the image (e.g., 'image/jpeg')
 * @returns {Promise<Buffer>} - the enhanced image buffer
 */
async function enhancePhotoWithGemini(imageBuffer, mimeType) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not defined in the environment.');
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    This is an image uploaded by a professional lawyer during account creation.
    Please enhance and transform this photo into a highly polished, professional corporate headshot suitable for a legal directory or law firm website.
    Ensure good lighting, a clean neutral or office background, and professional attire (like a suit).
    Keep the core facial features and identity of the person exactly the same, but improve the image quality and professional presentation.
    Output nothing but the generated image.
  `;

  // Provide the image inline
  const imagePart = {
    inlineData: {
      data: imageBuffer.toString("base64"),
      mimeType: mimeType
    }
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [
        {
          role: 'user',
          parts: [
            imagePart,
            { text: prompt }
          ]
        }
      ],
      config: {
        responseModalities: ["IMAGE"]
      }
    });

    const generatedPart = response.candidates?.[0]?.content?.parts?.[0];
    if (generatedPart && generatedPart.inlineData && generatedPart.inlineData.data) {
      const base64Data = generatedPart.inlineData.data;
      const decodedBuffer = Buffer.from(base64Data, "base64");
      return decodedBuffer;
    }

    throw new Error('No image was returned from Gemini.');
  } catch (error) {
    console.error('[Gemini] Error generating photo:', error);
    throw error;
  }
}

module.exports = {
  enhancePhotoWithGemini
};
