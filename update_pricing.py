import re

with open("src/app/[locale]/pricing/page.tsx", "r") as f:
    content = f.read()

# Add CheckoutButton import
if "CheckoutButton" not in content:
    content = content.replace('import { useState } from "react";', 'import { useState } from "react";\nimport CheckoutButton from "@/components/dashboard/CheckoutButton";')

# Add BotDropdown component
bot_dropdown = """
function BotDropdown({ tWallet, isPro, tPricing }: { tWallet: any, isPro: boolean, tPricing: any }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="mt-4 mb-6">
            <button 
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2 text-sm text-brand-text font-semibold hover:text-brand-leaf transition-colors w-full justify-between bg-[#E8F1EB]/50 p-3 rounded-xl border border-brand-sage/30"
            >
                <div className="flex items-center gap-2">
                    <span className="bg-brand-leaf text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">🤖</span>
                    {tPricing('botFeaturesLabel')}
                </div>
                <ChevronDown size={16} className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <ul className="text-xs space-y-2 mt-3 text-brand-gray-dark px-2 animate-in fade-in slide-in-from-top-2">
                    <li className="flex items-center gap-2">✔️ {tWallet('featurePhotoVoice')}</li>
                    <li className="flex items-center gap-2">✔️ {tWallet('featureDashboard')}</li>
                    <li className="flex items-center gap-2">✔️ {tWallet('featureMarathons')}</li>
                    <li className="flex items-center gap-2">✔️ {tWallet('featureVitamins')}</li>
                    <li className={`flex items-center gap-2 ${!isPro ? 'opacity-50' : ''}`}>
                        {isPro ? '✔️' : '❌'} <span className={isPro ? "font-bold" : ""}>{tWallet('featureOrganization')}</span>
                    </li>
                    <li className={`flex items-center gap-2 ${!isPro ? 'opacity-50' : ''}`}>
                        {isPro ? '✔️' : '❌'} <span className={isPro ? "font-bold" : ""}>{tWallet('featureAdvice')}</span>
                    </li>
                    <li className={`flex items-center gap-2 ${!isPro ? 'opacity-50' : ''}`}>
                        {isPro ? '✔️' : '❌'} <span className={isPro ? "font-bold" : ""}>{tWallet('featureAnalysis')}</span>
                    </li>
                    <li className={`flex items-center gap-2 ${!isPro ? 'opacity-50' : ''}`}>
                        {isPro ? '✔️' : '❌'} <span className={isPro ? "text-brand-leaf font-bold" : ""}>{tWallet('featureAI')}</span>
                    </li>
                </ul>
            )}
        </div>
    );
}
"""

if "BotDropdown" not in content:
    content = content.replace("export default function PricingPage() {", bot_dropdown + "\nexport default function PricingPage() {")

# Get tWallet
if "tWallet" not in content:
    content = content.replace('const tCommon = useTranslations("Common");', 'const tCommon = useTranslations("Common");\n    const tWallet = useTranslations("Wallet");')

# Let's replace the AI Assistant cards' links with CheckoutButton
# And add Telegram bot + Dropdown to all 4 cards
# Wait, for Essential and Premium, the user said "Для всех тарифов включен телеграм бот."
# I will add `<li className="flex items-center gap-3 text-sm text-brand-gray-dark"><Check size={18} className="text-brand-leaf flex-shrink-0" />{t("telegramBot")}</li>` 
# and `<BotDropdown tWallet={tWallet} isPro={false} tPricing={t} />` for Essential
# and `<BotDropdown tWallet={tWallet} isPro={true} tPricing={t} />` for Premium.

content = content.replace(
    '{t("eF5")}\n                            </li>\n                        </ul>',
    '{t("eF5")}\n                            </li>\n                            <li className="flex items-center gap-3 text-sm text-brand-gray-dark"><Check size={18} className="text-brand-leaf flex-shrink-0" />{t("telegramBot")}</li>\n                        </ul>\n                        <BotDropdown tWallet={tWallet} isPro={false} tPricing={t} />'
)

content = content.replace(
    '{t("pF5")}\n                            </li>\n                        </ul>',
    '{t("pF5")}\n                            </li>\n                            <li className="flex items-center gap-3 text-sm text-brand-text font-medium"><div className="bg-brand-leaf/20 p-0.5 rounded-full"><Check size={14} className="text-brand-leaf" strokeWidth={3} /></div>{t("telegramBot")}</li>\n                        </ul>\n                        <BotDropdown tWallet={tWallet} isPro={true} tPricing={t} />'
)

content = content.replace(
    '{t("aF4")}\n                            </li>\n                        </ul>',
    '{t("aF4")}\n                            </li>\n                            <li className="flex items-center gap-3 text-sm text-brand-gray-dark"><Check size={18} className="text-brand-leaf flex-shrink-0" />{t("telegramBot")}</li>\n                        </ul>\n                        <BotDropdown tWallet={tWallet} isPro={false} tPricing={t} />'
)
# The second one (Assistant PRO) will match again because we replaced it globally? Let's check how aF4 is there. It's there twice. The replace above will replace both if we don't specify count=1.
# Wait, python string replace does all occurrences.
# We want isPro={true} for Assistant PRO! So I'll do a regex or fix it.
content = re.sub(
    r'<BotDropdown tWallet=\{tWallet\} isPro=\{false\} tPricing=\{t\} />\s*<Link\s*href="/cabinet"\s*className="w-full py-3.5 rounded-full border border-blue-500 text-blue-600 font-medium text-sm hover:bg-blue-50 transition-colors text-center shadow-sm block"\s*>\s*\{t\("btnAssistantPro"\)\}\s*</Link>',
    r'<BotDropdown tWallet={tWallet} isPro={true} tPricing={t} />\n                        <CheckoutButton plan="PRO" amount={locale === "en" ? 15 : 745} className="w-full py-3.5 rounded-full border border-blue-500 text-blue-600 font-medium text-sm hover:bg-blue-50 transition-colors text-center shadow-sm block">{t("btnAssistantPro")}</CheckoutButton>',
    content
)

# Replace the Standard button
content = re.sub(
    r'<Link\s*href="/cabinet"\s*className="w-full py-3.5 rounded-full border border-brand-sage text-brand-text font-medium text-sm hover:border-brand-leaf hover:text-brand-leaf transition-colors text-center shadow-sm block"\s*>\s*\{t\("btnAssistantStandard"\)\}\s*</Link>',
    r'<CheckoutButton plan="Standard" amount={locale === "en" ? 7 : 495} className="w-full py-3.5 rounded-full border border-brand-sage text-brand-text font-medium text-sm hover:border-brand-leaf hover:text-brand-leaf transition-colors text-center shadow-sm block">{t("btnAssistantStandard")}</CheckoutButton>',
    content
)

with open("src/app/[locale]/pricing/page.tsx", "w") as f:
    f.write(content)
