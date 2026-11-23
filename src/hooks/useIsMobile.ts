import { useState, useEffect } from 'react';

export const useIsMobile = (breakpoint: number = 992) => {
    const checkIsMobile = () => {
        if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
        const hasMobileWidth = window.innerWidth < breakpoint;
        // Phone user agents should stay mobile, but large tablets (>= 1024px) get desktop layout
        const hasPhoneUA = /Android.*Mobile|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent);
        return hasMobileWidth || (hasPhoneUA && window.innerWidth < 1024);
    };

    const [isMobile, setIsMobile] = useState(checkIsMobile);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        let timeoutId: number;
        const handleResize = () => {
            window.clearTimeout(timeoutId);
            timeoutId = window.setTimeout(() => {
                setIsMobile(checkIsMobile());
            }, 100);
        };

        handleResize();
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.clearTimeout(timeoutId);
        };
    }, [breakpoint]);

    return isMobile;
};
