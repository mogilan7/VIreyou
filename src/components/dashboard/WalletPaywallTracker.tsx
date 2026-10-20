"use client";

import { useEffect } from "react";
import { trackPaywallView } from "@/lib/analytics";

export default function WalletPaywallTracker() {
    useEffect(() => {
        trackPaywallView('cabinet_wallet');
    }, []);

    return null;
}
