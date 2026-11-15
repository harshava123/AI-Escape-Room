const svg = (body) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ICONS = {
  door: svg('<rect x="5" y="2.5" width="11" height="19" rx="1"/><circle cx="13" cy="12" r="0.8"/><rect x="18" y="9" width="3" height="5" rx="0.6"/><path d="M19.5 10.5v2"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5"/><path d="M12 12l-3 2"/><path d="M12 3v1.5M21 12h-1.5M12 21v-1.5M3 12h1.5"/>'),
  poster: svg('<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M8 8h8M8 12h8M8 16h5"/><circle cx="12" cy="3" r="0.6"/>'),
  desk: svg('<path d="M2 9h20"/><path d="M4 9v11M20 9v11"/><rect x="12" y="11" width="7" height="4" rx="0.5"/><path d="M14.5 13h2"/>'),
  drawer: svg('<rect x="3" y="6" width="18" height="12" rx="1"/><path d="M9 12h6"/><rect x="16" y="8" width="3" height="3" rx="0.3"/>'),
  bookshelf: svg('<rect x="3" y="2.5" width="18" height="19" rx="1"/><path d="M3 9.5h18M3 16h18"/><path d="M6 4.5v4M8 5v3.5M10.5 4.5l1.5 4M6 11.5v4M9 12v3.5M15 11.5v4M17 12v3.5"/>'),
  terminal: svg('<rect x="2.5" y="3" width="19" height="13" rx="1.5"/><path d="M6 8l2.5 2L6 12M10.5 12h4"/><path d="M8 20h8M12 16v4"/>'),
  vent: svg('<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M6 9h12M6 12h12M6 15h12"/><circle cx="5" cy="7" r="0.4"/><circle cx="19" cy="17" r="0.4"/>'),
  plant: svg('<path d="M7 15h10l-1.5 6.5h-7z"/><path d="M12 15V9"/><path d="M12 11c-3 0-5-2-5-5 3 0 5 2 5 5z"/><path d="M12 9c0-3 2-5 5-5 0 3-2 5-5 5z"/>'),
  uv_flashlight: svg('<path d="M8 3h8l-1 5H9z"/><rect x="9" y="8" width="6" height="13" rx="1"/><path d="M12 12v3"/><path d="M5 2l-1.5-1M19 2l1.5-1M12 0.5V1"/>'),
  keycard: svg('<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 9h19"/><rect x="5" y="12" width="5" height="4" rx="0.5"/><path d="M13 13h5M13 15.5h3"/>'),
  rusty_key: svg('<circle cx="7" cy="12" r="4"/><path d="M11 12h10M17 12v3M20 12v2"/><circle cx="7" cy="12" r="1.2"/>'),
  sound_on: svg('<path d="M4 9h3l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>'),
  sound_off: svg('<path d="M4 9h3l5-4v14l-5-4H4z"/><path d="M16 9l5 6M21 9l-5 6"/>'),
  restart: svg('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v5h5"/>'),
};
