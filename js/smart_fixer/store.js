import { create } from 'zustand';

/**
 * js/smart_fixer/store.js
 * Source of truth for 3Dv2 Datatable and React Viewer.
 */

export const useSmartFixerStore = create((set, get) => ({
    components: [], // Parsed components
    visualGaps: [], // Array of visual gaps identified by solver
    isLoaded: false,
    selectedId: null,

    // PCF Builder Config & Logs
    pcfPrecision: 4, // default 4 for .4f, can be 1 for .1f
    pcfBuildLogs: [],

    // Set complete component list (from parsing PCF text)
    setComponents: (comps, gaps = []) => set({ components: comps, visualGaps: gaps, isLoaded: true }),

    setPcfPrecision: (precision) => set({ pcfPrecision: precision }),
    setPcfBuildLogs: (logs) => set({ pcfBuildLogs: logs }),

    // Update specific component (e.g. changing Fixing Action)
    updateComponent: (id, updates) => set(state => ({
        components: state.components.map(c => c.id === id ? { ...c, ...updates } : c)
    })),

    // Selection logic
    select: (id) => set({ selectedId: id }),
    deselect: () => set({ selectedId: null })
}));
