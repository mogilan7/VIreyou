'use server';

import prisma from '@/lib/prisma';
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';

function safeRevalidatePath(pathStr: string) {
  try {
    revalidatePath(pathStr);
    if (pathStr === '/admin/content') {
      revalidatePath('/[locale]/admin/content');
    }
  } catch (error: any) {
    console.warn(`[safeRevalidatePath] Skipped revalidation for ${pathStr}: ${error.message}`);
  }
  // Also bust the server-side data caches so next read hits DB fresh
  try { revalidateTag('weekly-hubs'); } catch (_) {}
  try { revalidateTag('projects'); } catch (_) {}
}


const _getProjectsCached = unstable_cache(
  async () => {
    const projects = await prisma.projects.findMany({
      orderBy: { created_at: 'desc' },
    });
    return projects;
  },
  ['projects-list'],
  { revalidate: 30, tags: ['projects'] }
);

export async function getProjects() {
  try {
    const projects = await _getProjectsCached();
    return { success: true, projects };
  } catch (error: any) {
    console.error('[ACTIONS] getProjects error:', error);
    return { success: false, error: error.message };
  }
}

export async function createProject(name: string) {
  try {
    if (!name.trim()) throw new Error('Project name cannot be empty');
    const project = await prisma.projects.create({
      data: { name: name.trim() },
    });
    safeRevalidatePath('/[locale]/admin/content');
    return { success: true, project };
  } catch (error: any) {
    console.error('[ACTIONS] createProject error:', error);
    return { success: false, error: error.message };
  }
}

const _getWeeklyHubsCached = unstable_cache(
  async (projectId?: string) => {
    let whereClause = {};
    if (projectId) {
      whereClause = { project_id: projectId };
    } else {
      const latestProject = await prisma.projects.findFirst({
        orderBy: { created_at: 'desc' }
      });
      if (latestProject) {
        whereClause = { project_id: latestProject.id };
      }
    }

    const hubs = await prisma.weekly_hubs.findMany({
      where: whereClause,
      orderBy: { week_number: 'asc' },
      include: {
        posts: {
          include: {
            carousel_slides: { orderBy: { slide_order: 'asc' } },
            veo_video_assets: { orderBy: { scene_order: 'asc' } },
            publication_logs: { orderBy: { published_at: 'desc' } },
          },
          orderBy: [
            { scheduled_at: { sort: 'asc', nulls: 'last' } },
            { platform: 'asc' },
          ],
        },
      },
    });

    const serialized = JSON.parse(JSON.stringify(hubs));
    return { hubs: serialized, currentProjectId: (whereClause as any).project_id };
  },
  ['weekly-hubs'],
  { revalidate: 30, tags: ['weekly-hubs'] }
);

export async function getWeeklyHubsWithPosts(projectId?: string) {
  try {
    const data = await _getWeeklyHubsCached(projectId);
    return { success: true, ...data };
  } catch (error: any) {
    console.error('[ACTIONS] getWeeklyHubsWithPosts error:', error);
    return { success: false, error: error.message };
  }
}

export async function deletePostImage(postId: string) {
  try {
    await prisma.posts.update({
      where: { id: postId },
      data: { selected_image: null }
    });
    safeRevalidatePath('/[locale]/admin/content');
    return { success: true };
  } catch (error: any) {
    console.error('[deletePostImage] error:', error);
    return { success: false, error: error.message };
  }
}

export async function updatePostStatus(
  postId: string,
  status: 'draft' | 'pending_review' | 'ready_for_review' | 'approved' | 'published' | 'failed'
) {
  try {
    const updatedPost = await prisma.posts.update({
      where: { id: postId },
      data: {
        status,
        updated_at: new Date(),
      },
    });
    safeRevalidatePath('/admin/content');
    return { success: true, post: updatedPost };
  } catch (error: any) {
    console.error('[ACTIONS] updatePostStatus error:', error);
    return { success: false, error: error.message };
  }
}

