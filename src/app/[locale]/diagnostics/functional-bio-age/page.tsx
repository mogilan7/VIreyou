
"use client";

import React, { useState, useEffect } from "react";
import { 
  Heart, 
  Move, 
  Zap, 
  Compass, 
  RefreshCw, 
  Fingerprint, 
  Activity, 
  ChevronRight, 
  ChevronLeft, 
  RotateCcw,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  Save,
  AlertCircle,
  Play
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { saveTestResult } from "@/actions/save-test";
import { createClient } from "@/utils/supabase/client";

type Zone = "green" | "yellow" | "red" | null;

export default function FunctionalBioAgePage() {
    const t = useTranslations("FunctionalBioAge");
    const tCommon = useTranslations("Common");

    const [currentStep, setCurrentStep] = useState(-1); // -1: Intro, 0: Walking, 1: Chair, 2: Balance, 3: Result
    
    // Data structures for results
    const [walkingTime, setWalkingTime] = useState<string>("");
    const [chairGender, setChairGender] = useState<"male" | "female" | null>(null);
    const [chairAge, setChairAge] = useState<string>("");
    const [chairCount, setChairCount] = useState<string>("");
    const [balanceResult, setBalanceResult] = useState<"yes" | "no" | null>(null);

    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
    const [saveErrorString, setSaveErrorString] = useState<string | null>(null);
    const supabase = createClient();

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setIsAuthenticated(!!session);
        };
        checkAuth();
    }, []);

    // Chair norms
    const chairNorms = {
        female: {
            "60-64": { min: 12, max: 17 },
            "65-69": { min: 11, max: 16 },
            "70-74": { min: 10, max: 15 },
            "75-79": { min: 10, max: 15 },
            "80-84": { min: 9, max: 14 },
            "85-89": { min: 8, max: 13 },
            "90-94": { min: 4, max: 11 }
        },
        male: {
            "60-64": { min: 14, max: 19 },
            "65-69": { min: 12, max: 18 },
            "70-74": { min: 12, max: 17 },
            "75-79": { min: 11, max: 17 },
            "80-84": { min: 10, max: 15 },
            "85-89": { min: 8, max: 14 },
            "90-94": { min: 7, max: 12 }
        }
    };

    const getWalkingZone = (): Zone => {
        if (!walkingTime) return null;
        const time = parseFloat(walkingTime.replace(",", "."));
        if (isNaN(time)) return null;
        if (time <= 4.0) return "green";
        if (time <= 5.0) return "yellow";
        return "red";
    };

    const getChairZone = (): Zone => {
        if (!chairGender || !chairAge || !chairCount) return null;
        const count = parseInt(chairCount);
        if (isNaN(count)) return null;
        if (count === 0) return "red"; // Can"t stand
        const norms = chairNorms[chairGender][chairAge as keyof typeof chairNorms["male"]];
        if (!norms) return null;
        if (count > norms.max) return "green";
        if (count >= norms.min) return "yellow";
        return "red";
    };

    const getBalanceZone = (): Zone => {
        if (!balanceResult) return null;
        return balanceResult === "yes" ? "green" : "red";
    };

    const getZoneColor = (zone: Zone) => {
        if (zone === "green") return "bg-green-100 text-green-700 border-green-200";
        if (zone === "yellow") return "bg-yellow-100 text-yellow-700 border-yellow-200";
        if (zone === "red") return "bg-red-100 text-red-700 border-red-200";
        return "bg-gray-100 text-gray-500 border-gray-200";
    };
    
    const getZoneLabel = (zone: Zone) => {
        if (zone === "green") return t("zoneGreen");
        if (zone === "yellow") return t("zoneYellow");
        if (zone === "red") return t("zoneRed");
        return "";
    };

    const renderIntro = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-4">{t("title")}</h1>
                <p className="text-lg text-gray-600 max-w-2xl mx-auto">{t("subtitle")}</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 space-y-6">
                <div className="space-y-4 text-gray-700 text-lg">
                    <p>{t("introText1")}</p>
                    <p>{t("introText2")}</p>
                    <p>{t("introText3")}</p>
                </div>

                <div className="bg-blue-50 rounded-xl p-5 border border-blue-100">
                    <h3 className="font-semibold text-blue-900 mb-2">{t("forWhomTitle")}</h3>
                    <p className="text-blue-800">{t("forWhomText")}</p>
                </div>

                <div className="border-t border-gray-100 pt-6">
                    <h2 className="text-xl font-semibold mb-4">{t("beforeStartTitle")}</h2>
                    <p className="text-gray-600 mb-4">{t("beforeStartText")}</p>
                    
                    <h3 className="font-semibold mb-2">{t("youNeedTitle")}</h3>
                    <ul className="list-disc pl-5 mb-6 space-y-1 text-gray-700">
                        {t.raw("youNeedList").map((item: string, idx: number) => (
                            <li key={idx}>{item}</li>
                        ))}
                    </ul>

                    <div className="bg-red-50 rounded-xl p-5 border border-red-100 mb-6">
                        <h3 className="font-semibold text-red-900 mb-2">{t("doNotDoTitle")}</h3>
                        <ul className="list-disc pl-5 space-y-1 text-red-800">
                            {t.raw("doNotDoList").map((item: string, idx: number) => (
                                <li key={idx}>{item}</li>
                            ))}
                        </ul>
                    </div>

                    <p className="text-sm text-gray-500 italic bg-gray-50 p-4 rounded-lg">
                        {t("warningText")}
                    </p>
                </div>

                <div className="flex justify-center pt-4">
                    <button
                        onClick={() => setCurrentStep(0)}
                        className="group flex items-center justify-center space-x-2 w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-medium transition-all"
                    >
                        <span>{t("introBtn")}</span>
                        <Play className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </div>
        </div>
    );

    const renderTestWalking = () => (
        <div className="space-y-6">
            <p className="text-gray-700 bg-blue-50 p-4 rounded-lg border border-blue-100">{t("tests.walking.shows")}</p>
            
            <div>
                <h3 className="font-semibold text-lg mb-3">{t("tests.walking.howToTitle")}</h3>
                <ul className="space-y-3">
                    {t.raw("tests.walking.howToSteps").map((step: string, idx: number) => (
                        <li key={idx} className="flex items-start">
                            <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-gray-100 rounded-full text-sm font-medium mr-3 mt-0.5">{idx + 1}</span>
                            <span className="text-gray-700">{step}</span>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t("tests.walking.inputLabel")}
                </label>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <input 
                        type="text" 
                        inputMode="decimal"
                        placeholder={t("tests.walking.placeholder")}
                        value={walkingTime}
                        onChange={(e) => setWalkingTime(e.target.value)}
                        className="w-full sm:w-48 px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {getWalkingZone() && (
                        <div className={`px-4 py-2 rounded-full font-medium text-sm border ${getZoneColor(getWalkingZone())}`}>
                            {getZoneLabel(getWalkingZone())}
                        </div>
                    )}
                </div>
            </div>

            <p className="text-xs text-gray-500 mt-4">{t("tests.walking.basedOn")}</p>
        </div>
    );

    const renderTestChair = () => (
        <div className="space-y-6">
            <p className="text-gray-700 bg-blue-50 p-4 rounded-lg border border-blue-100">{t("tests.chair.shows")}</p>
            
            <div>
                <h3 className="font-semibold text-lg mb-3">{t("tests.chair.howToTitle")}</h3>
                <ul className="space-y-3">
                    {t.raw("tests.chair.howToSteps").map((step: string, idx: number) => (
                        <li key={idx} className="flex items-start">
                            <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-gray-100 rounded-full text-sm font-medium mr-3 mt-0.5">{idx + 1}</span>
                            <span className="text-gray-700">{step}</span>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 mt-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t("tests.chair.genderLabel")}
                        </label>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setChairGender("male")}
                                className={`flex-1 py-2 px-3 border rounded-lg transition-colors ${chairGender === "male" ? "bg-blue-100 border-blue-500 text-blue-700 font-medium" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                            >
                                {t("tests.chair.genderMale")}
                            </button>
                            <button
                                onClick={() => setChairGender("female")}
                                className={`flex-1 py-2 px-3 border rounded-lg transition-colors ${chairGender === "female" ? "bg-blue-100 border-blue-500 text-blue-700 font-medium" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                            >
                                {t("tests.chair.genderFemale")}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t("tests.chair.ageLabel")}
                        </label>
                        <select
                            value={chairAge}
                            onChange={(e) => setChairAge(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        >
                            <option value="">{t("tests.chair.ageSelect")}</option>
                            {Object.keys(chairNorms.male).map(age => (
                                <option key={age} value={age}>{age}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t("tests.chair.inputLabel")}
                    </label>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <input 
                            type="number" 
                            min="0"
                            placeholder={t("tests.chair.placeholder")}
                            value={chairCount}
                            onChange={(e) => setChairCount(e.target.value)}
                            className="w-full sm:w-48 px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        {getChairZone() && (
                            <div className={`px-4 py-2 rounded-full font-medium text-sm border ${getChairZone() ? getZoneColor(getChairZone()) : ""}`}>
                                {getChairZone() && getZoneLabel(getChairZone())}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <p className="text-xs text-gray-500 mt-4">{t("tests.chair.basedOn")}</p>
        </div>
    );

    const renderTestBalance = () => (
        <div className="space-y-6">
            <p className="text-gray-700 bg-blue-50 p-4 rounded-lg border border-blue-100">{t("tests.balance.shows")}</p>
            
            <div>
                <h3 className="font-semibold text-lg mb-3">{t("tests.balance.howToTitle")}</h3>
                <ul className="space-y-3">
                    {t.raw("tests.balance.howToSteps").map((step: string, idx: number) => (
                        <li key={idx} className="flex items-start">
                            <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-gray-100 rounded-full text-sm font-medium mr-3 mt-0.5">{idx + 1}</span>
                            <span className="text-gray-700">{step}</span>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-4">
                    {t("tests.balance.inputLabel")}
                </label>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex gap-3 w-full sm:w-auto">
                        <button
                            onClick={() => setBalanceResult("yes")}
                            className={`flex-1 sm:flex-none py-3 px-8 border rounded-lg transition-colors ${balanceResult === "yes" ? "bg-green-100 border-green-500 text-green-700 font-medium" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                        >
                            {t("tests.balance.yes")}
                        </button>
                        <button
                            onClick={() => setBalanceResult("no")}
                            className={`flex-1 sm:flex-none py-3 px-8 border rounded-lg transition-colors ${balanceResult === "no" ? "bg-red-100 border-red-500 text-red-700 font-medium" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                        >
                            {t("tests.balance.no")}
                        </button>
                    </div>
                    {getBalanceZone() && (
                        <div className={`px-4 py-2 rounded-full font-medium text-sm border ${getZoneColor(getBalanceZone())}`}>
                            {getZoneLabel(getBalanceZone())}
                        </div>
                    )}
                </div>
            </div>

            <p className="text-xs text-gray-500 mt-4">{t("tests.balance.basedOn")}</p>
        </div>
    );

    const handleSave = async () => {
        setIsSaving(true);
        setSaveStatus("idle");
        
        try {
            let redCount = 0;
            let yellowCount = 0;
            let greenCount = 0;
            
            [getWalkingZone(), getChairZone(), getBalanceZone()].forEach(z => {
                if (z === "red") redCount++;
                if (z === "yellow") yellowCount++;
                if (z === "green") greenCount++;
            });
            
            const rawData = {
                walkingTime,
                chairGender,
                chairAge,
                chairCount,
                balanceResult,
                zones: {
                    walking: getWalkingZone(),
                    chair: getChairZone(),
                    balance: getBalanceZone()
                }
            };

            const res = await saveTestResult({
                test_id: "functional-bio-age",
                test_name: "4 проверки функционального возраста",
                value: String(redCount), 
                raw_data: JSON.stringify(rawData)
            });

            if (res.success) {
                setSaveStatus("success");
            } else {
                setSaveStatus("error");
                setSaveErrorString(res.error || "Unknown error");
            }
        } catch (error: any) {
            console.error("Save error:", error);
            setSaveStatus("error");
            setSaveErrorString(error.message || "Error occurred");
        } finally {
            setIsSaving(false);
        }
    };

    const renderResults = () => {
        const zones = {
            walking: getWalkingZone(),
            chair: getChairZone(),
            balance: getBalanceZone()
        };

        const hasAnyData = Object.values(zones).some(z => z !== null);

        return (
            <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
                <div className="text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 text-blue-600 mb-4">
                        <Activity className="w-8 h-8" />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">{t("resultTitle")}</h2>
                    {!hasAnyData && (
                        <p className="text-gray-500">Нет данных для анализа. Пройдите хотя бы одну проверку.</p>
                    )}
                </div>

                {hasAnyData && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="divide-y divide-gray-100">
                            {[
                                { id: "walking", title: t("tests.walking.title"), zone: zones.walking, val: walkingTime ? `${walkingTime} сек` : "Пропущено" },
                                { id: "chair", title: t("tests.chair.title"), zone: zones.chair, val: chairCount ? `${chairCount} раз` : "Пропущено" },
                                { id: "balance", title: t("tests.balance.title"), zone: zones.balance, val: balanceResult === "yes" ? t("tests.balance.yes") : balanceResult === "no" ? t("tests.balance.no") : "Пропущено" }
                            ].map((test, idx) => (
                                <div key={idx} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50 transition-colors">
                                    <div>
                                        <h3 className="font-medium text-gray-900">{test.title}</h3>
                                        <p className="text-sm text-gray-500">{test.val}</p>
                                    </div>
                                    <div>
                                        {test.zone ? (
                                            <div className={`px-4 py-1.5 rounded-full text-sm font-medium border ${getZoneColor(test.zone)}`}>
                                                {getZoneLabel(test.zone)}
                                            </div>
                                        ) : (
                                            <span className="text-sm text-gray-400">Нет данных</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row justify-center gap-4 pt-6">
                    <button
                        onClick={() => {
                            setWalkingTime("");
                            setChairCount("");
                            setBalanceResult(null);
                            setCurrentStep(-1);
                            setSaveStatus("idle");
                        }}
                        className="flex items-center justify-center space-x-2 px-6 py-3 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl font-medium transition-colors"
                    >
                        <RotateCcw className="w-5 h-5" />
                        <span>{t("restart")}</span>
                    </button>
                    
                    {isAuthenticated && hasAnyData && (
                        <button
                            onClick={handleSave}
                            disabled={isSaving || saveStatus === "success"}
                            className={`flex items-center justify-center space-x-2 px-8 py-3 rounded-xl font-medium transition-all ${
                                saveStatus === "success" 
                                    ? "bg-green-100 text-green-700 border border-green-200"
                                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md"
                            }`}
                        >
                            {isSaving ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : saveStatus === "success" ? (
                                <CheckCircle2 className="w-5 h-5" />
                            ) : (
                                <Save className="w-5 h-5" />
                            )}
                            <span>
                                {isSaving ? t("saving") : saveStatus === "success" ? t("saved") : t("saveBtn")}
                            </span>
                        </button>
                    )}
                </div>
                
                {saveStatus === "error" && (
                    <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-start space-x-3 text-sm mt-4">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <span>{saveErrorString}</span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50/50 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto">
                <Link 
                    href="/diagnostics"
                    className="inline-flex items-center space-x-2 text-gray-500 hover:text-gray-900 mb-8 transition-colors group"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    <span>{t("back")}</span>
                </Link>

                {currentStep === -1 ? (
                    renderIntro()
                ) : currentStep === 3 ? (
                    renderResults()
                ) : (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 animate-in slide-in-from-right-8 duration-300">
                        <div className="mb-8">
                            <div className="flex justify-between items-center mb-6">
                                <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                                    {t("stepText")} {currentStep + 1} {t("stepOf")} 3
                                </span>
                            </div>
                            
                            {/* Progress bar */}
                            <div className="flex gap-2 mb-8">
                                {[0, 1, 2].map((step) => (
                                    <div 
                                        key={step}
                                        className={`h-1.5 flex-1 rounded-full ${
                                            step <= currentStep ? "bg-blue-600" : "bg-gray-100"
                                        }`}
                                    />
                                ))}
                            </div>

                            <h2 className="text-2xl font-bold text-gray-900">
                                {currentStep === 0 && t("tests.walking.title")}
                                {currentStep === 1 && t("tests.chair.title")}
                                {currentStep === 2 && t("tests.balance.title")}
                            </h2>
                        </div>

                        {currentStep === 0 && renderTestWalking()}
                        {currentStep === 1 && renderTestChair()}
                        {currentStep === 2 && renderTestBalance()}

                        <div className="flex justify-between items-center pt-8 mt-8 border-t border-gray-100">
                            <button
                                onClick={() => setCurrentStep(prev => prev - 1)}
                                className="flex items-center space-x-2 text-gray-500 hover:text-gray-900 font-medium px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                <ChevronLeft className="w-5 h-5" />
                                <span>{t("backStep")}</span>
                            </button>
                            
                            <button
                                onClick={() => setCurrentStep(prev => prev + 1)}
                                className="flex items-center space-x-2 bg-gray-900 hover:bg-gray-800 text-white px-6 py-2.5 rounded-xl font-medium transition-colors"
                            >
                                <span>{currentStep === 2 ? t("resultTitle") : t("next")}</span>
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
