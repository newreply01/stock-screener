import React, { createContext, useContext, useState, useEffect } from 'react';

// Create Context
const GlobalFilterContext = createContext();

// Session Storage Key
const STORAGE_KEY = 'muchstock_global_filters';

export function GlobalFilterProvider({ children }) {
    // Initial State (load from sessionStorage to preserve during refresh)
    const [globalFilters, setGlobalFilters] = useState(() => {
        try {
            const saved = sessionStorage.getItem(STORAGE_KEY);
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {
            console.warn('Could not restore global filters', e);
        }

        return {
            market: 'all',          // 'all', 'twse', 'tpex'
            industry: 'all',        // 'all' or specific industry
            stockTypes: ['stock']   // ['stock', 'etf'] 預設只有個股
        };
    });

    // Save to storage on change
    useEffect(() => {
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(globalFilters));
        } catch (e) {
            // Ignore write errors
        }
    }, [globalFilters]);

    // Updater Functions
    const setMarket = (market) => {
        setGlobalFilters(prev => ({ ...prev, market }));
    };

    const setIndustry = (industry) => {
        setGlobalFilters(prev => ({ ...prev, industry }));
    };

    const toggleStockType = (typeId) => {
        setGlobalFilters(prev => {
            const current = [...prev.stockTypes];
            if (current.includes(typeId)) {
                const next = current.filter(t => t !== typeId);
                return { ...prev, stockTypes: next.length === 0 ? ['stock'] : next }; // 防止全空
            } else {
                return { ...prev, stockTypes: [...current, typeId] };
            }
        });
    };

    // Check if a specific type is selected
    const hasStockType = (typeId) => {
        return globalFilters.stockTypes.includes(typeId);
    };

    // Derived values for API hooks
    const marketForApi = globalFilters.market === 'all' ? undefined : globalFilters.market;
    const industryForApi = globalFilters.industry === 'all' ? undefined : globalFilters.industry;
    const stockTypesForApi = globalFilters.stockTypes.join(',');

    const contextValue = {
        ...globalFilters,
        setMarket,
        setIndustry,
        toggleStockType,
        hasStockType,
        marketForApi,
        industryForApi,
        stockTypesForApi
    };

    return (
        <GlobalFilterContext.Provider value={contextValue}>
            {children}
        </GlobalFilterContext.Provider>
    );
}

// Custom Hook
export function useGlobalFilters() {
    const context = useContext(GlobalFilterContext);
    if (!context) {
        throw new Error('useGlobalFilters must be used within a GlobalFilterProvider');
    }
    return context;
}
