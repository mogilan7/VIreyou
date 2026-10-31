import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
    let url = (process.env.DATABASE_URL || '').trim();
    if (url) {
        if (!url.includes('connection_limit=')) {
            url = url + (url.includes('?') ? '&' : '?') + 'connection_limit=5';
        }
        if (!url.includes('pool_timeout=')) {
            url = url + (url.includes('?') ? '&' : '?') + 'pool_timeout=20';
        }
        if (!url.includes('pgbouncer=true') && (url.includes(':6543') || url.includes('pooler.supabase.com'))) {
            url = url + (url.includes('?') ? '&' : '?') + 'pgbouncer=true';
        }
    }
    if (typeof window === 'undefined') {
        const host = url.split('@')[1]?.split(':')[0] || 'unknown';
        const port = url.split(':')[3]?.split('/')[0] || 'unknown';
        console.log(`[PRISMA INIT] Database Host: ${host}, Port: ${port}`);
    }
    return new PrismaClient({
        datasourceUrl: url,
    });
};

declare global {
    var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prisma ?? prismaClientSingleton();

// Middleware for DomainBaseline invalidation
prisma.$use(async (params, next) => {
    const result = await next(params);
    
    const logModels: Record<string, string> = {
      SleepLog: 'sleep',
      ActivityLog: 'activity',
      HydrationLog: 'hydration',
      NutritionLog: 'nutrition',
      HabitEpisode: 'habits'
    };
  
    if (params.model && logModels[params.model]) {
      const action = params.action;
      if (['create', 'update', 'delete', 'upsert', 'createMany', 'updateMany', 'deleteMany'].includes(action)) {
         const domain = logModels[params.model];
         let userIds = new Set<string>();
         
         // Extract userId from result if possible
         if (Array.isArray(result)) {
           result.forEach(r => { if (r && r.user_id) userIds.add(r.user_id) });
         } else if (result && result.user_id) {
           userIds.add(result.user_id);
         }
         
         // Fallback to args if result doesn't have it (e.g. deleteMany)
         if (userIds.size === 0 && params.args) {
            if (params.args.where?.user_id) userIds.add(params.args.where.user_id);
            else if (params.args.data?.user_id) userIds.add(params.args.data.user_id);
         }
  
         for (const uid of userIds) {
           if (typeof uid === 'string') {
               prisma.domainBaseline.updateMany({
                 where: { userId: uid, domain },
                 data: { is_outdated: true }
               }).catch(err => console.error(`[PRISMA MIDDLEWARE] Failed to invalidate baseline for ${uid}:`, err));
           }
         }
      }
    }
    
    return result;
});

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;
