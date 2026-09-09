import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const name = file.name.toLowerCase();

    // ── JSON: parse directly, no AI needed ──────────────────────────────────
    if (name.endsWith('.json')) {
      const text = buffer.toString('utf8');
      let slides: any;
      try {
        slides = JSON.parse(text);
      } catch {
        return NextResponse.json({ error: 'Invalid JSON file' }, { status: 400 });
      }
      // Accept both bare array and { slides: [...] }
      if (Array.isArray(slides)) {
        return NextResponse.json({ slides, source: 'json' });
      }
      if (Array.isArray(slides.slides)) {
        return NextResponse.json({ slides: slides.slides, source: 'json' });
      }
      return NextResponse.json({ error: 'JSON must be an array of slides or { slides: [...] }' }, { status: 400 });
    }

    // ── PDF: extract text ────────────────────────────────────────────────────
    let rawText = '';
    if (name.endsWith('.pdf')) {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      rawText = data.text;
    } else {
      // .txt / .md — read as plain text
      rawText = buffer.toString('utf8');
    }

    if (!rawText.trim()) {
      return NextResponse.json({ error: 'Could not extract text from file' }, { status: 400 });
    }

    // ── AI: parse text into slide structure ──────────────────────────────────
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
    if (!apiKey) {
      return NextResponse.json({ error: 'No Gemini API key configured. Use JSON upload instead.' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `You are a carousel slide parser for Instagram.
Parse the following text brief into a JSON array of slides.
Each slide must have a "type" field: "cover", "thesis", "list", "antithesis", or "final".

Slide schemas:
- cover:      { type, headline, hashtag }
- thesis:     { type, quote (optional), body }
- list:       { type, heading, items: [{name, desc}] }
- antithesis: { type, myth, fact }
- final:      { type, cta, tagline }

Rules:
- Always start with "cover" and end with "final"
- Create 5-8 slides total
- Keep text concise and impactful
- Preserve the original language (Russian or English)
- Return ONLY a valid JSON array, no markdown, no explanation

Text brief:
${rawText.substring(0, 6000)}`;

    const result = await model.generateContent(prompt);
    let jsonText = result.response.text().trim();
    jsonText = jsonText.replace(/^```json\s*/i, '').replace(/```$/, '').trim();

    const slides = JSON.parse(jsonText);
    return NextResponse.json({ slides, source: 'ai' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
