'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import {
  Instagram,
  Send,
  MessageSquare,
  BookOpen,
  RefreshCw,
  Check,
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Eye,
  Loader2,
  Tv,
  FileText,
  CheckCircle,
  Smartphone,
  ExternalLink,
  ChevronDown,
  Upload,
  Edit,
  X,
  Download,
  ZoomIn,
  Play,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import toast, { Toaster } from 'react-hot-toast';
import {
  getWeeklyHubsWithPosts,
  updatePostStatus,
  retriggerCarousel,
  publishPost,
  uploadPdfAndExtractSlides,
  updateCarouselSlide,
  updatePostText,
  updatePostExtras,
  updatePostSchedule,
  uploadPostImage,
  deletePostImage,
  uploadPostButtonFile,
  updatePostTitle,
  createVideoUploadUrl,
  confirmVideoUpload,
  getProjects,
  createProject,
  syncGoogleDrive,
  generateCarouselSlides,
  generateMissingImages,
  updatePostChatId
} from '@/app/actions/admin-content';

interface Project {
  id: string;
  name: string;
  created_at: string;
}

interface CarouselSlide {
  id: string;
  slide_order: number;
  slide_layout: 'cover' | 'thesis' | 'list' | 'antithesis' | 'final';
  main_title: string | null;
  subtitle: string | null;
  list_items: string[];
  generated_slide_url: string | null;
}

interface VeoVideoAsset {
  id: string;
  scene_order: number;
  duration_seconds: number | null;
  english_prompt: string;
  storage_url: string | null;
}

interface PublicationLog {
  id: string;
  external_post_id: string | null;
  published_at: string;
  error_message: string | null;
}

interface Post {
  id: string;
  hub_id: string;
  platform: 'instagram' | 'telegram' | 'max';
  insta_type: 'reel' | 'carousel' | 'post' | 'stories' | null;
  title: string | null;
  body_text: string;
  hook_text: string | null;
  hashtags: string[];
  status: 'draft' | 'pending_review' | 'ready_for_review' | 'approved' | 'published' | 'failed';
  scheduled_at: string | null;
  updated_at?: string | Date | null;
  carousel_slides: CarouselSlide[];
  veo_video_assets: VeoVideoAsset[];
  publication_logs: PublicationLog[];
  telegram_polls?: any;
  telegraph_url?: string | null;
}

interface WeeklyHub {
  id: string;
  week_number: number;
  theme_title: string;
  posts: Post[];
}

