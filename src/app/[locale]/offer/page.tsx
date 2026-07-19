import React from 'react';
import { getTranslations } from 'next-intl/server';
import PublicNavbar from '@/components/layout/PublicNavbar';
import PublicFooter from '@/components/layout/PublicFooter';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
    const resolvedParams = await params;
    const t = await getTranslations({ locale: resolvedParams.locale, namespace: 'Landing' });
    return {
        title: resolvedParams.locale === 'ru' ? "Публичная оферта | VIReYou" : "Public Offer | VIReYou",
        description: resolvedParams.locale === 'ru' ? "Условия оказания услуг и публичная оферта" : "Terms of service and public offer",
    };
}

export default async function OfferPage({ params }: { params: Promise<{ locale: string }> }) {
    const resolvedParams = await params;
    const isRu = resolvedParams.locale === 'ru';

    return (
        <main className="min-h-screen bg-brand-light flex flex-col">
            <PublicNavbar />
            
            <div className="flex-grow max-w-4xl mx-auto px-5 pt-32 pb-20 w-full">
                <h1 className="text-3xl font-bold text-brand-text mb-10 text-center font-display">
                    {isRu ? "Публичная оферта (Пользовательское соглашение)" : "Public Offer (Terms of Service)"}
                </h1>
                
                <div className="prose prose-brand max-w-none text-brand-text/80 space-y-6">
                    <p><strong>{isRu ? "Дата публикации:" : "Publication Date:"}</strong> {isRu ? "13 июля 2026 г." : "July 13, 2026"}</p>

                    {isRu ? (
                        <>
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
                        </>
                    ) : (
                        <>
                            <section>
                                <h2 className="text-xl font-bold text-brand-text mb-3 mt-8">1. General Provisions</h2>
                                <p>1.1. This document is an open offer (Offer) by the Contractor addressed to any individual (hereinafter - the Customer) to conclude an agreement for the provision of information and consulting services.</p>
                                <p>1.2. In accordance with Art. 437 of the Civil Code of the Russian Federation, this document is a public offer. Acceptance (full and unconditional agreement with the terms of the offer) is recognized as the fact of payment for services by the Customer.</p>
                                <p>1.3. Contractor: <strong>Valentina Ivanovna Korotkova</strong> (Professional income tax payer).</p>
                            </section>

                            <section>
                                <h2 className="text-xl font-bold text-brand-text mb-3 mt-8">2. Subject of the Agreement</h2>
                                <p>2.1. The Contractor undertakes to provide the Customer with services for providing access to closed content, a platform, a bot, or conducting consultations (according to the selected tariff on the website), and the Customer undertakes to pay for these services.</p>
                                <p>2.2. The services are strictly of an informational and consulting nature and do not constitute medical services.</p>
                            </section>

                            <section>
                                <h2 className="text-xl font-bold text-brand-text mb-3 mt-8">3. Cost of Services and Payment Procedure</h2>
                                <p>3.1. The cost of services is determined by the tariffs posted on the website in the &quot;Pricing&quot; section.</p>
                                <p>3.2. Payment is made on the basis of 100% prepayment via electronic payment systems connected to the website.</p>
                                <p>3.3. The service is considered paid from the moment of successful transaction by the payment system and the receipt of funds to the Contractor&apos;s account.</p>
                            </section>

                            <section>
                                <h2 className="text-xl font-bold text-brand-text mb-3 mt-8">4. Procedure for Providing Services and Refund Policy</h2>
                                <p>4.1. Access to digital products, the bot, and the platform is granted automatically or within 24 hours after successful payment.</p>
                                <p>4.2. <strong>Refund Policy:</strong> The Customer has the right to refuse the services and demand a refund within <strong>3 (three) days</strong> from the date of payment if the services were not actually consumed.</p>
                                <p>4.3. To process a refund, the Customer must send a free-form application to the Contractor&apos;s email address, specifying the reasons for the return and the details from which the payment was made.</p>
                            </section>

                            <section>
                                <h2 className="text-xl font-bold text-brand-text mb-3 mt-8">5. Liability of the Parties</h2>
                                <p>5.1. The Contractor is not responsible for the non-compliance of the provided service with the Customer&apos;s expectations or for their subjective assessment.</p>
                                <p>5.2. The Contractor&apos;s recommendations on nutrition and lifestyle do not replace a consultation with an attending physician. The Customer is solely responsible for their own health and the decision to apply the received recommendations.</p>
                            </section>

                            <section>
                                <h2 className="text-xl font-bold text-brand-text mb-3 mt-8">6. Contractor Details</h2>
                                <div className="bg-white p-6 rounded-2xl border border-brand-sage/40 shadow-sm mt-4">
                                    <ul className="space-y-2 list-none p-0">
                                        <li><strong>Full Name:</strong> Valentina Ivanovna Korotkova</li>
                                        <li><strong>Status:</strong> Professional income tax payer (Self-employed)</li>
                                        <li><strong>TIN (INN):</strong> 381452387308</li>
                                        <li><strong>Bank:</strong> JSC T-Bank</li>
                                        <li><strong>BIC:</strong> 044525974</li>
                                        <li><strong>Checking Account:</strong> 40817810200040399679</li>
                                        <li className="pt-3 border-t border-brand-sage/20 mt-3"><strong>Support Email:</strong> cleverval23@gmail.com</li>
                                        <li><strong>Phone:</strong> +7 (908) 647-73-99</li>
                                    </ul>
                                </div>
                            </section>
                        </>
                    )}
                </div>
            </div>
            
            <PublicFooter />
        </main>
    );
}
