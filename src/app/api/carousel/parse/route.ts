import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    let rawText = '';

    if (file.name.endsWith('.pdf')) {
      const tmpDir = path.join(process.cwd(), 'tmp');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      const tmpPath = path.join(tmpDir, `carousel_${randomUUID()}.pdf`);
      fs.writeFileSync(tmpPath, buffer);
      try {
        const scriptPath = path.join(process.cwd(), 'scripts', 'parse-pdf.js');
        rawText = execSync(`node "${scriptPath}" "${tmpPath}"`, {
          maxBuffer: 1024 * 1024 * 20, encoding: 'utf8',
        });
      } finally {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      }
    } else {
      rawText = buffer.toString('utf8');
    }

    if (!rawText.trim()) {
      return NextResponse.json({ error: 'Could not extract text' }, { status: 400 });
    }

    // Use Gemini to parse into slide structure
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `You are a carousel slide parser for Instagram. 
Parse the following text brief into a JSON array of slides.
Each slide must have a "type" field: "cover", "thesis", "list", "antithesis", or "final".

Slide schemas:
- cover: { type, headline, hashtag }
- thesis: { type, quote (optional), body }
- list: { type, heading, items: [{name, desc}] }
- antithesis: { type, myth, fact }
- final: { type, cta, tagline }

Rules:
- Always start with a "cover" slide and end with a "final" slide
- Create 5-8 slides total
- Keep text concise and impactful
- Preserve the original language (Russian or English)
- Return ONLY valid JSON array, no markdown, no explanation

Text brief:
${rawText.substring(0, 6000)}`;

    const result = await model.generateContent(prompt);
    let jsonText = result.response.text().trim();
    jsonText = jsonText.replace(/^```json\s*/i, '').replace(/```$/, '').trim();

    const slides = JSON.parse(jsonText);
    return NextResponse.json({ slides, raw_length: rawText.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