export async function retriggerCarousel(postId: string) {
  try {
    const post = await prisma.posts.findUnique({
      where: { id: postId },
      include: {
        carousel_slides: {
          orderBy: {
            slide_order: 'asc',
          },
        },
      },
    });

    if (!post) {
      throw new Error(`Post with ID ${postId} not found`);
    }

    if (post.platform !== 'instagram') {
      throw new Error('Can only trigger carousel rendering for Instagram posts');
    }

    // Set post status to pending_review while rendering
    await prisma.posts.update({
      where: { id: postId },
      data: {
        status: 'pending_review',
        updated_at: new Date(),
      },
    });
    safeRevalidatePath('/admin/content');

    const slidesPayload = post.carousel_slides.map((s) => ({
      slide_layout: s.slide_layout,
      main_title: s.main_title || '',
      subtitle: s.subtitle || '',
      list_items: s.list_items || [],
    }));

    // Call local FastAPI carousel generation microservice
    const response = await fetch('http://127.0.0.1:8001/generate-carousel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        post_id: postId,
        slides: slidesPayload,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`FastAPI rendering service error: ${errorText}`);
    }

    const resJson = await response.json();

    // Update DB with generated slide URLs
    for (const s of post.carousel_slides) {
      const url = `/factory/carousels/${postId}/slide_${s.slide_order}_${s.slide_layout}.png`;
      await prisma.carousel_slides.update({
        where: { id: s.id },
        data: { generated_slide_url: url }
      });
    }

    return { success: true, message: 'Carousel generation task started successfully', data: resJson };
  } catch (error: any) {
    console.error('[ACTIONS] retriggerCarousel error:', error);
    // Mark as failed in DB
    await prisma.posts.update({
      where: { id: postId },
      data: {
        status: 'failed',
        updated_at: new Date(),
      },
    });
    safeRevalidatePath('/admin/content');
    return { success: false, error: error.message };
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function markdownToHtml(md: string): string {
  // List of valid Telegram HTML tags to preserve
  const allowedTags = [
    'b', 'strong', 'i', 'em', 'code', 'pre', 'a', 'u', 'ins', 's', 'strike', 'del', 'tg-spoiler', 'blockquote'
  ];

  // Temporary tokens storage
  const tokens: string[] = [];

  // Regex matches opening, closing, and self-closing tags: e.g. <b>, </b>, <a href="...">
  const tagRegex = /<\/?([a-zA-Z0-9\-]+)(?:\s+[^>]*?)?>/g;

  // 1. Extract allowed HTML tags and replace them with placeholders (tokens)
  let placeholderIndex = 0;
  let html = md.replace(tagRegex, (match, tagName) => {
    const isAllowed = allowedTags.includes(tagName.toLowerCase());
    if (isAllowed) {
      const token = `HTMLTAGTOKEN${placeholderIndex}X`;
      tokens.push(match);
      placeholderIndex++;
      return token;
    }
    // If not allowed, keep it as is (will be escaped in next step)
    return match;
  });

  // 2. Escape all remaining raw text (including characters like & and raw < / >)
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 3. Convert list bullets (* or - or • at start of line) to •
  html = html.replace(/^[\s]*[\*\-\u2022]\s+/gm, '• ');

  // 4. Convert markdown headers to bold
  html = html.replace(/^#\s+(.+)$/gm, '<b>$1</b>');
  html = html.replace(/^##\s+(.+)$/gm, '<b>$1</b>');
  html = html.replace(/^###\s+(.+)$/gm, '<b>$1</b>');

  // 5. Convert markdown links [text](url) to HTML <a href="url">text</a>
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');

  // 6. Convert double underline (__text__) to <u>text</u>
  html = html.replace(/__(.*?)__/g, '<u>$1</u>');

  // 7. Convert bold (**text**) to <b>text</b>
  html = html.replace(/\*\*(.*?)\*\?/g, '<b>$1</b>'); // Note: safely matching **
  html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

  // 8. Convert strikethrough (~~text~~) to <s>text</s>
  html = html.replace(/~~(.*?)~~/g, '<s>$1</s>');

  // 9. Convert spoiler (||text||) to <tg-spoiler>text</tg-spoiler>
  html = html.replace(/\|\|(.*?)\|\|/g, '<tg-spoiler>$1</tg-spoiler>');

  // 10. Convert italic (*text* or _text_) to <i>text</i>
  html = html.replace(/\*(.*?)\*/g, '<i>$1</i>');
  html = html.replace(/_([^_]+)_/g, '<i>$1</i>');

  // 11. Convert code blocks (```code```) to <pre>code</pre>
  html = html.replace(/```([\s\S]*?)```/g, '<pre>$1</pre>');

  // 12. Convert inline code (`code`) to <code>code</code>
  html = html.replace(/`(.*?)`/g, '<code>$1</code>');

  // 13. Convert markdown blockquotes starting with >> (expandable blockquotes)
  html = html.replace(/^&gt;&gt;\s*(.*)$/gm, '<blockquote expandable>$1</blockquote>');

  // 14. Convert markdown blockquotes starting with > (standard blockquotes)
  html = html.replace(/^&gt;\s*(.*)$/gm, '<blockquote>$1</blockquote>');

  // 15. Restore saved HTML tags
  for (let i = 0; i < tokens.length; i++) {
    html = html.replace(`HTMLTAGTOKEN${i}X`, tokens[i]);
  }

  return html;
}

function splitTelegramMessage(text: string, maxLength: number = 4000): string[] {
  if (text.length <= maxLength) return [text];
  
  const chunks: string[] = [];
  let remaining = text;
  
  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }
    
    let splitIdx = remaining.lastIndexOf('\n\n', maxLength);
    if (splitIdx === -1 || splitIdx < maxLength * 0.3) {
      splitIdx = remaining.lastIndexOf('\n', maxLength);
    }
    if (splitIdx === -1 || splitIdx < maxLength * 0.3) {
      splitIdx = remaining.lastIndexOf(' ', maxLength);
    }
    if (splitIdx === -1) {
      splitIdx = maxLength;
    }
    
    chunks.push(remaining.substring(0, splitIdx).trim());
    remaining = remaining.substring(splitIdx).trim();
  }
  
  return chunks;
}

export async function publishPost(postId: string, targetChatId?: string) {
  try {
    const post = await prisma.posts.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new Error(`Post with ID ${postId} not found`);
    }

    // 1. Extract and remove inline buttons from the text before conversion/splitting
    const buttons: Array<{ label: string; msg: string; fileUrl?: string; id: string }> = [];
    const btnRegex = /\[\[BTN:\s*(.*?)\s*\|\s*MSG:\s*(.*?)(?:\s*\|\s*FILE:\s*(.*?))?\s*\]\]/g;
    let match;
    let cleanBodyText = post.body_text || '';
    
    while ((match = btnRegex.exec(post.body_text || '')) !== null) {
      const label = match[1].trim();
      const msg = match[2].trim();
      const fileUrl = match[3] ? match[3].trim() : undefined;
      const buttonId = `c_${randomUUID().substring(0, 8)}`;
      
      buttons.push({
        label,
        msg,
        fileUrl,
        id: buttonId
      });
    }
    
    cleanBodyText = cleanBodyText.replace(btnRegex, '').trim();

    if (post.platform === 'telegram') {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = targetChatId || post.target_chat_id || '@ergomarket38'; // Default channel

      if (!botToken) {
        throw new Error('TELEGRAM_BOT_TOKEN is not configured on the server');
      }

      // Convert body and format beautiful Telegram content with HTML
      let text = '';
      if (post.title) {
        text += `<b>${escapeHtml(post.title)}</b>\n\n`;
      }
      if (post.hook_text) {
        text += `<i>${escapeHtml(post.hook_text)}</i>\n\n`;
      }
      text += markdownToHtml(cleanBodyText);
      
      if (post.hashtags && post.hashtags.length > 0) {
        const hashStr = post.hashtags
          .filter((t) => !t.startsWith('__chat_id:'))
          .map((t) => (t.startsWith('#') ? t : `#${t}`))
          .join(' ');
        if (hashStr.trim()) text += `\n\n${hashStr}`;
      }
      
      if ((post as any).telegraph_url) {
        text += `\n\n<a href="${escapeHtml((post as any).telegraph_url)}">Читать статью полностью</a>`;
      }


      // Register custom reactions in the bot's database via the FastAPI microservice
      for (let index = 0; index < buttons.length; index++) {
          const btn = buttons[index];
        let fileType: string | null = null;
        if (btn.fileUrl) {
          const lowerUrl = btn.fileUrl.toLowerCase();
          if (/\.(jpg|jpeg|png|webp|gif)/.test(lowerUrl)) {
            fileType = 'photo';
          } else if (/\.(mp4|mov|avi|mkv)/.test(lowerUrl)) {
            fileType = 'video';
          } else {
            fileType = 'document';
          }
        }
        
        try {
          const registerRes = await fetch('http://127.0.0.1:8000/api/custom-reactions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: btn.id,
              message_text: btn.msg,
              file_id: btn.fileUrl || null,
              file_type: fileType,
            }),
          });
          
          if (!registerRes.ok) {
            const errText = await registerRes.text();
            console.error(`[TELEGRAM PUBLISH] Failed to register custom reaction ${btn.id}: ${errText}`);
          } else {
            console.log(`[TELEGRAM PUBLISH] Successfully registered custom reaction ${btn.id}`);
          }
        } catch (apiErr: any) {
          console.error(`[TELEGRAM PUBLISH Warning] Could not reach FastAPI to register reaction: ${apiErr.message}`);
        }
      }

      console.log(`[TELEGRAM PUBLISH] Preparing to send post to chat ${chatId}. Total text length: ${text.length}`);

      const hasMedia = !!post.selected_image;
      const mediaUrl = post.selected_image;
      let isVideo = false;
      let isVoice = false;
      let isDocument = false;
      
      if (mediaUrl) {
        const lowerUrl = mediaUrl.toLowerCase();
        if (/\.(mp4|mov|avi|mkv)/.test(lowerUrl)) {
          isVideo = true;
        } else if (/\.(mp3|ogg|oga|m4a|wav)/.test(lowerUrl)) {
          isVoice = true;
        } else if (!/\.(jpg|jpeg|png|webp|gif)/.test(lowerUrl)) {
          isDocument = true;
        }
      }

      // Split the message into chunks if it exceeds limits (caption limit is 1024, regular text limit is 4096)
      let chunks: string[] = [];
      if (hasMedia) {
        const firstPartSplit = splitTelegramMessage(text, 1000);
        const firstChunk = firstPartSplit[0];
        chunks.push(firstChunk);
        
        const remainingText = text.substring(firstChunk.length).trim();
        if (remainingText.length > 0) {
          const remainingChunks = splitTelegramMessage(remainingText, 4000);
          chunks.push(...remainingChunks);
        }
      } else {
        chunks = splitTelegramMessage(text, 4000);
      }
      
      console.log(`[TELEGRAM PUBLISH] Split into ${chunks.length} chunks`);

      // Build inline keyboard markup
      const inlineKeyboard: any[] = [];
      if (buttons.length > 0) {
        const row: any[] = [];
        for (const btn of buttons) {
          if (btn.msg.length > 200) {
            const botUsername = "ergomarketAI_bot";
            row.push({
              text: btn.label,
              url: `https://t.me/${botUsername}?start=${btn.id}`
            });
          } else {
            row.push({
              text: btn.label,
              callback_data: `reac_${btn.id}`
            });
          }
        }
        inlineKeyboard.push(row);
      }
      
      const replyMarkup = inlineKeyboard.length > 0 ? { inline_keyboard: inlineKeyboard } : undefined;
      let firstMessageId: string | null = null;
      let lastResJson: any = null;

      for (let i = 0; i < chunks.length; i++) {
        let endpoint = `https://api.telegram.org/bot${botToken}/sendMessage`;

        if (i === 0 && hasMedia) {
          // Send media using multipart/form-data to support larger files and avoid "failed to get HTTP URL content"
          let arrayBuffer;
          let filename = mediaUrl.split('/').pop() || 'file';

          if (mediaUrl.includes('bot.ergomarket.ru/factory/media/') || mediaUrl.startsWith('/factory/media/') || mediaUrl.startsWith('/media/')) {
            // Read from filesystem to avoid localhost fetch routing issues
            let relativePath = ""; 
            if (mediaUrl.includes("bot.ergomarket.ru/factory/media/")) { 
              relativePath = mediaUrl.split("bot.ergomarket.ru/factory/media/")[1].split("?")[0]; 
            } else if (mediaUrl.startsWith('/factory/media/')) { 
              relativePath = mediaUrl.split("/factory/media/")[1].split("?")[0]; 
            } else {
              relativePath = mediaUrl.split("/media/")[1].split("?")[0];
            }
            const fsPath = require('path').join(process.cwd(), 'public', 'media', relativePath);
            console.log(`[TELEGRAM PUBLISH] Reading local file from disk: ${fsPath}`);
            if (!require('fs').existsSync(fsPath)) {
              throw new Error(`Local media file not found at path: ${fsPath}`);
            }
            const buffer = require('fs').readFileSync(fsPath);
            arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
            filename = relativePath.split('/').pop() || 'file';
          } else {
            console.log(`[TELEGRAM PUBLISH] Downloading media from ${mediaUrl}...`);
            const mediaResponse = await fetch(mediaUrl);
            if (!mediaResponse.ok) {
              throw new Error(`Failed to download post cover media from URL: ${mediaUrl} (status: ${mediaResponse.status})`);
            }
            arrayBuffer = await mediaResponse.arrayBuffer();
          }

          const blob = new Blob([arrayBuffer]);

          const formData = new FormData();
          formData.append('chat_id', chatId);
          formData.append('parse_mode', 'HTML');
          formData.append('caption', chunks[i]);

          if (replyMarkup && i === chunks.length - 1) {
            formData.append('reply_markup', JSON.stringify(replyMarkup));
          }

          if (isVideo) {
            formData.append('video', blob, filename);
            endpoint = `https://api.telegram.org/bot${botToken}/sendVideo`;
          } else if (isVoice) {
            formData.append('voice', blob, filename);
            endpoint = `https://api.telegram.org/bot${botToken}/sendVoice`;
          } else if (isDocument) {
            formData.append('document', blob, filename);
            endpoint = `https://api.telegram.org/bot${botToken}/sendDocument`;
          } else {
            formData.append('photo', blob, filename);
            endpoint = `https://api.telegram.org/bot${botToken}/sendPhoto`;
          }

          console.log(`[TELEGRAM PUBLISH] Sending chunk ${i + 1}/${chunks.length} with direct media upload via ${endpoint}...`);
          const res = await fetch(endpoint, {
            method: 'POST',
            body: formData,
          });

          const resJson = await res.json();

          if (!res.ok || !resJson.ok) {
            const errMsg = resJson.description || `Failed to post chunk ${i + 1} with media to Telegram API`;
            throw new Error(errMsg);
          }

          firstMessageId = String(resJson.result.message_id);
          lastResJson = resJson;
        } else {
          // Send regular text message
          const payload: any = {
            chat_id: chatId,
            parse_mode: 'HTML',
            disable_web_page_preview: i > 0, // Only show preview on the first chunk
          };

          if (replyMarkup && i === chunks.length - 1) {
            payload.reply_markup = replyMarkup;
          }

          payload.text = chunks[i];
          if (firstMessageId) {
            payload.reply_to_message_id = Number(firstMessageId);
          }

          console.log(`[TELEGRAM PUBLISH] Sending chunk ${i + 1}/${chunks.length} via ${endpoint}...`);
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });

          const resJson = await res.json();

          if (!res.ok || !resJson.ok) {
            const errMsg = resJson.description || `Failed to post chunk ${i + 1} to Telegram API`;
            throw new Error(errMsg);
          }

          if (i === 0) {
            firstMessageId = String(resJson.result.message_id);
          }
          lastResJson = resJson;
        }
      }

      // Send Polls if they exist
      if ((post as any).telegram_polls) {
        let pollsData = (post as any).telegram_polls;
        // pollsData might be an array or a single object
        if (!Array.isArray(pollsData)) {
          pollsData = [pollsData];
        }
        
        for (const p of pollsData) {
          if (p && p.question && p.options && Array.isArray(p.options) && p.options.length > 1) {
            console.log(`[TELEGRAM PUBLISH] Sending poll: ${p.question}`);
            const pollEndpoint = `https://api.telegram.org/bot${botToken}/sendPoll`;
            const pollPayload: any = {
              chat_id: chatId,
              question: p.question,
              options: p.options,
            };
            
            // Link the poll to the main post
            if (firstMessageId) {
              pollPayload.reply_to_message_id = Number(firstMessageId);
            }
            
            try {
              const pollRes = await fetch(pollEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pollPayload),
              });
              const pollResJson = await pollRes.json();
              if (!pollRes.ok || !pollResJson.ok) {
                console.error(`[TELEGRAM PUBLISH] Failed to send poll:`, pollResJson);
              }
            } catch (pollErr) {
              console.error(`[TELEGRAM PUBLISH] Exception sending poll:`, pollErr);
            }
          }
        }
      }

      // Record publication log
      await prisma.publication_logs.create({
        data: {
          post_id: postId,
          external_post_id: firstMessageId || '',
          api_response_raw: lastResJson as any,
          published_at: new Date(),
        },
      });

      // Update post status to published
      await prisma.posts.update({
        where: { id: postId },
        data: {
          status: 'published',
          updated_at: new Date(),
        },
      });

      safeRevalidatePath('/admin/content');
      return { success: true, message: 'Published to Telegram successfully with media and buttons!', result: lastResJson };
    } else if (post.platform === 'max') {
      // Real Max Messenger publication
      const maxToken = process.env.MAX_BOT_TOKEN || 'f9LHodD0cOIF-goo9gS5RGsWakYhxOzsiNylBl131UHne2z4afrljW0pb8i2hIw9eLDlR-za_mTiDu_oTJ4x';
      const maxChatId = targetChatId || post.target_chat_id || process.env.MAX_CHANNEL_ID;

      if (!maxChatId) {
        throw new Error('MAX_CHANNEL_ID is not configured. Please provide a target chat ID.');
      }

      // Updated API domain (platform-api2.max.ru as of July 2026)
      const maxApiUrl = 'https://platform-api2.max.ru';

      // Helper: strip HTML tags from text (for body_text that comes from Telegram pipeline)
      function htmlToMaxMarkdown(html: string): string {
        if (!html) return '';
        return html
          // Convert bold HTML to markdown bold
          .replace(/<b>([\s\S]*?)<\/b>/gi, '**$1**')
          .replace(/<strong>([\s\S]*?)<\/strong>/gi, '**$1**')
          // Convert italic HTML to markdown italic
          .replace(/<i>([\s\S]*?)<\/i>/gi, '_$1_')
          .replace(/<em>([\s\S]*?)<\/em>/gi, '_$1_')
          // Convert underline (Max doesn't support, just strip tags)
          .replace(/<u>([\s\S]*?)<\/u>/gi, '$1')
          // Convert strikethrough
          .replace(/<s>([\s\S]*?)<\/s>/gi, '~~$1~~')
          .replace(/<del>([\s\S]*?)<\/del>/gi, '~~$1~~')
          // Convert code
          .replace(/<code>([\s\S]*?)<\/code>/gi, '`$1`')
          .replace(/<pre>([\s\S]*?)<\/pre>/gi, '```\n$1\n```')
          // Convert links
          .replace(/<a href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
          // Remove all remaining HTML tags
          .replace(/<[^>]+>/g, '')
          // Decode HTML entities
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .trim();
      }

      // Helper: detect media type from URL extension
      function detectMediaType(url: string): 'audio' | 'video' | 'image' | null {
        const lower = url.toLowerCase().split('?')[0];
        if (/\.(mp3|wav|m4a|ogg|aac|flac|wma)$/.test(lower)) return 'audio';
        if (/\.(mp4|mov|avi|mkv|webm)$/.test(lower)) return 'video';
        if (/\.(jpg|jpeg|png|gif|webp)$/.test(lower)) return 'image';
        return null;
      }

      // Helper: upload a file to Max via mandatory 2-step process and return token
      // Max cannot fetch files from external URLs (especially blocked ones in RU)
      async function uploadFileToMax(fileUrl: string, mediaTypeUp: 'audio' | 'video' | 'image'): Promise<string> {
        console.log(`[MAX UPLOAD] Starting ${mediaTypeUp} upload for: ${fileUrl}`);

        // Step 1: Request an upload URL + token from Max
        const uploadUrlRes = await fetch(`${maxApiUrl}/uploads?type=${mediaTypeUp}`, {
          method: 'POST',
          headers: { 'Authorization': maxToken },
        });
        if (!uploadUrlRes.ok) {
          const err = await uploadUrlRes.text();
          throw new Error(`Max upload URL request failed (${uploadUrlRes.status}): ${err}`);
        }
        const uploadUrlData = await uploadUrlRes.json();
        const uploadUrl: string = uploadUrlData.url;
        const uploadToken: string = uploadUrlData.token;
        if (!uploadUrl || !uploadToken) {
          throw new Error(`Max upload URL response missing url/token: ${JSON.stringify(uploadUrlData)}`);
        }

        // Step 2: Download the file from our server (read from disk if local)
        let fileBuffer: ArrayBuffer;
        let filename: string;
        
        if (fileUrl.includes('bot.ergomarket.ru/factory/media/') || fileUrl.startsWith('/factory/media/')) {
          let relativePath = ""; if (fileUrl.includes("bot.ergomarket.ru/factory/media/")) { relativePath = fileUrl.split("bot.ergomarket.ru/factory/media/")[1].split("?")[0]; } else { relativePath = fileUrl.split("/factory/media/")[1].split("?")[0]; }
          const fsPath = require('path').join(process.cwd(), 'public', 'media', relativePath);
          console.log(`[MAX UPLOAD] Reading local file from disk: ${fsPath}`);
          if (!require('fs').existsSync(fsPath)) {
            throw new Error(`Local file not found at path: ${fsPath}`);
          }
          const buffer = require('fs').readFileSync(fsPath);
          fileBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
          filename = relativePath.split('/').pop() || 'file';
        } else {
          console.log(`[MAX UPLOAD] Got upload URL, fetching file from: ${fileUrl}`);
          const fileRes = await fetch(fileUrl);
          if (!fileRes.ok) {
            throw new Error(`Failed to download file for Max upload: ${fileUrl} (status: ${fileRes.status})`);
          }
          fileBuffer = await fileRes.arrayBuffer();
          filename = fileUrl.split('/').pop()?.split('?')[0] || 'file';
        }

        // Step 3: Upload file bytes to Max's temporary upload URL
        const formData = new FormData();
        formData.append('data', new Blob([fileBuffer]), filename);
        const uploadRes = await fetch(uploadUrl, { method: 'POST', body: formData });
        if (!uploadRes.ok) {
          const err = await uploadRes.text();
          throw new Error(`Max file upload to storage failed (${uploadRes.status}): ${err}`);
        }

        console.log(`[MAX UPLOAD] ${mediaTypeUp} uploaded successfully, token: ${uploadToken}`);
        return uploadToken;
      }

      // Build message text using markdown (Max supports markdown format)
      let maxText = '';
      if (post.title) {
        const cleanTitle = htmlToMaxMarkdown(post.title);
        maxText += `**${cleanTitle}**\n\n`;
      }
      if (post.hook_text) {
        const cleanHook = htmlToMaxMarkdown(post.hook_text);
        maxText += `_${cleanHook}_\n\n`;
      }

      // Convert body_text from HTML to Max markdown
      const cleanBody = htmlToMaxMarkdown(cleanBodyText);
      maxText += cleanBody;

      if (post.hashtags && post.hashtags.length > 0) {
        const hashStr = post.hashtags
          .filter((t) => !t.startsWith('__chat_id:'))
          .map((t) => (t.startsWith('#') ? t : `#${t}`))
          .join(' ');
        if (hashStr.trim()) maxText += `\n\n${hashStr}`;
      }

      // Limit to 4000 chars
      if (maxText.length > 4000) {
        maxText = maxText.substring(0, 3997) + '...';
      }

      const mediaType = post.selected_image ? detectMediaType(post.selected_image) : null;
      console.log(`[MAX PUBLISH] Sending post to chat ${maxChatId}. Text length: ${maxText.length}. Media: ${mediaType || 'none'} (${post.selected_image || 'none'})`);

      // Build payload
      const maxPayload: any = {
        text: maxText,
        format: 'markdown',
      };

      // Upload media via 2-step process if present (Max cannot fetch URLs from blocked servers)
      if (post.selected_image && mediaType) {
        try {
          const mediaToken = await uploadFileToMax(post.selected_image, mediaType);
          maxPayload.attachments = [{
            type: mediaType,
            payload: { token: mediaToken },
          }];
        } catch (uploadErr: any) {
          console.error(`[MAX PUBLISH] Media upload failed, sending text-only: ${uploadErr.message}`);
          // Continue without media — text post is better than a complete failure
        }
      }

      // Add inline buttons for Max
      const maxButtons: any[][] = [];

      // Helper: check if a URL is a downloadable file (needs bot proxy) or a link to open directly
      function isDownloadableFile(url: string): boolean {
        // If it's a deeplink (max.ru/u/, t.me/, etc.) or has no file extension -> open as link
        if (/max\.ru\/u\//i.test(url)) return false;  // Max contact deeplink
        if (/\/u\//i.test(url) && /max\.ru/i.test(url)) return false;
        // Check for known file extensions
        return /\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z|tar|gz|mp4|mov|avi|mkv|jpg|jpeg|png|gif|webp|mp3|wav|ogg)([?#].*)?$/i.test(url);
      }

      // 1. Convert user-defined buttons
      if (buttons.length > 0) {
        for (let index = 0; index < buttons.length; index++) {
          const btn = buttons[index];
          if (btn.fileUrl) {
            const fUrl = btn.fileUrl.trim();
            if (isDownloadableFile(fUrl)) {
              // Real downloadable file -> use callback so bot sends it via DM
              maxButtons.push([{
                type: 'callback',
                text: btn.label,
                payload: `file_dl:${postId}:${index}`
              }]);
            } else {
              // Deeplink / contact / regular URL -> open directly
              maxButtons.push([{
                type: 'link',
                text: btn.label,
                url: fUrl
              }]);
            }
          } else if (btn.msg) {
            const btnUrl = btn.msg.trim();
            const isLink = /^(https?:\/\/|tg:\/\/)/i.test(btnUrl) || /^t\.me\//i.test(btnUrl) || /^@/i.test(btnUrl);
            if (isLink) {
              let finalUrl = btnUrl;
              if (/^t\.me\//i.test(btnUrl)) {
                finalUrl = `https://${btnUrl}`;
              } else if (/^@/i.test(btnUrl)) {
                finalUrl = `https://t.me/${btnUrl.substring(1)}`;
              }
              maxButtons.push([{
                type: 'link',
                text: btn.label,
                url: finalUrl
              }]);
            }
          }
        }
      }
      
      // 2. Always append Comments button at the bottom
      maxButtons.push([{
        type: 'link',
        text: '💬 Комментарии',
        url: `http://78.24.221.140:8080/comments?post_id=${postId}`
      }]);
      
      // Attach keyboard to payload
      if (!maxPayload.attachments) maxPayload.attachments = [];
      maxPayload.attachments.push({
        type: 'inline_keyboard',
        payload: {
          buttons: maxButtons
        }
      });

      // Send message - chat_id is a QUERY PARAMETER per Max API docs
      let maxRes: Response | undefined;
      let maxResJson: any;
      let retries = 10; // Wait up to 20 seconds for processing

      while (retries > 0) {
        maxRes = await fetch(`${maxApiUrl}/messages?chat_id=${maxChatId}`, {
          method: 'POST',
          headers: {
            'Authorization': maxToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(maxPayload),
        });

        maxResJson = await maxRes.json();

        if (!maxRes.ok) {
          const errMsg = maxResJson.message || '';
          // If media is still processing on Max's side, wait and retry
          if (errMsg.includes('not.processed')) {
            console.log(`[MAX PUBLISH] Media not processed yet, waiting 2s... (${retries} retries left)`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            retries--;
            continue;
          } else {
            throw new Error(errMsg || `Failed to post to Max API (status: ${maxRes.status}): ${JSON.stringify(maxResJson)}`);
          }
        }
        
        // Success
        break;
      }

      if (!maxRes || !maxRes.ok) {
        throw new Error(maxResJson?.message || `Failed to post to Max API after retries: ${JSON.stringify(maxResJson)}`);
      }

      const messageId = maxResJson.message?.body?.mid || '';

      // Record publication log
      await prisma.publication_logs.create({
        data: {
          post_id: postId,
          external_post_id: messageId,
          api_response_raw: maxResJson as any,
          published_at: new Date(),
        },
      });

      await prisma.posts.update({
        where: { id: postId },
        data: {
          status: 'published',
          updated_at: new Date(),
        },
      });

      safeRevalidatePath('/admin/content');
      return { success: true, message: 'Published to Max successfully!', result: maxResJson };
    } else {
      // Mock publication for Instagram
      const externalId = `mock_${post.platform}_${Math.random().toString(36).substring(7)}`;
      const mockResponse = {
        success: true,
        platform: post.platform,
        mock_timestamp: new Date().toISOString(),
        note: 'Mock API publication triggered successfully',
      };

      await prisma.publication_logs.create({
        data: {
          post_id: postId,
          external_post_id: externalId,
          api_response_raw: mockResponse,
          published_at: new Date(),
        },
      });

      await prisma.posts.update({
        where: { id: postId },
        data: {
          status: 'published',
          updated_at: new Date(),
        },
      });

      safeRevalidatePath('/admin/content');
      return { success: true, message: `Mock publication triggered for ${post.platform} successfully!` };
    }
  } catch (error: any) {
    console.error(`[ACTIONS] publishPost error for post ${postId}:`, error);
    
    // Log error in publication logs
    try {
      await prisma.publication_logs.create({
        data: {
          post_id: postId,
          error_message: error.message,
          published_at: new Date(),
        },
      });
    } catch (dbErr) {
      console.error('[ACTIONS] Failed to save publication error log:', dbErr);
    }

    return { success: false, error: error.message };
  }
}

// Helper to clean pagination noise and page breaks
function cleanRawText(text: string): string {
  return text
    .replace(/\r/g, '') // remove carriage returns
    .split('\n')
    .map(line => line.trim())
    .filter(line => {
      // Remove page indicators like "-- 1 of 6 --" or "1 / 6" or blank pagination lines
      if (/^--\s*\d+\s*of\s*\d+\s*--$/i.test(line)) return false;
      if (/^\d+\s*\/\s*\d+$/i.test(line)) return false;
      return true;
    })
    .join('\n');
}

// Extracts a specific field prefix-matched (e.g. "- Заголовок (3 строки): Text")
function extractField(slideText: string, keyPattern: string): string {
  // Matches "- KeyPattern (optional notes): Captured content up to next line starting with - or end"
  const regex = new RegExp(`(?:^|\\n)-\\s*(?:${keyPattern})\\s*(?:\\([^)]+\\))?\\s*:\\s*([\\s\\S]*?)(?=\\n\\s*-|$)`, 'i');
  const match = slideText.match(regex);
  return match ? match[1].trim() : '';
}

// Clean line-break slashes (trim spacing around them)
function cleanSlashes(val: string): string {
  if (!val) return '';
  // Convert / with irregular spaces to a standard ' / '
  return val.replace(/\s*\/\s*/g, ' / ').trim();
}

// Extracts list items and cleans them to Key - Value format
function extractListItems(slideText: string): string[] {
  const items: string[] = [];
  
  // First, find the "- Пункты:" section and capture everything up to next line with "-"
  const listBlockMatch = slideText.match(/-\s*Пункты\s*:\s*([\s\S]*?)(?=\n\s*-|$)/i);
  if (!listBlockMatch) return [];
  
  const rawLines = listBlockMatch[1].split('\n').map(l => l.trim()).filter(Boolean);
  
  for (const line of rawLines) {
    if (/^\d+\./.test(line)) {
      // Strip leading "1. "
      let clean = line.replace(/^\d+\.\s*/, '').trim();
      // Replace variations of "— "" —" with standard " — "
      clean = clean.replace(/\s*[—-]\s*""\s*[—-]\s*/g, ' — ');
      clean = clean.replace(/\s*[—-]\s*""\s*/g, ' — ');
      items.push(clean);
    }
  }
  
  // Layout compliance: limit to exactly 4 items
  return items.slice(0, 4);
}

interface ParsedSlide {
  slide_order: number;
  slide_layout: 'cover' | 'thesis' | 'list' | 'antithesis' | 'final';
  main_title: string;
  subtitle: string;
  list_items: string[];
}

interface ParsedPost {
  index: number;
  day: string;
  timeStr: string;
  title: string;
  bodyText: string;
}

interface ParsedStory {
  time: string;
  description: string;
  tags: string[];
  day: number;
  month: number;
  year: number;
  weekday: string;
  priority: string;
  pub_date: string;
  week?: number;
  week_theme?: string;
}

interface ParsedInstaPost {
  insta_type: 'reel' | 'carousel' | 'post';
  title: string;
  body_text: string;
  hashtags: string[];
  scheduled_at?: Date | null;
}

interface ParsedWeek {
  week_number: number;
  theme_title: string;
  slides: ParsedSlide[];
  telegram_posts?: ParsedPost[];
  max_posts?: ParsedPost[];
  telegram_text?: string;
  max_text?: string;
  stories?: ParsedStory[];
  instagram_posts?: ParsedInstaPost[];
}

function cleanPlatformText(text: string): string {
  if (!text) return '';
  return text
    .split('\n')
    .filter(line => {
      const trimmed = line.trim();
      if (/^[═─\-\*_—–\u2010-\u2015]{3,}$/.test(trimmed)) return false;
      return true;
    })
    .join('\n')
    .trim();
}

function parsePostsFromSection(sectionText: string): ParsedPost[] {
  if (!sectionText) return [];

  const headerRegex = /(?:^|\n)\s*(?:ПОСТ|POST)\s*(\d+)\s*·\s*([^\s·]+)\s*·\s*([^\s·]+(?:\s+МСК)?)\s*·\s*([^\n]+)/gi;
  const matches: { index: number; length: number; postIndex: number; day: string; timeStr: string; title: string }[] = [];
  
  let match;
  while ((match = headerRegex.exec(sectionText)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
      postIndex: parseInt(match[1], 10),
      day: match[2].trim(),
      timeStr: match[3].trim(),
      title: match[4].trim(),
    });
  }

  if (matches.length === 0) {
    return [];
  }

  const posts: ParsedPost[] = [];
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const startIdx = current.index + current.length;
    const endIdx = matches[i + 1] ? matches[i + 1].index : sectionText.length;
    
    let bodyText = sectionText.substring(startIdx, endIdx).trim();
    
    // Clean up any leading/trailing dashes or decoration lines
    bodyText = bodyText
      .replace(/^[\s—\-\*_═]*\n/gm, '') // remove line delimiters
      .replace(/[\s—\-\*_═]*$/gm, '') // remove trailing line delimiters
      .trim();

    posts.push({
      index: current.postIndex,
      day: current.day,
      timeStr: current.timeStr,
      title: current.title,
      bodyText,
    });
  }

  return posts;
}

function resolveScheduledDate(weekNumber: number, dayOfWeek: string, timeStr: string): Date | null {
  try {
    // Reference Start Date in UTC: Monday, June 1, 2026 (Month is 0-indexed, so 5 is June)
    const baseMonday = new Date(Date.UTC(2026, 5, 1));
    
    // Day offsets
    const dayMap: { [key: string]: number } = {
      'ПОНЕДЕЛЬНИК': 0, 'MONDAY': 0, 'ПН': 0,
      'ВТОРНИК': 1, 'TUESDAY': 1, 'ВТ': 1,
      'СРЕДА': 2, 'WEDNESDAY': 2, 'СР': 2,
      'ЧЕТВЕРГ': 3, 'THURSDAY': 3, 'ЧТ': 3,
      'ПЯТНИЦА': 4, 'FRIDAY': 4, 'ПТ': 4,
      'СУББОТА': 5, 'SATURDAY': 5, 'СБ': 5,
      'ВОСКРЕСЕНЬЕ': 6, 'SUNDAY': 6, 'ВС': 6
    };

    const cleanDay = dayOfWeek.toUpperCase().trim();
    const dayOffset = dayMap[cleanDay] !== undefined ? dayMap[cleanDay] : 0;

    // Calculate actual date for that day in UTC
    baseMonday.setUTCDate(baseMonday.getUTCDate() + (weekNumber - 1) * 7 + dayOffset);

    // Parse time
    let hours = 8;
    let minutes = 30;

    const timeUpper = timeStr.toUpperCase().trim();
    if (timeUpper.includes('ВЕЧЕР') || timeUpper.includes('EVENING')) {
      hours = 20;
      minutes = 0;
    } else if (timeUpper.includes('УТРО') || timeUpper.includes('MORNING')) {
      hours = 8;
      minutes = 30;
    } else if (timeUpper.includes('ДЕНЬ') || timeUpper.includes('AFTERNOON')) {
      hours = 14;
      minutes = 0;
    } else {
      const timeMatch = timeStr.match(/(\d{1,2})[:.-](\d{2})/);
      if (timeMatch) {
        hours = parseInt(timeMatch[1], 10);
        minutes = parseInt(timeMatch[2], 10);
      }
    }

    const pad = (num: number) => String(num).padStart(2, '0');
    const datePart = baseMonday.toISOString().split('T')[0];
    const isoStr = `${datePart}T${pad(hours)}:${pad(minutes)}:00+03:00`;
    
    return new Date(isoStr);
  } catch (err) {
    console.error('[resolveScheduledDate] error:', err);
    return null;
  }
}

function parseWeekBlock(contentBlock: string, weekNumber: number): ParsedWeek {
  // Extract theme title
  const themeMatch = contentBlock.match(/(?:ТЕМА|THEME):\s*([^\n]+)/i);
  const themeTitle = themeMatch ? themeMatch[1].trim() : `Неделя ${weekNumber}`;
  
  // Identify all section headers with their indices
  const sectionSpecs = [
    { type: 'telegram', regex: /(?:^|\n)\s*(?:TELEGRAM|ТЕЛЕГРАМ|ТЕЛЕГРАММ|TG|ТГ)(?:[^\n]*)(?:\n|$)/i },
    { type: 'max', regex: /(?:^|\n)\s*(?:MAX|МАКС)(?:[^\n]*)(?:\n|$)/i },
    { type: 'comments', regex: /(?:^|\n)\s*(?:КОММЕНТАРИИ|COMMENTS|ПРИМЕЧАНИЯ)(?:[^\n]*)(?:\n|$)/i },
    { type: 'schedule', regex: /(?:^|\n)\s*(?:РАСПИСАНИЕ|SCHEDULE|ПЛАН)(?:[^\n]*)(?:\n|$)/i },
    { type: 'slide_1', regex: /(?:^|\n)\s*(?:SLIDE|СЛАЙД)\s*1(?:[^\n]*)(?:\n|$)/i },
    { type: 'slide_2', regex: /(?:^|\n)\s*(?:SLIDE|СЛАЙД)\s*2(?:[^\n]*)(?:\n|$)/i },
    { type: 'slide_3', regex: /(?:^|\n)\s*(?:SLIDE|СЛАЙД)\s*3(?:[^\n]*)(?:\n|$)/i },
    { type: 'slide_4', regex: /(?:^|\n)\s*(?:SLIDE|СЛАЙД)\s*4(?:[^\n]*)(?:\n|$)/i },
    { type: 'slide_5', regex: /(?:^|\n)\s*(?:SLIDE|СЛАЙД)\s*5(?:[^\n]*)(?:\n|$)/i },
  ];

  const matches: { type: string; index: number; length: number }[] = [];
  for (const spec of sectionSpecs) {
    const regex = new RegExp(spec.regex, 'gi');
    let match;
    while ((match = regex.exec(contentBlock)) !== null) {
      matches.push({
        type: spec.type,
        index: match.index,
        length: match[0].length,
      });
    }
  }

  // Sort matches by start index
  matches.sort((a, b) => a.index - b.index);

  // Filter overlapping/nested matches
  const filteredMatches: typeof matches = [];
  let lastEnd = -1;
  for (const m of matches) {
    if (m.index >= lastEnd) {
      filteredMatches.push(m);
      lastEnd = m.index + m.length;
    }
  }

  const sections: { [key: string]: string } = {};
  for (let i = 0; i < filteredMatches.length; i++) {
    const current = filteredMatches[i];
    const startIdx = current.index + current.length;
    const endIdx = filteredMatches[i + 1] ? filteredMatches[i + 1].index : contentBlock.length;
    sections[current.type] = contentBlock.substring(startIdx, endIdx).trim();
  }

  // Parse slides
  const slides: ParsedSlide[] = [];
  for (let sIdx = 1; sIdx <= 5; sIdx++) {
    const slideText = sections[`slide_${sIdx}`] || '';
    const layouts: ('cover' | 'thesis' | 'list' | 'antithesis' | 'final')[] = ['cover', 'thesis', 'list', 'antithesis', 'final'];
    const layout = layouts[sIdx - 1];
    
    let mainTitle = '';
    let subtitle = '';
    let listItems: string[] = [];
    
    if (slideText) {
      if (sIdx === 1) {
        mainTitle = extractField(slideText, 'Заголовок');
        subtitle = extractField(slideText, 'Подзаголовок');
      } else if (sIdx === 2) {
        mainTitle = extractField(slideText, 'Главная мысль');
        subtitle = extractField(slideText, 'Курсив-пояснение');
      } else if (sIdx === 3) {
        mainTitle = extractField(slideText, 'Заголовок');
        subtitle = extractField(slideText, 'Выделенный вывод');
        listItems = extractListItems(slideText);
      } else if (sIdx === 4) {
        mainTitle = extractField(slideText, '"Это не\\.\\.\\."|Это не');
        subtitle = extractField(slideText, '"Это про\\.\\.\\."|Это про');
      } else if (sIdx === 5) {
        mainTitle = extractField(slideText, 'CTA');
        subtitle = extractField(slideText, 'Footer|Тэглайн|Handle');
        if (!subtitle || subtitle.startsWith('@')) {
          subtitle = extractField(slideText, 'Footer');
        }
        if (!subtitle) {
          subtitle = extractField(slideText, 'Тэглайн');
        }
      }
    }
    
    slides.push({
      slide_order: sIdx,
      slide_layout: layout,
      main_title: cleanSlashes(mainTitle),
      subtitle: cleanSlashes(subtitle),
      list_items: listItems
    });
  }

  const telegram_posts = sections['telegram'] ? parsePostsFromSection(sections['telegram']) : [];
  const max_posts = sections['max'] ? parsePostsFromSection(sections['max']) : [];

  let telegram_text = sections['telegram'] ? cleanPlatformText(sections['telegram']) : undefined;
  let max_text = sections['max'] ? cleanPlatformText(sections['max']) : undefined;

  // Fallback if no sections matched but we have content.
  // Guard: do NOT dump Instagram Posts content into Telegram.
  const looksLikeInstagram = /INSTAGRAM\s*POSTS|ПОДПИСЬ К REEL|ТЕКСТ ПОСТА|ЛИЧНЫЙ\s+ПОСТ/i.test(contentBlock.slice(0, 500));
  if (!looksLikeInstagram && telegram_posts.length === 0 && max_posts.length === 0 && !telegram_text && !max_text && filteredMatches.length === 0) {
    const fallbackText = contentBlock.replace(/(?:ТЕМА|THEME):\s*[^\n]+/i, '').trim();
    if (fallbackText) {
      telegram_text = cleanPlatformText(fallbackText);
    }
  }

  // Secondary fallback: no telegram/max section found, but other sections (schedule/comments)
  // exist and prevented the primary fallback. Try to parse ПОСТ N headers from entire content block.
  if (!looksLikeInstagram && telegram_posts.length === 0 && max_posts.length === 0 && !sections['telegram'] && !sections['max']) {
    const fullBlockText = contentBlock.replace(/(?:ТЕМА|THEME):\s*[^\n]+/i, '').trim();
    const parsedFromFullBlock = parsePostsFromSection(fullBlockText);
    if (parsedFromFullBlock.length > 0) {
      console.log(`[parseWeekBlock] Week ${weekNumber}: Secondary fallback found ${parsedFromFullBlock.length} posts from full block`);
      return {
        week_number: weekNumber,
        theme_title: themeTitle,
        slides,
        telegram_posts: parsedFromFullBlock,
        max_posts: [],
        telegram_text: undefined,
        max_text: undefined,
      };
    }
  }
  
  return {
    week_number: weekNumber,
    theme_title: themeTitle,
    slides: slides,
    telegram_posts,
    max_posts,
    telegram_text,
    max_text,
  };
}

/**
 * Detect the week number from the first few lines of a Telegram/Max file title.
 * Returns null if not found.
 */
function detectTgMaxFileWeekNumber(text: string): number | null {
  const firstLines = text.split('\n').slice(0, 8).join(' ');
  const m = firstLines.match(/Неделя\s+(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Split a multi-week TG/Max monthly document by "НЕДЕЛЯ N" section headers.
 * Returns array of { weekNumber, text } blocks.
 */
function splitTgMaxByWeek(text: string): { weekNumber: number; text: string }[] {
  // Match lines like: "═══ НЕДЕЛЯ 2 ═══", "НЕДЕЛЯ 2 · Силовые", or just "Неделя 2"
  const weekHeaderRegex = /(?:^|\n)([^\n]*(?:НЕДЕЛЯ|Неделя)\s+(\d+)[^\n]*)/g;
  const matches: { weekNumber: number; index: number; headerLength: number }[] = [];
  const seen = new Set<number>();
  let m;
  while ((m = weekHeaderRegex.exec(text)) !== null) {
    const weekNumber = parseInt(m[2], 10);
    if (!seen.has(weekNumber)) {
      seen.add(weekNumber);
      matches.push({ weekNumber, index: m.index, headerLength: m[1].length });
    }
  }
  if (matches.length === 0) return [];
  matches.sort((a, b) => a.index - b.index);
  return matches.map((match, i) => {
    const start = match.index + match.headerLength;
    const end = matches[i + 1] ? matches[i + 1].index : text.length;
    return { weekNumber: match.weekNumber, text: text.slice(start, end).trim() };
  });
}

/**
 * Detect if a text is a Telegram/Max posts file (not an Instagram carousel brief).
 * These files contain TELEGRAM · N ПОСТА or MAX · N ПОСТА sections
 * but do NOT contain SLIDE/СЛАЙД sections.
 */
function isTgMaxPostsFile(text: string): boolean {
  const hasTgOrMax = /(?:TELEGRAM|MAX)\s*·\s*\d+\s*ПОСТА/i.test(text);
  const hasSlides = /(?:SLIDE|СЛАЙД)\s*\d/i.test(text);
  return hasTgOrMax && !hasSlides;
}

/**
 * Detect if a text is an Instagram Posts file (Reel + Carousel caption + Personal post).
 * These files contain section headers like "НЕДЕЛЯ N · ДЕНЬ · REEL" or "INSTAGRAM POSTS" in the title.
 */
function isInstagramPostsFile(text: string): boolean {
  const hasInstagramPostsTitle = /INSTAGRAM\s*POSTS/i.test(text.slice(0, 300));
  const hasReelSection = /НЕДЕЛЯ\s+\d+[^\n]*·[^\n]*REEL/i.test(text);
  const hasCarouselSection = /НЕДЕЛЯ\s+\d+[^\n]*·[^\n]*КАРУСЕЛЬ/i.test(text);
  const hasPersonalPostSection = /НЕДЕЛЯ\s+\d+[^\n]*·[^\n]*ЛИЧНЫЙ\s+ПОСТ/i.test(text);
  return hasInstagramPostsTitle || hasReelSection || (hasCarouselSection && hasPersonalPostSection);
}

/**
 * Extract hashtags from a text block — finds lines with #tags.
 * Skips PDF page-break markers like «-- 4 of 7 --».
 */
function extractHashtags(text: string): string[] {
  const lines = text.split('\n');
  const PAGE_MARKER = /^--\s*\d+\s*of\s*\d+\s*--$/;

  // Find the ХЭШТЕГИ label line, then scan the following non-empty lines skipping markers
  for (let i = 0; i < lines.length; i++) {
    if (/(?:ХЭШТЕГИ|HASHTAGS)/i.test(lines[i])) {
      for (let j = i + 1; j < lines.length && j < i + 5; j++) {
        const candidate = lines[j].trim();
        if (!candidate || PAGE_MARKER.test(candidate)) continue;
        const tags = candidate.split(/\s+/).filter(t => t.startsWith('#'));
        if (tags.length >= 2) return tags;
        break; // non-empty, non-marker, but no tags — stop
      }
    }
  }
  // Fallback: find any line that is mostly hashtags
  for (const line of lines) {
    const tags = line.trim().split(/\s+/).filter(t => t.startsWith('#'));
    if (tags.length >= 3) return tags;
  }
  return [];
}

/**
 * Extract post caption between a label like "ПОДПИСЬ К REEL:" or "ТЕКСТ ПОСТА:" and the hashtag block.
 */
function extractCaption(text: string, ...labelPatterns: string[]): string {
  for (const label of labelPatterns) {
    const re = new RegExp(`(?:${label})\\s*:?\\n([\\s\\S]*?)(?:ХЭШТЕГИ|HASHTAGS|$)`, 'i');
    const m = text.match(re);
    if (m) {
      return m[1]
        .split('\n')
        .filter(l => !/^--\s*\d+\s*of\s*\d+\s*--$/.test(l.trim())) // strip PDF page markers
        .join('\n')
        .trim();
    }
  }
  return '';
}

/**
 * Parse Instagram Posts file: extracts Reel, Carousel caption, Personal Post per week.
 */
function parseInstagramPostsFile(text: string): { weekNumber: number; posts: ParsedInstaPost[] }[] {
  // Split by section headers: «═══ \n НЕДЕЛЯ N · DAY · TYPE \n ═══»
  const sectionRe = /═+\n(НЕДЕЛЯ\s+(\d+)[^\n]*)\n═+/gi;
  const sectionHeaders: { weekNumber: number; title: string; index: number; length: number }[] = [];
  let sm: RegExpExecArray | null;
  while ((sm = sectionRe.exec(text)) !== null) {
    sectionHeaders.push({
      weekNumber: parseInt(sm[2], 10),
      title: sm[1].trim(),
      index: sm.index,
      length: sm[0].length,
    });
  }

  if (sectionHeaders.length === 0) return [];

  // Group sections by week
  const weekMap = new Map<number, ParsedInstaPost[]>();

  for (let i = 0; i < sectionHeaders.length; i++) {
    const header = sectionHeaders[i];
    const nextHeader = sectionHeaders[i + 1];
    const sectionText = text.slice(
      header.index + header.length,
      nextHeader ? nextHeader.index : text.length
    ).trim();

    const titleUpper = header.title.toUpperCase();

    // Detect section type
    let instaType: 'reel' | 'carousel' | 'post' | null = null;
    let sectionTitle = header.title;

    if (/\bREEL\b/i.test(titleUpper)) {
      instaType = 'reel';
    } else if (/КАРУСЕЛЬ|CAROUSEL/i.test(titleUpper)) {
      instaType = 'carousel';
    } else if (/ЛИЧНЫЙ\s+ПОСТ|PERSONAL\s+POST/i.test(titleUpper)) {
      instaType = 'post';
    } else if (/СТОРИС|STORIES/i.test(titleUpper)) {
      // Skip stories — they come from the dedicated Stories file
      continue;
    } else {
      // Unknown section (e.g. page header, footer) — skip
      continue;
    }

    // Extract caption
    let caption = '';
    if (instaType === 'reel') {
      caption = extractCaption(sectionText, 'ПОДПИСЬ К REEL', 'CAPTION');
    } else if (instaType === 'carousel') {
      caption = extractCaption(sectionText, 'ПОДПИСЬ К КАРУСЕЛИ', 'ПОДПИСЬ К CAROUSEL', 'CAPTION');
    } else if (instaType === 'post') {
      caption = extractCaption(sectionText, 'ТЕКСТ ПОСТА', 'ПОДПИСЬ', 'CAPTION');
    }

    if (!caption) {
      // Fallback: take full section text minus hashtag line and metadata lines
      caption = cleanPlatformText(
        sectionText
          .replace(/(?:ХЭШТЕГИ|HASHTAGS)[^\n]*\n[^\n]*/i, '')
          .replace(/(?:Тема|Визуал|Тип съёмки|Длительность|СЦЕНАРИЙ)[^\n]*/gi, '')
          .trim()
      );
    }

    const hashtags = extractHashtags(sectionText);

    // Resolve scheduled date
    const titleParts = header.title.split('·');
    let weekday = 'ПОНЕДЕЛЬНИК';
    if (titleParts.length >= 2) {
      const dayPart = titleParts[1].trim().split(/\s+/)[0];
      if (dayPart) {
        weekday = dayPart;
      }
    }

    let defaultTime = '09:00';
    if (instaType === 'carousel') {
      defaultTime = '12:00';
    } else if (instaType === 'post') {
      defaultTime = '18:00';
    }

    const scheduledAt = resolveScheduledDate(header.weekNumber, weekday, defaultTime);

    if (!weekMap.has(header.weekNumber)) weekMap.set(header.weekNumber, []);
    weekMap.get(header.weekNumber)!.push({
      insta_type: instaType,
      title: sectionTitle,
      body_text: caption,
      hashtags,
      scheduled_at: scheduledAt,
    });
  }

  return [...weekMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([weekNumber, posts]) => ({ weekNumber, posts }));
}

/**
 * Detect if a text is an Instagram Stories file.
 * These files contain story lines like «09:00 — описание» and day headers
 * with priority markers (обязательно / желательно) but no ПОСТ N headers.
 */
function isStoriesFile(text: string): boolean {
  const hasStoryLines = /\d{2}:\d{2}\s*[—\-]\s*\S/.test(text);
  const hasDayBlock = /(?:ПОНЕДЕЛЬНИК|ВТОРНИК|СРЕДА|ЧЕТВЕРГ|ПЯТНИЦА|СУББОТА|ВОСКРЕСЕНЬЕ)\s*·\s*\d+\s*[А-ЯЁа-яё]+\s*·\s*(?:\((?:обязательно|желательно)|обязательно|желательно)/i.test(text);
  const hasPostHeaders = /ПОСТ\s+\d+\s*·/i.test(text);
  return hasStoryLines && hasDayBlock && !hasPostHeaders;
}

const STORIES_MONTHS_RU: Record<string, number> = {
  'января': 1, 'февраля': 2, 'марта': 3, 'апреля': 4,
  'мая': 5, 'июня': 6, 'июля': 7, 'августа': 8,
  'сентября': 9, 'октября': 10, 'ноября': 11, 'декабря': 12,
};

/**
 * Parse Instagram Stories PDF text.
 * Direct port of vireyou_stories_parser.py.
 */
function parseStoriesFormat(rawText: string, year = 2026): { weekNumber: number; weekTheme: string; stories: ParsedStory[] }[] {
  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Find week header positions: НЕДЕЛЯ N · ТЕМА
  const weekRe = /НЕДЕЛЯ\s+(\d+)[^a-zA-Zа-яА-ЯёЁ0-9]+([^·\n]+?)[^a-zA-Zа-яА-ЯёЁ0-9]/gi;
  const weekPositions: { pos: number; weekNum: number; theme: string }[] = [];
  let wm: RegExpExecArray | null;
  while ((wm = weekRe.exec(text)) !== null) {
    weekPositions.push({ pos: wm.index, weekNum: parseInt(wm[1]), theme: wm[2].trim() });
  }

  function weekForPos(pos: number): { weekNum?: number; weekTheme?: string } {
    let weekNum: number | undefined;
    let weekTheme: string | undefined;
    for (const wp of weekPositions) {
      if (wp.pos <= pos) { weekNum = wp.weekNum; weekTheme = wp.theme; }
    }
    return { weekNum, weekTheme };
  }

  function parsePriority(raw: string): string {
    const lower = raw.toLowerCase();
    if (lower.includes('обязательно')) return 'обязательно';
    if (lower.includes('желательно')) return 'желательно';
    return raw.replace(/^\(|\)$/g, '').replace(/[*_—\-·]/g, '').trim();
  }

  function extractTags(desc: string): string[] {
    const found = desc.match(/\[([^\]]+)\]/g) || [];
    return found.map(t => t.slice(1, -1).trim()).filter(Boolean);
  }

  const allStories: ParsedStory[] = [];
  const lines = text.split('\n').map(l => l.trim());
  
  const DAY_HEADER_RE = /^(ПОНЕДЕЛЬНИК|ВТОРНИК|СРЕДА|ЧЕТВЕРГ|ПЯТНИЦА|СУББОТА|ВОСКРЕСЕНЬЕ)[^a-zA-Zа-яА-ЯёЁ0-9]+(\d{1,2})[^a-zA-Zа-яА-ЯёЁ0-9]+([а-яА-ЯёЁ]+)(?:[^a-zA-Zа-яА-ЯёЁ0-9]+(.*))?$/i;
  const STORY_LINE_RE = /^(\d{2}:\d{2})\s*[_\-—·]\s*(.+)/;
  
  let currentDay: number | null = null;
  let currentMonth: number | null = null;
  let currentWeekday: string | null = null;
  let currentPriority = '';
  
  let currentStoryTime: string | null = null;
  let currentStoryDesc: string[] = [];
  let currentWeekNum: number | undefined;
  let currentWeekTheme: string | undefined;
  let currentBytePos = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLength = line.length + 1; // +1 for newline
    
    // update week context based on position
    const wc = weekForPos(currentBytePos);
    if (wc.weekNum) {
      currentWeekNum = wc.weekNum;
      currentWeekTheme = wc.weekTheme;
    }

    if (!line || /^[_=—\-]{3,}$/.test(line) || /^НЕДЕЛЯ\s+\d+/i.test(line) || /^[·*]+$/.test(line)) {
      currentBytePos += lineLength;
      continue;
    }

    const hm = DAY_HEADER_RE.exec(line);
    if (hm) {
      // It's a new day!
      const monthName = hm[3].toLowerCase();
      const monthNum = STORIES_MONTHS_RU[monthName];
      if (monthNum) {
        // Save previous story if exists
        if (currentStoryTime) {
          allStories.push({
            time: currentStoryTime,
            description: currentStoryDesc.join(' ').trim(),
            tags: extractTags(currentStoryDesc.join(' ')),
            day: currentDay!,
            month: currentMonth!,
            year,
            weekday: currentWeekday!,
            priority: currentPriority,
            pub_date: `${year}-${String(currentMonth!).padStart(2, '0')}-${String(currentDay!).padStart(2, '0')}`,
            week: currentWeekNum,
            week_theme: currentWeekTheme
          });
          currentStoryTime = null;
          currentStoryDesc = [];
        }
        
        currentWeekday = hm[1].toUpperCase();
        currentDay = parseInt(hm[2]);
        currentMonth = monthNum;
        currentPriority = parsePriority(hm[4] || '');
      }
      currentBytePos += lineLength;
      continue;
    }

    const sm = STORY_LINE_RE.exec(line);
    if (sm) {
      // It's a new story line!
      if (currentStoryTime && currentDay && currentMonth) {
         allStories.push({
            time: currentStoryTime,
            description: currentStoryDesc.join(' ').trim(),
            tags: extractTags(currentStoryDesc.join(' ')),
            day: currentDay,
            month: currentMonth,
            year,
            weekday: currentWeekday!,
            priority: currentPriority,
            pub_date: `${year}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`,
            week: currentWeekNum,
            week_theme: currentWeekTheme
          });
      }
      currentStoryTime = sm[1];
      currentStoryDesc = [sm[2].trim()];
    } else if (currentStoryTime) {
      // Continuation of current story description
      currentStoryDesc.push(line);
    }
    
    currentBytePos += lineLength;
  }
  
  // push last story
  if (currentStoryTime && currentDay && currentMonth) {
     allStories.push({
        time: currentStoryTime,
        description: currentStoryDesc.join(' ').trim(),
        tags: extractTags(currentStoryDesc.join(' ')),
        day: currentDay,
        month: currentMonth,
        year,
        weekday: currentWeekday!,
        priority: currentPriority,
        pub_date: `${year}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`,
        week: currentWeekNum,
        week_theme: currentWeekTheme
      });
  }

  // Group by week
  const weekGroups = new Map<number, ParsedStory[]>();
  const weekThemes = new Map<number, string>();
  for (const story of allStories) {
    const wn = story.week ?? 1;
    if (!weekGroups.has(wn)) weekGroups.set(wn, []);
    weekGroups.get(wn)!.push(story);
    if (story.week_theme) weekThemes.set(wn, story.week_theme);
  }

  return [...weekGroups.entries()].sort((a, b) => a[0] - b[0]).map(([wn, stories]) => ({
    weekNumber: wn,
    weekTheme: weekThemes.get(wn) ?? `Неделя ${wn}`,
    stories,
  }));
}

function parseBriefs(rawText: string): ParsedWeek[] {
  const cleanedText = cleanRawText(rawText);
  const parsedWeeks: ParsedWeek[] = [];

  console.log('[parseBriefs] text length:', cleanedText.length, '| isTgMax:', isTgMaxPostsFile(cleanedText));

  // ── MODE 1: Telegram/Max posts file ──
  if (isTgMaxPostsFile(cleanedText)) {
    // Sub-mode 1a: Multi-week monthly file (has multiple НЕДЕЛЯ N section headers)
    const weekBlocks = splitTgMaxByWeek(cleanedText);
    console.log('[parseBriefs] TG/Max week blocks:', weekBlocks.length, weekBlocks.map(b => b.weekNumber));

    if (weekBlocks.length > 1) {
      for (const block of weekBlocks) {
        const parsedWeek = parseWeekBlock(block.text, block.weekNumber);
        console.log(`[parseBriefs] Week ${block.weekNumber}: TG=${parsedWeek.telegram_posts?.length ?? 0}, Max=${parsedWeek.max_posts?.length ?? 0}`);
        const hasPosts =
          (parsedWeek.telegram_posts && parsedWeek.telegram_posts.length > 0) ||
          (parsedWeek.max_posts && parsedWeek.max_posts.length > 0) ||
          parsedWeek.telegram_text || parsedWeek.max_text;
        if (hasPosts) parsedWeeks.push(parsedWeek);
      }
      return parsedWeeks;
    }

    // Sub-mode 1b: Single-week TG/Max file
    const weekNumber = detectTgMaxFileWeekNumber(cleanedText) ?? weekBlocks[0]?.weekNumber ?? 1;
    console.log('[parseBriefs] Single TG/Max week:', weekNumber);
    const parsedWeek = parseWeekBlock(cleanedText, weekNumber);
    console.log(`[parseBriefs] TG=${parsedWeek.telegram_posts?.length ?? 0}, Max=${parsedWeek.max_posts?.length ?? 0}`);
    const hasPosts =
      (parsedWeek.telegram_posts && parsedWeek.telegram_posts.length > 0) ||
      (parsedWeek.max_posts && parsedWeek.max_posts.length > 0) ||
      parsedWeek.telegram_text || parsedWeek.max_text;
    if (hasPosts) parsedWeeks.push(parsedWeek);
    return parsedWeeks;
  }

  // ── MODE 2: Instagram carousel briefs with БРИФ/НЕДЕЛЯ/WEEK headers ──
  const headerRegex = /(?:^|\n)[^\n]*?(?:БРИФ|НЕДЕЛЯ|WEEK|WEEK_)\s*(?:№|#|:|серия|-)?\s*(\d+)[^\n]*/gi;
  const rawMatches: { weekNumber: number; index: number; length: number }[] = [];
  let match;
  while ((match = headerRegex.exec(cleanedText)) !== null) {
    rawMatches.push({ weekNumber: parseInt(match[1], 10), index: match.index, length: match[0].length });
  }

  if (rawMatches.length === 0) {
    console.log('[parseBriefs] No week headers found — returning empty');
    return [];
  }

  const seenWeeks = new Set<number>();
  const matches: typeof rawMatches = [];
  for (const m of rawMatches) {
    if (!seenWeeks.has(m.weekNumber)) { seenWeeks.add(m.weekNumber); matches.push(m); }
  }
  matches.sort((a, b) => a.index - b.index);
  console.log('[parseBriefs] Instagram briefs weeks:', matches.map(m => m.weekNumber));

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const startIdx = current.index + current.length;
    const endIdx = matches[i + 1] ? matches[i + 1].index : cleanedText.length;
    const contentBlock = cleanedText.substring(startIdx, endIdx).trim();
    if (!contentBlock) continue;
    parsedWeeks.push(parseWeekBlock(contentBlock, current.weekNumber));
  }

  return parsedWeeks;
}

export async function uploadPdfAndExtractSlides(postId: string, formData: FormData, projectId?: string) {
  try {
    const file = formData.get('file') as File;
    if (!file) {
      throw new Error('Файл не найден в запросе');
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let rawText = '';
    const isPdf = file.name.endsWith('.pdf') || file.type === 'application/pdf';

    if (isPdf) {
      // Write uploaded file to a temporary file in the workspace
      const tempDir = path.join(process.cwd(), 'tmp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      const tempFilePath = path.join(tempDir, `upload_${randomUUID()}.pdf`);
      fs.writeFileSync(tempFilePath, buffer);

      // Parse PDF using the external vanilla Node script
      console.log(`[FILE EXTRACTION] Parsing PDF file of size ${buffer.length} bytes using external parser...`);
      try {
        const scriptPath = path.join(process.cwd(), 'scripts', 'parse-pdf.js');
        const output = execSync(`node "${scriptPath}" "${tempFilePath}"`, {
          maxBuffer: 1024 * 1024 * 50, // 50MB buffer to handle very large PDFs
          encoding: 'utf8',
        });
        rawText = output;
      } catch (execErr: any) {
        console.error('[FILE EXTRACTION] External parser failed:', execErr);
        throw new Error(`Не удалось извлечь текст из PDF: ${execErr.message}`);
      } finally {
        // Clean up temp file
        try {
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
        } catch (cleanupErr) {
          console.warn('[FILE EXTRACTION] Failed to clean up temp PDF file:', cleanupErr);
        }
      }
    } else {
      // It is a text file (like .txt or .md)
      rawText = buffer.toString('utf8');
    }

    console.log(`[FILE EXTRACTION] Extracted raw text length: ${rawText.length}`);
    if (!rawText || rawText.trim().length === 0) {
      throw new Error('Не удалось извлечь текст из файла. Возможно, файл пуст.');
    }

    const cleanedText = cleanRawText(rawText);
    const parsedWeeks = parseBriefs(cleanedText);

    // Save to database helper function
    const handleUpsertPostAndSlides = async (postTargetId: string, slides: ParsedSlide[]) => {
      console.log(`[FILE EXTRACTION] Deleting old slides for post ${postTargetId}...`);
      await prisma.$executeRawUnsafe(
        `DELETE FROM carousel_slides WHERE post_id = $1::uuid`,
        postTargetId
      );

      console.log(`[FILE EXTRACTION] Saving ${slides.length} new slides to DB for post ${postTargetId}...`);
      for (const s of slides) {
        const slideId = randomUUID();
        const slideUrl = `/factory/carousels/${postTargetId}/slide_${s.slide_order}_${s.slide_layout}.png`;
        await prisma.$executeRawUnsafe(
          `INSERT INTO carousel_slides (id, post_id, slide_order, slide_layout, main_title, subtitle, list_items, generated_slide_url, created_at)
           VALUES ($1::uuid, $2::uuid, $3, $4::carousel_slide_type, $5, $6, $7, $8, NOW())`,
          slideId, postTargetId, s.slide_order, s.slide_layout, s.main_title, s.subtitle || null, s.list_items, slideUrl
        );
      }

      // Set post status to pending_review
      await prisma.posts.update({
        where: { id: postTargetId },
        data: {
          status: 'pending_review',
          updated_at: new Date(),
        },
      });

      console.log(`[FILE EXTRACTION] Triggering local FastAPI carousel generation service for post ${postTargetId}...`);
      try {
        const response = await fetch('http://127.0.0.1:8001/generate-carousel', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            post_id: postTargetId,
            slides: slides.map((s) => ({
              slide_layout: s.slide_layout,
              main_title: s.main_title,
              subtitle: s.subtitle || null,
              list_items: s.list_items || [],
            })),
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[FILE EXTRACTION] FastAPI service returned error: ${errorText}`);
        } else {
          console.log('[FILE EXTRACTION] FastAPI accepted rendering request.');
        }
      } catch (apiErr: any) {
        console.warn(`[FILE EXTRACTION Warning] Could not reach FastAPI: ${apiErr.message}`);
      }
    };

    let importedInstagram = false;
    let importedTelegram = false;
    let importedMax = false;
    let importedStories = false;
    let importedInstagramPosts = false;

    // ── Instagram Posts file detection & import (Reel + Carousel caption + Personal Post) ──
    if (isInstagramPostsFile(cleanedText)) {
      console.log('[FILE EXTRACTION] Detected Instagram Posts file (Reel/Carousel/Personal)');
      const igWeeks = parseInstagramPostsFile(cleanedText);
      console.log(`[FILE EXTRACTION] Instagram Posts weeks: ${igWeeks.length}, posts: ${igWeeks.reduce((acc, w) => acc + w.posts.length, 0)}`);

      for (const igWeek of igWeeks) {
        // Find or create weekly hub
        let targetHub = await prisma.weekly_hubs.findFirst({
          where: { week_number: igWeek.weekNumber, project_id: projectId || null }
        });
        if (!targetHub) {
          targetHub = await prisma.weekly_hubs.create({
            data: { week_number: igWeek.weekNumber, theme_title: `Неделя ${igWeek.weekNumber}`, project_id: projectId || null }
          });
        }

        // Clean up any old fallback Telegram posts in this hub that were created by parsing error
        await prisma.posts.deleteMany({
          where: {
            hub_id: targetHub.id,
            platform: 'telegram',
            OR: [
              { body_text: { contains: 'ПОДПИСЬ К REEL' } },
              { body_text: { contains: 'ПОДПИСЬ К КАРУСЕЛИ' } }
            ]
          }
        });

        for (const igPost of igWeek.posts) {
          // Find existing post of this type for this hub
          let existingPost = await prisma.posts.findFirst({
            where: {
              hub_id: targetHub.id,
              platform: 'instagram',
              insta_type: igPost.insta_type,
            }
          });

          if (existingPost) {
            // Update body text, title, hashtags — preserve slides for carousel
            await prisma.posts.update({
              where: { id: existingPost.id },
              data: {
                title: igPost.title,
                body_text: igPost.body_text,
                hashtags: igPost.hashtags,
                scheduled_at: igPost.scheduled_at,
                status: 'pending_review',
                updated_at: new Date(),
              }
            });
          } else {
            await prisma.posts.create({
              data: {
                hub_id: targetHub.id,
                platform: 'instagram',
                insta_type: igPost.insta_type,
                title: igPost.title,
                body_text: igPost.body_text,
                hashtags: igPost.hashtags,
                scheduled_at: igPost.scheduled_at,
                status: 'pending_review',
              }
            });
          }
          importedInstagramPosts = true;
        }
      }

      // If the user uploaded this file to replace a specific incorrect post, delete it!
      if (postId !== 'global') {
        const postToReplace = await prisma.posts.findUnique({
          where: { id: postId }
        });
        if (postToReplace) {
          const isInstagramPostOfImportedType = postToReplace.platform === 'instagram' && 
            (postToReplace.insta_type === 'reel' || postToReplace.insta_type === 'carousel' || postToReplace.insta_type === 'post');
          
          if (!isInstagramPostOfImportedType) {
            console.log(`[FILE EXTRACTION] Deleting replaced post ${postId} (platform: ${postToReplace.platform}, type: ${postToReplace.insta_type})`);
            await prisma.posts.delete({
              where: { id: postId }
            });
          }
        }
      }

      const totalPosts = igWeeks.reduce((acc, w) => acc + w.posts.length, 0);
      safeRevalidatePath('/admin/content');
      return {
        success: true,
        message: `Instagram Posts успешно импортированы! (${totalPosts} постов по ${igWeeks.length} неделям: Reel, Карусель caption, Личный пост)`,
      };
    }

    // ── Stories file detection & import ──
    if (isStoriesFile(cleanedText)) {
      console.log('[FILE EXTRACTION] Detected Instagram Stories file');
      const storiesWeeks = parseStoriesFormat(cleanedText);
      console.log(`[FILE EXTRACTION] Stories weeks: ${storiesWeeks.length}`);

      for (const sw of storiesWeeks) {
        // Find or create weekly hub
        let targetHub = await prisma.weekly_hubs.findFirst({ where: { week_number: sw.weekNumber, project_id: projectId || null } });
        if (!targetHub) {
          targetHub = await prisma.weekly_hubs.create({
            data: { week_number: sw.weekNumber, theme_title: sw.weekTheme, project_id: projectId || null }
          });
        }

        // Find or create the Stories post for this week
        let storiesPost = await prisma.posts.findFirst({
          where: { hub_id: targetHub.id, platform: 'instagram', insta_type: 'stories' }
        });

        const storiesJson = JSON.stringify(sw.stories);
        const summary = `${sw.stories.length} сторис за ${new Date(new Set([...sw.stories.map(s => s.pub_date)]).values().next().value + 'T00:00:00Z').toLocaleDateString('ru-RU', { month: 'long' })}`;

        if (!storiesPost) {
          storiesPost = await prisma.posts.create({
            data: {
              hub_id: targetHub.id,
              platform: 'instagram',
              insta_type: 'stories',
              title: `Instagram Stories — Неделя ${sw.weekNumber}`,
              body_text: storiesJson,
              status: 'pending_review',
            }
          });
        } else {
          await prisma.posts.update({
            where: { id: storiesPost.id },
            data: { body_text: storiesJson, title: `Instagram Stories — Неделя ${sw.weekNumber}`, updated_at: new Date() }
          });
        }
        importedStories = true;
      }

      safeRevalidatePath('/admin/content');
      return {
        success: true,
        message: `Instagram Stories успешно импортированы! (${storiesWeeks.reduce((acc, w) => acc + w.stories.length, 0)} сторис по ${storiesWeeks.length} неделям)`,
      };
    }

    if (parsedWeeks.length > 0) {
      // Multi-Week logic
      let activeWeekNumber: number | undefined = undefined;
      
      if (postId !== 'global') {
        const activePost = await prisma.posts.findUnique({
          where: { id: postId },
          include: { weekly_hubs: true }
        });
        activeWeekNumber = activePost?.weekly_hubs?.week_number;
      }

      for (const parsedWeek of parsedWeeks) {
        let targetInstagramPostId = '';

        // Find or create the weekly hub
        let targetHub = await prisma.weekly_hubs.findFirst({
          where: { week_number: parsedWeek.week_number, project_id: projectId || null }
        });
        if (!targetHub) {
          targetHub = await prisma.weekly_hubs.create({
            data: {
              week_number: parsedWeek.week_number,
              theme_title: parsedWeek.theme_title,
              project_id: projectId || null
            }
          });
        } else {
          // Update title if it has changed
          targetHub = await prisma.weekly_hubs.update({
            where: { id: targetHub.id },
            data: { theme_title: parsedWeek.theme_title }
          });
        }

        // 1. Instagram slides (Carousel)
        const hasSlides = parsedWeek.slides.some(s => s.main_title || s.subtitle);
        if (hasSlides) {
          let targetPost = await prisma.posts.findFirst({
            where: {
              hub_id: targetHub.id,
              platform: 'instagram',
              insta_type: 'carousel',
            }
          });
          if (!targetPost) {
            targetPost = await prisma.posts.create({
              data: {
                hub_id: targetHub.id,
                platform: 'instagram',
                insta_type: 'carousel',
                body_text: `Instagram carousel for Week ${parsedWeek.week_number}: ${parsedWeek.theme_title}`,
                status: 'pending_review'
              }
            });
          }
          targetInstagramPostId = targetPost.id;
          await handleUpsertPostAndSlides(targetInstagramPostId, parsedWeek.slides);
          importedInstagram = true;
        }

        // 2. Telegram posts
        if (parsedWeek.telegram_posts && parsedWeek.telegram_posts.length > 0) {
          await prisma.posts.deleteMany({
            where: {
              hub_id: targetHub.id,
              platform: 'telegram',
            }
          });
          for (const post of parsedWeek.telegram_posts) {
            const scheduledAt = resolveScheduledDate(parsedWeek.week_number, post.day, post.timeStr);
            await prisma.posts.create({
              data: {
                hub_id: targetHub.id,
                platform: 'telegram',
                title: post.title,
                body_text: post.bodyText,
                scheduled_at: scheduledAt,
                status: 'pending_review'
              }
            });
          }
          importedTelegram = true;
        } else if (parsedWeek.telegram_text) {
          await prisma.posts.deleteMany({
            where: {
              hub_id: targetHub.id,
              platform: 'telegram',
            }
          });
          await prisma.posts.create({
            data: {
              hub_id: targetHub.id,
              platform: 'telegram',
              body_text: parsedWeek.telegram_text,
              status: 'pending_review'
            }
          });
          importedTelegram = true;
        }

        // 3. Max posts
        if (parsedWeek.max_posts && parsedWeek.max_posts.length > 0) {
          await prisma.posts.deleteMany({
            where: {
              hub_id: targetHub.id,
              platform: 'max',
            }
          });
          for (const post of parsedWeek.max_posts) {
            const scheduledAt = resolveScheduledDate(parsedWeek.week_number, post.day, post.timeStr);
            await prisma.posts.create({
              data: {
                hub_id: targetHub.id,
                platform: 'max',
                title: post.title,
                body_text: post.bodyText,
                scheduled_at: scheduledAt,
                status: 'pending_review'
              }
            });
          }
          importedMax = true;
        } else if (parsedWeek.max_text) {
          await prisma.posts.deleteMany({
            where: {
              hub_id: targetHub.id,
              platform: 'max',
            }
          });
          await prisma.posts.create({
            data: {
              hub_id: targetHub.id,
              platform: 'max',
              body_text: parsedWeek.max_text,
              status: 'pending_review'
            }
          });
          importedMax = true;
        }
      }
    } else {
      // Single-Week Failsafe — also handles TG/Max-only files uploaded via global button
      // Try to detect week number from title/header of document
      const detectedWeekNumber = detectTgMaxFileWeekNumber(cleanedText);

      if (postId === 'global' && !detectedWeekNumber) {
        throw new Error(
          'В файле не найдено разбиение по неделям и не указан номер недели в заголовке. ' +
          'Убедитесь что файл содержит «Неделя N» в заголовке, или загрузите файл в карточку конкретной недели.'
        );
      }

      let activeWeekNumber: number;
      let activeWeekHubId: string;

      if (postId === 'global') {
        // Global upload with TG/Max-only file that has week number in title
        activeWeekNumber = detectedWeekNumber!;
        let hub = await prisma.weekly_hubs.findFirst({ where: { week_number: activeWeekNumber, project_id: projectId || null } });
        if (!hub) {
          hub = await prisma.weekly_hubs.create({
            data: { week_number: activeWeekNumber, theme_title: `Неделя ${activeWeekNumber}`, project_id: projectId || null }
          });
        }
        activeWeekHubId = hub.id;
      } else {
        const activePost = await prisma.posts.findUnique({
          where: { id: postId },
          include: { weekly_hubs: true }
        });
        if (!activePost) {
          throw new Error(`Пост с ID ${postId} не найден`);
        }
        activeWeekNumber = activePost.weekly_hubs?.week_number || detectedWeekNumber || 1;
        activeWeekHubId = activePost.hub_id;
      }

      const singleParsedWeek = parseWeekBlock(cleanedText, activeWeekNumber);

      // 1. Sync Instagram slides (Carousel) if present
      const hasSlides = singleParsedWeek.slides.some(s => s.main_title || s.subtitle);
      if (hasSlides) {
        let igPost = await prisma.posts.findFirst({
          where: {
            hub_id: activeWeekHubId,
            platform: 'instagram',
            insta_type: 'carousel'
          }
        });
        if (!igPost) {
          igPost = await prisma.posts.create({
            data: {
              hub_id: activeWeekHubId,
              platform: 'instagram',
              insta_type: 'carousel',
              body_text: `Instagram carousel for Week ${activeWeekNumber}`,
              status: 'pending_review'
            }
          });
        }
        await handleUpsertPostAndSlides(igPost.id, singleParsedWeek.slides);
        importedInstagram = true;
      }

      // 2. Sync Telegram Post Text/Posts
      if (singleParsedWeek.telegram_posts && singleParsedWeek.telegram_posts.length > 0) {
        await prisma.posts.deleteMany({
          where: {
            hub_id: activeWeekHubId,
            platform: 'telegram'
          }
        });
        for (const post of singleParsedWeek.telegram_posts) {
          const scheduledAt = resolveScheduledDate(activeWeekNumber, post.day, post.timeStr);
          await prisma.posts.create({
            data: {
              hub_id: activeWeekHubId,
              platform: 'telegram',
              title: post.title,
              body_text: post.bodyText,
              scheduled_at: scheduledAt,
              status: 'pending_review'
            }
          });
        }
        importedTelegram = true;
      } else {
        let tgText = singleParsedWeek.telegram_text;
        if (!tgText && postId !== 'global' && (await prisma.posts.findUnique({ where: { id: postId } }))?.platform === 'telegram') {
          tgText = cleanedText; // fallback to entire file text
        }
        if (tgText) {
          await prisma.posts.deleteMany({
            where: {
              hub_id: activeWeekHubId,
              platform: 'telegram'
            }
          });
          await prisma.posts.create({
            data: {
              hub_id: activeWeekHubId,
              platform: 'telegram',
              body_text: tgText,
              status: 'pending_review'
            }
          });
          importedTelegram = true;
        }
      }

      // 3. Sync Max Post Text/Posts
      if (singleParsedWeek.max_posts && singleParsedWeek.max_posts.length > 0) {
        await prisma.posts.deleteMany({
          where: {
            hub_id: activeWeekHubId,
            platform: 'max'
          }
        });
        for (const post of singleParsedWeek.max_posts) {
          const scheduledAt = resolveScheduledDate(activeWeekNumber, post.day, post.timeStr);
          await prisma.posts.create({
            data: {
              hub_id: activeWeekHubId,
              platform: 'max',
              title: post.title,
              body_text: post.bodyText,
              scheduled_at: scheduledAt,
              status: 'pending_review'
            }
          });
        }
        importedMax = true;
      } else {
        let maxText = singleParsedWeek.max_text;
        if (!maxText && postId !== 'global' && (await prisma.posts.findUnique({ where: { id: postId } }))?.platform === 'max') {
          maxText = cleanedText; // fallback to entire file text
        }
        if (maxText) {
          await prisma.posts.deleteMany({
            where: {
              hub_id: activeWeekHubId,
              platform: 'max'
            }
          });
          await prisma.posts.create({
            data: {
              hub_id: activeWeekHubId,
              platform: 'max',
              body_text: maxText,
              status: 'pending_review'
            }
          });
          importedMax = true;
        }
      }
    }

    // Build highly descriptive success message
    const importedList: string[] = [];
    if (importedInstagram) importedList.push('Карусель Instagram (отправлена на Pillow-отрисовку)');
    if (importedTelegram) importedList.push('Пост Telegram');
    if (importedMax) importedList.push('Пост Max (мессенджер)');

    const finalMessage = importedList.length > 0 
      ? `Контент успешно импортирован verbatim (без ИИ)! Извлечено: ${importedList.join(', ')}`
      : 'Файл успешно обработан, но не содержал распознаваемых данных для импорта.';

    safeRevalidatePath('/admin/content');
    return { success: true, message: finalMessage };
  } catch (error: any) {
    console.error('[ACTIONS] uploadPdfAndExtractSlides error:', error);
    return { success: false, error: error.message };
  }
}

export async function updateCarouselSlide(
  slideId: string,
  data: {
    main_title: string;
    subtitle?: string | null;
    list_items?: string[] | null;
  }
) {
  try {
    // 1. Update the specific slide in the database
    const slide = await prisma.carousel_slides.update({
      where: { id: slideId },
      data: {
        main_title: data.main_title,
        subtitle: data.subtitle || null,
        list_items: data.list_items || [],
      },
    });

    const postId = slide.post_id;

    // 2. Update post status to pending_review and set updated_at
    await prisma.posts.update({
      where: { id: postId },
      data: {
        status: 'pending_review',
        updated_at: new Date(),
      },
    });

    // 3. Fetch all slides for this post to trigger rebuild
    const allSlides = await prisma.carousel_slides.findMany({
      where: { post_id: postId },
      orderBy: { slide_order: 'asc' },
    });

    // 4. Trigger FastAPI Microservice to regenerate carousel assets
    console.log(`[SLIDE UPDATE] Triggering FastAPI carousel generation service for post ${postId}...`);
    try {
      const response = await fetch('http://127.0.0.1:8001/generate-carousel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_id: postId,
          slides: allSlides.map((s) => ({
            slide_layout: s.slide_layout,
            main_title: s.main_title,
            subtitle: s.subtitle || null,
            list_items: s.list_items || [],
          })),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[SLIDE UPDATE] FastAPI service returned error: ${errorText}`);
      } else {
        console.log('[SLIDE UPDATE] FastAPI accepted rendering request.');
        // Update database with the new slide's URL
        const targetSlide = allSlides.find((s) => s.id === slideId);
        if (targetSlide) {
          const url = `/factory/carousels/${postId}/slide_${targetSlide.slide_order}_${targetSlide.slide_layout}.png`;
          await prisma.carousel_slides.update({
            where: { id: slideId },
            data: { generated_slide_url: url }
          });
        }
      }
    } catch (apiErr: any) {
      console.warn(`[SLIDE UPDATE Warning] Could not reach FastAPI: ${apiErr.message}`);
    }

    safeRevalidatePath('/admin/content');
    return { success: true, message: 'Слайд успешно обновлен и отправлен на перерисовку!' };
  } catch (error: any) {
    console.error('[ACTIONS] updateCarouselSlide error:', error);
    return { success: false, error: error.message };
  }
}

export async function updatePostText(postId: string, bodyText: string) {
  try {
    const updatedPost = await prisma.posts.update({
      where: { id: postId },
      data: {
        body_text: bodyText,
        status: 'pending_review', // reset to pending review on manual edits
        updated_at: new Date(),
      },
    });
    
    safeRevalidatePath('/admin/content');
    return { success: true, post: updatedPost };
  } catch (error: any) {
    console.error('[ACTIONS] updatePostText error:', error);
    return { success: false, error: error.message };
  }
}

export async function updatePostExtras(postId: string, telegraphUrl: string | null, pollsData: any) {
  try {
    const updatedPost = await prisma.posts.update({
      where: { id: postId },
      data: {
        telegraph_url: telegraphUrl,
        telegram_polls: pollsData,
        updated_at: new Date(),
      }
    });
    safeRevalidatePath('/admin/content');
    return { success: true, post: updatedPost };
  } catch (error: any) {
    console.error('[ACTIONS] updatePostExtras error:', error);
    return { success: false, error: error.message };
  }
}


export async function updatePostChatId(postId: string, targetChatId: string) {
  try {
    const updatedPost = await prisma.posts.update({
      where: { id: postId },
      data: {
        target_chat_id: targetChatId,
        updated_at: new Date(),
      },
    });
    safeRevalidatePath('/admin/content');
    return { success: true, post: updatedPost };
  } catch (error) {
    console.error('[ACTIONS] updatePostChatId error:', error);
    return { success: false, error: 'Failed to update target chat ID.' };
  }
}

export async function updatePostTitle(postId: string, title: string) {
  try {
    const updatedPost = await prisma.posts.update({
      where: { id: postId },
      data: {
        title: title,
        updated_at: new Date(),
      },
    });
    
    safeRevalidatePath('/[locale]/admin/content');
    return { success: true, post: updatedPost };
  } catch (error: any) {
    console.error('[ACTIONS] updatePostTitle error:', error);
    return { success: false, error: error.message };
  }
}

export async function updatePostSchedule(postId: string, scheduledAt: Date | null) {
  try {
    const updatedPost = await prisma.posts.update({
      where: { id: postId },
      data: {
        scheduled_at: scheduledAt,
        updated_at: new Date(),
      },
    });
    
    safeRevalidatePath('/admin/content');
    return { success: true, post: updatedPost };
  } catch (error: any) {
    console.error('[ACTIONS] updatePostSchedule error:', error);
    return { success: false, error: error.message };
  }
}

export async function uploadPostImage(postId: string, formData: FormData) {
  try {
    const file = formData.get('file') as File | null;
    if (!file || file.size === 0) {
      throw new Error("Файл не найден");
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${postId}-${Date.now()}.${fileExt}`;
    const mediaDir = '/opt/Ergomarket_content_factory/longevity-portal/public/media';

    // Save directly to local server filesystem
    const { writeFileSync } = require('fs');
    const { join } = require('path');
    const buffer = Buffer.from(await file.arrayBuffer());
    writeFileSync(join(mediaDir, fileName), buffer);

    const publicUrl = `/factory/media/${fileName}`;

    // Save to database
    await prisma.posts.update({
      where: { id: postId },
      data: { selected_image: publicUrl }
    });

    safeRevalidatePath('/[locale]/admin/content');
    return { success: true, url: publicUrl };
  } catch (error: any) {
    console.error('[uploadPostImage] error:', error);
    return { success: false, error: error.message };
  }
}


export async function createVideoUploadUrl(postId: string, fileName: string) {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data, error } = await supabaseAdmin.storage
      .from('content-images')
      .createSignedUploadUrl(fileName);

    if (error) throw new Error(error.message);
    
    return { success: true, signedUrl: data.signedUrl, token: data.token, path: data.path };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function confirmVideoUpload(postId: string, fileName: string) {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data } = supabaseAdmin.storage
      .from('content-images')
      .getPublicUrl(fileName);

    await prisma.posts.update({
      where: { id: postId },
      data: { selected_image: data.publicUrl }
    });

    safeRevalidatePath('/[locale]/admin/content');
    return { success: true, url: data.publicUrl };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function uploadPostButtonFile(postId: string, formData: FormData) {
  try {
    const file = formData.get('file') as File | null;
    if (!file || file.size === 0) {
      throw new Error("Файл не найден");
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `btn-file-${postId}-${Date.now()}.${fileExt}`;
    const mediaDir = '/opt/Ergomarket_content_factory/longevity-portal/public/media';

    // Save directly to local server filesystem
    const { writeFileSync } = require('fs');
    const { join } = require('path');
    const buffer = Buffer.from(await file.arrayBuffer());
    writeFileSync(join(mediaDir, fileName), buffer);

    // Build public URL served by the Next.js app
    const publicUrl = `/factory/media/${fileName}`;

    return { success: true, url: publicUrl };
  } catch (error: any) {
    console.error('[uploadPostButtonFile] error:', error);
    return { success: false, error: error.message };
  }
}


export async function syncGoogleDrive() {
  try {
    const { execSync } = require('child_process');
    console.log('[ACTIONS] Manual trigger of Google Drive sync started...');
    
    // Execute python script manually
    const output = execSync('/opt/taskbot/venv/bin/python3 /opt/Ergomarket_content_factory/longevity-portal/scripts/import-from-gdrive.py', {
      encoding: 'utf8'
    });
    
    console.log('[ACTIONS] Manual Google Drive sync output:', output);
    safeRevalidatePath('/[locale]/admin/content');
    
    if (output.includes('Successfully imported')) {
      // Find the success message in output
      const match = output.match(/Successfully imported (.*?)!/);
      const msg = match ? match[0] : 'Импорт завершен успешно!';
      return { success: true, message: msg };
    }
    
    if (output.includes('has already been imported')) {
      return { success: true, message: 'Все файлы с Google Диска уже импортированы ранее.' };
    }
    
    if (output.includes('No JSON files found')) {
      return { success: true, message: 'JSON файлы в папке Google Диска не найдены.' };
    }
    
    return { success: true, message: 'Проверка завершена. Детали в логах сервера.', output };
  } catch (error: any) {
    console.error('[ACTIONS] syncGoogleDrive error:', error);
    return { success: false, error: error.message || 'Ошибка выполнения скрипта импорта.' };
  }
}

