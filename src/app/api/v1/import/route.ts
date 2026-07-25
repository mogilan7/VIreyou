import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Reference Start Date in UTC: Monday, June 1, 2026
function resolveScheduledDate(weekNumber: number, dayOfWeek: string, timeStr: string): Date | null {
  try {
    const baseMonday = new Date(Date.UTC(2026, 5, 1));
    
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

    baseMonday.setUTCDate(baseMonday.getUTCDate() + (weekNumber - 1) * 7 + dayOffset);

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
    console.error('[API resolveScheduledDate] error:', err);
    return null;
  }
}

interface PostInput {
  platform: 'telegram' | 'max';
  postNumber: number;
  day: string;
  time: string;
  title: string;
  bodyText: string;
  polls?: any;
  telegraph_url?: string;
  insta_type?: string;
  carousel_slides?: any[];
}

interface ImportRequest {
  apiKey: string;
  projectId?: string;
  createNewProject?: boolean;
  newProjectName?: string;
  weekNumber: number;
  weekTitle: string;
  posts: PostInput[];
}

export async function POST(req: Request) {
  try {
    const body: ImportRequest = await req.json();
    const { apiKey, projectId, weekNumber, weekTitle, posts } = body;

    // 1. Authenticate using static key for safety or Supabase service role
    const systemApiKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const isStaticKeyValid = apiKey === 'VPNTaskbot!2026';
    const isServiceKeyValid = systemApiKey && apiKey === systemApiKey;

    if (!isStaticKeyValid && !isServiceKeyValid) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Invalid API Key.' }, { status: 401 });
    }

    if (!weekNumber) {
      return NextResponse.json({ success: false, error: 'weekNumber is required' }, { status: 400 });
    }

    if (!posts || !Array.isArray(posts)) {
      return NextResponse.json({ success: false, error: 'posts array is required' }, { status: 400 });
    }

    // 2. Resolve Project
    let targetProjectId = projectId;
    if (!targetProjectId) {
      if (body.newProjectName) {
        const existingProj = await prisma.projects.findFirst({
          where: { name: body.newProjectName }
        });
        if (existingProj) {
          targetProjectId = existingProj.id;
        } else if (body.createNewProject) {
          const newProj = await prisma.projects.create({
            data: { name: body.newProjectName }
          });
          targetProjectId = newProj.id;
        }
      }
      
      if (!targetProjectId) {
        const latestProject = await prisma.projects.findFirst({
          orderBy: { created_at: 'desc' }
        });
        if (latestProject) {
          targetProjectId = latestProject.id;
        } else {
          // Fallback: create a default project if none exists
          const defaultProj = await prisma.projects.create({
            data: { name: 'Default Project' }
          });
          targetProjectId = defaultProj.id;
        }
      }
    }

    // 3. Find or Create Weekly Hub
    let hub = await prisma.weekly_hubs.findFirst({
      where: {
        week_number: weekNumber,
        project_id: targetProjectId
      }
    });

    if (!hub) {
      hub = await prisma.weekly_hubs.create({
        data: {
          week_number: weekNumber,
          theme_title: weekTitle || `Неделя ${weekNumber}`,
          project_id: targetProjectId
        }
      });
    } else if (weekTitle) {
      // Update title if provided
      hub = await prisma.weekly_hubs.update({
        where: { id: hub.id },
        data: { theme_title: weekTitle }
      });
    }

    // 4. Delete old posts for platforms present in the incoming payload
    const incomingPlatforms = Array.from(new Set(posts.map((p: any) => p.platform)));
    await prisma.posts.deleteMany({
      where: {
        hub_id: hub.id,
        platform: { in: incomingPlatforms }
      }
    });

    // 5. Create new posts
    const createdPosts = [];
    for (const post of posts) {
      const scheduledAt = resolveScheduledDate(weekNumber, post.day, post.time);
      const newPost = await prisma.posts.create({
        data: {
          hub_id: hub.id,
          platform: post.platform,
          insta_type: post.insta_type || null,
          title: post.title || `Пост ${post.postNumber}`,
          body_text: post.bodyText,
          telegram_polls: post.polls ? JSON.parse(JSON.stringify(post.polls)) : null,
          telegraph_url: post.telegraph_url || null,
          scheduled_at: scheduledAt,
          status: 'pending_review',
          ...(post.carousel_slides && Array.isArray(post.carousel_slides) ? {
            carousel_slides: {
              create: post.carousel_slides.map((slide: any) => ({
                slide_order: slide.slide_order,
                slide_layout: slide.slide_layout,
                main_title: slide.main_title || null,
                subtitle: slide.subtitle || null,
                list_items: slide.list_items || []
              }))
            }
          } : {})
        }
      });
      createdPosts.push(newPost);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${createdPosts.length} posts for Week ${weekNumber} (${weekTitle})`,
      hubId: hub.id,
      importedCount: createdPosts.length
    });

  } catch (err: any) {
    console.error('[API import] error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