export default function AdminContentPage() {
  const params = useParams();
  const locale = params.locale as string || 'ru';
  
  const [hubs, setHubs] = useState<WeeklyHub[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  
  const [selectedHubIndex, setSelectedHubIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [telegramChats, setTelegramChats] = useState<{ [postId: string]: string }>({});
  const [maxChats, setMaxChats] = useState<{ [postId: string]: string }>({}); 
  const [activeTab, setActiveTab] = useState<'all' | 'instagram' | 'telegram' | 'max'>('all');
  const [zoomSlide, setZoomSlide] = useState<string | null>(null);
  const [activeCarouselSlideIdx, setActiveCarouselSlideIdx] = useState<{ [postId: string]: number }>({});
  const [showArchitecture, setShowArchitecture] = useState(true);
  const [showGlobalUpload, setShowGlobalUpload] = useState(false);
  const [pdfUploading, setPdfUploading] = useState<{ [postId: string]: boolean }>({});
  const [pdfUploadProgress, setPdfUploadProgress] = useState<{ [postId: string]: string }>({});
  const [showPdfUpload, setShowPdfUpload] = useState<{ [postId: string]: boolean }>({});
  const [dragOver, setDragOver] = useState<{ [postId: string]: boolean }>({});
  const [playingVideos, setPlayingVideos] = useState<{ [postId: string]: boolean }>({});

  // Slide editing state hooks
  const [editingSlideId, setEditingSlideId] = useState<string | null>(null);
  const [editMainTitle, setEditMainTitle] = useState<string>('');
  const [editSubtitle, setEditSubtitle] = useState<string>('');
  const [editListItems, setEditListItems] = useState<string[]>([]);
  const [isSavingSlide, setIsSavingSlide] = useState<boolean>(false);

  // Post text editing state hooks
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editPostBody, setEditPostBody] = useState<string>('');
  const [editPostTitle, setEditPostTitle] = useState<string>('');
  const [editTelegraphUrl, setEditTelegraphUrl] = useState<string>('');
  const [editPolls, setEditPolls] = useState<{question: string, options: string[]}[]>([]);
  const [isSavingPost, setIsSavingPost] = useState<boolean>(false);
  
  const [reelVideoProgress, setReelVideoProgress] = useState<{ [postId: string]: number | null }>({});

  const handleReelVideoUpload = async (postId: string, file: File) => {
    if (!file.type.startsWith('video/')) {
      toast.error('Пожалуйста, загрузите видео (MP4, MOV)');
      return;
    }
    
    setReelVideoProgress(prev => ({ ...prev, [postId]: 0 }));
    
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${postId}-video-${Date.now()}.${ext}`;
      
      const { success, signedUrl, path, error } = await createVideoUploadUrl(postId, fileName);
      if (!success) {
        throw new Error(error || 'Ошибка получения ссылки для загрузки');
      }

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            setReelVideoProgress(prev => ({ ...prev, [postId]: percent }));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.response);
          } else {
            let msg = 'Ошибка загрузки в хранилище';
            try { msg = JSON.parse(xhr.responseText).message || msg; } catch(err){}
            reject(new Error(msg));
          }
        };
        xhr.onerror = () => reject(new Error('Сетевая ошибка при загрузке напрямую'));
        
        xhr.open('PUT', signedUrl, true);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      const confirmRes = await confirmVideoUpload(postId, path);
      if (confirmRes.success) {
        toast.success('Видео успешно загружено!');
        await loadData(true);
      } else {
        throw new Error(confirmRes.error || 'Ошибка подтверждения загрузки');
      }
      
    } catch (e: any) {
      console.error('[ReelVideoUpload] Upload Error:', e);
      toast.error(`Ошибка: ${e?.message || e}`);
    } finally {
      setReelVideoProgress(prev => ({ ...prev, [postId]: null }));
    }
  };

  // Instagram Post photo upload state
  const [igPostPhoto, setIgPostPhoto] = useState<{ [postId: string]: string | null }>({});
  const [igPhotoDragOver, setIgPhotoDragOver] = useState<{ [postId: string]: boolean }>({});
  const [igPhotoUploading, setIgPhotoUploading] = useState<{ [postId: string]: boolean }>({});

  const handleIgPhotoUpload = async (postId: string, file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Пожалуйста, загрузите изображение (JPG, PNG, WEBP)');
      return;
    }
    setIgPhotoUploading(prev => ({ ...prev, [postId]: true }));
    
    // Optimistic update for immediate feedback
    const reader = new FileReader();
    reader.onload = (e) => {
      setIgPostPhoto(prev => ({ ...prev, [postId]: e.target?.result as string }));
    };
    reader.readAsDataURL(file);

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await uploadPostImage(postId, formData);
      if (res.success && res.url) {
        setIgPostPhoto(prev => ({ ...prev, [postId]: res.url }));
        toast.success('Фото успешно сохранено!');
      } else {
        toast.error(res.error || 'Ошибка сохранения фото на сервере');
        setIgPostPhoto(prev => ({ ...prev, [postId]: null })); // Revert
      }
    } catch (e: any) {
      toast.error('Ошибка сети при сохранении фото');
      setIgPostPhoto(prev => ({ ...prev, [postId]: null })); // Revert
    } finally {
      setIgPhotoUploading(prev => ({ ...prev, [postId]: false }));
    }
  };

  const handleIgPhotoDelete = async (postId: string) => {
    setIgPostPhoto(prev => ({ ...prev, [postId]: null }));
    const res = await deletePostImage(postId);
    if (!res.success) {
      toast.error('Не удалось удалить фото с сервера');
    }
  };

  const handlePostFileUpload = async (postId: string, file: File) => {
    if (!file) return;
    setPdfUploading((prev) => ({ ...prev, [postId]: true }));
    setPdfUploadProgress((prev) => ({ ...prev, [postId]: 'Загрузка...' }));

    try {
      const formData = new FormData();
      formData.append('file', file);

      setPdfUploadProgress((prev) => ({ ...prev, [postId]: 'Сохранение...' }));
      const res = await uploadPostImage(postId, formData);

      if (res.success && res.url) {
        toast.success('Обложка поста успешно загружена!');
        await loadData(true);
      } else {
        toast.error(res.error || 'Ошибка загрузки обложки.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Ошибка сети при загрузке.');
    } finally {
      setPdfUploading((prev) => ({ ...prev, [postId]: false }));
      setPdfUploadProgress((prev) => ({ ...prev, [postId]: '' }));
    }
  };

  const handlePostFileDelete = async (postId: string) => {
    const res = await deletePostImage(postId);
    if (res.success) {
      toast.success('Обложка удалена');
      await loadData(true);
    } else {
      toast.error(res.error || 'Не удалось удалить обложку');
    }
  };

  const handleInlineButtonFileUpload = async (postId: string, file: File) => {
    if (!file) return;
    setPdfUploading((prev) => ({ ...prev, [postId]: true }));
    setPdfUploadProgress((prev) => ({ ...prev, [postId]: 'Загрузка файла...' }));

    try {
      const formData = new FormData();
      formData.append('file', file);

      setPdfUploadProgress((prev) => ({ ...prev, [postId]: 'Сохранение файла...' }));
      const res = await uploadPostButtonFile(postId, formData);

      if (res.success && res.url) {
        const fileUrl = res.url;
        
        // Find current post in state to get the current body text
        const currentPost = hubs.flatMap(h => h.posts).find(p => p.id === postId);
        if (currentPost) {
          const currentText = currentPost.body_text || '';
          
          // Regex to check if a button with FILE is already there
          const btnRegex = /(\[\[BTN:\s*([^\s|][^|]*?)\s*\|\s*MSG:\s*([^\s|][^|]*?))(?:\s*\|\s*FILE:\s*([^\s\]]+))?\s*\]\]/i;
          
          let newText = '';
          if (btnRegex.test(currentText)) {
            // Replace existing file URL
            newText = currentText.replace(btnRegex, (match, prefix, label, msg) => {
              return `${prefix} | FILE: ${fileUrl}]]`;
            });
          } else {
            // Append a new button
            newText = currentText + `\n\n[[BTN: Скачать файл | MSG: Файл успешно отправлен! | FILE: ${fileUrl}]]`;
          }

          const updateRes = await updatePostText(postId, newText);
          if (updateRes.success) {
            toast.success('Файл успешно прикреплен к кнопке!');
          } else {
            toast.error(updateRes.error || 'Файл загружен, но не удалось обновить текст поста.');
          }
        } else {
          toast.error('Пост не найден в текущем состоянии.');
        }
        setShowPdfUpload((prev) => ({ ...prev, [postId]: false }));
        await loadData(true);
      } else {
        toast.error(res.error || 'Ошибка при загрузке файла.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Ошибка сети.');
    } finally {
      setPdfUploading((prev) => ({ ...prev, [postId]: false }));
      setPdfUploadProgress((prev) => ({ ...prev, [postId]: '' }));
    }
  };


  const startEditingPost = (post: any) => {
    setEditingPostId(post.id);
    setEditPostBody(post.body_text || '');
    setEditPostTitle(post.title || '');
    setEditTelegraphUrl(post.telegraph_url || '');
    if (post.telegram_polls && Array.isArray(post.telegram_polls)) {
      setEditPolls(post.telegram_polls);
    } else if (post.telegram_polls && typeof post.telegram_polls === 'object') {
      setEditPolls([post.telegram_polls]);
    } else {
      setEditPolls([]);
    }
  };

  // Moscow Time zone offset (UTC+3) formatting helpers
  const getLocalDateStringMSK = (dateStr: string | null) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Moscow',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      return formatter.format(d);
    } catch (e) {
      return '';
    }
  };

  const getLocalTimeStringMSK = (dateStr: string | null) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const formatter = new Intl.DateTimeFormat('ru-RU', {
        timeZone: 'Europe/Moscow',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      return formatter.format(d);
    } catch (e) {
      return '';
    }
  };

  const formatMSKDateTime = (dateStr: string | null) => {
    if (!dateStr) return 'Не запланирован';
    try {
      const d = new Date(dateStr);
      const formatter = new Intl.DateTimeFormat('ru-RU', {
        timeZone: 'Europe/Moscow',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      return `${formatter.format(d)} МСК`;
    } catch (e) {
      return 'Некорректная дата';
    }
  };

  // Scheduling state hooks
  const [editScheduleId, setEditScheduleId] = useState<string | null>(null);
  const [editScheduleDate, setEditScheduleDate] = useState<string>('');
  const [editScheduleTime, setEditScheduleTime] = useState<string>('');
  const [isSavingSchedule, setIsSavingSchedule] = useState<boolean>(false);

  const startEditingSchedule = (post: Post) => {
    setEditScheduleId(post.id);
    setEditScheduleDate(getLocalDateStringMSK(post.scheduled_at));
    setEditScheduleTime(getLocalTimeStringMSK(post.scheduled_at) || '08:30');
  };

  const handleSaveSchedule = async (postId: string) => {
    if (!editScheduleDate || !editScheduleTime) {
      toast.error('Пожалуйста, выберите дату и время');
      return;
    }
    setIsSavingSchedule(true);
    const dateObj = new Date(`${editScheduleDate}T${editScheduleTime}:00+03:00`);
    
    // Optimistic UI update
    setHubs(prev => prev.map(hub => ({
      ...hub,
      posts: hub.posts.map(p => p.id === postId ? { ...p, scheduled_at: dateObj.toISOString() } : p)
    })));
    setEditScheduleId(null);
    
    const toastId = toast.loading('Сохранение времени публикации...');
    try {
      const res = await updatePostSchedule(postId, dateObj);
      if (res.success) {
        toast.success('Время публикации успешно обновлено!', { id: toastId });
        // We skip loadData() here to avoid race conditions with server cache.
        // The optimistic update handles the UI, and the 60s poller will eventually sync it.
      } else {
        toast.error(res.error || 'Не удалось обновить расписание.', { id: toastId });
        await loadData(true); // Revert on error
      }
    } catch (err: any) {
      toast.error(err.message || 'Ошибка обновления расписания.', { id: toastId });
      await loadData(true); // Revert on error
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const applyFormat = (prefix: string, suffix: string = '') => {
    if (!editingPostId) return;
    const textarea = document.getElementById(`editor-textarea-${editingPostId}`) as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);

    let replacement = '';
    if (prefix === '>') {
      replacement = `> ${selectedText || 'Цитата'}`;
    } else if (prefix === '>>') {
      replacement = `>> ${selectedText || 'Скрываемая цитата'}`;
    } else if (prefix === 'link') {
      const url = prompt('Введите URL ссылки:', 'https://');
      if (url === null) return; // Prompt cancelled
      replacement = `[${selectedText || 'ссылка'}](${url})`;
    } else {
      replacement = `${prefix}${selectedText || 'текст'}${suffix}`;
    }

    const newValue = text.substring(0, start) + replacement + text.substring(end);
    setEditPostBody(newValue);

    // Refocus textarea and reselect the formatted text
    setTimeout(() => {
      textarea.focus();
      const newCursorStart = start + (prefix === 'link' ? 1 : prefix.length);
      const newCursorEnd = newCursorStart + (selectedText ? selectedText.length : (prefix === 'link' ? 6 : replacement.length - prefix.length - (prefix === 'link' ? 0 : suffix.length)));
      textarea.setSelectionRange(newCursorStart, newCursorEnd);
    }, 50);
  };

  const handleSavePost = async (postId: string) => {
    setIsSavingPost(true);
    const toastId = toast.loading('Сохранение изменений...');
    try {
      const res = await updatePostText(postId, editPostBody);
      const resTitle = await updatePostTitle(postId, editPostTitle);
      
      const parsedPollData = editPolls
        .map(p => ({
          question: p.question,
          options: p.options.filter(o => o.trim() !== '')
        }))
        .filter(p => p.question.trim() !== '' && p.options.length > 1);
      
      const pollData = parsedPollData.length > 0 ? parsedPollData : null;
      const resExtras = await updatePostExtras(postId, editTelegraphUrl || null, pollData);

      if (res.success && resTitle.success && resExtras.success) {
        toast.success('Текст поста сохранен!', { id: toastId });
        setEditingPostId(null);
        await loadData(true);
      } else {
        toast.error(res.error || 'Не удалось сохранить текст.', { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || 'Ошибка сохранения текста.', { id: toastId });
    } finally {
      setIsSavingPost(false);
    }
  };

  const startEditingSlide = (slide: CarouselSlide) => {
    setEditingSlideId(slide.id);
    setEditMainTitle(slide.main_title || '');
    setEditSubtitle(slide.subtitle || '');
    setEditListItems(slide.list_items || []);
  };

  const handleSaveSlide = async (slideId: string) => {
    setIsSavingSlide(true);
    const toastId = toast.loading('Сохранение слайда и перерисовка карусели...');
    try {
      const res = await updateCarouselSlide(slideId, {
        main_title: editMainTitle,
        subtitle: editSubtitle || null,
        list_items: editListItems,
      });

      if (res.success) {
        toast.success('Слайд сохранен! Карусель обновляется в фоне...', { id: toastId });
        setEditingSlideId(null);
        await loadData(true);
      } else {
        toast.error(res.error || 'Не удалось сохранить изменения.', { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || 'Ошибка сохранения слайда.', { id: toastId });
    } finally {
      setIsSavingSlide(false);
    }
  };

  const loadData = async (silent = false, specificProjectId: string | null = selectedProjectId) => {
    if (!silent) setLoading(true);
    
    // Always fetch projects initially if we haven't yet
    let currentProjects = projects;
    if (projects.length === 0) {
      const projRes = await getProjects();
      if (projRes.success && projRes.projects) {
        currentProjects = projRes.projects as unknown as Project[];
        setProjects(currentProjects);
      }
    }

    const res = await getWeeklyHubsWithPosts(specificProjectId || undefined);
    if (res.success && res.hubs) {
      setHubs(res.hubs as unknown as WeeklyHub[]);
      if (res.currentProjectId && !specificProjectId) {
        setSelectedProjectId(res.currentProjectId);
      } else if (specificProjectId) {
        setSelectedProjectId(specificProjectId);
      }
    } else {
      toast.error(res.error || 'Failed to load content pipeline drafts.');
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    loadData();
    
    // Poll status updates every 60 seconds to reduce heavy rendering
    const interval = setInterval(() => {
      if (selectedProjectId) {
        loadData(true, selectedProjectId);
      }
    }, 60000);
    
    return () => clearInterval(interval);
  }, [selectedProjectId]);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      toast.error('Введите название проекта');
      return;
    }
    const res = await createProject(newProjectName);
    if (res.success && res.project) {
      toast.success('Проект создан');
      setProjects([res.project as unknown as Project, ...projects]);
      setSelectedProjectId(res.project.id);
      setIsCreatingProject(false);
      setNewProjectName('');
      await loadData(false, res.project.id);
    } else {
      toast.error(res.error || 'Ошибка при создании проекта');
    }
  };

  const handleStatusChange = async (postId: string, newStatus: Post['status']) => {
    setActionLoading(postId + '_status');
    
    // Optimistic UI update
    setHubs(prev => prev.map(hub => ({
      ...hub,
      posts: hub.posts.map(p => p.id === postId ? { ...p, status: newStatus } : p)
    })));

    const res = await updatePostStatus(postId, newStatus);
    if (res.success) {
      toast.success(`Post status updated to ${newStatus}`);
      // Skip immediate loadData() to avoid pulling stale data before cache fully clears
    } else {
      toast.error(res.error || 'Failed to update status.');
      await loadData(true); // Revert on error
    }
    setActionLoading(null);
  };

  const handleRetriggerCarousel = async (postId: string) => {
    setActionLoading(postId + '_retrigger');
    toast.loading('Starting slide rendering service...', { id: postId });
    const res = await retriggerCarousel(postId);
    if (res.success) {
      toast.success('Regeneration successfully enqueued. Slides will update in 10-15s.', { id: postId });
      await loadData(true);
    } else {
      toast.error(res.error || 'Failed to start regeneration.', { id: postId });
    }
    setActionLoading(null);
  };

  const handleDownloadCarousel = async (post: Post) => {
    if (!post.carousel_slides || post.carousel_slides.length === 0) return;
    const toastId = toast.loading('Скачивание слайдов...');
    try {
      let downloadedCount = 0;
      for (let i = 0; i < post.carousel_slides.length; i++) {
        const slide = post.carousel_slides[i];
        if (slide.generated_slide_url) {
          // Fetch the image to trigger download via object URL (bypasses some popup blockers and forces download instead of open in new tab)
          const response = await fetch(slide.generated_slide_url);
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = `carousel_slide_${i + 1}.png`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          downloadedCount++;
          // Small delay to prevent browser from missing downloads
          await new Promise(r => setTimeout(r, 400));
        }
      }
      if (downloadedCount > 0) {
        toast.success(`Скачано слайдов: ${downloadedCount}`, { id: toastId });
      } else {
        toast.error('Нет готовых слайдов для скачивания', { id: toastId });
      }
    } catch (error) {
      toast.error('Ошибка при скачивании', { id: toastId });
    }
  };

  const handleSyncGoogleDrive = async () => {
    setActionLoading('gdrive_sync');
    const toastId = toast.loading('Проверка новых файлов на Google Диске...');
    try {
      const res = await syncGoogleDrive();
      if (res.success) {
        toast.success(res.message || 'Импорт завершен успешно!', { id: toastId });
        await loadData(true);
      } else {
        toast.error(res.error || 'Ошибка при синхронизации.', { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || 'Произошла непредвиденная ошибка.', { id: toastId });
    } finally {
      setActionLoading(null);
    }
  };

  const handlePublish = async (postId: string, platform?: string) => {
    setActionLoading(postId + '_publish');
    let chatId: string | undefined;
    
    // Find the post to get its current target_chat_id
    const post = hubs.flatMap(h => h.posts).find(p => p.id === postId);
    
    if (platform === 'max') {
      chatId = maxChats[postId] ?? post?.target_chat_id ?? '-75708478796476';
    } else {
      chatId = telegramChats[postId] ?? post?.target_chat_id ?? '@ergomarket38';
    }
    
    toast.loading('Publishing content live...', { id: postId + '_pub' });
    
    const res = await publishPost(postId, chatId);
    if (res.success) {
      toast.success(res.message || 'Post published successfully!', { id: postId + '_pub' });
      await loadData(true);
    } else {
      toast.error(res.error || 'Failed to publish post.', { id: postId + '_pub' });
    }
    setActionLoading(null);
  };

  const handlePdfUpload = async (postId: string, file: File) => {
    if (!file) return;
    const isPdf = file.name.endsWith('.pdf') || file.type === 'application/pdf';
    const isTxt = file.name.endsWith('.txt') || file.name.endsWith('.md') || file.type.startsWith('text/');
    
    if (!isPdf && !isTxt) {
      toast.error('Пожалуйста, выберите файл в формате PDF, TXT или MD');
      return;
    }

    setPdfUploading((prev) => ({ ...prev, [postId]: true }));
    setPdfUploadProgress((prev) => ({ ...prev, [postId]: 'Чтение файла...' }));

    try {
      const formData = new FormData();
      formData.append('file', file);

      setPdfUploadProgress((prev) => ({ ...prev, [postId]: 'Разбор бриф-файла...' }));
      
      const res = await uploadPdfAndExtractSlides(postId, formData, selectedProjectId || undefined);

      if (res.success) {
        setPdfUploadProgress((prev) => ({ ...prev, [postId]: 'Отрисовка карусели (Pillow)...' }));
        toast.success(res.message || 'Слайды успешно извлечены и отправлены на отрисовку!');
        
        // Wait a small moment to let rendering start, then load new data
        setTimeout(async () => {
          await loadData(true);
          if (postId === 'global') {
            setShowGlobalUpload(false);
          } else {
            setShowPdfUpload((prev) => ({ ...prev, [postId]: false }));
          }
        }, 2000);
      } else {
        toast.error(res.error || 'Произошла ошибка при обработке файла.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Ошибка загрузки файла.');
    } finally {
      setPdfUploading((prev) => ({ ...prev, [postId]: false }));
      setPdfUploadProgress((prev) => ({ ...prev, [postId]: '' }));
    }
  };

  const handleDragOver = (e: React.DragEvent, postId: string) => {
    e.preventDefault();
    setDragOver((prev) => ({ ...prev, [postId]: true }));
  };

  const handleDragLeave = (e: React.DragEvent, postId: string) => {
    e.preventDefault();
    setDragOver((prev) => ({ ...prev, [postId]: false }));
  };

  const handleDrop = async (e: React.DragEvent, postId: string) => {
    e.preventDefault();
    setDragOver((prev) => ({ ...prev, [postId]: false }));
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await handlePdfUpload(postId, files[0]);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#F7F5F0] dark:bg-slate-950 text-[#2D2D2D] dark:text-slate-100 font-sans">
        <Loader2 className="h-12 w-12 animate-spin text-[#60B76F]" />
        <p className="mt-4 font-serif text-lg italic text-[#244131] dark:text-[#89CB8F]">
          Loading Ergomarket Content Dashboard...
        </p>
      </div>
    );
  }

  const currentHub = hubs[selectedHubIndex];

  // Helper to format character length for Max (Messenger)
  const getTweetLength = (post: Post) => {
    let fullText = post.body_text;
    if (post.hashtags && post.hashtags.length > 0) {
      const visibleTags = post.hashtags.filter((h) => !h.startsWith('__chat_id:'));
      if (visibleTags.length > 0) {
        fullText += ' ' + visibleTags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ');
      }
    }
    return fullText.length;
  };

  const getStatusBadge = (status: Post['status']) => {
    switch (status) {
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-800 dark:bg-slate-800 dark:text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
            Черновик
          </span>
        );
      case 'pending_review':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/30 dark:text-amber-300 animate-pulse">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Генерация ИИ
          </span>
        );
      case 'ready_for_review':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
            Готов к ревью
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#60B76F]/10 px-2.5 py-0.5 text-xs font-semibold text-[#60B76F] dark:bg-[#60B76F]/20">
            <span className="h-1.5 w-1.5 rounded-full bg-[#60B76F]" />
            Одобрено
          </span>
        );
      case 'published':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            Опубликовано
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            Ошибка
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F5F0] dark:bg-[#0b0f19] text-[#2D2D2D] dark:text-slate-200 font-sans pb-24 transition-colors duration-300">
      <Toaster position="bottom-right" />
      
      {/* Top Premium Header */}
      <header className="border-b border-[#DDE5E0] dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md sticky top-0 z-30 transition-colors">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#244131] text-[#F7F5F0]">
                <Sparkles className="h-4.5 w-4.5" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight font-serif text-[#244131] dark:text-[#89CB8F]">
                Ergomarket Content Pipeline
              </h1>
            </div>
            
            {/* Project Selector & Creator */}
            <div className="mt-2 flex items-center gap-3">
              {isCreatingProject ? (
                <div className="flex items-center gap-2">
                  <input 
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Название проекта (например: Май 2026)"
                    className="border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-[#60B76F]"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                  />
                  <button onClick={handleCreateProject} className="text-xs font-bold text-white bg-[#60B76F] px-2 py-1 rounded hover:bg-[#4ea35d]">Сохранить</button>
                  <button onClick={() => setIsCreatingProject(false)} className="text-xs text-gray-500 hover:text-gray-700">Отмена</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <select
                    value={selectedProjectId || ''}
                    onChange={(e) => {
                      setSelectedProjectId(e.target.value);
                      setSelectedHubIndex(0);
                    }}
                    className="border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm font-medium rounded-lg px-3 py-1.5 outline-none cursor-pointer focus:ring-1 focus:ring-[#60B76F]"
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                    {projects.length === 0 && <option value="">Загрузка проектов...</option>}
                  </select>
                  <button 
                    onClick={() => setIsCreatingProject(true)}
                    className="text-xs font-medium text-[#60B76F] hover:text-[#4ea35d] underline underline-offset-2"
                  >
                    + Новый проект
                  </button>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Premium Google Drive Sync Button */}
            <button
              onClick={handleSyncGoogleDrive}
              disabled={actionLoading === 'gdrive_sync'}
              className="flex items-center gap-2 bg-[#244131] hover:bg-[#1a3024] text-white text-xs font-bold px-3 py-2 rounded-xl transition shadow-sm border border-[#244131]/20 disabled:opacity-50 dark:bg-slate-800 dark:hover:bg-slate-700"
            >
              {actionLoading === 'gdrive_sync' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Синхронизация Google Диск
            </button>

            {/* Premium Global Import Button */}
            <button
              onClick={() => setShowGlobalUpload(!showGlobalUpload)}
              className="flex items-center gap-2 bg-[#60B76F] hover:bg-[#4ea35d] text-white dark:text-[#0b0f19] text-xs font-bold px-3 py-2 rounded-xl transition shadow-sm border border-[#60B76F]/20"
            >
              <Upload className="h-3.5 w-3.5" />
              Импорт контент-плана (PDF / TXT)
            </button>

            {/* Week Selector Pills */}
            <div className="flex flex-wrap gap-1 bg-gray-100 dark:bg-slate-800/60 p-1 rounded-xl">
              {hubs.map((hub, idx) => (
                <button
                  key={hub.id}
                  onClick={() => {
                    setSelectedHubIndex(idx);
                    setActiveCarouselSlideIdx({});
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    selectedHubIndex === idx
                      ? 'bg-[#244131] text-white shadow-sm dark:bg-[#60B76F] dark:text-[#0b0f19]'
                      : 'text-gray-600 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  Неделя {hub.week_number}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-8">

        {/* Beautiful Glassmorphic Global Multi-Week Upload Dropzone */}
        {showGlobalUpload && (
          <div className="mb-8 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-3xl p-8 border-2 border-dashed border-[#60B76F]/50 dark:border-[#60B76F]/30 relative overflow-hidden transition-all duration-300 shadow-md">
            <button
              onClick={() => setShowGlobalUpload(false)}
              className="absolute top-4 right-4 text-xs font-bold px-3 py-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 bg-white/80 dark:bg-slate-800/80 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 transition"
            >
              Закрыть
            </button>

            <div
              onDragOver={(e) => handleDragOver(e, 'global')}
              onDragLeave={(e) => handleDragLeave(e, 'global')}
              onDrop={(e) => handleDrop(e, 'global')}
              className={`w-full rounded-2xl flex flex-col items-center justify-center p-8 text-center transition-all ${
                dragOver['global'] ? 'bg-[#60B76F]/5 dark:bg-[#60B76F]/10 scale-[1.01]' : ''
              }`}
            >
              {pdfUploading['global'] ? (
                <div className="flex flex-col items-center justify-center">
                  <div className="relative flex items-center justify-center h-16 w-16 mb-4">
                    <span className="absolute animate-ping h-10 w-10 rounded-full bg-[#60B76F]/20 opacity-75" />
                    <Loader2 className="h-12 w-12 animate-spin text-[#60B76F] relative z-10" />
                  </div>
                  <h4 className="text-base font-semibold text-[#244131] dark:text-[#89CB8F] animate-pulse">
                    Импорт контент-плана
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-2 font-medium bg-gray-100 dark:bg-slate-800/80 px-4 py-1.5 rounded-full shadow-inner">
                    {pdfUploadProgress['global'] || 'Загрузка...'}
                  </p>
                </div>
              ) : (
                <label className="cursor-pointer flex flex-col items-center w-full justify-center">
                  <input
                    type="file"
                    accept=".pdf,.txt,.md"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        await handlePdfUpload('global', file);
                      }
                    }}
                  />
                  <div className="h-16 w-16 rounded-full bg-[#60B76F]/10 dark:bg-[#60B76F]/20 flex items-center justify-center mb-4 transition-transform hover:scale-110">
                    <Upload className="h-7 w-7 text-[#60B76F]" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-700 dark:text-slate-200 font-serif leading-snug">
                    Импорт месячного контент-плана (PDF / TXT)
                  </h3>
                  <p className="text-sm text-gray-400 dark:text-slate-400 mt-2 max-w-lg leading-relaxed">
                    Перетащите сюда бриф-файл, содержащий одну или несколько недель с разделителями ═════.
                    Система автоматически распознает недели, создаст хабы и заполнит карусели 100% дословно без ИИ.
                  </p>
                  <div className="mt-5 inline-flex items-center gap-2 text-[10px] font-bold text-[#244131] dark:text-[#89CB8F] bg-[#60B76F]/10 dark:bg-[#60B76F]/20 px-3 py-1.5 rounded-lg tracking-wider">
                    БЕЗ ИИ • ДОСЛОВНЫЙ РАЗБОР • PILLOW RENDER
                  </div>
                </label>
              )}
            </div>
          </div>
        )}
        
        {/* Weekly Hub Hub Header Card */}
        {currentHub && (
          <div className="bg-gradient-to-br from-[#244131] to-[#122219] rounded-3xl p-6 sm:p-8 text-[#F7F5F0] shadow-xl relative overflow-hidden mb-8">
            <div className="absolute right-0 bottom-0 opacity-10 translate-x-12 translate-y-12">
              <Sparkles className="h-64 w-64" />
            </div>
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <span className="text-[#60B76F] font-bold text-xs uppercase tracking-wider block mb-1">
                  Тематический Хаб • Неделя {currentHub.week_number}
                </span>
                <h2 className="text-2xl sm:text-3xl font-serif font-semibold tracking-wide">
                  {currentHub.theme_title}
                </h2>
                <div className="flex items-center gap-4 mt-4 text-xs text-[#DDE5E0]">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-[#60B76F]" />
                    Июнь 2026 г.
                  </span>
                  <span>•</span>
                  <span>{currentHub.posts.length} Готовых постов для 3 каналов</span>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => loadData(false)}
                  disabled={loading}
                  className="flex items-center gap-2 bg-[#F7F5F0]/10 hover:bg-[#F7F5F0]/20 text-white text-xs font-semibold px-4 py-2.5 rounded-xl border border-white/10 transition"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                  Синхронизировать
                </button>
              </div>
            </div>
          </div>
        )}


        {/* Filters and Tabs */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-2 border-b border-[#DDE5E0] dark:border-slate-800 pb-2 w-full">
            <button
              onClick={() => setActiveTab('all')}
              className={`pb-2 px-1 text-sm font-semibold border-b-2 transition-all ${
                activeTab === 'all'
                  ? 'border-[#244131] text-[#244131] dark:border-[#60B76F] dark:text-[#60B76F]'
                  : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-slate-400'
              }`}
            >
              Все посты
            </button>
            <button
              onClick={() => setActiveTab('instagram')}
              className={`pb-2 px-1 text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === 'instagram'
                  ? 'border-[#244131] text-[#244131] dark:border-[#60B76F] dark:text-[#60B76F]'
                  : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-slate-400'
              }`}
            >
              <Instagram className="h-4 w-4" />
              Instagram
            </button>
            <button
              onClick={() => setActiveTab('telegram')}
              className={`pb-2 px-1 text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === 'telegram'
                  ? 'border-[#244131] text-[#244131] dark:border-[#60B76F] dark:text-[#60B76F]'
                  : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-slate-400'
              }`}
            >
              <Send className="h-4 w-4" />
              Telegram
            </button>
            <button
              onClick={() => setActiveTab('max')}
              className={`pb-2 px-1 text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === 'max'
                  ? 'border-[#244131] text-[#244131] dark:border-[#60B76F] dark:text-[#60B76F]'
                  : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-slate-400'
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              Max (Мессенджер)
            </button>
          </div>
        </div>

        {/* Content Stream (Dynamic Grid) */}
        {currentHub && currentHub.posts && (
          <div className="grid grid-cols-1 gap-8">
            {currentHub.posts
              .filter((post) => {
                if (activeTab === 'all') return true;
                if (activeTab === 'instagram') return post.platform === 'instagram';
                if (activeTab === 'telegram') return post.platform === 'telegram';
                if (activeTab === 'max') return post.platform === 'max';
                return true;
              })
              .sort((a, b) => {
                const dateA = a.scheduled_at ? new Date(a.scheduled_at).getTime() : Infinity;
                const dateB = b.scheduled_at ? new Date(b.scheduled_at).getTime() : Infinity;
                if (dateA !== dateB) {
                  return dateA - dateB;
                }
                const platCompare = a.platform.localeCompare(b.platform);
                if (platCompare !== 0) return platCompare;
                return (a.title || '').localeCompare(b.title || '');
              })
              .map((post) => {
                const activeSlideIdx = activeCarouselSlideIdx[post.id] || 0;
                
                return (
                  <div
                    key={post.id}
                    className="bg-white dark:bg-slate-900 border border-[#DDE5E0] dark:border-slate-800/80 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition duration-300"
                  >
                    
                    {/* Post Card Header */}
                    <div className="border-b border-[#DDE5E0] dark:border-slate-800/80 px-6 py-4 bg-gray-50/50 dark:bg-slate-900/30 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span
                          className={`h-9 w-9 rounded-xl flex items-center justify-center text-white ${
                            post.platform === 'instagram'
                              ? 'bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600'
                              : post.platform === 'telegram'
                              ? 'bg-[#229ED9]'
                              : 'bg-emerald-600 dark:bg-emerald-800'
                          }`}
                        >
                          {post.platform === 'instagram' ? (
                            <Instagram className="h-4.5 w-4.5" />
                          ) : post.platform === 'telegram' ? (
                            <Send className="h-4.5 w-4.5" />
                          ) : (
                            <MessageSquare className="h-4.5 w-4.5" />
                          )}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm tracking-wide capitalize text-[#244131] dark:text-[#89CB8F]">
                              {post.platform === 'instagram'
                                ? `Instagram ${
                                    post.insta_type === 'reel' ? 'Reel'
                                    : post.insta_type === 'carousel' ? 'Carousel'
                                    : post.insta_type === 'stories' ? 'Stories'
                                    : 'Post'
                                  }`
                                : post.platform}
                            </span>
                            {getStatusBadge(post.status)}
                          </div>
                          {post.title && (
                            <h3 className="text-xs text-gray-500 dark:text-slate-400 font-semibold truncate max-w-sm mt-0.5">
                              {post.title}
                            </h3>
                          )}
                        </div>
                      </div>

                      {/* Moderation & Publishing Actions */}
                      <div className="flex items-center gap-2">
                        {post.status === 'ready_for_review' && (
                          <button
                            onClick={() => handleStatusChange(post.id, 'approved')}
                            disabled={actionLoading !== null}
                            className="bg-[#60B76F] hover:bg-[#60B76F]/90 text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Одобрить
                          </button>
                        )}
                        
                        {post.status !== 'published' ? (
                          <button
                            onClick={() => handlePublish(post.id, post.platform)}
                            disabled={actionLoading !== null}
                            className="bg-[#244131] dark:bg-[#60B76F] hover:bg-[#244131]/90 dark:hover:bg-[#60B76F]/90 text-white dark:text-[#0b0f19] text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Опубликовать
                          </button>
                        ) : (
                          <button
                            onClick={() => handlePublish(post.id, post.platform)}
                            disabled={actionLoading !== null}
                            className="bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Опубликовать повторно
                          </button>
                        )}

                        <div className="relative group">
                          <button className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer">
                            <ChevronDown className="h-4 w-4" />
                          </button>
                          {/* Removed mt-1 and added pt-2 to avoid gap losing hover state */}
                          <div className="absolute right-0 pt-2 w-48 z-20 hidden group-hover:block">
                            <div className="rounded-xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700/80 shadow-lg py-1">
                              <button
                                onClick={() => handleStatusChange(post.id, 'draft')}
                                className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 dark:text-slate-300 dark:hover:bg-slate-700/60 cursor-pointer"
                              >
                                В черновик
                              </button>
                              <button
                                onClick={() => handleStatusChange(post.id, 'ready_for_review')}
                                className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 dark:text-slate-300 dark:hover:bg-slate-700/60 cursor-pointer"
                              >
                                Готов к ревью
                              </button>
                              <button
                                onClick={() => handleStatusChange(post.id, 'approved')}
                                className="w-full text-left px-4 py-2 text-xs text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/30 cursor-pointer"
                              >
                                Одобрить
                              </button>
                              <button
                                onClick={() => handleStatusChange(post.id, 'failed')}
                                className="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/20 cursor-pointer"
                              >
                                Сбросить статус
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Post Card Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-12">
                      
                      {/* Left: Metadata and Text Content */}
                      <div className={`p-6 sm:p-8 ${
                        post.insta_type === 'stories' ? 'lg:col-span-12'
                        : 'lg:col-span-7'
                      }`}>
                        
                        {/* Premium Moscow Time Scheduling Widget */}
                        {editScheduleId === post.id ? (
                          <div className="mb-6 bg-white/80 dark:bg-slate-900/80 border border-[#60B76F]/40 dark:border-[#60B76F]/30 p-4 rounded-2xl shadow-md w-full transition-all duration-300">
                            <div className="flex items-center gap-1.5 mb-3 pb-2 border-b border-gray-100 dark:border-slate-800">
                              <Calendar className="h-4 w-4 text-[#60B76F] animate-pulse" />
                              <span className="text-xs font-bold text-[#244131] dark:text-[#89CB8F] uppercase tracking-wide">
                                Планирование поста (МСК / UTC+3)
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-4 items-end">
                              <div className="flex-1 min-w-[140px]">
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-1">
                                  Дата (МСК)
                                </label>
                                <input
                                  type="date"
                                  value={editScheduleDate}
                                  onChange={(e) => setEditScheduleDate(e.target.value)}
                                  className="w-full bg-gray-50 dark:bg-slate-800 text-xs rounded-xl p-2.5 border border-gray-250 dark:border-slate-700/80 text-gray-800 dark:text-slate-200 focus:outline-none focus:border-[#60B76F] focus:ring-1 focus:ring-[#60B76F] font-sans"
                                />
                              </div>
                              <div className="flex-1 min-w-[100px]">
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-1">
                                  Время (МСК)
                                </label>
                                <input
                                  type="time"
                                  value={editScheduleTime}
                                  onChange={(e) => setEditScheduleTime(e.target.value)}
                                  className="w-full bg-gray-50 dark:bg-slate-800 text-xs rounded-xl p-2.5 border border-gray-250 dark:border-slate-700/80 text-gray-800 dark:text-slate-200 focus:outline-none focus:border-[#60B76F] focus:ring-1 focus:ring-[#60B76F] font-sans"
                                />
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleSaveSchedule(post.id)}
                                  disabled={isSavingSchedule}
                                  className="bg-[#244131] dark:bg-[#60B76F] hover:bg-[#244131]/90 dark:hover:bg-[#60B76F]/90 text-white dark:text-[#0b0f19] text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition disabled:opacity-50 cursor-pointer"
                                >
                                  {isSavingSchedule ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Check className="h-3.5 w-3.5" />
                                  )}
                                  Сохранить
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditScheduleId(null)}
                                  disabled={isSavingSchedule}
                                  className="bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 text-xs font-semibold px-4 py-2.5 rounded-xl transition cursor-pointer"
                                >
                                  Отмена
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="mb-6 flex flex-wrap items-center gap-3 bg-white/40 dark:bg-slate-800/20 backdrop-blur-sm border border-gray-150 dark:border-slate-800/80 p-3 rounded-2xl">
                            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 flex items-center gap-1.5">
                              <Calendar className="h-4 w-4 text-[#60B76F]" />
                              Время публикации:
                            </span>
                            <span className="text-xs font-bold text-[#244131] dark:text-[#89CB8F] bg-[#60B76F]/10 dark:bg-[#60B76F]/20 px-3 py-1 rounded-xl">
                              {formatMSKDateTime(post.scheduled_at)}
                            </span>
                            <button
                              type="button"
                              onClick={() => startEditingSchedule(post)}
                              className="text-xs font-bold text-[#60B76F] hover:text-[#60B76F]/80 flex items-center gap-1 transition ml-auto cursor-pointer"
                            >
                              <Edit className="h-3.5 w-3.5" />
                              {post.scheduled_at ? 'Изменить' : 'Запланировать'}
                            </button>
                          </div>
                        )}

                        {/* Title and Hook */}
                        {post.title && (
                          <h4 className="text-lg font-serif font-semibold text-[#244131] dark:text-[#89CB8F] mb-2">
                            {post.title}
                          </h4>
                        )}
                        {post.hook_text && (
                          <div className="mb-4 bg-[#F7F5F0]/50 dark:bg-slate-800/40 border-l-4 border-[#60B76F] p-3 rounded-r-xl">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 block mb-1">
                              Hook Text (Лид-абзац)
                            </span>
                            <p className="text-sm italic font-medium">{post.hook_text}</p>
                          </div>
                        )}

                        {/* Main Body */}
                        {editingPostId === post.id ? (
                          <div className="flex flex-col gap-3 mt-2 bg-white/70 dark:bg-slate-900/50 p-4 rounded-2xl border border-[#DDE5E0] dark:border-slate-800/80 shadow-sm backdrop-blur-md">
                            
                            {/* Title Edit */}
                            <div className="mb-2">
                              <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 mb-1">Заголовок / Тема поста</label>
                              <input
                                type="text"
                                value={editPostTitle}
                                onChange={(e) => setEditPostTitle(e.target.value)}
                                className="w-full text-sm font-semibold bg-white dark:bg-slate-800 border border-[#DDE5E0] dark:border-slate-700 rounded-lg p-2 focus:ring-2 focus:ring-[#60B76F] focus:border-[#60B76F] outline-none text-gray-900 dark:text-white"
                                placeholder="Название поста"
                              />
                            </div>

                            {/* Formatting Toolbar */}
                            <div className="flex flex-wrap gap-1 pb-3 border-b border-[#DDE5E0] dark:border-slate-800/80">
                              <button
                                type="button"
                                onClick={() => applyFormat('**', '**')}
                                className="px-2 py-1 text-xs font-bold rounded bg-gray-100 hover:bg-[#60B76F] hover:text-white dark:bg-slate-800 transition-all cursor-pointer"
                                title="Жирный (**текст**)"
                              >
                                <b>Ж</b>
                              </button>
                              <button
                                type="button"
                                onClick={() => applyFormat('*', '*')}
                                className="px-2 py-1 text-xs font-bold rounded bg-gray-100 hover:bg-[#60B76F] hover:text-white dark:bg-slate-800 transition-all cursor-pointer"
                                title="Курсив (*текст*)"
                              >
                                <i>К</i>
                              </button>
                              <button
                                type="button"
                                onClick={() => applyFormat('__', '__')}
                                className="px-2 py-1 text-xs font-bold rounded bg-gray-100 hover:bg-[#60B76F] hover:text-white dark:bg-slate-800 transition-all cursor-pointer"
                                title="Подчеркнутый (__текст__)"
                              >
                                <u>Ч</u>
                              </button>
                              <button
                                type="button"
                                onClick={() => applyFormat('~~', '~~')}
                                className="px-2 py-1 text-xs font-bold rounded bg-gray-100 hover:bg-[#60B76F] hover:text-white dark:bg-slate-800 transition-all cursor-pointer"
                                title="Зачеркнутый (~~текст~~)"
                              >
                                <s>З</s>
                              </button>
                              <span className="w-[1px] h-5 bg-[#DDE5E0] dark:bg-slate-800/80 mx-1 align-self-center" />
                              <button
                                type="button"
                                onClick={() => applyFormat('||', '||')}
                                className="px-2.5 py-1 text-xs font-semibold rounded bg-gray-100 hover:bg-[#60B76F] hover:text-white dark:bg-slate-800 transition-all cursor-pointer"
                                title="Спойлер (||текст||)"
                              >
                                Спойлер
                              </button>
                              <button
                                type="button"
                                onClick={() => applyFormat('`', '`')}
                                className="px-2.5 py-1 text-xs font-mono rounded bg-gray-100 hover:bg-[#60B76F] hover:text-white dark:bg-slate-800 transition-all cursor-pointer"
                                title="Код (`код`)"
                              >
                                `Код`
                              </button>
                              <button
                                type="button"
                                onClick={() => applyFormat('```\n', '\n```')}
                                className="px-2.5 py-1 text-xs font-mono rounded bg-gray-100 hover:bg-[#60B76F] hover:text-white dark:bg-slate-800 transition-all cursor-pointer"
                                title="Блок кода (```код```)"
                              >
                                ```Блок```
                              </button>
                              <span className="w-[1px] h-5 bg-[#DDE5E0] dark:bg-slate-800/80 mx-1 align-self-center" />
                              <button
                                type="button"
                                onClick={() => applyFormat('> ')}
                                className="px-2.5 py-1 text-xs font-semibold rounded bg-gray-100 hover:bg-[#60B76F] hover:text-white dark:bg-slate-800 transition-all cursor-pointer"
                                title="Цитата (> цитата)"
                              >
                                Цитата
                              </button>
                              <button
                                type="button"
                                onClick={() => applyFormat('>> ')}
                                className="px-2.5 py-1 text-xs font-semibold rounded bg-gray-100 hover:bg-[#60B76F] hover:text-white dark:bg-slate-800 transition-all cursor-pointer"
                                title="Скрываемая цитата (>> скрываемая цитата)"
                              >
                                Скрытая цит.
                              </button>
                              <button
                                type="button"
                                onClick={() => applyFormat('link')}
                                className="px-2.5 py-1 text-xs font-semibold rounded bg-gray-100 hover:bg-[#60B76F] hover:text-white dark:bg-slate-800 transition-all cursor-pointer"
                                title="Ссылка [текст](url)"
                              >
                                Ссылка
                              </button>
                            </div>

                            {/* Textarea */}
                            <textarea
                              id={`editor-textarea-${post.id}`}
                              value={editPostBody}
                              onChange={(e) => setEditPostBody(e.target.value)}
                              rows={12}
                              className="w-full text-sm font-sans bg-transparent text-[#2D2D2D] dark:text-slate-200 border-0 focus:outline-none focus:ring-0 resize-y whitespace-pre-wrap leading-relaxed focus:ring-transparent focus:border-transparent outline-none p-1"
                              placeholder="Напишите текст поста с использованием Markdown..."
                            />

                            {/* Telegraph Link */}
                            {(post.platform === 'telegram' || post.platform === 'max') && (
                              <div className="mt-4 mb-2">
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-1">
                                  Ссылка Telegraph (опционально)
                                </label>
                                <input
                                  type="text"
                                  value={editTelegraphUrl}
                                  onChange={(e) => setEditTelegraphUrl(e.target.value)}
                                  placeholder="https://telegra.ph/..."
                                  className="w-full bg-gray-50 dark:bg-slate-800 text-xs rounded-lg p-2 border border-gray-200 dark:border-slate-700/80 text-gray-800 dark:text-slate-200 focus:outline-none focus:border-[#60B76F] focus:ring-1 focus:ring-[#60B76F] font-sans"
                                />
                              </div>
                            )}

                            {/* Polls (Telegram only) */}
                            {post.platform === 'telegram' && (
                              <div className="mt-4 mb-4">
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#244131] dark:text-[#89CB8F] mb-2 flex justify-between items-center">
                                  Опросы (Викторина)
                                  <span className="text-[10px] text-gray-400 font-normal normal-case tracking-normal">Можно добавить несколько опросов</span>
                                </label>
                                
                                {editPolls.map((poll, pIdx) => (
                                  <div key={pIdx} className="mb-4 border border-[#DDE5E0] dark:border-slate-700/80 p-3 rounded-xl bg-white/50 dark:bg-slate-900/50 relative">
                                    <button
                                      type="button"
                                      onClick={() => setEditPolls(editPolls.filter((_, i) => i !== pIdx))}
                                      className="absolute -top-2 -right-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-rose-500 hover:text-rose-600 rounded-full p-1 shadow-sm transition"
                                      title="Удалить опрос"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                    
                                    <div className="mb-2">
                                      <input
                                        type="text"
                                        value={poll.question}
                                        onChange={(e) => {
                                          const newPolls = [...editPolls];
                                          newPolls[pIdx].question = e.target.value;
                                          setEditPolls(newPolls);
                                        }}
                                        placeholder={`Вопрос опроса ${pIdx + 1}...`}
                                        className="w-full bg-gray-50 dark:bg-slate-800 text-xs rounded-lg p-2 border border-gray-200 dark:border-slate-700/80 text-gray-800 dark:text-slate-200 focus:outline-none focus:border-[#60B76F] focus:ring-1 focus:ring-[#60B76F] font-sans"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      {poll.options.map((opt, i) => (
                                        <div key={i} className="flex gap-2">
                                          <input
                                            type="text"
                                            value={opt}
                                            onChange={(e) => {
                                              const newPolls = [...editPolls];
                                              newPolls[pIdx].options[i] = e.target.value;
                                              setEditPolls(newPolls);
                                            }}
                                            placeholder={`Вариант ответа ${i + 1}`}
                                            className="w-full bg-gray-50 dark:bg-slate-800 text-xs rounded-lg p-2 border border-gray-200 dark:border-slate-700/80 text-gray-800 dark:text-slate-200 focus:outline-none focus:border-[#60B76F] focus:ring-1 focus:ring-[#60B76F] font-sans"
                                          />
                                          {poll.options.length > 2 && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const newPolls = [...editPolls];
                                                newPolls[pIdx].options = poll.options.filter((_, idx) => idx !== i);
                                                setEditPolls(newPolls);
                                              }}
                                              className="shrink-0 p-2 text-gray-400 hover:text-rose-500 bg-gray-100 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-900/20 rounded-lg transition"
                                            >
                                              <X className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                        </div>
                                      ))}
                                      {poll.options.length < 10 && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const newPolls = [...editPolls];
                                            newPolls[pIdx].options.push('');
                                            setEditPolls(newPolls);
                                          }}
                                          className="text-[11px] text-[#60B76F] hover:text-[#4CA15A] font-medium block mt-1"
                                        >
                                          + Добавить вариант
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                                
                                <button
                                  type="button"
                                  onClick={() => setEditPolls([...editPolls, { question: '', options: ['', ''] }])}
                                  className="w-full border border-dashed border-[#60B76F]/50 text-[#60B76F] hover:bg-[#60B76F]/5 dark:hover:bg-[#60B76F]/10 rounded-xl p-2 text-[11px] font-medium transition flex items-center justify-center gap-1 mt-2"
                                >
                                  + Добавить опрос
                                </button>
                              </div>
                            )}

                            {/* Controls and character counts */}
                            <div className="flex flex-wrap items-center justify-between pt-3 border-t border-[#DDE5E0] dark:border-slate-800/80">
                              <span className={`text-[11px] font-medium ${
                                post.platform === 'max' && editPostBody.length > 1000 
                                  ? 'text-rose-500 font-semibold' 
                                  : 'text-gray-400 dark:text-slate-400'
                              }`}>
                                Длина: {editPostBody.length} {
                                  post.platform === 'max' ? '/ 1000 символов' : post.platform === 'telegram' ? '/ 4000 символов' : ''
                                }
                              </span>
                              
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingPostId(null)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-gray-700 dark:text-slate-300 transition-all cursor-pointer border border-transparent"
                                >
                                  <X className="h-3 w-3" />
                                  Отмена
                                </button>
                                <button
                                  type="button"
                                  disabled={isSavingPost}
                                  onClick={() => handleSavePost(post.id)}
                                  className="inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-[#60B76F] hover:bg-[#4CA15A] text-white transition-all disabled:opacity-50 cursor-pointer shadow-sm shadow-[#60B76F]/20"
                                >
                                  {isSavingPost ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Check className="h-3 w-3" />
                                  )}
                                  Сохранить
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div>
                            {showPdfUpload[post.id] && (post.platform === 'telegram' || post.platform === 'max') ? (
                              <div className="w-full max-w-lg mb-6">
                                <div
                                  onDragOver={(e) => handleDragOver(e, post.id)}
                                  onDragLeave={(e) => handleDragLeave(e, post.id)}
                                  onDrop={async (e) => {
                                    e.preventDefault();
                                    setDragOver((prev) => ({ ...prev, [post.id]: false }));
                                    const files = e.dataTransfer.files;
                                    if (files && files.length > 0) {
                                      await handleInlineButtonFileUpload(post.id, files[0]);
                                    }
                                  }}
                                  className={`aspect-[4/2.2] w-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-6 text-center transition-all relative overflow-hidden backdrop-blur-sm select-none ${
                                    pdfUploading[post.id]
                                      ? 'bg-white/90 dark:bg-slate-900/90 border-[#60B76F] shadow-inner'
                                      : dragOver[post.id]
                                      ? 'bg-[#60B76F]/5 dark:bg-[#60B76F]/10 border-[#60B76F] scale-[1.02] shadow-md'
                                      : 'bg-white/40 dark:bg-slate-900/40 border-gray-200 dark:border-slate-800 hover:border-[#60B76F]/60 dark:hover:border-[#60B76F]/45 shadow-sm'
                                  }`}
                                >
                                  {!pdfUploading[post.id] && (
                                    <button
                                      onClick={() => setShowPdfUpload((prev) => ({ ...prev, [post.id]: false }))}
                                      className="absolute top-3 right-3 text-[10px] font-bold px-2 py-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 bg-white/80 dark:bg-slate-800/80 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700/80 transition"
                                    >
                                      Отмена
                                    </button>
                                  )}

                                  {pdfUploading[post.id] ? (
                                    <div className="flex flex-col items-center justify-center p-4">
                                      <div className="relative flex items-center justify-center h-10 w-10 mb-2">
                                        <span className="absolute animate-ping h-6 w-6 rounded-full bg-[#60B76F]/20 opacity-75" />
                                        <Loader2 className="h-7 w-7 animate-spin text-[#60B76F] relative z-10" />
                                      </div>
                                      <h4 className="text-xs font-semibold text-[#244131] dark:text-[#89CB8F] animate-pulse">
                                        Загрузка файла...
                                      </h4>
                                      <p className="text-[10px] text-gray-500 dark:text-slate-400 mt-1 font-medium bg-gray-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-full shadow-inner">
                                        {pdfUploadProgress[post.id] || 'Загрузка...'}
                                      </p>
                                    </div>
                                  ) : (
                                    <label className="cursor-pointer flex flex-col items-center w-full h-full justify-center">
                                      <input
                                        type="file"
                                        accept="*/*"
                                        className="hidden"
                                        onChange={async (e) => {
                                          const file = e.target.files?.[0];
                                          if (file) {
                                            await handleInlineButtonFileUpload(post.id, file);
                                          }
                                        }}
                                      />
                                      <div className="h-10 w-10 rounded-full bg-[#60B76F]/10 dark:bg-[#60B76F]/25 flex items-center justify-center mb-2">
                                        <Upload className="h-4 w-4 text-[#60B76F]" />
                                      </div>
                                      <h4 className="text-xs font-bold text-gray-700 dark:text-slate-300 font-serif leading-snug">
                                        Прикрепить файл к инлайн-кнопке
                                      </h4>
                                      <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1 max-w-[240px] leading-relaxed">
                                        Выберите или перетащите любой документ/медиа
                                      </p>
                                    </label>
                                  )}
                                </div>
                              </div>
                            ) : (
                              post.insta_type === 'stories' ? (
                                <div className="w-full flex flex-col gap-3 mb-6">
                                  {(() => {
                                    try {
                                      const storiesData = JSON.parse(post.body_text);
                                      if (!Array.isArray(storiesData) || storiesData.length === 0) {
                                        return <p className="text-sm text-gray-500 italic">Нет данных о сторис. Загрузите PDF.</p>;
                                      }
                                      
                                      return storiesData.map((story: any, idx: number) => {
                                        const isMandatory = story.priority === 'обязательно';
                                        const monthStr = story.month === 5 ? 'мая' : story.month === 6 ? 'июня' : 'месяца';
                                        
                                        return (
                                          <div key={idx} className="flex flex-col sm:flex-row gap-3 sm:items-center bg-gray-50 dark:bg-slate-900/50 rounded-xl p-4 border border-[#DDE5E0] dark:border-slate-800">
                                            {/* Date and Time Column */}
                                            <div className="flex sm:flex-col sm:w-[120px] shrink-0 justify-between sm:justify-start gap-1">
                                              <span className="font-bold text-sm text-[#244131] dark:text-[#89CB8F]">
                                                {story.day} {monthStr}
                                              </span>
                                              <span className="font-mono text-xs text-gray-500 dark:text-slate-400">
                                                {story.time}
                                              </span>
                                            </div>
                                            
                                            {/* Content Column */}
                                            <div className="flex-1">
                                              <p className="text-sm text-gray-800 dark:text-slate-200 leading-relaxed font-sans">
                                                {story.description}
                                              </p>
                                            </div>
                                            
                                            {/* Status / Priority Column */}
                                            <div className="shrink-0 flex items-center">
                                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
                                                isMandatory 
                                                ? 'bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-900/30 dark:border-rose-800/50 dark:text-rose-400' 
                                                : 'bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:border-amber-800/50 dark:text-amber-400'
                                              }`}>
                                                {story.priority}
                                              </span>
                                            </div>
                                          </div>
                                        );
                                      });
                                    } catch (e) {
                                      return <p className="text-sm text-rose-500 bg-rose-50 p-4 rounded-xl">Ошибка отображения JSON-данных сторис.</p>;
                                    }
                                  })()}
                                </div>
                              ) : (
                                <div className="prose max-w-none text-sm text-[#2D2D2D] dark:text-slate-300 font-sans leading-relaxed whitespace-pre-wrap select-text mb-4">
                                  {post.body_text}
                                </div>
                              )
                            )}
                            <div className="flex gap-2 flex-wrap">
                              {/* Text editing for non-stories platforms */}
                              {(post.platform === 'telegram' || post.platform === 'max' || (post.platform === 'instagram' && post.insta_type !== 'stories')) && (
                                <button
                                  type="button"
                                  onClick={() => startEditingPost(post)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 text-[#244131] dark:text-[#89CB8F] border border-[#DDE5E0] dark:border-slate-700/60 hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-all shadow-sm cursor-pointer"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                  Редактировать текст
                                </button>
                              )}
                              
                              {/* Stories PDF upload button */}
                              {post.platform === 'instagram' && post.insta_type === 'stories' && !editingPostId && (
                                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-amber-500 via-pink-500 to-purple-600 text-white cursor-pointer hover:opacity-90 transition-all shadow-sm">
                                  <input
                                    type="file"
                                    accept=".pdf"
                                    className="hidden"
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (file) await handlePdfUpload(post.id, file);
                                    }}
                                  />
                                  <Upload className="h-3.5 w-3.5" />
                                  Загрузить Stories PDF
                                </label>
                              )}

                              {post.platform === 'instagram' && post.insta_type === 'carousel' && !editingPostId && (
                                <button
                                  type="button"
                                  onClick={() => setShowPdfUpload(prev => ({ ...prev, [post.id]: !prev[post.id] }))}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 text-[#244131] dark:text-[#89CB8F] border border-[#DDE5E0] dark:border-slate-700/60 hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-all shadow-sm cursor-pointer"
                                >
                                  <Upload className="h-3.5 w-3.5" />
                                  Загрузить файл (PDF / TXT)
                                </button>
                              )}

                              {(post.platform === 'telegram' || post.platform === 'max') && !editingPostId && (
                                <button
                                  type="button"
                                  onClick={() => setShowPdfUpload(prev => ({ ...prev, [post.id]: !prev[post.id] }))}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 text-[#244131] dark:text-[#89CB8F] border border-[#DDE5E0] dark:border-slate-700/60 hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-all shadow-sm cursor-pointer"
                                >
                                  <Upload className="h-3.5 w-3.5" />
                                  {post.body_text?.includes('FILE:') ? 'Заменить файл на кнопке' : 'Прикрепить файл к кнопке'}
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Hashtags */}
                        {post.hashtags && post.hashtags.filter(t => !t.startsWith('__chat_id:')).length > 0 && (
                          <div className="mt-6 flex flex-wrap gap-1.5">
                            {post.hashtags.filter(t => !t.startsWith('__chat_id:')).map((tag, idx) => (
                              <span
                                key={idx}
                                className="bg-[#60B76F]/5 dark:bg-[#60B76F]/10 text-[#244131] dark:text-[#89CB8F] text-xs font-semibold px-2.5 py-1 rounded-lg border border-[#60B76F]/15 hover:bg-[#60B76F]/10 transition cursor-default"
                              >
                                {tag.startsWith('#') ? tag : `#${tag}`}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Telegram Specific Controls */}
                        {post.platform === 'telegram' && (
                          <div className="mt-8 pt-6 border-t border-[#DDE5E0] dark:border-slate-800/80">
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 mb-2">
                              Направление публикации (Telegram Chat ID)
                            </label>
                            <div className="flex gap-2 max-w-md">
                                <input
                                  type="text"
                                  value={telegramChats[post.id] ?? post.target_chat_id ?? '@ergomarket38'}
                                  onChange={(e) =>
                                    setTelegramChats({ ...telegramChats, [post.id]: e.target.value })
                                  }
                                  onBlur={async () => {
                                    const newChatId = telegramChats[post.id] ?? post.target_chat_id ?? '@ergomarket38';
                                    await updatePostChatId(post.id, newChatId);
                                  }}
                                  placeholder="@ergomarket38"
                                  className="bg-gray-50 dark:bg-slate-800 text-sm font-semibold rounded-xl px-4 py-2 border border-[#DDE5E0] dark:border-slate-700/80 w-full focus:outline-none focus:border-[#60B76F] focus:ring-1 focus:ring-[#60B76F]"
                                />
                            </div>
                            <span className="text-[10px] text-gray-400 mt-1 block">
                              Укажите ID публичного канала или числовой ID приватного чата.
                            </span>
                          </div>
                        )}

                        {/* Max Messenger Specific Controls */}
                        {post.platform === 'max' && (
                          <div className="mt-8 pt-6 border-t border-[#DDE5E0] dark:border-slate-800/80">
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 mb-2">
                              Направление публикации (Max Chat ID)
                            </label>
                            <div className="flex gap-2 max-w-md">
                                <input
                                  type="text"
                                  value={maxChats[post.id] ?? post.target_chat_id ?? '-75708478796476'}
                                  onChange={(e) =>
                                    setMaxChats({ ...maxChats, [post.id]: e.target.value })
                                  }
                                  onBlur={async () => {
                                    const newChatId = maxChats[post.id] ?? post.target_chat_id ?? '-75708478796476';
                                    await updatePostChatId(post.id, newChatId);
                                  }}
                                  placeholder="-75708478796476"
                                  className="bg-gray-50 dark:bg-slate-800 text-sm font-semibold rounded-xl px-4 py-2 border border-[#DDE5E0] dark:border-slate-700/80 w-full focus:outline-none focus:border-[#60B76F] focus:ring-1 focus:ring-[#60B76F]"
                                />
                            </div>
                            <span className="text-[10px] text-gray-400 mt-1 block">
                              Chat ID канала «Эргомаркет» в Max. Можно изменить для другого канала.
                            </span>
                          </div>
                        )}

                        {/* Publication Logs / Result */}
                        {post.publication_logs && post.publication_logs.length > 0 && (
                          <details className="mt-6 pt-6 border-t border-[#DDE5E0] dark:border-slate-800/80 bg-gray-50/30 dark:bg-slate-900/10 p-4 rounded-2xl group">
                            <summary className="text-xs font-bold text-[#244131] dark:text-[#89CB8F] uppercase tracking-wider flex items-center gap-1.5 cursor-pointer outline-none">
                              <CheckCircle className="h-4 w-4 text-[#60B76F]" />
                              Логи публикации
                              <span className="ml-auto text-gray-400 group-open:rotate-180 transition-transform">▼</span>
                            </summary>
                            <div className="mt-4">
                              {post.publication_logs.map((log) => (
                                <div key={log.id} className="text-xs mb-2 last:mb-0">
                                  <div className="flex justify-between text-gray-500 dark:text-slate-400 mb-0.5">
                                    <span>{new Date(log.published_at).toLocaleString('ru-RU')}</span>
                                    {log.external_post_id && (
                                      <span className="font-mono text-[10px] bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                        ID: {log.external_post_id}
                                      </span>
                                    )}
                                  </div>
                                  {log.error_message ? (
                                    <p className="text-rose-600 font-medium">{log.error_message}</p>
                                  ) : (
                                    <p className="text-emerald-600 font-medium">Успешно доставлено в сеть</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>

                      {/* Right: Visual Assets Panel */}
                      {post.insta_type !== 'stories' && (
                        <div className="p-6 sm:p-8 lg:col-span-5 bg-gray-50/50 dark:bg-slate-900/20 border-t lg:border-t-0 lg:border-l border-[#DDE5E0] dark:border-slate-800/80 flex flex-col items-center justify-center min-h-[350px]">
                          
                          {/* Instagram Carousel Slide Previewer */}
                          {post.platform === 'instagram' && post.insta_type === 'carousel' && (
                            <div className="w-full flex flex-col items-center">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 block mb-3 flex items-center gap-1">
                                <BookOpen className="h-3.5 w-3.5 text-[#60B76F]" />
                                Instagram Carousel Preview ({post.carousel_slides.length} слайдов)
                              </span>
                              
                              {(showPdfUpload[post.id] || !post.carousel_slides || post.carousel_slides.length === 0) ? (
                                <div className="w-full max-w-[320px]">
                                  {/* Beautiful Drag & Drop PDF Uploader */}
                                  <div
                                    onDragOver={(e) => handleDragOver(e, post.id)}
                                    onDragLeave={(e) => handleDragLeave(e, post.id)}
                                    onDrop={(e) => handleDrop(e, post.id)}
                                    className={`aspect-[4/5] w-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-6 text-center transition-all relative overflow-hidden backdrop-blur-sm select-none ${
                                      pdfUploading[post.id]
                                        ? 'bg-white/90 dark:bg-slate-900/90 border-[#60B76F] shadow-inner'
                                        : dragOver[post.id]
                                        ? 'bg-[#60B76F]/5 dark:bg-[#60B76F]/10 border-[#60B76F] scale-[1.02] shadow-md'
                                        : 'bg-white/40 dark:bg-slate-900/40 border-gray-200 dark:border-slate-800 hover:border-[#60B76F]/60 dark:hover:border-[#60B76F]/45 shadow-sm'
                                    }`}
                                  >
                                    {/* If post already has slides, allow canceling/closing the upload screen */}
                                    {post.carousel_slides && post.carousel_slides.length > 0 && !pdfUploading[post.id] && (
                                      <button
                                        onClick={() => setShowPdfUpload((prev) => ({ ...prev, [post.id]: false }))}
                                        className="absolute top-3 right-3 text-[10px] font-bold px-2 py-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 bg-white/80 dark:bg-slate-800/80 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700/80 transition"
                                      >
                                        Отмена
                                      </button>
                                    )}

                                    {pdfUploading[post.id] ? (
                                      <div className="flex flex-col items-center justify-center p-4">
                                        <div className="relative flex items-center justify-center h-14 w-14 mb-4">
                                          <span className="absolute animate-ping h-8 w-8 rounded-full bg-[#60B76F]/20 opacity-75" />
                                          <Loader2 className="h-10 w-10 animate-spin text-[#60B76F] relative z-10" />
                                        </div>
                                        <h4 className="text-sm font-semibold text-[#244131] dark:text-[#89CB8F] animate-pulse">
                                          Обработка файла
                                        </h4>
                                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-2 font-medium bg-gray-100 dark:bg-slate-800/80 px-3 py-1 rounded-full shadow-inner">
                                          {pdfUploadProgress[post.id] || 'Загрузка...'}
                                        </p>
                                      </div>
                                    ) : (
                                      <label className="cursor-pointer flex flex-col items-center w-full h-full justify-center">
                                        <input
                                          type="file"
                                          accept=".pdf,.txt,.md"
                                          className="hidden"
                                          onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                              await handlePdfUpload(post.id, file);
                                            }
                                          }}
                                        />
                                        <div className="h-12 w-12 rounded-full bg-[#60B76F]/10 dark:bg-[#60B76F]/25 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                                          <Upload className="h-5 w-5 text-[#60B76F]" />
                                        </div>
                                        <h4 className="text-sm font-bold text-gray-700 dark:text-slate-300 font-serif leading-snug">
                                          Загрузить тексты (PDF / TXT)
                                        </h4>
                                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-2 max-w-[190px] leading-relaxed">
                                          Перетащите файл или кликните для выбора на компьютере
                                        </p>
                                        <div className="mt-4 inline-flex items-center gap-1 text-[9px] font-bold text-[#244131] dark:text-[#89CB8F] bg-[#60B76F]/10 dark:bg-[#60B76F]/20 px-2 py-1 rounded-md tracking-wide">
                                          CLAUDE DRAFT → GEMINI → PILLOW
                                        </div>
                                      </label>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="w-full max-w-[320px]">
                                  {/* Render Current Slide PNG or Fallback mockup */}
                                  <div className="aspect-[4/5] bg-white border border-gray-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-md relative group select-none">
                                    {post.carousel_slides[activeSlideIdx]?.generated_slide_url ? (
                                      <img
                                        loading="lazy"
                                        src={`${post.carousel_slides[activeSlideIdx].generated_slide_url!}${post.updated_at ? '?t=' + new Date(post.updated_at).getTime() : ''}`}
                                        alt={`Slide ${activeSlideIdx + 1}`}
                                        className="h-full w-full object-cover cursor-zoom-in"
                                        onClick={() => setZoomSlide(`${post.carousel_slides[activeSlideIdx].generated_slide_url!}${post.updated_at ? '?t=' + new Date(post.updated_at).getTime() : ''}`)}
                                      />
                                    ) : (
                                      /* Simulated aesthetic Slide Mockup if rendering failed or not done */
                                      <div
                                        className={`h-full w-full p-6 flex flex-col justify-between transition ${
                                          post.carousel_slides[activeSlideIdx].slide_layout === 'antithesis'
                                            ? 'bg-[#244131] text-[#F7F5F0]'
                                            : 'bg-[#F7F5F0] text-[#2D2D2D]'
                                        }`}
                                      >
                                        <span className="text-[9px] font-bold uppercase tracking-widest opacity-60">
                                          Слайд {activeSlideIdx + 1} • {post.carousel_slides[activeSlideIdx].slide_layout}
                                        </span>
                                        <div className="my-auto">
                                          <h4 className="text-base font-serif font-bold leading-snug">
                                            {post.carousel_slides[activeSlideIdx].main_title}
                                          </h4>
                                          {post.carousel_slides[activeSlideIdx].subtitle && (
                                            <p className="text-xs opacity-75 font-sans mt-2 leading-relaxed">
                                              {post.carousel_slides[activeSlideIdx].subtitle}
                                            </p>
                                          )}
                                          {post.carousel_slides[activeSlideIdx].list_items &&
                                            post.carousel_slides[activeSlideIdx].list_items.length > 0 && (
                                              <ul className="text-xs mt-3 space-y-1 font-sans">
                                                {post.carousel_slides[activeSlideIdx].list_items.map((it, i) => (
                                                  <li key={i} className="flex items-start gap-1.5">
                                                    <span className="text-[#60B76F] font-bold">✓</span>
                                                    <span>{it}</span>
                                                  </li>
                                                ))}
                                              </ul>
                                            )}
                                        </div>
                                        <span className="text-[9px] font-semibold opacity-40 font-sans tracking-wide text-right">
                                          @ergomarket
                                        </span>
                                      </div>
                                    )}
                                    
                                    {/* Glass Swipe Overlay Controls */}
                                    <div className="absolute inset-x-0 bottom-3 flex items-center justify-between px-3">
                                      <button
                                        disabled={activeSlideIdx === 0}
                                        onClick={() =>
                                          setActiveCarouselSlideIdx({
                                            ...activeCarouselSlideIdx,
                                            [post.id]: activeSlideIdx - 1,
                                          })
                                        }
                                        className="h-8 w-8 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur border border-gray-100 dark:border-slate-800 flex items-center justify-center disabled:opacity-40 disabled:pointer-events-none hover:bg-white transition shadow-sm text-gray-700 dark:text-slate-200"
                                      >
                                        <ChevronLeft className="h-4 w-4" />
                                      </button>
                                      <span className="text-[10px] font-bold bg-white/80 dark:bg-slate-900/80 backdrop-blur px-2.5 py-1 rounded-full shadow-sm">
                                        {activeSlideIdx + 1} / {post.carousel_slides.length}
                                      </span>
                                      <button
                                        disabled={activeSlideIdx === post.carousel_slides.length - 1}
                                        onClick={() =>
                                          setActiveCarouselSlideIdx({
                                            ...activeCarouselSlideIdx,
                                            [post.id]: activeSlideIdx + 1,
                                          })
                                        }
                                        className="h-8 w-8 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur border border-gray-100 dark:border-slate-800 flex items-center justify-center disabled:opacity-40 disabled:pointer-events-none hover:bg-white transition shadow-sm text-gray-700 dark:text-slate-200"
                                      >
                                        <ChevronRight className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Slide Info & Inline Editor Panel */}
                                  {(() => {
                                    const currentSlide = post.carousel_slides[activeSlideIdx];
                                    if (!currentSlide) return null;
                                    
                                    if (editingSlideId === currentSlide.id) {
                                      return (
                                        <div className="mt-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-[#60B76F]/30 dark:border-[#60B76F]/20 rounded-2xl p-4 w-full shadow-md text-left transition-all duration-300">
                                          <div className="flex items-center justify-between mb-3 border-b border-gray-100 dark:border-slate-800 pb-2">
                                            <div className="flex items-center gap-1.5">
                                              <Sparkles className="h-4 w-4 text-[#60B76F] animate-pulse" />
                                              <span className="text-xs font-bold text-[#244131] dark:text-[#89CB8F] uppercase tracking-wide">
                                                Редактор слайда {currentSlide.slide_order}
                                              </span>
                                            </div>
                                            <button
                                              onClick={() => setEditingSlideId(null)}
                                              className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition"
                                            >
                                              <X className="h-4 w-4" />
                                            </button>
                                          </div>

                                          <div className="space-y-3">
                                            {/* Main Title Input */}
                                            <div>
                                              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-1">
                                                Основной заголовок (main_title)
                                              </label>
                                              <textarea
                                                value={editMainTitle}
                                                onChange={(e) => setEditMainTitle(e.target.value)}
                                                rows={2}
                                                className="w-full bg-gray-50 dark:bg-slate-800 text-xs rounded-lg p-2 border border-gray-200 dark:border-slate-700/80 text-gray-800 dark:text-slate-200 focus:outline-none focus:border-[#60B76F] focus:ring-1 focus:ring-[#60B76F] resize-none font-sans"
                                                placeholder="Введите заголовок слайда..."
                                              />
                                            </div>

                                            {/* Subtitle Input */}
                                            <div>
                                              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-1">
                                                {currentSlide.slide_layout === 'cover'
                                                  ? 'Подзаголовок (subtitle)'
                                                  : currentSlide.slide_layout === 'thesis'
                                                  ? 'Ключевая цитата курсивом (subtitle)'
                                                  : currentSlide.slide_layout === 'list'
                                                  ? 'Заголовок плашки внизу (subtitle)'
                                                  : currentSlide.slide_layout === 'antithesis'
                                                  ? 'Текст контраста (subtitle)'
                                                  : 'Текст призыва к действию (subtitle)'}
                                              </label>
                                              <textarea
                                                value={editSubtitle}
                                                onChange={(e) => setEditSubtitle(e.target.value)}
                                                rows={2}
                                                className="w-full bg-gray-50 dark:bg-slate-800 text-xs rounded-lg p-2 border border-gray-200 dark:border-slate-700/80 text-gray-800 dark:text-slate-200 focus:outline-none focus:border-[#60B76F] focus:ring-1 focus:ring-[#60B76F] resize-none font-sans"
                                                placeholder="Введите подзаголовок..."
                                              />
                                            </div>

                                            {/* List Items Inputs (Only for list layout) */}
                                            {currentSlide.slide_layout === 'list' && (
                                              <div className="space-y-2">
                                                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                                                  Пункты списка (4 пункта)
                                                </label>
                                                {[0, 1, 2, 3].map((itemIdx) => (
                                                  <div key={itemIdx} className="flex items-center gap-1.5">
                                                    <span className="text-[10px] font-bold text-gray-400 dark:text-slate-600 bg-gray-100 dark:bg-slate-800 h-5 w-5 rounded-full flex items-center justify-center shrink-0">
                                                      {itemIdx + 1}
                                                    </span>
                                                    <input
                                                      type="text"
                                                      value={editListItems[itemIdx] || ''}
                                                      onChange={(e) => {
                                                        const updated = [...editListItems];
                                                        updated[itemIdx] = e.target.value;
                                                        setEditListItems(updated);
                                                      }}
                                                      className="w-full bg-gray-50 dark:bg-slate-800 text-xs rounded-lg px-2.5 py-1.5 border border-gray-200 dark:border-slate-700/80 text-gray-800 dark:text-slate-200 focus:outline-none focus:border-[#60B76F] focus:ring-1 focus:ring-[#60B76F] font-sans"
                                                      placeholder={`Пункт ${itemIdx + 1}`}
                                                    />
                                                  </div>
                                                ))}
                                              </div>
                                            )}

                                            {/* Action Buttons */}
                                            <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-slate-800 mt-2">
                                              <button
                                                onClick={() => handleSaveSlide(currentSlide.id)}
                                                disabled={isSavingSlide}
                                                className="flex-1 bg-[#244131] dark:bg-[#60B76F] hover:bg-[#244131]/90 dark:hover:bg-[#60B76F]/90 text-white dark:text-[#0b0f19] text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 transition shadow-sm disabled:opacity-50"
                                              >
                                                {isSavingSlide ? (
                                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                  <Check className="h-3.5 w-3.5" />
                                                )}
                                                Сохранить
                                              </button>
                                              <button
                                                onClick={() => setEditingSlideId(null)}
                                                disabled={isSavingSlide}
                                                className="bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 text-xs font-semibold px-3 py-2 rounded-xl transition"
                                              >
                                                Отмена
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    } else {
                                      return (
                                        <div className="mt-3 bg-white/60 dark:bg-slate-800/40 backdrop-blur-sm border border-gray-100 dark:border-slate-800/80 rounded-2xl p-3.5 w-full shadow-sm text-left">
                                          <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                                              Параметры слайда {currentSlide.slide_order}
                                            </span>
                                            <button
                                              onClick={() => startEditingSlide(currentSlide)}
                                              className="text-[#60B76F] hover:text-[#60B76F]/80 text-xs font-bold flex items-center gap-1 transition"
                                            >
                                              <Edit className="h-3.5 w-3.5" />
                                              Редактировать
                                            </button>
                                          </div>
                                          
                                          <div className="space-y-1">
                                            <div className="text-xs">
                                              <span className="text-gray-400 dark:text-slate-500 font-medium">Макет: </span>
                                              <span className="font-semibold text-gray-700 dark:text-slate-300 capitalize">{currentSlide.slide_layout}</span>
                                            </div>
                                            <div className="text-xs truncate">
                                              <span className="text-gray-400 dark:text-slate-500 font-medium">Текст: </span>
                                              <span className="text-gray-600 dark:text-slate-400">{currentSlide.main_title || '—'}</span>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }
                                  })()}
                                  
                                  {/* Carousel Action Buttons */}
                                  <div className="flex gap-2 mt-4 w-full">
                                    <button
                                      onClick={() => handleRetriggerCarousel(post.id)}
                                      disabled={actionLoading !== null}
                                      className="flex-1 flex items-center justify-center gap-1.5 bg-[#F7F5F0] dark:bg-slate-800/80 border border-[#DDE5E0] dark:border-slate-700/80 hover:bg-[#DDE5E0]/45 text-xs font-semibold px-2 py-2.5 rounded-xl transition truncate"
                                    >
                                      <RefreshCw className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                                      Перегенерировать
                                    </button>
                                    
                                    <button
                                      onClick={() => handleDownloadCarousel(post)}
                                      className="flex-1 flex items-center justify-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200/60 dark:border-blue-800/40 hover:bg-blue-100/50 text-xs font-semibold text-blue-700 dark:text-blue-400 px-2 py-2.5 rounded-xl transition truncate"
                                    >
                                      <Download className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                                      Скачать слайды
                                    </button>

                                    <button
                                      onClick={() => setShowPdfUpload((prev) => ({ ...prev, [post.id]: true }))}
                                      className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 hover:bg-emerald-100/50 text-xs font-semibold text-emerald-800 dark:text-[#89CB8F] px-2 py-2.5 rounded-xl transition truncate"
                                    >
                                      <Upload className="h-3.5 w-3.5 text-emerald-600 dark:text-[#89CB8F] shrink-0" />
                                      Загрузить PDF
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Instagram Reel Video Player Mockup */}
                          {post.platform === 'instagram' && post.insta_type === 'reel' && (
                            <div className="w-full flex flex-col items-center">
                              <div className="flex items-center justify-between w-full mb-4 px-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 flex items-center gap-1">
                                  <Tv className="h-3.5 w-3.5 text-[#60B76F]" />
                                  Instagram Reel Player
                                </span>
                                <Link 
                                  href={`/${locale}/admin/reels-builder/${post.id}`}
                                  className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-sm transition-colors flex items-center gap-1"
                                >
                                  <Tv className="h-3.5 w-3.5" />
                                  Создать видео рилс
                                </Link>
                              </div>
                              
                              {(() => {
                                const reelVideoUrl = post.selected_image || (post.veo_video_assets && post.veo_video_assets.length > 0 ? post.veo_video_assets[0].storage_url : null);
                                return reelVideoUrl ? (
                                  <div className="w-full max-w-[240px]">
                                    {/* Simulated Smartphone Wireframe */}
                                    <div className="relative mx-auto border-[6px] border-slate-800 dark:border-slate-700 rounded-[2.5rem] h-[400px] w-[220px] shadow-xl overflow-hidden bg-black flex items-center justify-center group">
                                      <div className="absolute top-0 inset-x-0 h-4 bg-slate-800 dark:bg-slate-700 z-20 flex justify-center">
                                        <div className="w-20 h-3 bg-black rounded-b-xl" /> {/* Speaker cutout */}
                                      </div>
                                      
                                      {playingVideos[post.id] ? (
                                        <video
                                          preload="auto"
                                          src={reelVideoUrl}
                                          controls
                                          autoPlay
                                          loop
                                          playsInline
                                          className="h-full w-full object-cover rounded-[1.8rem]"
                                        />
                                      ) : (
                                        <div 
                                          className="h-full w-full bg-slate-900 rounded-[1.8rem] flex items-center justify-center cursor-pointer hover:bg-slate-800 transition-colors"
                                          onClick={() => setPlayingVideos(prev => ({ ...prev, [post.id]: true }))}
                                        >
                                          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <Play className="w-8 h-8 text-white ml-1" />
                                          </div>
                                        </div>
                                      )}

                                      {reelVideoProgress[post.id] !== undefined && reelVideoProgress[post.id] !== null && (
                                        <div className="absolute inset-0 bg-black/60 z-30 flex flex-col items-center justify-center backdrop-blur-sm">
                                          <div className="relative flex items-center justify-center w-16 h-16 mx-auto mb-3">
                                            <svg className="w-16 h-16 transform -rotate-90">
                                              <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-white/20" />
                                              <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-[#60B76F] transition-all duration-300" strokeDasharray="175.9" strokeDashoffset={175.9 - (reelVideoProgress[post.id]! / 100) * 175.9} strokeLinecap="round" />
                                            </svg>
                                            <span className="absolute text-xs font-bold text-white">{reelVideoProgress[post.id]}%</span>
                                          </div>
                                          <p className="text-xs text-white font-medium">Загрузка видео...</p>
                                        </div>
                                      )}

                                      {/* Upload & Download overlay */}
                                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 flex gap-2 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                                        <a 
                                          href={reelVideoUrl}
                                          target="_blank"
                                          download
                                          className="flex-1 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white text-xs font-semibold py-2 rounded-lg flex items-center justify-center gap-1 transition-colors"
                                          title="Скачать видео"
                                        >
                                          <Download className="w-4 h-4" />
                                          Скачать
                                        </a>
                                        <label className="flex-1 bg-[#60B76F]/80 hover:bg-[#60B76F] backdrop-blur-md text-white text-xs font-semibold py-2 rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer">
                                          <Upload className="w-4 h-4" />
                                          Свое
                                          <input type="file" className="hidden" accept="video/*" onChange={(e) => {
                                            if (e.target.files && e.target.files[0]) {
                                              handleReelVideoUpload(post.id, e.target.files[0]);
                                            }
                                          }} />
                                        </label>
                                      </div>
                                    </div>
                                    
                                    {/* Display Prompt for Veo */}
                                    {post.veo_video_assets && post.veo_video_assets.length > 0 && !post.selected_image && (
                                      <div className="mt-3 bg-white dark:bg-slate-800 border border-[#DDE5E0] dark:border-slate-700/80 p-2.5 rounded-xl text-[10px] text-gray-500 dark:text-slate-400 leading-snug">
                                        <span className="font-bold text-gray-700 dark:text-slate-300 mr-1">Veo Prompt:</span>
                                        {post.veo_video_assets[0].english_prompt}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="w-full max-w-[240px]">
                                    {/* Empty state wireframe */}
                                    <div className="relative mx-auto border-[6px] border-slate-800 dark:border-slate-700 rounded-[2.5rem] h-[400px] w-[220px] shadow-xl overflow-hidden bg-slate-100 dark:bg-slate-800/50 flex flex-col items-center justify-center group">
                                      <div className="absolute top-0 inset-x-0 h-4 bg-slate-800 dark:bg-slate-700 z-20 flex justify-center">
                                        <div className="w-20 h-3 bg-black rounded-b-xl" />
                                      </div>
                                      
                                      {reelVideoProgress[post.id] !== undefined && reelVideoProgress[post.id] !== null ? (
                                        <div className="p-4 w-full flex flex-col items-center">
                                          <div className="relative flex items-center justify-center w-12 h-12 mx-auto mb-2">
                                            <svg className="w-12 h-12 transform -rotate-90">
                                              <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-gray-200 dark:text-slate-700" />
                                              <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-[#60B76F] transition-all duration-300" strokeDasharray="125.6" strokeDashoffset={125.6 - (reelVideoProgress[post.id]! / 100) * 125.6} strokeLinecap="round" />
                                            </svg>
                                            <span className="absolute text-[10px] font-bold text-gray-700 dark:text-gray-300">{reelVideoProgress[post.id]}%</span>
                                          </div>
                                          <p className="text-[10px] text-gray-400 font-medium">Загрузка видео...</p>
                                        </div>
                                      ) : (
                                        <div className="p-4 text-center flex flex-col justify-center h-full">
                                          <Tv className="h-8 w-8 text-gray-400 mx-auto mb-2 opacity-50" />
                                          <p className="text-[10px] text-gray-400 font-medium mb-4">Видео еще не создано</p>
                                          
                                          <label className="bg-[#60B76F] hover:bg-[#60B76F]/90 text-white text-[10px] font-bold py-1.5 px-3 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1 cursor-pointer w-max mx-auto">
                                            <Upload className="h-3 w-3" />
                                            Загрузить готовое
                                            <input type="file" className="hidden" accept="video/*" onChange={(e) => {
                                              if (e.target.files && e.target.files[0]) {
                                                handleReelVideoUpload(post.id, e.target.files[0]);
                                              }
                                            }} />
                                          </label>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          )}

                          {/* Instagram Post — Vertical Photo Upload */}
                          {post.platform === 'instagram' && post.insta_type === 'post' && (
                            <div className="w-full flex flex-col items-center">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 block mb-3 flex items-center gap-1">
                                <Smartphone className="h-3.5 w-3.5 text-[#60B76F]" />
                                Instagram Post — вертикальное фото (4:5 / 9:16)
                              </span>

                              <div className="w-full max-w-[240px]">
                                {igPostPhoto[post.id] || post.selected_image ? (
                                  /* Photo Preview */
                                  <div className="relative group">
                                    <div className="aspect-[4/5] rounded-2xl overflow-hidden border-2 border-[#60B76F]/30 shadow-lg relative">
                                      {igPhotoUploading[post.id] && (
                                        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">
                                          <Loader2 className="w-6 h-6 text-[#60B76F] animate-spin" />
                                        </div>
                                      )}
                                      <img
                                        loading="lazy"
                                        src={igPostPhoto[post.id] || post.selected_image}
                                        alt="Instagram Post Preview"
                                        className="h-full w-full object-cover"
                                      />
                                    </div>
                                    {/* Overlay Controls */}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 rounded-2xl transition-all duration-200 flex items-center justify-center">
                                      <button
                                        onClick={() => handleIgPhotoDelete(post.id)}
                                        disabled={igPhotoUploading[post.id]}
                                        className="opacity-0 group-hover:opacity-100 transition-all bg-white/90 text-gray-800 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-md disabled:opacity-50"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                        Заменить фото
                                      </button>
                                    </div>
                                    {/* Instagram-style overlay badge */}
                                    <div className="absolute bottom-3 left-3 right-3 bg-black/50 backdrop-blur-sm rounded-xl px-2.5 py-1.5 flex items-center gap-2">
                                      <Instagram className="h-3 w-3 text-white shrink-0" />
                                      <span className="text-[10px] text-white font-semibold truncate">@ergomarket</span>
                                      <span className="ml-auto text-[9px] text-white/70">Post</span>
                                    </div>
                                  </div>
                                ) : (
                                  /* Upload Dropzone */
                                  <label
                                    className={`cursor-pointer aspect-[4/5] w-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-5 text-center transition-all relative overflow-hidden select-none ${
                                      igPhotoDragOver[post.id]
                                        ? 'bg-[#60B76F]/5 border-[#60B76F] scale-[1.02] shadow-md'
                                        : 'bg-white/40 dark:bg-slate-900/40 border-gray-200 dark:border-slate-800 hover:border-[#60B76F]/60'
                                    }`}
                                    onDragOver={(e) => { e.preventDefault(); setIgPhotoDragOver(prev => ({ ...prev, [post.id]: true })); }}
                                    onDragLeave={(e) => { e.preventDefault(); setIgPhotoDragOver(prev => ({ ...prev, [post.id]: false })); }}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      setIgPhotoDragOver(prev => ({ ...prev, [post.id]: false }));
                                      const file = e.dataTransfer.files?.[0];
                                      if (file) handleIgPhotoUpload(post.id, file);
                                    }}
                                  >
                                    <input
                                      type="file"
                                      accept="image/jpeg,image/png,image/webp"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleIgPhotoUpload(post.id, file);
                                      }}
                                    />
                                    {igPhotoUploading[post.id] ? (
                                      <Loader2 className="h-8 w-8 animate-spin text-[#60B76F] mb-2" />
                                    ) : (
                                      <>
                                        <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 flex items-center justify-center mb-3 shadow-md">
                                          <Upload className="h-5 w-5 text-white" />
                                        </div>
                                        <h4 className="text-xs font-bold text-gray-700 dark:text-slate-300 font-serif">
                                          Загрузить фото
                                        </h4>
                                        <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1.5 max-w-[160px] leading-relaxed">
                                          JPG / PNG / WEBP<br />Вертикальное 4:5 или 9:16
                                        </p>
                                        <div className="mt-3 inline-flex items-center gap-1 text-[9px] font-bold text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/20 px-2.5 py-1 rounded-lg tracking-wide">
                                          Instagram Post Format
                                        </div>
                                      </>
                                    )}
                                  </label>
                                )}

                                {/* Caption hint below photo */}
                                <div className="mt-2.5 bg-white/60 dark:bg-slate-800/40 border border-gray-100 dark:border-slate-800/80 rounded-xl px-3 py-2 text-[10px] text-gray-500 dark:text-slate-400 leading-snug">
                                  <span className="font-bold text-gray-600 dark:text-slate-300 block mb-0.5">💡 Совет:</span>
                                  Текст поста используется как описание (caption) под фото. Редактируйте слева.
                                </div>
                              </div>
                            </div>
                          )}



                          {/* Telegram & Max — Cover Photo / Video Upload */}
                          {(post.platform === 'telegram' || post.platform === 'max') && (
                            <div className="w-full flex flex-col items-center gap-4 mb-6">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 block mb-1 flex items-center gap-1">
                                <Smartphone className="h-3.5 w-3.5 text-[#60B76F]" />
                                Обложка поста (Фото / Видео / Аудио)
                              </span>

                              <div className="w-full max-w-[240px]">
                                {post.selected_image ? (
                                  /* Cover Preview (Image or Video) */
                                  <div className="relative group">
                                    <div className="w-full rounded-2xl overflow-hidden border-2 border-[#60B76F]/30 shadow-lg relative bg-black flex items-center justify-center min-h-[160px] max-h-[320px]">
                                      {(() => {
                                        const fileUrl = post.selected_image;
                                        const extension = fileUrl.split('?')[0].split('.').pop()?.toLowerCase();
                                        const isVideo = ['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(extension || '');
                                        const isAudio = ['mp3', 'ogg', 'wav', 'm4a'].includes(extension || '');

                                        if (isVideo) {
                                          return playingVideos[post.id] ? (
                                            <video
                                              preload="auto"
                                              src={fileUrl}
                                              controls
                                              autoPlay
                                              className="max-h-[320px] w-full object-contain"
                                            />
                                          ) : (
                                            <div 
                                              className="h-full min-h-[160px] w-full bg-slate-900/50 flex items-center justify-center cursor-pointer hover:bg-slate-900 transition-colors"
                                              onClick={() => setPlayingVideos(prev => ({ ...prev, [post.id]: true }))}
                                            >
                                              <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:scale-110 transition-transform">
                                                <Play className="w-6 h-6 text-white ml-1" />
                                              </div>
                                            </div>
                                          );
                                        } else if (isAudio) {
                                          return (
                                            <div className="w-full p-6 bg-slate-900 rounded-xl flex items-center justify-center min-h-[160px] relative z-20">
                                              <audio
                                                preload="none"
                                                src={fileUrl}
                                                controls
                                                className="w-full"
                                              />
                                            </div>
                                          );
                                        } else {
                                          return (
                                            <div className="relative w-full h-[240px]">
                                              <Image
                                                src={fileUrl}
                                                alt="Post Cover Preview"
                                                fill
                                                className="object-contain"
                                                sizes="(max-width: 768px) 100vw, 300px"
                                              />
                                            </div>
                                          );
                                        }
                                      })()}
                                    </div>
                                    {/* Overlay Controls */}
                                    {!playingVideos[post.id] && (
                                      <div className="absolute inset-0 pointer-events-none rounded-2xl transition-all duration-200 flex flex-col justify-start p-3 group-hover:bg-black/20 z-30">
                                        <div className="flex items-start justify-end gap-2 pointer-events-auto">
                                          {(() => {
                                            const fileUrl = post.selected_image;
                                            const extension = fileUrl?.split('?')[0].split('.').pop()?.toLowerCase();
                                            const isMedia = ['mp4', 'mov', 'webm', 'avi', 'mkv', 'mp3', 'ogg', 'wav', 'm4a'].includes(extension || '');

                                            return (
                                              <>
                                                {!isMedia && fileUrl && (
                                                  <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); setZoomSlide(fileUrl); }}
                                                    className="opacity-0 group-hover:opacity-100 transition-all bg-white/95 text-blue-600 hover:bg-white text-xs font-bold p-2 rounded-xl flex items-center shadow-md cursor-pointer"
                                                    title="Посмотреть целиком"
                                                  >
                                                    <ZoomIn className="h-4 w-4" />
                                                  </button>
                                                )}
                                                <button
                                                  type="button"
                                                  onClick={(e) => { e.stopPropagation(); handlePostFileDelete(post.id); }}
                                                  className="opacity-0 group-hover:opacity-100 transition-all bg-white/95 text-rose-600 hover:bg-white text-xs font-bold p-2 rounded-xl flex items-center shadow-md cursor-pointer"
                                                  title="Удалить обложку"
                                                >
                                                  <X className="h-4 w-4" />
                                                </button>
                                              </>
                                            );
                                          })()}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  /* Upload Dropzone for Image/Video */
                                  <label
                                    className={`cursor-pointer w-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-5 text-center transition-all relative overflow-hidden select-none min-h-[200px] ${
                                      dragOver[post.id]
                                        ? 'bg-[#60B76F]/5 border-[#60B76F] scale-[1.02] shadow-md'
                                        : 'bg-white/40 dark:bg-slate-900/40 border-gray-200 dark:border-slate-800 hover:border-[#60B76F]/60'
                                    }`}
                                    onDragOver={(e) => { e.preventDefault(); setDragOver(prev => ({ ...prev, [post.id]: true })); }}
                                    onDragLeave={(e) => { e.preventDefault(); setDragOver(prev => ({ ...prev, [post.id]: false })); }}
                                    onDrop={async (e) => {
                                      e.preventDefault();
                                      setDragOver(prev => ({ ...prev, [post.id]: false }));
                                      const file = e.dataTransfer.files?.[0];
                                      if (file) await handlePostFileUpload(post.id, file);
                                    }}
                                  >
                                    <input
                                      type="file"
                                      accept="image/*,video/*"
                                      className="hidden"
                                      onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (file) await handlePostFileUpload(post.id, file);
                                      }}
                                    />
                                    {pdfUploading[post.id] ? (
                                      <div className="flex flex-col items-center justify-center p-4">
                                        <Loader2 className="h-8 w-8 animate-spin text-[#60B76F] mb-2" />
                                        <span className="text-[10px] text-gray-500">{pdfUploadProgress[post.id]}</span>
                                      </div>
                                    ) : (
                                      <>
                                        <div className="h-12 w-12 rounded-full bg-[#60B76F]/10 dark:bg-[#60B76F]/25 flex items-center justify-center mb-3">
                                          <Upload className="h-5 w-5 text-[#60B76F]" />
                                        </div>
                                        <h4 className="text-xs font-bold text-gray-700 dark:text-slate-300 font-serif">
                                          Загрузить обложку
                                        </h4>
                                        <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1.5 max-w-[160px] leading-relaxed">
                                          Фото или видео<br />(JPG, PNG, MP4, MOV)
                                        </p>
                                      </>
                                    )}
                                  </label>
                                )}
                              </div>
                            </div>
                          )}


                        </div>
                      )}

                    </div>

                  </div>
                );
              })}
          </div>
        )}

      </main>

      {/* Slide Zoom Modal */}
      {zoomSlide && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center justify-center">
            <button
              onClick={() => setZoomSlide(null)}
              className="absolute top-4 right-4 h-10 w-10 bg-white/20 hover:bg-white/30 backdrop-blur rounded-full flex items-center justify-center text-white text-lg font-bold transition shadow-lg"
            >
              ✕
            </button>
            <img
              src={zoomSlide}
              alt="Zoomed Slide"
              className="max-h-[80vh] w-auto max-w-full rounded-2xl shadow-2xl object-contain"
            />
          </div>
        </div>
      )}

    </div>
  );
}
