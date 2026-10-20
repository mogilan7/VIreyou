/**
 * Утилита однократной авторизации YouTube Analytics API
 * Запускает локальный сервер на http://localhost:8989/oauth2callback,
 * генерирует ссылку для авторизации и сохраняет YOUTUBE_REFRESH_TOKEN в .env.local
 */

import * as http from 'http';
import * as url from 'url';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { google } from 'googleapis';

const envLocalPath = path.resolve(__dirname, '../.env.local');
dotenv.config({ path: envLocalPath });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const clientId = process.env.YOUTUBE_CLIENT_ID;
const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
const port = 8989;
const redirectUri = `http://localhost:${port}/oauth2callback`;

if (!clientId || !clientSecret) {
    console.error(`
[YOUTUBE AUTH] ОШИБКА: Не заданы YOUTUBE_CLIENT_ID или YOUTUBE_CLIENT_SECRET в .env.local.

Чтобы настроить:
1. Перейдите в Google Cloud Console: https://console.cloud.google.com/
2. Создайте проект или выберите существующий.
3. Включите API:
   - YouTube Analytics API
   - YouTube Data API v3
4. Перейдите в "OAuth consent screen" (Экран согласия OAuth):
   - User Type: Внешний (External)
   - Добавьте свой Google-аккаунт в Test Users (Тестовые пользователи).
5. Перейдите в "Credentials" (Учетные данные) -> "Create Credentials" -> "OAuth client ID":
   - Application type: Web application
   - Authorized redirect URIs: http://localhost:8989/oauth2callback
6. Скопируйте Client ID и Client Secret в .env.local:
   YOUTUBE_CLIENT_ID=ваш_client_id
   YOUTUBE_CLIENT_SECRET=ваш_client_secret
`);
    process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
);

const scopes = [
    'https://www.googleapis.com/auth/yt-analytics.readonly',
    'https://www.googleapis.com/auth/youtube.readonly'
];

const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent' // Принудительно запрашивать consent для получения refresh_token
});

console.log('\n======================================================');
console.log('🔗 Для авторизации откройте эту ссылку в браузере:');
console.log('======================================================\n');
console.log(authUrl);
console.log('\nОжидание ответа от браузера на http://localhost:8989/oauth2callback ...\n');

const server = http.createServer(async (req, res) => {
    try {
        const parsedUrl = url.parse(req.url || '', true);
        if (parsedUrl.pathname === '/oauth2callback') {
            const code = parsedUrl.query.code as string;
            if (!code) {
                res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end('<h2>Ошибка: Код авторизации не получен.</h2>');
                return;
            }

            const { tokens } = await oauth2Client.getToken(code);
            const refreshToken = tokens.refresh_token;

            if (!refreshToken) {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end('<h2>Внимание: Refresh token не был возвращен. Возможно, доступ уже был предоставлен ранее. Попробуйте еще раз с параметром prompt=consent или удалите приложение в безопасности Google-аккаунта.</h2>');
                console.warn('[YOUTUBE AUTH] Refresh token не получен (Google отдал только access token).');
                server.close();
                return;
            }

            // Save to .env.local
            let envContent = fs.existsSync(envLocalPath) ? fs.readFileSync(envLocalPath, 'utf8') : '';
            if (envContent.includes('YOUTUBE_REFRESH_TOKEN=')) {
                envContent = envContent.replace(/YOUTUBE_REFRESH_TOKEN=.*(\r?\n|$)/g, `YOUTUBE_REFRESH_TOKEN=${refreshToken}\n`);
            } else {
                envContent += `\nYOUTUBE_REFRESH_TOKEN=${refreshToken}\n`;
            }
            fs.writeFileSync(envLocalPath, envContent, 'utf8');

            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<h1>✅ Авторизация YouTube Analytics успешно завершена!</h1><p>Refresh token сохранен в .env.local. Можете закрыть эту вкладку.</p>');

            console.log('✅ [YOUTUBE AUTH] Успех! YOUTUBE_REFRESH_TOKEN успешно сохранен в .env.local.');
            setTimeout(() => {
                server.close();
                process.exit(0);
            }, 1000);
        }
    } catch (err: any) {
        console.error('[YOUTUBE AUTH] Ошибка при обмене кода на токен:', err);
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h2>Ошибка сервера: ${err?.message || err}</h2>`);
    }
});

server.listen(port);
