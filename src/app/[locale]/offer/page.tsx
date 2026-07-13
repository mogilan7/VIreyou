import React from 'react';
import { getTranslations } from 'next-intl/server';
import PublicNavbar from '@/components/layout/PublicNavbar';
import PublicFooter from '@/components/layout/PublicFooter';

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }) {
    const t = await getTranslations({ locale, namespace: 'Landing' });
    return {
        title: "Публичная оферта | VIReYou",
        description: "Условия оказания услуг и публичная оферта",
    };
}

export default function OfferPage() {
    return (
        <main className="min-h-screen bg-brand-light flex flex-col">
            <PublicNavbar />
            
            <div className="flex-grow max-w-4xl mx-auto px-5 pt-32 pb-20 w-full">
                <h1 className="text-3xl font-bold text-brand-text mb-10 text-center font-display">Публичная оферта (Пользовательское соглашение)</h1>
                
                <div className="prose prose-brand max-w-none text-brand-text/80 space-y-6">
                    <p><strong>Дата публикации:</strong> 13 июля 2026 г.</p>

                    <section>
                        <h2 className="text-xl font-bold text-brand-text mb-3 mt-8">1. Общие положения</h2>
                        <p>1.1. Настоящий документ представляет собой открытое предложение (Оферту) Исполнителя, адресованное любому физическому лицу (далее — Заказчик), заключить договор на оказание информационно-консультационных услуг.</p>
                        <p>1.2. В соответствии со ст. 437 Гражданского кодекса РФ данный документ является публичной офертой. Акцептом (полным и безоговорочным согласием с условиями оферты) признается факт оплаты услуг Заказчиком.</p>
                        <p>1.3. Исполнитель: <strong>Короткова Валентина Ивановна</strong> (Плательщик налога на профессиональный доход).</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-brand-text mb-3 mt-8">2. Предмет договора</h2>
                        <p>2.1. Исполнитель обязуется оказать Заказчику услуги по предоставлению доступа к закрытому контенту, платформе, боту или проведению консультаций (согласно выбранному тарифу на сайте), а Заказчик обязуется оплатить эти услуги.</p>
                        <p>2.2. Услуги носят исключительно информационно-консультационный характер и не являются медицинскими услугами.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-brand-text mb-3 mt-8">3. Стоимость услуг и порядок расчетов</h2>
                        <p>3.1. Стоимость услуг определяется тарифами, размещенными на сайте в разделе «Цены».</p>
                        <p>3.2. Оплата производится на условиях 100% предоплаты через электронные платежные системы, подключенные к сайту.</p>
                        <p>3.3. Услуга считается оплаченной с момента успешного проведения транзакции платежной системой и поступления средств на счет Исполнителя.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-brand-text mb-3 mt-8">4. Порядок оказания услуг и возврата средств</h2>
                        <p>4.1. Доступ к цифровым продуктам, боту и платформе открывается автоматически или в течение 24 часов после успешной оплаты.</p>
                        <p>4.2. <strong>Политика возврата:</strong> Заказчик вправе отказаться от услуг и потребовать возврат денежных средств в течение <strong>3 (трех) дней</strong> с момента оплаты, если услуги не были фактически потреблены.</p>
                        <p>4.3. Для оформления возврата Заказчик должен направить заявление в свободной форме на электронную почту Исполнителя с указанием причин возврата и реквизитов, с которых производилась оплата.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-brand-text mb-3 mt-8">5. Ответственность сторон</h2>
                        <p>5.1. Исполнитель не несет ответственности за несоответствие предоставленной услуги ожиданиям Заказчика или за его субъективную оценку.</p>
                        <p>5.2. Рекомендации Исполнителя по питанию и образу жизни не заменяют консультацию лечащего врача. Заказчик самостоятельно несет ответственность за свое здоровье и решение применять полученные рекомендации.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-brand-text mb-3 mt-8">6. Реквизиты Исполнителя</h2>
                        <div className="bg-white p-6 rounded-2xl border border-brand-sage/40 shadow-sm mt-4">
                            <ul className="space-y-2 list-none p-0">
                                <li><strong>ФИО:</strong> Короткова Валентина Ивановна</li>
                                <li><strong>Статус:</strong> Плательщик налога на профессиональный доход (Самозанятый)</li>
                                <li><strong>ИНН:</strong> 381452387308</li>
                                <li><strong>Банк:</strong> ОАО Тбанк</li>
                                <li><strong>БИК:</strong> 044525974</li>
                                <li><strong>Расчетный счет (ЛС):</strong> 40817810200040399679</li>
                                <li className="pt-3 border-t border-brand-sage/20 mt-3"><strong>Email поддержки:</strong> cleverval23@gmail.com</li>
                                <li><strong>Телефон:</strong> +7 (908) 647-73-99</li>
                            </ul>
                        </div>
                    </section>
                </div>
            </div>
            
            <PublicFooter />
        </main>
    );
}
