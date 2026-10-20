"use client";

import { useEffect } from "react";
import { trackPortalVisit } from "@/lib/analytics";

export default function AnalyticsTracker() {
    useEffect(() => {
        trackPortalVisit();
    }, []);

    return null;
}
