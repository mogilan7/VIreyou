import { createNavigation } from 'next-intl/navigation';

const { redirect } = createNavigation({
    locales: ['en', 'ru'],
    defaultLocale: 'en'
});

try {
    redirect({ href: '/cabinet', locale: 'ru' });
} catch (err: any) {
    console.log("CAUGHT ERROR:", err);
    console.log("KEYS:", Object.keys(err));
    console.log("MESSAGE:", err.message);
    console.log("DIGEST:", err.digest);
    if (err.digest) {
        console.log("DIGEST STARTS WITH NEXT_REDIRECT:", err.digest.startsWith('NEXT_REDIRECT'));
    }
}
